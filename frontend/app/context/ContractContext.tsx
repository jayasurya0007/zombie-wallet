// ContractContext.tsx
'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
} from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { ApolloClient, InMemoryCache, gql } from '@apollo/client';
import { fromBase64 } from '@mysten/bcs';
import { ZOMBIE_MODULE, ZOMBIE_WALLET_TYPE } from '@/config/constants';

export interface BeneficiaryData {
  allocation: string;
}

export interface ZombieWallet {
  id: string;
  owner: string;
  beneficiaries: Record<string, BeneficiaryData>;
  beneficiary_addrs: string[];
  coin: { balance: string };
}

  // Type assertion for field.name
export type DynamicFieldName = {
    type: string;
    value?: {
      type: string;
      fields?: {
        key?: Uint8Array | number[];
      };
    };
  };

interface ContractContextType {
  isConnected: boolean;
  wallets: ZombieWallet[];
  isLoading: boolean;
  createWallet: () => Promise<void>;
  addBeneficiary: (
    walletId: string,
    beneficiary: string,
    allocation: number,
    depositCoinId: string
  ) => Promise<void>;
  withdraw: (walletId: string, beneficiary: string) => Promise<void>;
  executeTransfer: (walletId: string) => Promise<void>;
  claimAllocation: (walletId: string) => Promise<void>;
  fetchWallets: () => Promise<ZombieWallet[]>;
  getCoins: () => Promise<{ coinObjectId: string, balance: string }[]>;
  getBeneficiaryData: (
    walletId: string, 
    beneficiary: string
  ) => Promise<BeneficiaryData | null>;
}

const ContractContext = createContext<ContractContextType>({} as ContractContextType);

// Apollo Client
const apolloClient = new ApolloClient({
  uri: 'https://sui-testnet.mystenlabs.com/graphql',
  cache: new InMemoryCache(),
});

// Helper function to convert byte array to address
const convertByteArrayToAddress = (bytes: Uint8Array | number[]): string => {
  const byteArray = Array.isArray(bytes) ? bytes : Array.from(bytes);
  return '0x' + byteArray
    .slice(0, 32)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

// Parse BCS beneficiary data (allocation)
const parseBeneficiaryData = (bcsData: string): BeneficiaryData => {
  const bytes = fromBase64(bcsData);
  const view = new DataView(bytes.buffer);
  return {
    allocation: view.getBigUint64(0, true).toString(),
  };
};

export function ContractProvider({ children }: { children: React.ReactNode }) {
  const currentAccount = useCurrentAccount();
  const { mutateAsync: signAndExecuteTransactionBlock } = useSignAndExecuteTransaction();
  const provider = useSuiClient();
  const [wallets, setWallets] = useState<ZombieWallet[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const getCoins = async () => {
    if (!currentAccount?.address) return [];
    const res = await provider.getCoins({
      owner: currentAccount.address,
      coinType: '0x2::sui::SUI',
    });
    return res.data.map((coin: any) => ({
      coinObjectId: coin.coinObjectId,
      balance: coin.balance,
    }));
  };

  useEffect(() => {
    if (currentAccount?.address) {
      fetchWallets();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAccount?.address]);

  const FETCH_ALL_ZOMBIE_WALLETS = gql`
    query GetAllZombieWallets($cursor: String) {
      objects(
        filter: { 
          type: "${ZOMBIE_WALLET_TYPE}"
        }
        first: 20
        after: $cursor
      ) {
        nodes {
          address
          owner {
            __typename
            ... on Shared {
              initialSharedVersion
            }
          }
          asMoveObject {
            contents {
              type { repr }
              json
            }
          }
        }
        pageInfo {
          endCursor
          hasNextPage
        }
      }
    }
  `;

  const fetchWallets = async () => {
    if (!currentAccount?.address) return [];
    setIsLoading(true);
    try {
      const response = await apolloClient.query({
        query: FETCH_ALL_ZOMBIE_WALLETS,
        variables: { cursor: null },
        fetchPolicy: 'network-only' // Bypass cache
      });

      const filteredWallets = response.data.objects.nodes
        .filter((node: any) => 
          node.asMoveObject.contents.json.owner === currentAccount.address
        )
        .map((node: any) => ({
          id: node.address,
          owner: node.asMoveObject.contents.json.owner,
          beneficiary_addrs: node.asMoveObject.contents.json.beneficiary_addrs,
          coin: { balance: node.asMoveObject.contents.json.coin.value },
          beneficiaries: {}
        }));

      setWallets(filteredWallets);
      return filteredWallets; // Return the fetched wallets
    } catch (error) {
      console.error("Failed to fetch wallets:", error);
      setWallets([]);
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const createWallet = async () => {
    if (!currentAccount?.address) throw new Error("No connected account");
    const tx = new Transaction();
    tx.moveCall({
      target: `${ZOMBIE_MODULE}::zombie::create_wallet`,
      arguments: [],
    });
    
    // Execute transaction and wait for confirmation
    const result = await signAndExecuteTransactionBlock({ 
      transaction: tx,
    });
    
    // Wait for transaction finality
    await provider.waitForTransaction({
      digest: result.digest,
      timeout: 30 * 1000,
      pollInterval: 2 * 1000
    });
    
    // Force refresh wallets
    await fetchWallets();
  };

  const addBeneficiary = async (
    walletId: string,
    beneficiary: string,
    allocation: number,
    depositCoinId: string
  ) => {
    if (!currentAccount?.address) throw new Error("No connected account");
    const allocationMist = Math.round(allocation * 1e9);
    const tx = new Transaction();
    const [depositCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(allocationMist)]);
    tx.setGasBudget(20000000); // 0.2 SUI
    tx.moveCall({
      target: `${ZOMBIE_MODULE}::zombie::add_beneficiary`,
      arguments: [
        tx.object(walletId),
        tx.pure.address(beneficiary),
        tx.pure.u64(allocationMist),
        depositCoin,
      ],
    });
    try {
      await signAndExecuteTransactionBlock({ transaction: tx });
      await fetchWallets();
    } catch (error) {
      console.error("Transaction failed:", error);
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`Transaction failed: ${message}`);
    }
  };

  const withdraw = async (walletId: string, beneficiary: string): Promise<void> => {
    if (!currentAccount?.address) throw new Error("No connected account");
    try {
      const { data: walletData } = await provider.getObject({
        id: walletId,
        options: { showContent: false }
      });
      if (!walletData) throw new Error("Wallet not found");
      const tx = new Transaction();
      tx.setGasBudget(20000000);
      tx.moveCall({
        target: `${ZOMBIE_MODULE}::zombie::withdraw`,
        arguments: [
          tx.object(walletId),
          tx.pure.address(beneficiary)
        ]
      });
      const { digest } = await signAndExecuteTransactionBlock({
        transaction: tx
      });
      await provider.waitForTransaction({
        digest,
        timeout: 30 * 1000,
        pollInterval: 2 * 1000
      });
      await fetchWallets();
    } catch (error) {
      console.error("Withdrawal failed:", error);
      throw new Error(`Withdrawal failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const executeTransfer = async (walletId: string) => {
    try {
      const walletData = await provider.getObject({
        id: walletId,
        options: { showContent: false }
      });
      if (!walletData.data) {
        throw new Error("Wallet not found");
      }
      const tx = new Transaction();
      tx.setGasBudget(200000000);
      tx.moveCall({
        target: `${ZOMBIE_MODULE}::zombie::execute_transfer`,
        arguments: [tx.object(walletId)]
      });
      const { digest } = await signAndExecuteTransactionBlock({
        transaction: tx
      });
      await provider.waitForTransaction({
        digest,
        timeout: 30 * 1000,
        pollInterval: 2 * 1000
      });
      await fetchWallets();
    } catch (error) {
      console.error("Execute Transfer Failed:", error);
      throw new Error(
        `Failed to execute transfer: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  };

  const claimAllocation = async (walletId: string) => {
    const tx = new Transaction();
    tx.moveCall({
      target: `${ZOMBIE_MODULE}::zombie::claim_allocation`,
      arguments: [tx.object(walletId)],
    });
    await signAndExecuteTransactionBlock({ transaction: tx });
    await fetchWallets();
  };

  const getBeneficiaryData = async (
    walletId: string,
    beneficiaryAddr: string
  ): Promise<BeneficiaryData | null> => {
    try {
      const dynamicFields = await provider.getDynamicFields({
        parentId: walletId,
      });
      for (const field of dynamicFields.data) {
        const fieldName = field.name as DynamicFieldName;
        if (
          fieldName.value?.type === 'Address' &&
          fieldName.value.fields?.key
        ) {
          const addressBytes = Array.from(fieldName.value.fields.key);
          const address = convertByteArrayToAddress(addressBytes);
          if (address === beneficiaryAddr) {
            const fieldObj = await provider.getDynamicFieldObject({
              parentId: walletId,
              name: field.name
            });
            const bcsData = (fieldObj.data?.content as any)?.bcs?.bcsBytes;
            if (typeof bcsData === 'string') {
              return parseBeneficiaryData(bcsData);
            }
          }
        }
      }
      return null;
    } catch (error) {
      console.error("Failed to get beneficiary data:", error);
      return null;
    }
  };

  return (
    <ContractContext.Provider
      value={{
        isConnected: !!currentAccount,
        wallets,
        isLoading,
        createWallet,
        addBeneficiary,
        withdraw,
        executeTransfer,
        claimAllocation,
        fetchWallets,
        getCoins,
        getBeneficiaryData,
      }}
    >
      {children}
    </ContractContext.Provider>
  );
}

export const useContract = () => useContext(ContractContext);

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

// Initialize Apollo Client
const apolloClient = new ApolloClient({
  uri: 'https://sui-testnet.mystenlabs.com/graphql',
  cache: new InMemoryCache(),
});

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
  withdraw: (walletId: string, amount: number) => Promise<void>;
  executeTransfer: (walletId: string) => Promise<void>;
  claimAllocation: (walletId: string) => Promise<void>;
  fetchWallets: () => Promise<void>;
  fetchWalletsGraphQL: () => Promise<ZombieWallet[]>;
  fetchWalletDetailsGraphQL: (walletId: string) => Promise<ZombieWallet | null>;
  getCoins: () => Promise<{ coinObjectId: string, balance: string }[]>;
  getBeneficiaryAddrs: (walletId: string) => Promise<string[]>;
  getBeneficiaryData: (
    walletId: string, 
    beneficiary: string
  ) => Promise<BeneficiaryData | null>;
}

const ContractContext = createContext<ContractContextType>({} as ContractContextType);

export function ContractProvider({ children }: { children: React.ReactNode }) {
  const currentAccount = useCurrentAccount();
  const { mutateAsync: signAndExecuteTransactionBlock } = useSignAndExecuteTransaction();
  const provider = useSuiClient();
  const [wallets, setWallets] = useState<ZombieWallet[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Helper function to convert byte array to address
  const convertByteArrayToAddress = (bytes: Uint8Array | number[]): string => {
  const byteArray = Array.isArray(bytes) ? bytes : Array.from(bytes);
  return '0x' + byteArray
    .slice(0, 32)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

  // Simplified beneficiary data parser
  const parseBeneficiaryData = (bcsData: string): BeneficiaryData => {
    const bytes = fromBase64(bcsData);
    const view = new DataView(bytes.buffer);
    return {
      allocation: view.getBigUint64(0, true).toString(),
    };
  };

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
  }, [currentAccount?.address]);

  const fetchWallets = async () => {
  if (!currentAccount?.address) return;
  
  setIsLoading(true);
  try {
    const response = await provider.getOwnedObjects({
      owner: currentAccount.address,
      filter: { StructType: ZOMBIE_WALLET_TYPE },
      options: { showContent: true },
    });

    const wallets = await Promise.all(
      response.data.map(async (obj: any) => {
        const content = obj.data?.content;
        if (!content || content.dataType !== 'moveObject') return null;

        // Safe field access with fallbacks
        return {
          id: obj.data.objectId,
          owner: content.fields.owner || '',
          beneficiaries: {},
          beneficiary_addrs: (content.fields.beneficiary_addrs || []).map(
            (addr: any) => convertByteArrayToAddress(addr)
          ),
          coin: { 
            balance: content.fields.coin?.value || '0' // Updated path
          }
        };
      })
    );

    setWallets(wallets.filter(Boolean) as ZombieWallet[]);
  } catch (error) {
    console.error("Failed to fetch wallets:", error);
    setWallets([]);
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
    await signAndExecuteTransactionBlock({ transaction: tx });
    await fetchWallets();
  };

  const addBeneficiary = async (
  walletId: string,
  beneficiary: string,
  allocation: number,
  depositCoinId: string
) => {
  if (!currentAccount?.address) throw new Error("No connected account");

  const tx = new Transaction();
  
  // 1. Prepare the deposit coin explicitly
  const depositCoin = tx.object(depositCoinId);
  
  // 2. Set proper gas handling
  tx.moveCall({
    target: `${ZOMBIE_MODULE}::zombie::add_beneficiary`,
    arguments: [
      tx.object(walletId),
      tx.pure.address(beneficiary),
      tx.pure.u64(allocation * 1e9), // Convert to MIST
      depositCoin,
    ],
  });

  // 3. Set reasonable gas budget (0.05 SUI)
  tx.setGasBudget(50_000_000);

  try {
    await signAndExecuteTransactionBlock({
      transaction: tx,
    });
    await fetchWallets();
  } catch (error) {
    console.error("Transaction failed:", error);
    throw new Error(`Transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

  const withdraw = async (walletId: string, amount: number) => {
    const tx = new Transaction();
    const amountMist = Math.round(amount * 1e9);
    
    tx.moveCall({
      target: `${ZOMBIE_MODULE}::zombie::withdraw`,
      arguments: [
        tx.object(walletId),
        tx.pure.u64(amountMist),
      ],
    });
    await signAndExecuteTransactionBlock({ transaction: tx });
    await fetchWallets();
  };

  const executeTransfer = async (walletId: string) => {
    const tx = new Transaction();
    tx.moveCall({
      target: `${ZOMBIE_MODULE}::zombie::execute_transfer`,
      arguments: [tx.object(walletId)],
    });
    await signAndExecuteTransactionBlock({ transaction: tx });
    await fetchWallets();
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

  const getBeneficiaryAddrs = async (walletId: string): Promise<string[]> => {
    try {
      const wallet = await provider.getObject({
        id: walletId,
        options: { showContent: true }
      });
      
      return (wallet.data?.content as any)?.fields.beneficiary_addrs
        .map((addr: any) => convertByteArrayToAddress(addr)) || [];
    } catch (error) {
      console.error("Failed to get beneficiary addresses:", error);
      return [];
    }
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
      // Add type assertion for the field name structure
      const fieldName = field.name as {
        type: string;
        value?: {
          type: string;
          fields?: {
            key?: Uint8Array | number[];
          };
        };
      };

      // Check for SuiAddress type and extract bytes
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

          // Add type guard for BCS data
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
        fetchWalletsGraphQL: async () => [], // Implement as needed
        fetchWalletDetailsGraphQL: async () => null, // Implement as needed
        getCoins,
        getBeneficiaryAddrs,
        getBeneficiaryData,
      }}
    >
      {children}
    </ContractContext.Provider>
  );
}

export const useContract = () => useContext(ContractContext);
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
import { ZOMBIE_MODULE, REGISTRY_TYPE, ZOMBIE_WALLET_TYPE } from '@/config/constants';

// Initialize Apollo Client
const apolloClient = new ApolloClient({
  uri: 'https://sui-testnet.mystenlabs.com/graphql',
  cache: new InMemoryCache(),
});

export interface BeneficiaryData {
  last_checkin: string;
  threshold: string;
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
  registry: any | null;
  wallets: ZombieWallet[];
  isLoading: boolean;
  createRegistry: () => Promise<void>;
  createWallet: (registryId: string) => Promise<void>;
  addBeneficiary: (
    walletId: string,
    beneficiary: string,
    allocation: number,
    duration: number,
    timeUnit: number
  ) => Promise<void>;
  withdraw: (walletId: string, amount: number) => Promise<void>;
  executeTransfer: (walletId: string) => Promise<void>;
  fetchRegistry: () => Promise<void>;
  fetchWallets: () => Promise<void>;
  fetchWalletsGraphQL: () => Promise<ZombieWallet[]>;
  fetchWalletDetailsGraphQL: (walletId: string) => Promise<ZombieWallet | null>;
  getCoins: () => Promise<{ coinObjectId: string, balance: string }[]>;
  checkin: (walletId: string, beneficiary: string) => Promise<void>;
  get_beneficiary_addrs: (walletId: string) => Promise<string[]>;
  get_beneficiary_data: (
    walletId: string, 
    beneficiary: string
  ) => Promise<BeneficiaryData | null>;
}

const ContractContext = createContext<ContractContextType>({} as ContractContextType);

export function ContractProvider({ children }: { children: React.ReactNode }) {
  const currentAccount = useCurrentAccount();
  const { mutateAsync: signAndExecuteTransactionBlock } = useSignAndExecuteTransaction();
  const provider = useSuiClient();
  const [registry, setRegistry] = useState<any | null>(null);
  const [wallets, setWallets] = useState<ZombieWallet[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Helper function to convert byte array to address
  const convertByteArrayToAddress = (bytes: number[]): string => {
    return '0x' + bytes.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  // Helper function to parse beneficiary data from BCS
  const parseBeneficiaryData = (bcsData: string): BeneficiaryData => {
    const bytes = fromBase64(bcsData);
    const view = new DataView(bytes.buffer);
    
    return {
      last_checkin: view.getBigUint64(0, true).toString(),
      threshold: view.getBigUint64(8, true).toString(),
      allocation: view.getBigUint64(16, true).toString(),
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
      fetchRegistry();
      fetchWallets();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAccount?.address]);

  const fetchRegistry = async () => {
    if (!currentAccount?.address) return;
    setIsLoading(true);
    try {
      const response = await provider.getOwnedObjects({
        owner: currentAccount.address,
        filter: { StructType: REGISTRY_TYPE },
        options: { showContent: true },
      });
      setRegistry(response.data[0]?.data || null);
    } catch (error) {
      console.error("Failed to fetch registry:", error);
      setRegistry(null);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchWallets = async () => {
  if (!currentAccount?.address || !provider) return;
  
  setIsLoading(true);
  try {
    const response = await provider.getOwnedObjects({
      owner: currentAccount.address,
      filter: { StructType: ZOMBIE_WALLET_TYPE },
      options: { showContent: true, showType: true },
    });

    const walletsWithBeneficiaries = await Promise.all(
      response.data.map(async (obj: any) => {
        try {
          const walletContent = obj.data?.content;
          if (!walletContent || walletContent.dataType !== 'moveObject') return null;

          const baseWallet = {
            id: obj.data.objectId,
            owner: (walletContent.fields as { owner: string }).owner,
            beneficiaries: {} as Record<string, BeneficiaryData>,
            beneficiary_addrs: [] as string[],
            coin: { 
              balance: (walletContent.fields as { coin: { fields: { balance: string } }}).coin.fields?.balance 
            }
          };

          // Handle dynamic fields with pagination
          let cursor: string | null = null;
          let hasNextPage = true;
          
          while (hasNextPage) {
            const dynamicFieldsResponse = await provider.getDynamicFields({
              parentId: obj.data.objectId,
              cursor,
            });

            // Process current page of fields
            await Promise.all(
              dynamicFieldsResponse.data.map(async (field) => {
                try {
                  const fieldData = await provider.getDynamicFieldObject({
                    parentId: obj.data.objectId,
                    name: field.name,
                  });

                  if (fieldData.data?.content?.dataType === 'moveObject' && 
                      fieldData.data.content.type === `${ZOMBIE_MODULE}::zombie::BeneficiaryData`) {
                    const address = (field.name as any).value?.fields?.key;
                    const dataFields = fieldData.data.content.fields as {
                      last_checkin: string;
                      threshold: string;
                      allocation: string;
                    };

                    if (address && dataFields) {
                      baseWallet.beneficiaries[address] = {
                        last_checkin: dataFields.last_checkin,
                        threshold: dataFields.threshold,
                        allocation: dataFields.allocation
                      };
                      baseWallet.beneficiary_addrs.push(address);
                    }
                  }
                } catch (error) {
                  console.error('Error processing dynamic field:', error);
                }
              })
            );

            cursor = dynamicFieldsResponse.nextCursor;
            hasNextPage = dynamicFieldsResponse.hasNextPage;
          }

          return baseWallet;
        } catch (error) {
          console.error('Error processing wallet:', error);
          return null;
        }
      })
    );

    setWallets(walletsWithBeneficiaries.filter(Boolean) as ZombieWallet[]);
  } catch (error) {
    console.error("Failed to fetch wallets:", error);
    setWallets([]);
  } finally {
    setIsLoading(false);
  }
};
  const fetchWalletsGraphQL = async (): Promise<ZombieWallet[]> => {
    if (!currentAccount?.address) return [];
    
    const GET_WALLETS = gql`
      query GetWallets($owner: SuiAddress!) {
        objects(
          filter: {
            owner: $owner
            type: "${ZOMBIE_WALLET_TYPE}"
          }
          first: 10
        ) {
          nodes {
            address
            asMoveObject {
              contents {
                data
              }
              dynamicFields(first: 10) {
                nodes {
                  name {
                    bcs
                  }
                  value {
                    ... on MoveValue {
                      type {
                        repr
                      }
                      bcs
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    try {
      const { data } = await apolloClient.query({
        query: GET_WALLETS,
        variables: { owner: currentAccount.address },
      });

      return data.objects.nodes.map((node: any) => {
        const content = node.asMoveObject.contents.data.Struct;
        
        // Extract owner
        const ownerField = content.find((f: any) => f.name === "owner");
        const owner = convertByteArrayToAddress(ownerField.value.Address);
        
        // Extract coin balance
        const coinField = content.find((f: any) => f.name === "coin");
        const balance = coinField.value.Struct[0].value.Number;

        // Extract beneficiary addresses
        const beneficiaryAddrsField = content.find((f: any) => f.name === "beneficiary_addrs");
        const beneficiary_addrs = beneficiaryAddrsField.value.Vector.map((v: any) => 
          convertByteArrayToAddress(v.Address)
        );

        // Process dynamic fields (beneficiaries)
        const beneficiaries: Record<string, BeneficiaryData> = {};
        
        node.asMoveObject.dynamicFields.nodes.forEach((field: any) => {
          try {
            const nameBytes = fromBase64(field.name.bcs);
            const nameView = new DataView(nameBytes.buffer);
            const addressBytes = new Uint8Array(nameBytes.slice(0, 32));
            const address = convertByteArrayToAddress(Array.from(addressBytes));
            
            const data = parseBeneficiaryData(field.value.bcs);
            beneficiaries[address] = data;
          } catch (error) {
            console.error("Error parsing beneficiary field:", error);
          }
        });

        return {
          id: node.address,
          owner,
          beneficiaries,
          beneficiary_addrs,
          coin: { balance },
        };
      });
    } catch (error) {
      console.error("GraphQL query failed:", error);
      return [];
    }
  };

  const fetchWalletDetailsGraphQL = async (walletId: string): Promise<ZombieWallet | null> => {
    const GET_WALLET_DETAILS = gql`
      query GetWalletDetails($walletId: SuiAddress!) {
        object(address: $walletId) {
          address
          asMoveObject {
            contents {
              data
            }
            dynamicFields(first: 10) {
              nodes {
                name {
                  bcs
                }
                value {
                  ... on MoveValue {
                    type {
                      repr
                    }
                    bcs
                  }
                }
              }
            }
          }
        }
      }
    `;

    try {
      const { data } = await apolloClient.query({
        query: GET_WALLET_DETAILS,
        variables: { walletId },
      });

      if (!data.object) return null;
      
      const content = data.object.asMoveObject.contents.data.Struct;
      
      // Extract owner
      const ownerField = content.find((f: any) => f.name === "owner");
      const owner = convertByteArrayToAddress(ownerField.value.Address);
      
      // Extract coin balance
      const coinField = content.find((f: any) => f.name === "coin");
      const balance = coinField.value.Struct[0].value.Number;

      // Extract beneficiary addresses
      const beneficiaryAddrsField = content.find((f: any) => f.name === "beneficiary_addrs");
      const beneficiary_addrs = beneficiaryAddrsField.value.Vector.map((v: any) => 
        convertByteArrayToAddress(v.Address)
      );

      // Process dynamic fields (beneficiaries)
      const beneficiaries: Record<string, BeneficiaryData> = {};
      
      data.object.asMoveObject.dynamicFields.nodes.forEach((field: any) => {
        try {
          const nameBytes = fromBase64(field.name.bcs);
          const nameView = new DataView(nameBytes.buffer);
          const addressBytes = new Uint8Array(nameBytes.slice(0, 32));
          const address = convertByteArrayToAddress(Array.from(addressBytes));
          
          const data = parseBeneficiaryData(field.value.bcs);
          beneficiaries[address] = data;
        } catch (error) {
          console.error("Error parsing beneficiary field:", error);
        }
      });

      return {
        id: data.object.address,
        owner,
        beneficiaries,
        beneficiary_addrs,
        coin: { balance },
      };
    } catch (error) {
      console.error("GraphQL query failed:", error);
      return null;
    }
  };

  const createRegistry = async () => {
    if (!currentAccount?.address) throw new Error("No connected account");
    const tx = new Transaction();
    tx.moveCall({
      target: `${ZOMBIE_MODULE}::zombie::create_registry`,
      arguments: [],
    });
    await signAndExecuteTransactionBlock({
      transaction: tx,
    });
    await fetchRegistry();
  };

  const createWallet = async (registryId: string) => {
    if (!currentAccount?.address) throw new Error("No connected account");
    const tx = new Transaction();
    tx.moveCall({
      target: `${ZOMBIE_MODULE}::zombie::create_wallet`,
      arguments: [
        tx.object(registryId),
      ],
    });
    await signAndExecuteTransactionBlock({
      transaction: tx,
    });
    await fetchWallets();
  };

  const addBeneficiary = async (
    walletId: string,
    beneficiary: string,
    allocation: number,
    duration: number,
    timeUnit: number
  ) => {
    if (!currentAccount?.address) throw new Error("No connected account");

    // Convert SUI to MIST (1 SUI = 1e9 MIST)
    const allocationMist = Math.round(allocation * 1e9);
    
    const tx = new Transaction();

    // Correct method name and syntax for splitting coins
    const [depositCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(allocationMist)]);

    // Set explicit gas budget (0.2 SUI)
    tx.setGasBudget(20000000); // 200 million MIST = 0.2 SUI

    tx.moveCall({
      target: `${ZOMBIE_MODULE}::zombie::add_beneficiary`,
      arguments: [
        tx.object(walletId),
        tx.pure.address(beneficiary),
        tx.pure.u64(allocationMist),
        tx.pure.u64(duration),
        tx.pure.u8(timeUnit),
        depositCoin,
        tx.object('0x6'), // Clock object
      ],
    });

    try {
      await signAndExecuteTransactionBlock({
        transaction: tx,
      });
      await fetchWallets();
    } catch (error) {
      console.error("Transaction failed:", error);
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`Transaction failed: ${message}`);
    }
  };

  const withdraw = async (walletId: string, amount: number) => {
    const tx = new Transaction();
    tx.moveCall({
      target: `${ZOMBIE_MODULE}::zombie::withdraw`,
      arguments: [
        tx.object(walletId),
        tx.pure.u64(amount * 1e9), // Convert SUI to MIST
      ],
    });
    await signAndExecuteTransactionBlock({ transaction: tx });
    await fetchWallets();
  };

  const executeTransfer = async (walletId: string) => {
    const tx = new Transaction();
    tx.moveCall({
      target: `${ZOMBIE_MODULE}::zombie::execute_transfer`,
      arguments: [
        tx.object(walletId),
        tx.object('0x6'), // Clock object
      ],
    });
    await signAndExecuteTransactionBlock({ transaction: tx });
    await fetchWallets();
  };

  const get_beneficiary_addrs = async (walletId: string): Promise<string[]> => {
  const GET_BENEFICIARY_ADDRS = gql`
    query GetWalletBeneficiaryAddrs($walletId: SuiAddress!) {
      object(address: $walletId) {
        asMoveObject {
          contents {
            data
          }
        }
      }
    }
  `;

  try {
    const { data } = await apolloClient.query({
      query: GET_BENEFICIARY_ADDRS,
      variables: { walletId },
    });

    if (!data.object?.asMoveObject?.contents?.data?.Struct) return [];

    const content = data.object.asMoveObject.contents.data.Struct;
    const beneficiaryAddrsField = content.find((f: any) => f.name === "beneficiary_addrs");
    if (!beneficiaryAddrsField) return [];

    // Convert byte arrays to addresses
    return beneficiaryAddrsField.value.Vector.map((v: any) =>
      convertByteArrayToAddress(v.Address)
    );
  } catch (error) {
    console.error("GraphQL get_beneficiary_addrs failed:", error);
    return [];
  }
};

  const get_beneficiary_data = async (
  walletId: string,
  beneficiary: string
): Promise<BeneficiaryData | null> => {
  const GET_BENEFICIARY_DATA = gql`
    query GetWalletBeneficiaryData($walletId: SuiAddress!) {
      object(address: $walletId) {
        asMoveObject {
          dynamicFields(first: 50) {
            nodes {
              name {
                bcs
              }
              value {
                ... on MoveValue {
                  type {
                    repr
                  }
                  bcs
                }
              }
            }
          }
        }
      }
    }
  `;

  try {
    const { data } = await apolloClient.query({
      query: GET_BENEFICIARY_DATA,
      variables: { walletId },
    });

    const dynamicFields = data.object?.asMoveObject?.dynamicFields?.nodes || [];
    for (const field of dynamicFields) {
      // Extract address from field name (first 32 bytes)
      const nameBytes = fromBase64(field.name.bcs);
      const addressBytes = Array.from(new Uint8Array(nameBytes.slice(0, 32)));
      const address = convertByteArrayToAddress(addressBytes);

      if (address.toLowerCase() === beneficiary.toLowerCase()) {
        return parseBeneficiaryData(field.value.bcs);
      }
    }
    return null;
  } catch (error) {
    console.error("GraphQL get_beneficiary_data failed:", error);
    return null;
  }
};


  const checkin = async (walletId: string, beneficiary: string) => {
      const tx = new Transaction();
      tx.moveCall({
        target: `${ZOMBIE_MODULE}::zombie::checkin`,
        arguments: [
          tx.object(walletId),
          tx.pure.address(beneficiary),
          tx.object('0x6'), // Clock object
        ],
      });
      await signAndExecuteTransactionBlock({ transaction: tx });
      await fetchWallets();
    };


  return (
    <ContractContext.Provider
      value={{
        isConnected: !!currentAccount,
        registry,
        wallets,
        isLoading,
        createRegistry,
        createWallet,
        addBeneficiary,
        withdraw,
        executeTransfer,
        fetchRegistry,
        fetchWallets,
        fetchWalletsGraphQL,
        fetchWalletDetailsGraphQL,
        getCoins,
        checkin,
        get_beneficiary_addrs,
        get_beneficiary_data,
      }}
    >
      {children}
    </ContractContext.Provider>
  );
}

export const useContract = () => {
  const context = useContext(ContractContext);
  if (!context) {
    throw new Error('useContract must be used within a ContractProvider');
  }
  return context;
};
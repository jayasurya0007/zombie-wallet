import { createContext, useContext, useEffect, useState } from 'react';
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient
} from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { ZOMBIE_MODULE, REGISTRY_TYPE, ZOMBIE_WALLET_TYPE } from '@/config/constants';

interface ContractContextType {
  isConnected: boolean;
  registries: any[];
  wallets: any[];
  isLoading: boolean;
  createRegistry: () => Promise<void>;
  createWallet: (
    coinId: string,
    duration: number,
    timeUnit: number,
    beneficiaries: string[],
    allocations: number[],
    zkCommitment: string
  ) => Promise<void>;
  checkIn: (
    walletId: string,
    newCommitment: string,
    zkProof: string
  ) => Promise<void>;
  withdraw: (walletId: string, amount: number) => Promise<void>;
  executeTransfer: (
    registryId: string,
    walletId: string,
    zkProof: string
  ) => Promise<void>;
  updateThreshold: (
    walletId: string,
    newDuration: number,
    timeUnit: number
  ) => Promise<void>;
  fetchRegistries: () => Promise<void>;
  fetchWallets: () => Promise<void>;
}

const ContractContext = createContext<ContractContextType>({} as ContractContextType);

export function ContractProvider({ children }: { children: React.ReactNode }) {
  const currentAccount = useCurrentAccount();
  const { mutateAsync: signAndExecuteTransactionBlock } = useSignAndExecuteTransaction();
  const provider = useSuiClient();
  const [registries, setRegistries] = useState<any[]>([]);
  const [wallets, setWallets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  
  useEffect(() => {
    if (currentAccount?.address) {
      fetchRegistries();
      fetchWallets();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAccount?.address]);

  const fetchRegistries = async () => {
    if (!currentAccount?.address) return;
    setIsLoading(true);
    try {
      const response = await provider.getOwnedObjects({
        owner: currentAccount.address,
        filter: { StructType: REGISTRY_TYPE },
        options: { showContent: true },
      });
      setRegistries(response.data.map((obj: any) => obj.data!));
    } finally {
      setIsLoading(false);
    }
  };

  const fetchWallets = async () => {
    if (!currentAccount?.address) return;
    setIsLoading(true);
    try {
      const response = await provider.getOwnedObjects({
        owner: currentAccount.address,
        filter: { StructType: ZOMBIE_WALLET_TYPE },
        options: { showContent: true },
      });
      setWallets(response.data.map((obj: any) => obj.data!));
    } finally {
      setIsLoading(false);
    }
  };

  const createRegistry = async () => {
    const tx = new Transaction();
    tx.moveCall({
      target: `${ZOMBIE_MODULE}::zombie::create_registry`,
      arguments: [],
    });

    await signAndExecuteTransactionBlock({
      transaction: tx,
      chain: 'sui:testnet',
    });
    await fetchRegistries();
  };

  const createWallet = async (
    coinId: string,
    duration: number,
    timeUnit: number,
    beneficiaries: string[],
    allocations: number[],
    zkCommitment: string
  ) => {
    if (!registries.length) throw new Error("Create a registry first");
    
    try {
      const tx = new Transaction();
      const coin = tx.object(coinId);
      const total = allocations
        .map((x) => Number(x))
        .reduce((a, b) => a + b, 0);

      const [primaryCoin] = tx.splitCoins(coin, [BigInt(total)]);


    tx.moveCall({
      target: `${ZOMBIE_MODULE}::zombie::create_wallet`,
      arguments: [
        tx.object(registries[0].objectId),
        primaryCoin,
        tx.pure.u64(duration),
        tx.pure.u8(timeUnit),
        tx.pure.vector('address',beneficiaries),
        tx.pure.vector('u64', allocations),
        tx.pure(new Uint8Array(Buffer.from(zkCommitment))),
        tx.object('0x6'),
      ],
    });
        

    await signAndExecuteTransactionBlock({
      transaction: tx,
      chain: 'sui:testnet',
    });
    await fetchWallets();
    } catch (error) {
      console.error('Create wallet failed:', error);
      throw error; // Re-throw for UI handling
    }
  };

  const checkIn = async (
    walletId: string,
    newCommitment: string,
    zkProof: string
  ) => {
    const tx = new Transaction();
    tx.moveCall({
      target: `${ZOMBIE_MODULE}::zombie::check_in`,
      arguments: [
        tx.object(walletId),
        tx.pure(new Uint8Array(Buffer.from(newCommitment, 'hex'))),
        tx.pure(new Uint8Array(Buffer.from(zkProof, 'hex'))),
        tx.object('0x6'),
      ],
    });

    await signAndExecuteTransactionBlock({
      transaction: tx,
      chain: 'sui:testnet',

    });
  };

  const withdraw = async (walletId: string, amount: number) => {
    const tx = new Transaction();
    tx.moveCall({
      target: `${ZOMBIE_MODULE}::zombie::withdraw`,
      arguments: [
        tx.object(walletId),
        tx.pure.u64(amount),
      ],
    });

    await signAndExecuteTransactionBlock({
      transaction: tx,
      chain: 'sui:testnet',
    });
    await fetchWallets();
  };

  const executeTransfer = async (
    registryId: string,
    walletId: string,
    zkProof: string
  ) => {
    const tx = new Transaction();
    tx.moveCall({
      target: `${ZOMBIE_MODULE}::zombie::execute_transfer`,
      arguments: [
        tx.object(registryId),
        tx.object(walletId),
        tx.pure(new Uint8Array(Buffer.from(zkProof, 'hex'))),
        tx.object('0x6'),
      ],
    });

    await signAndExecuteTransactionBlock({
      transaction: tx,
      chain: 'sui:testnet',
    });
    await Promise.all([fetchRegistries(), fetchWallets()]);
  };

  const updateThreshold = async (
    walletId: string,
    newDuration: number,
    timeUnit: number
  ) => {
    const tx = new Transaction();
    tx.moveCall({
      target: `${ZOMBIE_MODULE}::zombie::update_threshold`,
      arguments: [
        tx.object(walletId),
        tx.pure.u64(newDuration),
        tx.pure.u8(timeUnit),
      ],
    });

    await signAndExecuteTransactionBlock({
      transaction: tx,
      chain: 'sui:testnet',
    });
    await fetchWallets();
  };

  return (
    <ContractContext.Provider
      value={{
        isConnected: !!currentAccount,
        registries,
        wallets,
        isLoading,
        createRegistry,
        createWallet,
        checkIn,
        withdraw,
        executeTransfer,
        updateThreshold,
        fetchRegistries,
        fetchWallets,
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

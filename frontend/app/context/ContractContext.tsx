import { createContext, useContext, useEffect, useState } from 'react';
import { useWalletKit } from '@mysten/wallet-kit';
import { useSuiClient } from '@mysten/dapp-kit';
import { TransactionBlock } from '@mysten/sui.js/transactions';
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
  const { currentAccount, signAndExecuteTransactionBlock } = useWalletKit();
  const provider = useSuiClient();
  const [registries, setRegistries] = useState<any[]>([]);
  const [wallets, setWallets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (currentAccount?.address) {
      fetchRegistries();
      fetchWallets();
    }
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
    const tx = new TransactionBlock();
    tx.moveCall({
      target: `${ZOMBIE_MODULE}::zombie::create_registry`,
      arguments: [],
    });

    await signAndExecuteTransactionBlock({ transactionBlock: tx });
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
    const tx = new TransactionBlock();
    const coin = tx.object(coinId);
    const total = allocations.reduce((a, b) => a + b, 0);
    
    // Split the coin to match total allocations
    const [primaryCoin] = tx.splitCoins(coin, [tx.pure.u64(total)]);

    tx.moveCall({
      target: `${ZOMBIE_MODULE}::zombie::create_wallet`,
      arguments: [
        tx.object(registries[0].objectId), // Registry ID
        primaryCoin,
        tx.pure.u64(duration), // Duration as u64
        tx.pure.u8(timeUnit), // Time unit as u8
        tx.pure(beneficiaries, 'vector<address>'), // Address vector
        tx.pure(allocations.map(a => tx.pure.u64(a)), 'vector<u64>'), // u64 vector
        tx.pure(Array.from(Buffer.from(zkCommitment))), // vector<u8>
        tx.object('0x6'), // Clock object
      ],
    });

    await signAndExecuteTransactionBlock({ transactionBlock: tx });
    await fetchWallets();
  };

  const checkIn = async (
    walletId: string,
    newCommitment: string,
    zkProof: string
  ) => {
    const tx = new TransactionBlock();
    tx.moveCall({
      target: `${ZOMBIE_MODULE}::zombie::check_in`,
      arguments: [
        tx.object(walletId),
        tx.pure(Array.from(Buffer.from(newCommitment))),
        tx.pure(Array.from(Buffer.from(zkProof))),
        tx.object('0x6'),
      ],
    });

    await signAndExecuteTransactionBlock({ transactionBlock: tx });
  };

  const withdraw = async (walletId: string, amount: number) => {
    const tx = new TransactionBlock();
    tx.moveCall({
      target: `${ZOMBIE_MODULE}::zombie::withdraw`,
      arguments: [
        tx.object(walletId),
        tx.pure.u64(amount),
      ],
    });

    await signAndExecuteTransactionBlock({ transactionBlock: tx });
    await fetchWallets();
  };

  const executeTransfer = async (
    registryId: string,
    walletId: string,
    zkProof: string
  ) => {
    const tx = new TransactionBlock();
    tx.moveCall({
      target: `${ZOMBIE_MODULE}::zombie::execute_transfer`,
      arguments: [
        tx.object(registryId),
        tx.object(walletId),
        tx.pure(Array.from(Buffer.from(zkProof))),
        tx.object('0x6'),
      ],
    });

    await signAndExecuteTransactionBlock({ transactionBlock: tx });
    await Promise.all([fetchRegistries(), fetchWallets()]);
  };

  const updateThreshold = async (
    walletId: string,
    newDuration: number,
    timeUnit: number
  ) => {
    const tx = new TransactionBlock();
    tx.moveCall({
      target: `${ZOMBIE_MODULE}::zombie::update_threshold`,
      arguments: [
        tx.object(walletId),
        tx.pure.u64(newDuration),
        tx.pure.u8(timeUnit),
      ],
    });

    await signAndExecuteTransactionBlock({ transactionBlock: tx });
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
'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
} from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { ZOMBIE_MODULE, REGISTRY_TYPE, ZOMBIE_WALLET_TYPE } from '@/config/constants';

interface BeneficiaryData {
  last_checkin: string;
  threshold: string;
  allocation: string;
}

interface ZombieWallet {
  id: string;
  owner: string;
  beneficiaries: Record<string, BeneficiaryData>;
  coin: { value: string };
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
  ownerWithdraw: (walletId: string, amount: number) => Promise<void>;
  executeTransfer: (
    registryId: string,
    walletId: string,
    beneficiary: string
  ) => Promise<void>;
  fetchRegistry: () => Promise<void>;
  fetchWallets: () => Promise<void>;
  getCoins: () => Promise<{ coinObjectId: string, balance: string }[]>;
}

const ContractContext = createContext<ContractContextType>({} as ContractContextType);

export function ContractProvider({ children }: { children: React.ReactNode }) {
  const currentAccount = useCurrentAccount();
  const { mutateAsync: signAndExecuteTransactionBlock } = useSignAndExecuteTransaction();
  const provider = useSuiClient();
  const [registry, setRegistry] = useState<any | null>(null);
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
    if (!currentAccount?.address) return;
    setIsLoading(true);
    try {
      const response = await provider.getOwnedObjects({
        owner: currentAccount.address,
        filter: { StructType: ZOMBIE_WALLET_TYPE },
        options: { showContent: true },
      });
      setWallets(response.data.map((obj: any) => obj.data?.content?.fields as ZombieWallet));
    } catch (error) {
      console.error("Failed to fetch wallets:", error);
      setWallets([]);
    } finally {
      setIsLoading(false);
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

  // --- FINAL, ROBUST addBeneficiary ---
  const addBeneficiary = async (
    walletId: string,
    beneficiary: string,
    allocation: number,
    duration: number,
    timeUnit: number
  ) => {
    if (!currentAccount?.address) throw new Error("No connected account");
    const coins = await getCoins();
    // Convert SUI to MIST
    const allocationMist = Math.round(allocation * 1e9);

    // Find a coin with enough balance for allocation + some for gas
    const needed = allocationMist + 1e7; // 0.01 SUI extra for gas
    const coin = coins.find(c => Number(c.balance) >= needed);
    if (!coin) throw new Error("No coin with enough balance for allocation and gas");

    const tx = new Transaction();
    // Split the coin for allocation, so the rest is used for gas
    const [depositCoin] = tx.splitCoins(tx.object(coin.coinObjectId), [tx.pure.u64(allocationMist)]);

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
      throw new Error("Transaction failed. Please check your balance and try again.");
    }
  };

  const ownerWithdraw = async (walletId: string, amount: number) => {
    const tx = new Transaction();
    tx.moveCall({
      target: `${ZOMBIE_MODULE}::zombie::owner_withdraw`,
      arguments: [
        tx.object(walletId),
        tx.pure.u64(amount),
      ],
    });
    await signAndExecuteTransactionBlock({
      transaction: tx,
    });
    await fetchWallets();
  };

  const executeTransfer = async (
    registryId: string,
    walletId: string,
    beneficiary: string
  ) => {
    const tx = new Transaction();
    tx.moveCall({
      target: `${ZOMBIE_MODULE}::zombie::execute_transfer`,
      arguments: [
        tx.object(registryId),
        tx.object(walletId),
        tx.pure.address(beneficiary),
        tx.object('0x6'), // Clock object
      ],
    });
    await signAndExecuteTransactionBlock({
      transaction: tx,
    });
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
        ownerWithdraw,
        executeTransfer,
        fetchRegistry,
        fetchWallets,
        getCoins,
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

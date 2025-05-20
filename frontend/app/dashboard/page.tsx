// app/dashboard/page.tsx
'use client';
import { useContract } from '@/app/context/ContractContext';
import { useQuery } from '@apollo/client';
import { useCurrentAccount, useDisconnectWallet } from '@mysten/dapp-kit';
import { useState, useEffect } from 'react';
import { formatBalance, formatAddressDisplay, formatAddress } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import client from '@/lib/client';
import { GET_ZOMBIE_WALLETS_BY_OWNER } from '@/lib/queries';
import BeneficiaryList from '@/app/components/BeneficiaryList';
import ClaimList from '@/app/components/ClaimList';

interface WalletData {
  asMoveObject: {
    address: string;
    contents: {
      data: {
        Struct: Array<{
          name: string;
          value: any;
        }>;
      };
    };
  };
}

export default function Dashboard() {
  const router = useRouter();
  const {
    isConnected,
    wallets,
    isLoading: contractLoading,
    createWallet,
    addBeneficiary,
    withdraw,
    executeTransfer,
    fetchWallets,
    getCoins,
  } = useContract();

  const currentAccount = useCurrentAccount();
  const { mutate: disconnect } = useDisconnectWallet();
  const [activeTab, setActiveTab] = useState<'wallets' | 'onchain' | 'checkins' | 'claims'>('wallets');
  const [showAddBeneficiary, setShowAddBeneficiary] = useState(false);
  const [showWithdrawForm, setShowWithdrawForm] = useState<string | null>(null);
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
  const [beneficiaryForm, setBeneficiaryForm] = useState({
    address: '',
    allocation: '',
    depositCoinId: '',
    inactivityDuration: '30',
    inactivityUnit: 'days',
  });
  const [availableCoins, setAvailableCoins] = useState<{ coinObjectId: string, balance: string }[]>([]);
  const [selectedBeneficiary, setSelectedBeneficiary] = useState<string | null>(null);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [storeStatus, setStoreStatus] = useState<{ loading: boolean; error: string | null }>({
    loading: false,
    error: null,
  });

  const { loading: graphqlLoading, error, data } = useQuery(GET_ZOMBIE_WALLETS_BY_OWNER, {
    client,
    variables: { ownerAddress: currentAccount?.address || '' },
    skip: !currentAccount?.address
  });

  useEffect(() => {
    if (!currentAccount?.address) {
      router.push('/');
    }
  }, [currentAccount?.address, router]);

  useEffect(() => {
    const loadCoins = async () => {
      const coins = await getCoins();
      setAvailableCoins(coins);
    };
    loadCoins();
  }, [getCoins]);

  const getWalletBeneficiaries = (walletId: string): string[] => {
    const wallet = data?.objects?.nodes?.find(
      (w: WalletData) => w.asMoveObject.address === walletId
    );
    return wallet?.asMoveObject.contents.data.Struct
      .find((f: any) => f.name === 'beneficiary_addrs')?.value.Vector
      .map((b: { Address: number[] }) => formatAddress(b.Address)) || [];
  };

  const getWalletBalance = (wallet: WalletData) => {
    const coinValue = wallet.asMoveObject.contents.data.Struct
      .find((f: any) => f.name === 'coin')?.value.Struct[0]?.value.Number || '0';
    return parseInt(coinValue) / 100000000;
  };

  const handleAddBeneficiary = async () => {
    if (!selectedWallet || !currentAccount?.address) return;
    const allocation = Number(beneficiaryForm.allocation);
    const inactivityDuration = Number(beneficiaryForm.inactivityDuration);
    
    if (isNaN(allocation) || isNaN(inactivityDuration) || inactivityDuration <= 0) {
      alert('Invalid allocation amount or inactivity duration');
      return;
    }

    setStoreStatus({ loading: true, error: null });

    try {
      await addBeneficiary(
        selectedWallet,
        beneficiaryForm.address,
        allocation,
        beneficiaryForm.depositCoinId
      );

      const storeResponse = await fetch('/api/beneficiaries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerAddress: currentAccount.address,
          beneAddress: beneficiaryForm.address,
          allocation: allocation,
          walletAddress: selectedWallet,
          inactivityDuration: inactivityDuration,
          inactivityUnit: beneficiaryForm.inactivityUnit,
        }),
      });

      const result = await storeResponse.json();
      if (!storeResponse.ok) throw new Error(result.error || 'Failed to store beneficiary record');

      setShowAddBeneficiary(false);
      setBeneficiaryForm({ 
        address: '', 
        allocation: '', 
        depositCoinId: '',
        inactivityDuration: '30',
        inactivityUnit: 'days'
      });
      await fetchWallets();
    } catch (error) {
      console.error('Storage error:', error);
      setStoreStatus({
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setStoreStatus(prev => ({ ...prev, loading: false }));
    }
  };

  const handleWithdraw = async (walletId: string) => {
    if (!selectedBeneficiary || !currentAccount?.address) return;
    
    setIsWithdrawing(true);
    try {
      await withdraw(walletId, selectedBeneficiary);

      const deleteResponse = await fetch('/api/beneficiaries', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerAddress: currentAccount.address,
          beneAddress: selectedBeneficiary
        }),
      });

      const result = await deleteResponse.json();
      if (!deleteResponse.ok) throw new Error(result.error || 'Failed to remove beneficiary record');

      setShowWithdrawForm(null);
      setSelectedBeneficiary(null);
      await fetchWallets();
    } catch (error) {
      alert(`Withdrawal failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsWithdrawing(false);
    }
  };

  const handleExecuteTransfer = async (walletId: string) => {
    if (!currentAccount?.address) return;
    
    setIsTransferring(true);
    try {
      await executeTransfer(walletId);

      const deleteResponse = await fetch('/api/beneficiaries', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerAddress: currentAccount.address,
          walletAddress: walletId
        }),
      });

      const result = await deleteResponse.json();
      if (!deleteResponse.ok) throw new Error(result.error || 'Failed to delete beneficiaries');

      await fetchWallets();
    } catch (error) {
      alert(`Transfer failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsTransferring(false);
    }
  };

  const handleDisconnect = () => {
    disconnect(undefined, {
      onSuccess: () => router.push('/')
    });
  };

  if (graphqlLoading || contractLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-500">
        Error loading data: {error.message}
      </div>
    );
  }

  if (wallets.length === 0) {
    return (
      <div className="max-w-md mx-auto mt-12 p-6 bg-white rounded-lg shadow-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Create Your First Wallet</h2>
          <button
            onClick={handleDisconnect}
            className="bg-red-500 hover:bg-red-600 text-white py-1 px-3 rounded text-sm"
          >
            Disconnect
          </button>
        </div>
        <button
          onClick={createWallet}
          disabled={contractLoading}
          className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded"
        >
          {contractLoading ? 'Creating...' : 'Create Wallet'}
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">ZombieWallet Dashboard</h1>
        <button
          onClick={handleDisconnect}
          className="bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded"
        >
          Disconnect Wallet
        </button>
      </div>

      <div className="flex mb-6 border-b">
        <button
          className={`py-2 px-4 font-medium ${activeTab === 'wallets' ? 'border-b-2 border-blue-500' : ''}`}
          onClick={() => setActiveTab('wallets')}
        >
          My Wallets
        </button>
        <button
          className={`py-2 px-4 font-medium ${activeTab === 'onchain' ? 'border-b-2 border-blue-500' : ''}`}
          onClick={() => setActiveTab('onchain')}
        >
          On-chain Beneficiaries
        </button>
        <button
          className={`py-2 px-4 font-medium ${activeTab === 'checkins' ? 'border-b-2 border-blue-500' : ''}`}
          onClick={() => setActiveTab('checkins')}
        >
          Beneficiary Check-ins
        </button>
        <button
          className={`py-2 px-4 font-medium ${activeTab === 'claims' ? 'border-b-2 border-blue-500' : ''}`}
          onClick={() => setActiveTab('claims')}
        >
          Fund Claims
        </button>
      </div>

      {activeTab === 'wallets' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {wallets.map((wallet) => {
            const walletData = data?.objects?.nodes?.find(
              (w: WalletData) => w.asMoveObject.address === wallet.id
            );
            
            const balance = walletData ? getWalletBalance(walletData) : 0;
            const beneficiaries = getWalletBeneficiaries(wallet.id);

            return (
              <div key={wallet.id} className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-xl font-semibold mb-2">
                  {formatAddressDisplay(wallet.id)}
                </h3>
                <p className="mb-4">
                  Balance: {balance.toFixed(2)} SUI
                </p>
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      setSelectedWallet(wallet.id);
                      setShowAddBeneficiary(true);
                    }}
                    className="w-full bg-blue-100 hover:bg-blue-200 text-blue-800 py-2 px-4 rounded"
                  >
                    Add Beneficiary
                  </button>
                  <button
                    onClick={async () => setShowWithdrawForm(wallet.id)}
                    className="w-full bg-green-100 hover:bg-green-200 text-green-800 py-2 px-4 rounded"
                  >
                    Withdraw Funds
                  </button>
                  <button
                    onClick={() => handleExecuteTransfer(wallet.id)}
                    disabled={isTransferring}
                    className="w-full bg-purple-100 hover:bg-purple-200 text-purple-800 py-2 px-4 rounded disabled:opacity-50"
                  >
                    {isTransferring ? 'Transferring...' : 'Execute Transfer'}
                  </button>
                  {showWithdrawForm === wallet.id && (
                    <div className="mt-4 bg-gray-100 p-3 rounded">
                      <select
                        value={selectedBeneficiary || ''}
                        onChange={(e) => setSelectedBeneficiary(e.target.value)}
                        className="w-full p-2 mb-2 border rounded"
                      >
                        <option value="">Select Beneficiary</option>
                        {beneficiaries.map((addr) => (
                          <option key={addr} value={addr}>
                            {formatAddressDisplay(addr)}
                          </option>
                        ))}
                      </select>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleWithdraw(wallet.id)}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded"
                          disabled={!selectedBeneficiary || isWithdrawing}
                        >
                          {isWithdrawing ? 'Processing...' : 'Confirm'}
                        </button>
                        <button
                          onClick={() => {
                            setShowWithdrawForm(null);
                            setSelectedBeneficiary(null);
                          }}
                          className="flex-1 bg-gray-300 hover:bg-gray-400 py-2 rounded"
                        >
                          Cancel
                        </button>
                      </div>
                      {isWithdrawing && (
                        <p className="mt-2 text-sm text-gray-600">
                          Removing beneficiary record from database...
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'claims' && currentAccount?.address && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Claimable Funds</h2>
          <ClaimList ownerAddress={currentAccount.address} />
        </div>
      )}
      {activeTab === 'onchain' && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">All Beneficiaries</h2>
          {wallets.map((wallet) => (
            <div key={wallet.id} className="mb-6">
              <h3 className="font-medium mb-2">
                {formatAddressDisplay(wallet.id)}'s Beneficiaries
              </h3>
              <ul className="space-y-2">
                {getWalletBeneficiaries(wallet.id).map((addr) => (
                  <li key={addr} className="font-mono text-sm break-all p-2 bg-gray-50 rounded">
                    {formatAddressDisplay(addr)}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'checkins' && currentAccount?.address && (
        <BeneficiaryList ownerAddress={currentAccount.address} />
      )}

      {showAddBeneficiary && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center">
          <div className="bg-white p-6 rounded-lg max-w-md w-full">
            <h3 className="text-xl font-semibold mb-4">Add Beneficiary</h3>
            {storeStatus.error && (
              <div className="mb-4 text-red-500 text-sm">{storeStatus.error}</div>
            )}
            <input
              type="text"
              value={beneficiaryForm.address}
              onChange={(e) => setBeneficiaryForm({ ...beneficiaryForm, address: e.target.value })}
              placeholder="Beneficiary Address (0x...)"
              className="w-full p-2 border rounded mb-3"
              pattern="^0x[a-fA-F0-9]{64}$"
            />
            <input
              type="number"
              value={beneficiaryForm.allocation}
              onChange={(e) => setBeneficiaryForm({ ...beneficiaryForm, allocation: e.target.value })}
              placeholder="Allocation (SUI)"
              className="w-full p-2 border rounded mb-3"
              min="0"
              step="0.01"
            />
            <div className="flex gap-2 mb-3">
              <input
                type="number"
                value={beneficiaryForm.inactivityDuration}
                onChange={(e) => setBeneficiaryForm({ 
                  ...beneficiaryForm, 
                  inactivityDuration: e.target.value 
                })}
                placeholder="Inactivity duration"
                className="w-2/3 p-2 border rounded"
                min="1"
              />
              <select
                value={beneficiaryForm.inactivityUnit}
                onChange={(e) => setBeneficiaryForm({ 
                  ...beneficiaryForm, 
                  inactivityUnit: e.target.value 
                })}
                className="w-1/3 p-2 border rounded"
              >
                <option value="minutes">Minutes</option>
                <option value="hours">Hours</option>
                <option value="days">Days</option>
              </select>
            </div>
            <select
              value={beneficiaryForm.depositCoinId}
              onChange={(e) => setBeneficiaryForm({ 
                ...beneficiaryForm, 
                depositCoinId: e.target.value 
              })}
              className="w-full p-2 border rounded mb-3"
            >
              <option value="">Select Coin to Deposit</option>
              {availableCoins
                .filter(coin => 
                  Number(coin.balance) > (Number(beneficiaryForm.allocation || 0) * 1e9 + 0.1 * 1e9)
                )
                .map((coin) => (
                  <option key={coin.coinObjectId} value={coin.coinObjectId}>
                    {formatBalance(coin.balance)} SUI ({coin.coinObjectId.slice(0, 6)}...)
                  </option>
                ))}
            </select>
            <div className="flex space-x-2">
              <button
                onClick={handleAddBeneficiary}
                disabled={storeStatus.loading}
                className="flex-1 bg-blue-600 text-white py-2 rounded disabled:opacity-50"
              >
                {storeStatus.loading ? 'Saving...' : 'Add'}
              </button>
              <button
                onClick={() => setShowAddBeneficiary(false)}
                className="flex-1 bg-gray-300 py-2 rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
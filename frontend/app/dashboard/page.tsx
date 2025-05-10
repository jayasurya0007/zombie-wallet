'use client';
import { useContract } from '@/app/context/ContractContext';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { useState, useEffect } from 'react';
import { formatBalance } from '@/lib/utils';

// Helper to robustly extract a number from Sui Move object fields
function extractU64(val: any) {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') return Number(val);
  if (val && typeof val === 'object') {
    if ('fields' in val && typeof val.fields.value !== 'undefined') return Number(val.fields.value);
    if ('value' in val) return Number(val.value);
  }
  return 0;
}

export default function Dashboard() {
  const {
    isConnected,
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
  } = useContract();

  const currentAccount = useCurrentAccount();
  const [activeTab, setActiveTab] = useState<'wallets' | 'beneficiaries'>('wallets');
  const [showAddBeneficiary, setShowAddBeneficiary] = useState(false);
  const [showWithdrawForm, setShowWithdrawForm] = useState<string | null>(null);
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
  const [beneficiaryForm, setBeneficiaryForm] = useState({
    address: '',
    allocation: '',
    duration: '',
    timeUnit: 0, // 0 = minutes, 1 = days
  });
  const [withdrawAmount, setWithdrawAmount] = useState('');

  // Helper function to extract wallet ID string
  const getWalletId = (wallet: any) => {
    if (typeof wallet.id === 'string') return wallet.id;
    if (wallet.id?.fields?.id) return wallet.id.fields.id;
    if (wallet.id?.id) return wallet.id.id;
    return 'unknown-id';
  };


   // Load data on account change
  useEffect(() => {
    if (isConnected && currentAccount?.address) {
      fetchRegistry();
      fetchWallets();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, currentAccount?.address]);

  const handleCreateRegistry = async () => {
    await createRegistry();
  };

  const handleCreateWallet = async () => {
    if (registry?.objectId) {
      await createWallet(registry.objectId);
    }
  };

  const handleAddBeneficiary = async () => {
    if (!selectedWallet) return;
    const allocation = Number(beneficiaryForm.allocation);
    if (isNaN(allocation) || allocation <= 0) {
      alert("Please enter a valid allocation amount");
      return;
    }
    await addBeneficiary(
      selectedWallet,
      beneficiaryForm.address,
      allocation,
      Number(beneficiaryForm.duration),
      beneficiaryForm.timeUnit
    );
    setShowAddBeneficiary(false);
    setBeneficiaryForm({
      address: '',
      allocation: '',
      duration: '',
      timeUnit: 0,
    });
  };

  const handleWithdraw = async (walletId: string) => {
    await withdraw(walletId, Number(withdrawAmount));
    setShowWithdrawForm(null);
    setWithdrawAmount('');
  };

  const handleExecuteTransfer = async (walletId: string) => {
    await executeTransfer(walletId);
  };

  // First-time user flow
  if (!registry) {
    return (
      <div className="max-w-md mx-auto mt-12 p-6 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold mb-4">Welcome to ZombieWallet</h2>
        <p className="mb-6">You need to create a registry to start using ZombieWallets.</p>
        <button
          onClick={handleCreateRegistry}
          disabled={isLoading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded disabled:opacity-50"
        >
          {isLoading ? 'Creating...' : 'Create Registry'}
        </button>
      </div>
    );
  }

  // Returning user with no wallets
  if (registry && wallets.length === 0) {
    return (
      <div className="max-w-md mx-auto mt-12 p-6 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold mb-4">Create Your First ZombieWallet</h2>
        <p className="mb-6">You need to create a wallet to start managing your funds.</p>
        <button
          onClick={handleCreateWallet}
          disabled={isLoading}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded disabled:opacity-50"
        >
          {isLoading ? 'Creating...' : 'Create Wallet'}
        </button>
      </div>
    );
  }

  // Main dashboard
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">ZombieWallet Dashboard</h1>
      
      <div className="flex mb-6 border-b">
        <button
          className={`py-2 px-4 font-medium ${activeTab === 'wallets' ? 'border-b-2 border-blue-500' : ''}`}
          onClick={() => setActiveTab('wallets')}
        >
          My Wallets
        </button>
        <button
          className={`py-2 px-4 font-medium ${activeTab === 'beneficiaries' ? 'border-b-2 border-blue-500' : ''}`}
          onClick={() => setActiveTab('beneficiaries')}
        >
          Beneficiaries
        </button>
      </div>

      {activeTab === 'wallets' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {wallets.map((wallet) => {
            const walletId = getWalletId(wallet);
            const displayId = walletId.length > 8 
              ? `${walletId.slice(0, 8)}...${walletId.slice(-4)}` 
              : walletId;
            
            return (
              <div key={walletId} className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-xl font-semibold mb-2">Wallet: {displayId}</h3>
                <p className="text-lg mb-4">
                  Balance: {wallet.coin?.value ? formatBalance(wallet.coin.value) : '0'} SUI
                </p>
                <div className="space-y-3">
                  <button
                    onClick={() => {
                      setSelectedWallet(walletId);
                      setShowAddBeneficiary(true);
                    }}
                    className="w-full bg-blue-100 hover:bg-blue-200 text-blue-800 py-2 px-4 rounded"
                  >
                    Add Beneficiary
                  </button>
                  
                  <button
                    onClick={() => setShowWithdrawForm(walletId)}
                    className="w-full bg-green-100 hover:bg-green-200 text-green-800 py-2 px-4 rounded"
                  >
                    Withdraw Funds
                  </button>

                  {showWithdrawForm === walletId && (
                    <div className="mt-4 p-4 bg-gray-50 rounded">
                      <input
                        type="number"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        placeholder="Amount to withdraw"
                        className="w-full p-2 mb-2 border rounded"
                      />
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleWithdraw(walletId)}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setShowWithdrawForm(null)}
                          className="flex-1 bg-gray-200 hover:bg-gray-300 py-2 px-4 rounded"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'beneficiaries' && selectedWallet && (
        <div>
          <h2 className="text-2xl font-semibold mb-4">Beneficiaries</h2>
          {Object.entries(wallets.find(w => getWalletId(w) === selectedWallet)?.beneficiaries || {})
            .filter(([address]) => /^0x[a-fA-F0-9]{40,}$/.test(address))
            .map(([address, data]) => {
              const allocation = extractU64(data.allocation);
              const threshold = extractU64(data.threshold);
              return (
                <div key={address} className="bg-white p-4 mb-4 rounded-lg shadow">
                  <p className="font-medium">Address: {address.slice(0, 8)}...{address.slice(-4)}</p>
                  <p>Allocation: {formatBalance(allocation.toString())} SUI</p>
                  <p>Threshold: {threshold} seconds</p>
                  <button
                    onClick={() => handleExecuteTransfer(selectedWallet)}
                    className="mt-2 bg-purple-100 hover:bg-purple-200 text-purple-800 py-1 px-3 rounded text-sm"
                  >
                    Execute Transfer
                  </button>
                </div>
              );
            })}
        </div>
      )}

      {showAddBeneficiary && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg max-w-md w-full">
            <h3 className="text-xl font-semibold mb-4">Add Beneficiary</h3>
            <div className="space-y-4">
              <input
                type="text"
                value={beneficiaryForm.address}
                onChange={(e) => setBeneficiaryForm({...beneficiaryForm, address: e.target.value})}
                placeholder="Beneficiary address"
                className="w-full p-2 border rounded"
              />
              <input
                type="number"
                value={beneficiaryForm.allocation}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '' || (!isNaN(Number(value)) && Number(value) >= 0)) {
                    setBeneficiaryForm({...beneficiaryForm, allocation: value});
                  }
                }}
                placeholder="Allocation amount (SUI)"
                className="w-full p-2 border rounded"
                step="0.1"
                min="0"
              />
              <div className="flex space-x-2">
                <input
                  type="number"
                  value={beneficiaryForm.duration}
                  onChange={(e) => setBeneficiaryForm({...beneficiaryForm, duration: e.target.value})}
                  placeholder="Duration"
                  className="flex-1 p-2 border rounded"
                />
                <select
                  value={beneficiaryForm.timeUnit}
                  onChange={(e) => setBeneficiaryForm({...beneficiaryForm, timeUnit: Number(e.target.value)})}
                  className="flex-1 p-2 border rounded"
                >
                  <option value={0}>Minutes</option>
                  <option value={1}>Days</option>
                </select>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={handleAddBeneficiary}
                  disabled={isLoading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded disabled:opacity-50"
                >
                  {isLoading ? 'Adding...' : 'Add Beneficiary'}
                </button>
                <button
                  onClick={() => setShowAddBeneficiary(false)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 py-2 px-4 rounded"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

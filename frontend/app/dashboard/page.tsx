'use client';
import { useContract, BeneficiaryData } from '@/app/context/ContractContext';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { useState, useEffect } from 'react';
import { formatBalance } from '@/lib/utils';
import { ZombieWalletBeneficiary } from '@/app/components/ZombieWalletBeneficiary';

function extractU64(val: unknown): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') return Number(val);
  if (val && typeof val === 'object') {
    if ('value' in val) return Number((val as { value: string | number }).value);
    if ('fields' in val) {
      const fields = (val as { fields: Record<string, unknown> }).fields;
      if ('value' in fields) return Number(fields.value);
    }
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
    fetchWalletsGraphQL,
    get_beneficiary_addrs,
    get_beneficiary_data,
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
    timeUnit: 0,
  });
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [beneficiaryAddrs, setBeneficiaryAddrs] = useState<string[]>([]);
  const [beneficiariesData, setBeneficiariesData] = useState<Record<string, BeneficiaryData>>({});
  const [loadingBeneficiaries, setLoadingBeneficiaries] = useState(false);

  useEffect(() => {
    if (isConnected && currentAccount?.address) {
      fetchWalletsGraphQL();
    }
  }, [isConnected, currentAccount?.address]);

  useEffect(() => {
    const loadBeneficiaries = async () => {
      if (!selectedWallet) return;
      setLoadingBeneficiaries(true);
      
      try {
        const addrs = await get_beneficiary_addrs(selectedWallet);
        setBeneficiaryAddrs(addrs);

        const data: Record<string, BeneficiaryData> = {};
        for (const addr of addrs) {
          const beneficiary = await get_beneficiary_data(selectedWallet, addr);
          if (beneficiary) {
            data[addr] = beneficiary;
          }
        }
        setBeneficiariesData(data);
      } catch (error) {
        console.error('Failed to load beneficiaries:', error);
      } finally {
        setLoadingBeneficiaries(false);
      }
    };

    loadBeneficiaries();
  }, [selectedWallet, get_beneficiary_addrs, get_beneficiary_data]);

  const handleCreateRegistry = async () => await createRegistry();
  const handleCreateWallet = async () => registry?.objectId && await createWallet(registry.objectId);

  const handleAddBeneficiary = async () => {
    if (!selectedWallet) return;
    const allocation = Number(beneficiaryForm.allocation);
    
    if (isNaN(allocation) || allocation <= 0) {
      alert('Please enter a valid allocation amount');
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
    setBeneficiaryForm({ address: '', allocation: '', duration: '', timeUnit: 0 });
    await fetchWalletsGraphQL();
  };

  const handleWithdraw = async (walletId: string) => {
    await withdraw(walletId, Number(withdrawAmount));
    setShowWithdrawForm(null);
    setWithdrawAmount('');
  };

  const handleExecuteTransfer = async (walletId: string) => {
    await executeTransfer(walletId);
    await fetchWalletsGraphQL();
    setBeneficiaryAddrs([]);
    setBeneficiariesData({});
  };

  if (!registry) {
    return (
      <div className="max-w-md mx-auto mt-12 p-6 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold mb-4">Welcome to ZombieWallet</h2>
        <button
          onClick={handleCreateRegistry}
          disabled={isLoading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded"
        >
          {isLoading ? 'Creating...' : 'Create Registry'}
        </button>
      </div>
    );
  }

  if (wallets.length === 0) {
    return (
      <div className="max-w-md mx-auto mt-12 p-6 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold mb-4">Create Your First Wallet</h2>
        <button
          onClick={handleCreateWallet}
          disabled={isLoading}
          className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded"
        >
          {isLoading ? 'Creating...' : 'Create Wallet'}
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">ZombieWallet Dashboard</h1>
      
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
            const balance = extractU64(wallet.coin?.balance);
            return (
              <div key={wallet.id} className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-xl font-semibold mb-2">
                  Wallet: {wallet.id.slice(0, 8)}...{wallet.id.slice(-4)}
                </h3>
                <p className="mb-4">
                  Balance: {formatBalance(balance.toString())} SUI
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
                    onClick={() => setShowWithdrawForm(wallet.id)}
                    className="w-full bg-green-100 hover:bg-green-200 text-green-800 py-2 px-4 rounded"
                  >
                    Withdraw Funds
                  </button>
                  {showWithdrawForm === wallet.id && (
                    <div className="mt-4 bg-gray-100 p-3 rounded">
                      <input
                        type="number"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        placeholder="Amount in SUI"
                        className="w-full p-2 mb-2 border rounded"
                      />
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleWithdraw(wallet.id)}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setShowWithdrawForm(null)}
                          className="flex-1 bg-gray-300 hover:bg-gray-400 py-2 rounded"
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

      {activeTab === 'beneficiaries' && (
        <ZombieWalletBeneficiary  />
      )}

      {showAddBeneficiary && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center">
          <div className="bg-white p-6 rounded-lg max-w-md w-full">
            <h3 className="text-xl font-semibold mb-4">Add Beneficiary</h3>
            <input
              type="text"
              value={beneficiaryForm.address}
              onChange={(e) => setBeneficiaryForm({ ...beneficiaryForm, address: e.target.value })}
              placeholder="Beneficiary Address"
              className="w-full p-2 border rounded mb-3"
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
            <div className="flex space-x-2 mb-3">
              <input
                type="number"
                value={beneficiaryForm.duration}
                onChange={(e) => setBeneficiaryForm({ ...beneficiaryForm, duration: e.target.value })}
                placeholder="Duration"
                className="flex-1 p-2 border rounded"
              />
              <select
                value={beneficiaryForm.timeUnit}
                onChange={(e) => setBeneficiaryForm({ ...beneficiaryForm, timeUnit: Number(e.target.value) })}
                className="flex-1 p-2 border rounded"
              >
                <option value={0}>Minutes</option>
                <option value={1}>Days</option>
              </select>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={handleAddBeneficiary}
                className="flex-1 bg-blue-600 text-white py-2 rounded"
              >
                Add
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
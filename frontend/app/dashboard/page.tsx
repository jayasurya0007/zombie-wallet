'use client';
import { useContract } from '@/app/context/ContractContext';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { useState, useEffect } from 'react';
import { formatBalance } from '@/lib/utils';
import { AptosClient } from "aptos";
import { ZOMBIE_MODULE, REGISTRY_TYPE, ZOMBIE_WALLET_TYPE } from '@/config/constants';




function extractU64(val: any): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') return Number(val);
  if (val?.fields?.value) return Number(val.fields.value);
  if (val?.value) return Number(val.value);
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
    timeUnit: 0,
  });
  const [withdrawAmount, setWithdrawAmount] = useState('');

  async function fetchZombieWallet(address: string) {
  try {
    // Fetch the account's resources
    const client = new AptosClient("https://fullnode.testnet.aptoslabs.com"); // or testnet/devnet URL
    const resources = await client.getAccountResources(address);
    
    // Find the ZombieWallet resource
    const zombieWalletResource = resources.find((resource) => 
      resource.type === ZOMBIE_WALLET_TYPE
    );

    if (zombieWalletResource) {
      console.log('Zombie Wallet:', zombieWalletResource.data);
    } else {
      console.log('Zombie Wallet not found for this address.');
    }
  } catch (error) {
    console.error('Error fetching Zombie Wallet:', error);
  }
}



  useEffect(() => {
    if (isConnected && currentAccount?.address) {
      fetchRegistry();
      fetchWallets();
    }
  }, [isConnected, currentAccount?.address]);

  const getWalletId = (wallet: any): string => {
    if (!wallet) return 'unknown-id';
    console.log('wallet:', wallet);
    // Example: Fetch Zombie Wallet for a specific address
    fetchZombieWallet('0x90465c9f240415ed71e68eebbda9e28d8b36fb26ff2764e2d24a89801c6d2337');
    return typeof wallet.id === 'string'
      ? wallet.id
      : wallet.id?.id || wallet.id?.fields?.id || 'unknown-id';
      
  };

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
    await fetchWallets();
    setShowAddBeneficiary(false);
    setBeneficiaryForm({ address: '', allocation: '', duration: '', timeUnit: 0 });
  };

  const handleWithdraw = async (walletId: string) => {
    await withdraw(walletId, Number(withdrawAmount));
    setShowWithdrawForm(null);
    setWithdrawAmount('');
  };

  const handleExecuteTransfer = async (walletId: string) => {
    await executeTransfer(walletId);
  };

  if (!registry) {
    return (
      <div className="max-w-md mx-auto mt-12 p-6 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold mb-4">Welcome to ZombieWallet</h2>
        <p className="mb-6">Create a registry to begin.</p>
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
            const walletId = getWalletId(wallet);
            const displayId = `${walletId.slice(0, 8)}...${walletId.slice(-4)}`;
            const balance = extractU64(wallet.coin?.balance || 0);
            console.log('wallet.beneficiary_addrs:', wallet.beneficiary_addrs);// Shows array content
            console.log('wallet.beneficiaries:', JSON.stringify(wallet.beneficiaries, null, 2)); // Pretty print object
            console.log('wallet.coin:', wallet.coin);
            console.log("balance",balance);
            return (
              <div key={walletId} className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-xl font-semibold mb-2">Wallet: {displayId}</h3>
                <p className="mb-4">Balance: {formatBalance(balance.toString())} SUI</p>
                <div className="space-y-2">
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
                          onClick={() => handleWithdraw(walletId)}
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

      {activeTab === 'beneficiaries' && selectedWallet && (
        <div>
          <h2 className="text-2xl font-semibold mb-4">Beneficiaries</h2>
          {(wallets.find(w => getWalletId(w) === selectedWallet)?.beneficiaries || {}) &&
            Object.entries(wallets.find(w => getWalletId(w) === selectedWallet)?.beneficiaries || {})
              .filter(([addr]) => /^0x[a-fA-F0-9]{40,}$/.test(addr))
              .map(([addr, data]) => {
                const allocation = extractU64(data.allocation);
                const threshold = extractU64(data.threshold);
                return (
                  <div key={addr} className="bg-white p-4 mb-4 rounded shadow">
                    <p>Address: {addr.slice(0, 8)}...{addr.slice(-4)}</p>
                    <p>Allocation: {formatBalance(allocation.toString())} SUI</p>
                    <p>Threshold: {threshold} seconds</p>
                    <button
                      onClick={() => handleExecuteTransfer(selectedWallet)}
                      className="mt-2 bg-purple-100 hover:bg-purple-200 text-purple-800 py-1 px-3 rounded"
                    >
                      Execute Transfer
                    </button>
                  </div>
                );
              })}
        </div>
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

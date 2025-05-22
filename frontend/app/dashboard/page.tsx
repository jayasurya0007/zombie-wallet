// app/dashboard/page.tsx
'use client';
import { useContract } from '@/app/context/ContractContext';
import { useQuery } from '@apollo/client';
import { useCurrentAccount, useDisconnectWallet } from '@mysten/dapp-kit';
import { useState, useEffect } from 'react';
import { formatBalance, formatAddressDisplay, formatAddress } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import client from '@/lib/client';
import { GET_ALL_ZOMBIE_WALLETS } from '@/lib/queries';
import BeneficiaryList from '@/app/components/BeneficiaryList';
import ClaimList from '@/app/components/ClaimList';

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

  const { loading: graphqlLoading, error, data,refetch  } = useQuery(GET_ALL_ZOMBIE_WALLETS, {
  client,
  skip: !currentAccount?.address,
  fetchPolicy: 'network-only' 
});

  useEffect(() => {
      setShowAddBeneficiary(false);
      setShowWithdrawForm(null);
      setSelectedBeneficiary(null);
      setSelectedWallet(null);
    }, [activeTab]);

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
      (w: any) => w.address === walletId
    );
    return wallet?.asMoveObject.contents.json.beneficiary_addrs || [];
  };

  const getWalletBalance = (wallet: any) => {
  return parseInt(wallet.asMoveObject.contents.json.coin.value) / 1_000_000_000;
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
      client.cache.evict({ fieldName: 'objects' });
      await Promise.all([
        fetchWallets()
      ]);
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

       // Clear cache and refresh data
      client.cache.evict({ fieldName: 'objects' });
      await Promise.all([
        fetchWallets(),
        refetch()
      ]);

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
      <div className="min-h-screen zombie-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin text-6xl mb-4">🧟♂️</div>
          <p className="text-[var(--zombie-green)] font-zombie text-xl">Awakening the undead...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen zombie-background flex items-center justify-center">
        <div className="text-center p-8 bg-[rgba(138,3,3,0.2)] border-2 border-[var(--blood-red)] rounded-lg backdrop-blur-sm">
          <div className="text-6xl mb-4">💀</div>
          <h2 className="text-[var(--blood-red)] font-zombie text-2xl mb-4">FATAL ERROR</h2>
          <p className="text-[var(--decay-yellow)]">The crypt has been compromised: {error.message}</p>
        </div>
      </div>
    );
  }

  if (wallets.length === 0) {
    return (
      <div className="min-h-screen zombie-background relative overflow-hidden">
        <div className="absolute inset-0 border-8 border-[rgba(138,3,3,0.3)] mix-blend-multiply -rotate-1 scale-105" />
        <div className="absolute inset-0 border-8 border-[rgba(107,140,33,0.2)] mix-blend-multiply rotate-2 scale-103" />
        
        <div className="flex items-center justify-center min-h-screen px-4">
          <div className="bg-[rgba(10,10,8,0.9)] border-4 border-[var(--decay-yellow)] rounded-lg p-8 max-w-md w-full relative">
            <div className="absolute -top-4 -right-4 text-4xl animate-float">🧟‍♀️</div>
            
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-[var(--blood-red)] font-zombie text-2xl">Summon Your First Crypt</h2>
              <button
                onClick={handleDisconnect}
                className="group relative"
              >
                <div className="absolute -inset-1 bg-[rgba(138,3,3,0.3)] rounded blur opacity-75 group-hover:opacity-100 transition-all duration-300" />
                <div className="relative bg-[var(--blood-red)] hover:bg-[#6d0202] text-[var(--decay-yellow)] py-1 px-3 rounded font-zombie text-sm transition-all duration-300 border border-[var(--decay-yellow)]">
                  Escape
                </div>
              </button>
            </div>
            
            <div className="group relative">
              <div className="absolute -inset-1 bg-[rgba(107,140,33,0.3)] rounded-lg blur opacity-75 group-hover:opacity-100 transition-all duration-1000 group-hover:duration-200 animate-tilt" />
              <button
                onClick={async () => {
                  await createWallet();
                  await refetch(); 
                }}
                disabled={contractLoading}
                className="relative w-full bg-[var(--zombie-green)] hover:bg-[var(--blood-red)] text-[var(--decay-yellow)] py-4 rounded-lg font-zombie text-xl
                          transition-all duration-300 hover:scale-105 border-2 border-[var(--decay-yellow)] 
                          shadow-lg hover:shadow-[0_0_15px_rgba(138,3,3,0.5)] disabled:opacity-50"
              >
                {contractLoading ? '⚰️ Digging Grave...' : '🧟‍♂️ Create Undead Vault'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen zombie-background relative">
      <div className="absolute inset-0 border-8 border-[rgba(138,3,3,0.2)] mix-blend-multiply -rotate-1 scale-105" />
      <div className="absolute inset-0 border-8 border-[rgba(107,140,33,0.1)] mix-blend-multiply rotate-1 scale-102" />
      
      <div className="relative container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center space-x-4">
            <div className="text-5xl animate-float">🧟‍♂️</div>
            <h1 className="text-[var(--blood-red)] font-zombie text-4xl drop-shadow-[0_2px_1px_rgba(0,0,0,0.8)]">
              Zombie Crypt Dashboard
            </h1>
          </div>
          
          <div className="group relative">
            <div className="absolute -inset-1 bg-[rgba(138,3,3,0.3)] rounded blur opacity-75 group-hover:opacity-100 transition-all duration-300" />
            <button
              onClick={handleDisconnect}
              className="relative bg-[var(--blood-red)] hover:bg-[#6d0202] text-[var(--decay-yellow)] py-2 px-6 rounded font-zombie text-lg
                        transition-all duration-300 border-2 border-[var(--decay-yellow)] shadow-lg hover:shadow-[0_0_10px_rgba(138,3,3,0.5)]"
            >
              ⚰️ Disconnect Wallet
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex mb-8 bg-[rgba(10,10,8,0.8)] rounded-lg border-2 border-[var(--zombie-green)] p-2">
          {[
            { key: 'wallets', label: '🧟‍♂️ My Crypts', icon: '⚰️' },
            { key: 'onchain', label: '👻 Undead Heirs', icon: '🦴' },
            { key: 'checkins', label: '💀 Soul Check-ins', icon: '👁️' },
            { key: 'claims', label: '🩸 Blood Claims', icon: '⚱️' }
          ].map(tab => (
            <button
              key={tab.key}
              className={`flex-1 py-3 px-4 font-zombie text-lg transition-all duration-300 rounded ${
                activeTab === tab.key 
                  ? 'bg-[var(--zombie-green)] text-[var(--decay-yellow)] border-2 border-[var(--blood-red)] shadow-lg' 
                  : 'text-[var(--zombie-green)] hover:bg-[rgba(107,140,33,0.2)] hover:text-[var(--decay-yellow)]'
              }`}
              onClick={() => setActiveTab(tab.key as any)}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Wallets Tab */}
        {activeTab === 'wallets' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {wallets.map((wallet) => {
              const walletData = data?.objects?.nodes?.find(
                (w: any) => w.address === wallet.id
              );
              
              const balance = walletData ? getWalletBalance(walletData) : 0;
              const beneficiaries = getWalletBeneficiaries(wallet.id);

              return (
                <div key={wallet.id} className="bg-[rgba(10,10,8,0.9)] border-4 border-[var(--decay-yellow)] rounded-lg p-6 relative group">
                  <div className="absolute -top-3 -right-3 text-3xl animate-tilt">⚰️</div>
                  <h3 className="text-[var(--zombie-green)] font-zombie text-xl mb-4">
                    🧟‍♂️ Owner ID:  {wallet.owner}
                  </h3>
                  <h3 className="text-[var(--zombie-green)] font-zombie text-xl mb-4">
                    🧟‍♂️ Wallet ID :{wallet.id}
                  </h3>
                  
                  <div className="mb-6 p-3 bg-[rgba(107,140,33,0.2)] rounded border border-[var(--zombie-green)]">
                    <p className="text-[var(--decay-yellow)] font-mono">
                      💰 Cursed Balance: <span className="text-[var(--blood-red)] font-bold">{balance.toFixed(2)} SUI</span>
                    </p>
                    <p className="text-[var(--zombie-green)] text-sm mt-1">
                      👻 Heirs: {beneficiaries.length}
                    </p>
                  </div>
                  
                  <div className="space-y-3">
                    {/* Add Beneficiary Button */}
                    <div className="group/btn relative">
                      <div className="absolute -inset-0.5 bg-[rgba(107,140,33,0.3)] rounded blur opacity-75 group-hover/btn:opacity-100 transition-all duration-300" />
                      <button
                        onClick={() => {
                          setSelectedWallet(wallet.id);
                          setShowAddBeneficiary(true);
                        }}
                        className="relative w-full bg-[var(--zombie-green)] hover:bg-[rgba(107,140,33,0.8)] text-[var(--decay-yellow)] py-3 px-4 rounded font-zombie
                                  transition-all duration-300 border border-[var(--decay-yellow)] hover:shadow-[0_0_10px_rgba(107,140,33,0.5)]"
                      >
                        👻 Add Soul Heir
                      </button>
                    </div>

                    {/* Withdraw Button */}
                    <div className="group/btn relative">
                      <div className="absolute -inset-0.5 bg-[rgba(196,183,13,0.3)] rounded blur opacity-75 group-hover/btn:opacity-100 transition-all duration-300" />
                      <button
                        onClick={async () => setShowWithdrawForm(wallet.id)}
                        className="relative w-full bg-[var(--decay-yellow)] hover:bg-[rgba(196,183,13,0.8)] text-[var(--zombie-dark)] py-3 px-4 rounded font-zombie
                                  transition-all duration-300 border border-[var(--zombie-green)] hover:shadow-[0_0_10px_rgba(196,183,13,0.5)]"
                      >
                        💰 Extract Treasure
                      </button>
                    </div>

                    {/* Execute Transfer Button */}
                    <div className="group/btn relative">
                      <div className="absolute -inset-0.5 bg-[rgba(138,3,3,0.3)] rounded blur opacity-75 group-hover/btn:opacity-100 transition-all duration-300" />
                      <button
                        onClick={() => handleExecuteTransfer(wallet.id)}
                        disabled={isTransferring || beneficiaries.length === 0}
                        className="relative w-full bg-[var(--blood-red)] hover:bg-[rgba(138,3,3,0.8)] text-[var(--decay-yellow)] py-3 px-4 rounded font-zombie
                                  transition-all duration-300 border border-[var(--decay-yellow)] hover:shadow-[0_0_10px_rgba(138,3,3,0.5)]
                                  disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isTransferring ? '⚰️ Transferring...' : '🩸 Execute Death Transfer'}
                      </button>
                    </div>

                    {/* Withdraw Form */}
                    {showWithdrawForm === wallet.id && (
                      <div className="mt-4 bg-[rgba(138,3,3,0.2)] border-2 border-[var(--blood-red)] p-4 rounded">
                        <p className="text-[var(--decay-yellow)] font-zombie mb-3">💀 Choose Your Victim:</p>
                        <select
                          value={selectedBeneficiary || ''}
                          onChange={(e) => setSelectedBeneficiary(e.target.value)}
                          className="w-full p-2 mb-3 bg-[var(--zombie-dark)] text-[var(--zombie-green)] border border-[var(--decay-yellow)] rounded font-mono"
                        >
                          <option value="">👻 Select Soul...</option>
                          {beneficiaries.map((addr) => (
                            <option key={addr} value={addr}>
                              🧟‍♀️ {addr.slice(0, 6)}...{addr.slice(-4)}
                            </option>
                          ))}
                        </select>
                        <div className="flex space-x-2">
                          <div className="group/confirm relative flex-1">
                            <div className="absolute -inset-0.5 bg-[rgba(107,140,33,0.3)] rounded blur opacity-75 group-hover/confirm:opacity-100 transition-all duration-300" />
                            <button
                              onClick={() => handleWithdraw(wallet.id)}
                              className="relative w-full bg-[var(--zombie-green)] hover:bg-[rgba(107,140,33,0.8)] text-[var(--decay-yellow)] py-2 rounded font-zombie
                                        transition-all duration-300 border border-[var(--decay-yellow)] disabled:opacity-50"
                              disabled={!selectedBeneficiary || isWithdrawing}
                            >
                              {isWithdrawing ? '⚰️ Claiming...' : '✅ Confirm Kill'}
                            </button>
                          </div>
                          <button
                            onClick={() => {
                              setShowWithdrawForm(null);
                              setSelectedBeneficiary(null);
                            }}
                            className="flex-1 bg-[rgba(10,10,8,0.8)] hover:bg-[rgba(10,10,8,0.9)] text-[var(--zombie-green)] py-2 rounded font-zombie
                                      transition-all duration-300 border border-[var(--zombie-green)]"
                          >
                            ❌ Spare Life
                          </button>
                        </div>
                        {isWithdrawing && (
                          <p className="mt-3 text-sm text-[var(--decay-yellow)] font-mono">
                            💀 Removing soul from the underworld database...
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

        {/* Claims Tab */}
        {activeTab === 'claims' && currentAccount?.address && (
          <div className="bg-[rgba(10,10,8,0.9)] border-4 border-[var(--blood-red)] p-6 rounded-lg">
            <div className="flex items-center mb-6">
              <div className="text-4xl mr-4">⚱️</div>
              <h2 className="text-[var(--blood-red)] font-zombie text-2xl">Claimable Blood Money</h2>
            </div>
            <div className="bg-[rgba(138,3,3,0.1)] border border-[var(--blood-red)] rounded p-4">
              <ClaimList ownerAddress={currentAccount.address} />
            </div>
          </div>
        )}

        {/* On-chain Tab */}
        {activeTab === 'onchain' && (
          <div className="bg-[rgba(10,10,8,0.9)] border-4 border-[var(--zombie-green)] p-6 rounded-lg">
            <div className="flex items-center mb-6">
              <div className="text-4xl mr-4">🦴</div>
              <h2 className="text-[var(--zombie-green)] font-zombie text-2xl">Registry of the Damned</h2>
            </div>
            {wallets.map((wallet) => (
              <div key={wallet.id} className="mb-6 bg-[rgba(107,140,33,0.1)] border border-[var(--zombie-green)] rounded p-4">
                <h3 className="font-zombie text-[var(--decay-yellow)] mb-3">
                  ⚰️ {wallet.id}'s Cursed Heirs
                </h3>
                <ul className="space-y-2">
                  {getWalletBeneficiaries(wallet.id).map((addr) => (
                    <li key={addr} className="font-mono text-sm text-[var(--zombie-green)] p-3 bg-[rgba(10,10,8,0.5)] rounded border border-[var(--decay-yellow)]">
                      👻 {addr}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {/* Check-ins Tab */}
        {activeTab === 'checkins' && currentAccount?.address && (
          <div className="bg-[rgba(10,10,8,0.9)] border-4 border-[var(--decay-yellow)] p-6 rounded-lg">
            <div className="flex items-center mb-6">
              <div className="text-4xl mr-4">👁️</div>
              <h2 className="text-[var(--decay-yellow)] font-zombie text-2xl">Soul Surveillance</h2>
            </div>
            <div className="bg-[rgba(196,183,13,0.1)] border border-[var(--decay-yellow)] rounded p-4">
              <BeneficiaryList ownerAddress={currentAccount.address} />
            </div>
          </div>
        )}

        {/* Add Beneficiary Modal */}
        {showAddBeneficiary && (
          <div className="fixed inset-0 bg-[rgba(0,0,0,0.8)] flex justify-center items-center z-50 backdrop-blur-sm">
            <div className="bg-[rgba(10,10,8,0.95)] border-4 border-[var(--blood-red)] p-8 rounded-lg max-w-md w-full mx-4 relative">
              <div className="absolute -top-4 -right-4 text-4xl animate-float">💀</div>
              
              <h3 className="text-[var(--blood-red)] font-zombie text-2xl mb-6">Summon New Soul Heir</h3>
              
              {storeStatus.error && (
                <div className="mb-4 p-3 bg-[rgba(138,3,3,0.3)] border border-[var(--blood-red)] rounded text-[var(--decay-yellow)] text-sm">
                  ⚠️ {storeStatus.error}
                </div>
              )}
              
              <div className="space-y-4">
                <input
                  type="text"
                  value={beneficiaryForm.address}
                  onChange={(e) => setBeneficiaryForm({ ...beneficiaryForm, address: e.target.value })}
                  placeholder="👻 Soul Address (0x...)"
                  className="w-full p-3 bg-[var(--zombie-dark)] text-[var(--zombie-green)] border-2 border-[var(--decay-yellow)] rounded font-mono
                            placeholder-[var(--zombie-green)] focus:border-[var(--blood-red)] focus:outline-none transition-all duration-300"
                  pattern="^0x[a-fA-F0-9]{64}$"
                />
                
                <input
                  type="number"
                  value={beneficiaryForm.allocation}
                  onChange={(e) => setBeneficiaryForm({ ...beneficiaryForm, allocation: e.target.value })}
                  placeholder="💰 Blood Money (SUI)"
                  className="w-full p-3 bg-[var(--zombie-dark)] text-[var(--zombie-green)] border-2 border-[var(--decay-yellow)] rounded
                            placeholder-[var(--zombie-green)] focus:border-[var(--blood-red)] focus:outline-none transition-all duration-300"
                  min="0"
                  step="0.01"
                />
                
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={beneficiaryForm.inactivityDuration}
                    onChange={(e) => setBeneficiaryForm({ 
                      ...beneficiaryForm, 
                      inactivityDuration: e.target.value 
                    })}
                    placeholder="⏰ Death Timer"
                    className="w-2/3 p-3 bg-[var(--zombie-dark)] text-[var(--zombie-green)] border-2 border-[var(--decay-yellow)] rounded
                              placeholder-[var(--zombie-green)] focus:border-[var(--blood-red)] focus:outline-none transition-all duration-300"
                    min="1"
                  />
                  <select
                    value={beneficiaryForm.inactivityUnit}
                    onChange={(e) => setBeneficiaryForm({ 
                      ...beneficiaryForm, 
                      inactivityUnit: e.target.value 
                    })}
                    className="w-1/3 p-3 bg-[var(--zombie-dark)] text-[var(--zombie-green)] border-2 border-[var(--decay-yellow)] rounded
                              focus:border-[var(--blood-red)] focus:outline-none transition-all duration-300"
                  >
                    <option value="minutes">Min</option>
                    <option value="hours">Hrs</option>
                    <option value="days">Days</option>
                  </select>
                </div>
                
                <select
                  value={beneficiaryForm.depositCoinId}
                  onChange={(e) => setBeneficiaryForm({ 
                    ...beneficiaryForm, 
                    depositCoinId: e.target.value 
                  })}
                  className="w-full p-3 bg-[var(--zombie-dark)] text-[var(--zombie-green)] border-2 border-[var(--decay-yellow)] rounded
                            focus:border-[var(--blood-red)] focus:outline-none transition-all duration-300"
                >
                  <option value="">💰 Select Cursed Coin...</option>
                  {availableCoins
                    .filter(coin => 
                      Number(coin.balance) > (Number(beneficiaryForm.allocation || 0) * 1e9 + 0.1 * 1e9)
                    )
                    .map((coin) => (
                      <option key={coin.coinObjectId} value={coin.coinObjectId}>
                        ⚰️ {formatBalance(coin.balance)} SUI ({coin.coinObjectId.slice(0, 6)}...)
                      </option>
                    ))}
                </select>
              </div>
              
              <div className="flex space-x-3 mt-6">
                <div className="group/add relative flex-1">
                  <div className="absolute -inset-0.5 bg-[rgba(107,140,33,0.3)] rounded blur opacity-75 group-hover/add:opacity-100 transition-all duration-300" />
                  <button
                    onClick={handleAddBeneficiary}
                    disabled={storeStatus.loading}
                    className="relative w-full bg-[var(--zombie-green)] hover:bg-[rgba(107,140,33,0.8)] text-[var(--decay-yellow)] py-3 rounded font-zombie text-lg
                              transition-all duration-300 border-2 border-[var(--decay-yellow)] disabled:opacity-50 hover:shadow-[0_0_10px_rgba(107,140,33,0.5)]"
                  >
                    {storeStatus.loading ? '⚰️ Cursing...' : '👻 Bind Soul'}
                  </button>
                </div>
                <button
                  onClick={() => setShowAddBeneficiary(false)}
                  className="flex-1 bg-[rgba(10,10,8,0.8)] hover:bg-[rgba(10,10,8,0.9)] text-[var(--zombie-green)] py-3 rounded font-zombie text-lg
                            transition-all duration-300 border-2 border-[var(--zombie-green)] hover:border-[var(--blood-red)]"
                >
                  ❌ Banish
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Floating bottom gradient */}
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[var(--zombie-dark)]/80 to-transparent pointer-events-none" />
      </div>
    </div>
  );
}
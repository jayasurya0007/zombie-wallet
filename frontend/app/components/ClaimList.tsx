// app/components/ClaimList.tsx
'use client';
import { useContract } from '@/app/context/ContractContext';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { useEffect, useState } from 'react';
import { formatAddressDisplay } from '@/lib/utils';

interface Beneficiary {
  _id: string;
  ownerAddress: string;
  beneAddress: string;
  walletAddress: string;
  allocation: number;
  inactivityDuration: number;
  inactivityUnit: string;
  timestamp_checkin: string;
  timestamp_created: string;
}

interface ClaimListProps {
  ownerAddress: string;
}

const ClaimList = ({ ownerAddress }: ClaimListProps) => {
  const { claimAllocation } = useContract();
  const currentAccount = useCurrentAccount();
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState<string | null>(null);

  // Add refresh interval for real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setBeneficiaries((prev) => [...prev]);
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  const calculateTimeRemaining = (beneficiary: Beneficiary) => {
    const lastCheckin = new Date(beneficiary.timestamp_checkin).getTime();
    const durationMap = {
      minutes: 60 * 1000,
      hours: 60 * 60 * 1000,
      days: 24 * 60 * 60 * 1000
    } as const;

    const unit = beneficiary.inactivityUnit as keyof typeof durationMap;
    const expirationTime = lastCheckin + 
      (beneficiary.inactivityDuration * durationMap[unit]);
    
    return expirationTime - Date.now();
  };

  const fetchClaims = async () => {
    try {
      const beneAddress = currentAccount?.address;
      if (!beneAddress) return;

      const response = await fetch(`/api/claimlist?beneAddress=${beneAddress}`);
      if (!response.ok) throw new Error('Failed to fetch claims');
      
      const data: Beneficiary[] = await response.json();
      setBeneficiaries(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load claims');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentAccount?.address) fetchClaims();
  }, [currentAccount?.address]);

  const handleRetry = () => {
    setLoading(true);
    setError(null);
    fetchClaims();
  };

  const handleClaim = async (walletAddress: string) => {
    if (!currentAccount?.address) return;
    
    setClaiming(walletAddress);
    try {
      await claimAllocation(walletAddress);
      await fetch(`/api/claimlist`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          walletAddress, 
          beneAddress: currentAccount.address 
        })
      });
      await fetchClaims();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Claim failed');
    } finally {
      setClaiming(null);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin text-5xl mb-4">⚱️</div>
        <p className="text-[var(--blood-red)] font-zombie text-xl">Searching the crypt for treasures...</p>
        <p className="text-[var(--zombie-green)] text-sm mt-2">Disturbing ancient graves...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 p-8 bg-[rgba(138,3,3,0.2)] border-4 border-[var(--blood-red)] rounded-lg">
        <div className="text-6xl mb-4">💀</div>
        <h3 className="text-[var(--blood-red)] font-zombie text-2xl mb-4">Grave Robbing Failed</h3>
        <p className="text-[var(--decay-yellow)] mb-6">The spirits are angry: {error}</p>
        
        <div className="group relative inline-block">
          <div className="absolute -inset-1 bg-[rgba(138,3,3,0.3)] rounded blur opacity-75 group-hover:opacity-100 transition-all duration-300" />
          <button 
            onClick={handleRetry} 
            className="relative bg-[var(--blood-red)] hover:bg-[rgba(138,3,3,0.8)] text-[var(--decay-yellow)] px-6 py-3 rounded font-zombie text-lg
                      transition-all duration-300 border-2 border-[var(--decay-yellow)] hover:shadow-[0_0_10px_rgba(138,3,3,0.5)]"
          >
            🔄 Retry Excavation
          </button>
        </div>
      </div>
    );
  }

  if (beneficiaries.length === 0) {
    return (
      <div className="text-center py-16 bg-[rgba(107,140,33,0.1)] border-4 border-[var(--zombie-green)] rounded-lg">
        <div className="text-8xl mb-6 animate-float">🕸️</div>
        <h3 className="text-[var(--zombie-green)] font-zombie text-2xl mb-4">No Blood Money to Claim</h3>
        <p className="text-[var(--decay-yellow)] text-lg">The vaults remain sealed... for now.</p>
        <p className="text-[var(--zombie-green)] text-sm mt-2">Wait for souls to perish and their treasures to unlock.</p>
      </div>
    );
  }

  const claimableCount = beneficiaries.filter(b => calculateTimeRemaining(b) <= 0).length;
  const totalValue = beneficiaries.reduce((sum, b) => sum + b.allocation, 0);

  return (
    <div className="space-y-6">
      {/* Claims Table */}
      <div className="bg-[rgba(10,10,8,0.9)] border-4 border-[var(--decay-yellow)] rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            {/* Table Header */}
            <thead className="bg-[rgba(107,140,33,0.3)] border-b-2 border-[var(--zombie-green)]">
              <tr>
                <th className="px-4 py-4 text-left text-[var(--decay-yellow)] font-zombie text-lg">
                  👑 Deceased Owner
                </th>
                <th className="px-4 py-4 text-left text-[var(--decay-yellow)] font-zombie text-lg">
                  ⚰️ Cursed Vault
                </th>
                <th className="px-4 py-4 text-left text-[var(--decay-yellow)] font-zombie text-lg">
                  💰 Blood Money
                </th>
                <th className="px-4 py-4 text-left text-[var(--decay-yellow)] font-zombie text-lg">
                  ⏰ Death Timer
                </th>
                <th className="px-4 py-4 text-left text-[var(--decay-yellow)] font-zombie text-lg">
                  💀 Soul Status
                </th>
                <th className="px-4 py-4 text-left text-[var(--decay-yellow)] font-zombie text-lg">
                  🏴‍☠️ Action
                </th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-[var(--zombie-green)]">
              {beneficiaries.map((beneficiary) => {
                const timeRemaining = calculateTimeRemaining(beneficiary);
                const isClaimable = timeRemaining <= 0;
                const daysRemaining = Math.ceil(timeRemaining / (1000 * 60 * 60 * 24));
                
                const timeRemainingText = isClaimable 
                  ? '💀 DEPARTED' 
                  : `⏳ ${daysRemaining} days`;

                const rowBg = isClaimable 
                  ? 'rgba(138,3,3,0.2)' 
                  : 'rgba(107,140,33,0.1)';

                return (
                  <tr 
                    key={beneficiary._id}
                    className="hover:bg-[rgba(107,140,33,0.2)] transition-all duration-300"
                    style={{ backgroundColor: rowBg }}
                  >
                    {/* Owner */}
                    <td className="px-4 py-4">
                      <div className="flex items-center">
                        <div className="text-xl mr-2">
                          {isClaimable ? '💀' : '👑'}
                        </div>
                        <div>
                          <p className="text-[var(--zombie-green)] font-mono text-sm">
                            {formatAddressDisplay(beneficiary.ownerAddress)}
                          </p>
                          <p className="text-[var(--decay-yellow)] text-xs">
                            {isClaimable ? 'Soul Departed' : 'Still Breathing'}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Wallet */}
                    <td className="px-4 py-4">
                      <div className="flex items-center">
                        <div className="text-xl mr-2">⚰️</div>
                        <div>
                          <p className="text-[var(--decay-yellow)] font-mono text-sm">
                            {formatAddressDisplay(beneficiary.walletAddress)}
                          </p>
                          <p className="text-[var(--zombie-green)] text-xs">Vault Address</p>
                        </div>
                      </div>
                    </td>

                    {/* Allocation */}
                    <td className="px-4 py-4">
                      <div className="flex items-center">
                        <div className="text-xl mr-2">
                          {isClaimable ? '🩸' : '💰'}
                        </div>
                        <div>
                          <p className={`font-bold text-lg ${isClaimable ? 'text-[var(--blood-red)] animate-pulse' : 'text-[var(--zombie-green)]'}`}>
                            {beneficiary.allocation.toFixed(2)} SUI
                          </p>
                          <p className="text-[var(--decay-yellow)] text-xs">
                            {isClaimable ? 'Ready to Claim' : 'Locked Away'}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Inactivity Period */}
                    <td className="px-4 py-4">
                      <div className="flex items-center">
                        <div className="text-xl mr-2">⏰</div>
                        <div>
                          <p className="text-[var(--zombie-green)] font-bold">
                            {beneficiary.inactivityDuration} {beneficiary.inactivityUnit}
                          </p>
                          <p className="text-[var(--decay-yellow)] text-xs">Death Period</p>
                        </div>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-4">
                      <div className="flex items-center">
                        <div className="text-xl mr-2">
                          {isClaimable ? '💀' : '👻'}
                        </div>
                        <div>
                          <p className={`font-zombie text-sm font-bold ${isClaimable ? 'text-[var(--blood-red)]' : 'text-[var(--zombie-green)]'}`}>
                            {timeRemainingText}
                          </p>
                          <p className="text-[var(--decay-yellow)] text-xs">
                            {isClaimable ? 'Claim Available' : 'Still Alive'}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Action */}
                    <td className="px-4 py-4">
                      <div className="group/btn relative">
                        <div 
                          className="absolute -inset-1 rounded blur opacity-75 group-hover/btn:opacity-100 transition-all duration-300"
                          style={{ 
                            backgroundColor: `rgba(${isClaimable ? '138,3,3' : '107,140,33'}, 0.4)`
                          }}
                        />
                        <button
                          onClick={() => handleClaim(beneficiary.walletAddress)}
                          disabled={!isClaimable || claiming === beneficiary.walletAddress}
                          className={`relative px-4 py-2 rounded font-zombie text-sm border-2 transition-all duration-300 ${
                            isClaimable 
                              ? 'bg-[var(--blood-red)] hover:bg-[rgba(138,3,3,0.8)] text-[var(--decay-yellow)] border-[var(--decay-yellow)] hover:shadow-[0_0_10px_rgba(138,3,3,0.5)] hover:scale-105'
                              : 'bg-[rgba(107,140,33,0.3)] text-[var(--zombie-green)] border-[var(--zombie-green)] cursor-not-allowed opacity-50'
                          }`}
                        >
                          {claiming === beneficiary.walletAddress 
                            ? '⚰️ Robbing...' 
                            : isClaimable 
                              ? '🩸 Claim Now'
                              : '⏳ Wait for Death'
                          }
                        </button>
                      </div>

                      {claiming === beneficiary.walletAddress && (
                        <div className="flex items-center mt-2">
                          <div className="animate-spin text-lg mr-2">💀</div>
                          <p className="text-[var(--blood-red)] text-xs font-zombie">
                            Grave robbing...
                          </p>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Header with Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-[rgba(138,3,3,0.2)] border-2 border-[var(--blood-red)] rounded-lg p-4 text-center">
          <div className="text-3xl mb-2">⚱️</div>
          <p className="text-[var(--blood-red)] font-zombie text-xl">{claimableCount}</p>
          <p className="text-[var(--decay-yellow)] text-sm">Ready to Plunder</p>
        </div>
        
        <div className="bg-[rgba(107,140,33,0.2)] border-2 border-[var(--zombie-green)] rounded-lg p-4 text-center">
          <div className="text-3xl mb-2">💰</div>
          <p className="text-[var(--zombie-green)] font-zombie text-xl">{totalValue.toFixed(2)}</p>
          <p className="text-[var(--decay-yellow)] text-sm">Total SUI Cursed</p>
        </div>
        
        <div className="bg-[rgba(196,183,13,0.2)] border-2 border-[var(--decay-yellow)] rounded-lg p-4 text-center">
          <div className="text-3xl mb-2">🏴‍☠️</div>
          <p className="text-[var(--decay-yellow)] font-zombie text-xl">{beneficiaries.length}</p>
          <p className="text-[var(--zombie-green)] text-sm">Death Contracts</p>
        </div>
      </div>

      {/* Footer Notice */}
      <div className="bg-[rgba(10,10,8,0.8)] border-2 border-[var(--decay-yellow)] rounded-lg p-6">
        <div className="flex items-center">
          <div className="text-4xl mr-4">🏴‍☠️</div>
          <div>
            <h4 className="text-[var(--decay-yellow)] font-zombie text-lg mb-2">Grave Robber's Code</h4>
            <p className="text-[var(--zombie-green)] text-sm">
              Only souls who have missed their check-in deadline can have their blood money claimed. 
              The dead cannot protect their treasures from the living. Each row shows a different death contract.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ClaimList;
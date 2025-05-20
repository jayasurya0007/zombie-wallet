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

  const calculateTimeRemaining = (beneficiary: Beneficiary) => {
  const lastCheckin = new Date(beneficiary.timestamp_checkin).getTime();
  const durationMap = {
    minutes: 60 * 1000,
    hours: 60 * 60 * 1000,
    days: 24 * 60 * 60 * 1000
  } as const; // Add const assertion

  // Add type assertion for the unit
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
      await fetch(`/api/beneficiaries`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, beneAddress: currentAccount.address })
      });
      await fetchClaims();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Claim failed');
    } finally {
      setClaiming(null);
    }
  };

  if (loading) return <div className="flex justify-center p-4">Loading...</div>;
  if (error) return (
    <div className="p-4 text-center">
      <div className="text-red-500 mb-2">Error: {error}</div>
      <button onClick={handleRetry} className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded">
        Retry
      </button>
    </div>
  );

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Owner</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Wallet</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Allocation</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Inactivity Period</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {beneficiaries.map((beneficiary) => {
            const timeRemaining = calculateTimeRemaining(beneficiary);
            const isClaimable = timeRemaining <= 0;
            const timeRemainingText = isClaimable 
              ? 'Available to claim' 
              : `${Math.ceil(timeRemaining/(1000*60*60*24))} days remaining`;

            return (
              <tr key={beneficiary._id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">
                  {formatAddressDisplay(beneficiary.ownerAddress)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">
                  {formatAddressDisplay(beneficiary.walletAddress)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {beneficiary.allocation.toFixed(2)} SUI
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {beneficiary.inactivityDuration} {beneficiary.inactivityUnit}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {timeRemainingText}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <button
                    onClick={() => handleClaim(beneficiary.walletAddress)}
                    disabled={!isClaimable || claiming === beneficiary.walletAddress}
                    className={`${
                      isClaimable 
                        ? 'bg-green-100 hover:bg-green-200 text-green-800'
                        : 'bg-gray-100 text-gray-500 cursor-not-allowed'
                    } px-3 py-1 rounded text-sm disabled:opacity-50`}
                  >
                    {claiming === beneficiary.walletAddress ? 'Claiming...' : 'Claim'}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {beneficiaries.length === 0 && (
        <div className="p-4 text-gray-500 text-center">No available claims</div>
      )}
    </div>
  );
}

export default ClaimList;
// app/components/BeneficiaryList.tsx
'use client';
import { useEffect, useState } from 'react';
import { formatAddressDisplay, formatDate } from '@/lib/utils';

interface Beneficiary {
  _id: string;
  ownerAddress: string;
  beneAddress: string;
  allocation: number;
  inactivityDuration: number;
  inactivityUnit: string;
  timestamp_checkin: string;
  timestamp_created: string;
  walletAddress: string;
}

export default function BeneficiaryList({ ownerAddress }: { ownerAddress: string }) {
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add auto-refresh for real-time status updates
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
      days: 24 * 60 * 60 * 1000,
    } as const;

    const unit = beneficiary.inactivityUnit as keyof typeof durationMap;
    const expirationTime = lastCheckin + 
      (beneficiary.inactivityDuration * durationMap[unit]);
    
    return expirationTime - Date.now();
  };

  const fetchBeneficiaries = async () => {
    try {
      const response = await fetch(`/api/beneficiaries?ownerAddress=${ownerAddress}`);
      if (!response.ok) throw new Error('Failed to fetch beneficiaries');
      
      const data = await response.json();
      setBeneficiaries(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load beneficiaries');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async (beneAddress: string) => {
    try {
      const response = await fetch('/api/beneficiaries', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerAddress, beneAddress }),
      });

      if (!response.ok) throw new Error('Check-in failed');
      await fetchBeneficiaries();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Check-in failed');
    }
  };

  useEffect(() => {
    fetchBeneficiaries();
  }, [ownerAddress]);

  if (loading) return <div>Loading beneficiaries...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-lg font-semibold mb-4">Beneficiary Check-ins</h2>
      <div className="space-y-4">
        {beneficiaries.map((beneficiary) => {
          const timeRemaining = calculateTimeRemaining(beneficiary);
          const isCheckInEnabled = timeRemaining > 0;
          const statusText = isCheckInEnabled 
            ? `Active (${Math.ceil(timeRemaining/(1000*60*60*24))} days remaining)`
            : 'Inactive - Period expired';

          return (
            <div key={beneficiary._id} className="p-4 border rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <div>
                  <p className="font-medium">
                    {formatAddressDisplay(beneficiary.beneAddress)}
                  </p>
                  <p className="text-sm text-gray-600">
                    Allocation: {beneficiary.allocation} SUI
                  </p>
                  <p className="text-sm text-gray-600">
                    Inactivity Period: {beneficiary.inactivityDuration} {beneficiary.inactivityUnit}
                  </p>
                  <p className="text-sm text-gray-600">
                    Wallet: {formatAddressDisplay(beneficiary.walletAddress)}
                  </p>
                  <p className="text-sm text-gray-500">
                    Status: {statusText}
                  </p>
                </div>
                <button
                  onClick={() => handleCheckIn(beneficiary.beneAddress)}
                  disabled={!isCheckInEnabled}
                  className={`${
                    isCheckInEnabled
                      ? 'bg-blue-100 hover:bg-blue-200 text-blue-800'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  } px-4 py-2 rounded transition-colors`}
                >
                  Check In
                </button>
              </div>
              <div className="text-sm text-gray-500">
                <p>Last check-in: {formatDate(beneficiary.timestamp_checkin)}</p>
                <p>Created: {formatDate(beneficiary.timestamp_created)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
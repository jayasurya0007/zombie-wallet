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

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin text-4xl mb-4">👻</div>
        <p className="text-[var(--zombie-green)] font-zombie text-lg">Communing with the spirits...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 p-6 bg-[rgba(138,3,3,0.2)] border-2 border-[var(--blood-red)] rounded-lg">
        <div className="text-4xl mb-4">💀</div>
        <p className="text-[var(--blood-red)] font-zombie text-lg mb-2">Soul Connection Failed</p>
        <p className="text-[var(--decay-yellow)] text-sm">{error}</p>
      </div>
    );
  }

  if (beneficiaries.length === 0) {
    return (
      <div className="text-center py-12 bg-[rgba(107,140,33,0.1)] border-2 border-[var(--zombie-green)] rounded-lg">
        <div className="text-6xl mb-4 animate-float">🕷️</div>
        <h3 className="text-[var(--zombie-green)] font-zombie text-xl mb-2">No Souls Under Watch</h3>
        <p className="text-[var(--decay-yellow)]">The crypt is empty... for now.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <div className="text-3xl mr-3 animate-tilt">👁️</div>
          <h2 className="text-[var(--decay-yellow)] font-zombie text-xl">Soul Surveillance Registry</h2>
        </div>
        <div className="text-[var(--zombie-green)] font-mono text-sm">
          🦴 {beneficiaries.length} Souls Monitored
        </div>
      </div>

      {/* Table Header */}
      <div className="bg-[rgba(10,10,8,0.9)] border-2 border-[var(--zombie-green)] rounded-lg overflow-hidden">
        <div className="grid grid-cols-12 gap-4 p-4 bg-[rgba(107,140,33,0.3)] border-b-2 border-[var(--zombie-green)]">
          <div className="col-span-2 text-[var(--decay-yellow)] font-zombie text-sm">
            🧟‍♀️ Soul ID
          </div>
          <div className="col-span-2 text-[var(--decay-yellow)] font-zombie text-sm">
            💰 Blood Money
          </div>
          <div className="col-span-2 text-[var(--decay-yellow)] font-zombie text-sm">
            ⚰️ Death Timer
          </div>
          <div className="col-span-2 text-[var(--decay-yellow)] font-zombie text-sm">
            👁️ Status
          </div>
          <div className="col-span-2 text-[var(--decay-yellow)] font-zombie text-sm">
            🕐 Last Heartbeat
          </div>
          <div className="col-span-2 text-[var(--decay-yellow)] font-zombie text-sm">
            💓 Actions
          </div>
        </div>

        {/* Table Rows */}
        <div className="divide-y divide-[var(--zombie-green)]">
          {beneficiaries.map((beneficiary, index) => {
            const timeRemaining = calculateTimeRemaining(beneficiary);
            const isCheckInEnabled = timeRemaining > 0;
            const daysRemaining = Math.ceil(timeRemaining / (1000 * 60 * 60 * 24));
            
            const statusText = isCheckInEnabled 
              ? `🟢 Alive (${daysRemaining}d)`
              : '💀 DECEASED';

            const statusColor = isCheckInEnabled ? 'var(--zombie-green)' : 'var(--blood-red)';
            const rowBg = index % 2 === 0 ? 'rgba(10,10,8,0.5)' : 'rgba(10,10,8,0.3)';

            return (
              <div key={beneficiary._id}>
                <div
                  className="grid grid-cols-12 gap-6 p-6 hover:bg-[rgba(107,140,33,0.1)] transition-all duration-300 relative group rounded-md"
                  style={{ backgroundColor: rowBg }}
                >
                  {/* Soul Status Icon */}
                  <div className="absolute -top-2 -right-2 text-lg z-10">
                    {isCheckInEnabled ? '👻' : '💀'}
                  </div>

                  {/* Soul ID */}
                  <div className="col-span-2">
                    <div className="flex flex-col">
                      <p className="text-[var(--zombie-green)] font-mono text-sm">
                        {beneficiary.beneAddress}
                      </p>
                    </div>
                  </div>

                  {/* Blood Money */}
                  <div className="col-span-2">
                    <div className="flex items-center">
                      <span className="text-[var(--decay-yellow)] font-bold text-lg">
                        {beneficiary.allocation} SUI
                      </span>
                    </div>
                  </div>

                  {/* Death Timer */}
                  <div className="col-span-2">
                    <div className="flex items-center">
                      <span className="text-[var(--zombie-green)] font-bold">
                        {beneficiary.inactivityDuration} {beneficiary.inactivityUnit}
                      </span>
                    </div>
                  </div>

                  {/* Status */}
                  <div className="col-span-2">
                    <div className="flex flex-col">
                      <span className="font-bold text-sm" style={{ color: statusColor }}>
                        {statusText}
                      </span>
                      {isCheckInEnabled && timeRemaining < 7 * 24 * 60 * 60 * 1000 && (
                        <span className="text-[var(--blood-red)] text-xs animate-pulse">
                          ⚠️ Check-in soon!
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Last Heartbeat */}
                  <div className="col-span-2">
                    <div className="flex flex-col">
                      <span className="text-[var(--decay-yellow)] text-sm font-mono">
                        {formatDate(beneficiary.timestamp_checkin)}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="col-span-2">
                    <button
                      onClick={() => handleCheckIn(beneficiary.beneAddress)}
                      disabled={!isCheckInEnabled}
                      className={`px-4 py-2 rounded font-zombie text-sm border-2 transition-all duration-300 w-full ${
                        isCheckInEnabled
                          ? 'bg-[var(--zombie-green)] hover:bg-[rgba(107,140,33,0.8)] text-[var(--decay-yellow)] border-[var(--decay-yellow)] hover:shadow-[0_0_5px_rgba(107,140,33,0.5)] hover:scale-105'
                          : 'bg-[rgba(138,3,3,0.5)] text-[var(--decay-yellow)] border-[var(--blood-red)] cursor-not-allowed opacity-50'
                      }`}
                    >
                      {isCheckInEnabled ? '💓 Prove Life' : '💀 Departed'}
                    </button>
                  </div>
                </div>

                {/* Expanded Info Row - Show on hover or for expired souls */}
                {(!isCheckInEnabled || false) && (
                  <div className="bg-[rgba(138,3,3,0.2)] border-t-2 border-[var(--blood-red)] p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Wallet Address */}
                      <div className="bg-[rgba(10,10,8,0.5)] border border-[var(--zombie-green)] rounded p-3">
                        <p className="text-[var(--zombie-green)] text-sm font-zombie mb-1">🏴‍☠️ Cursed Vault</p>
                        <p className="text-[var(--decay-yellow)] font-mono text-sm">
                          {formatAddressDisplay(beneficiary.walletAddress)}
                        </p>
                      </div>

                      {/* Creation Date */}
                      <div className="bg-[rgba(196,183,13,0.1)] border border-[var(--decay-yellow)] rounded p-3">
                        <p className="text-[var(--decay-yellow)] text-sm font-zombie mb-1">⚰️ Soul Bound</p>
                        <p className="text-[var(--zombie-green)] text-sm font-mono">
                          {formatDate(beneficiary.timestamp_created)}
                        </p>
                      </div>
                    </div>

                    {/* Danger Zone for Expired Souls */}
                    {!isCheckInEnabled && (
                      <div className="mt-4 p-3 bg-[rgba(138,3,3,0.3)] border-2 border-[var(--blood-red)] rounded animate-pulse">
                        <div className="flex items-center text-[var(--blood-red)]">
                          <div className="text-2xl mr-3">⚠️</div>
                          <div>
                            <p className="font-zombie text-lg">SOUL TRANSFER ACTIVATED</p>
                            <p className="text-sm text-[var(--decay-yellow)]">
                              This soul's funds are now claimable by the heir.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer Stats */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[rgba(107,140,33,0.2)] border-2 border-[var(--zombie-green)] rounded p-4 text-center">
          <div className="text-2xl mb-2">🟢</div>
          <p className="text-[var(--zombie-green)] font-zombie text-lg">
            {beneficiaries.filter(b => calculateTimeRemaining(b) > 0).length}
          </p>
          <p className="text-[var(--decay-yellow)] text-sm">Living Souls</p>
        </div>
        
        <div className="bg-[rgba(138,3,3,0.2)] border-2 border-[var(--blood-red)] rounded p-4 text-center">
          <div className="text-2xl mb-2">💀</div>
          <p className="text-[var(--blood-red)] font-zombie text-lg">
            {beneficiaries.filter(b => calculateTimeRemaining(b) <= 0).length}
          </p>
          <p className="text-[var(--decay-yellow)] text-sm">Departed Souls</p>
        </div>
        
        <div className="bg-[rgba(196,183,13,0.2)] border-2 border-[var(--decay-yellow)] rounded p-4 text-center">
          <div className="text-2xl mb-2">⚰️</div>
          <p className="text-[var(--decay-yellow)] font-zombie text-lg">
            {beneficiaries.reduce((sum, b) => sum + b.allocation, 0).toFixed(2)}
          </p>
          <p className="text-[var(--zombie-green)] text-sm">Total SUI Cursed</p>
        </div>
      </div>
    </div>
  );
}
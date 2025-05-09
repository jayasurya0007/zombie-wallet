'use client';

import { useEffect, useState } from 'react';
import { useContract } from '@/app/context/ContractContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const GAS_BUFFER = 50_000_000; // 0.01 SUI in MIST

export default function Dashboard() {
  const {
    registries,
    createRegistry,
    createWallet,
    getCoins,
  } = useContract();

  const [coinId, setCoinId] = useState('');
  const [coins, setCoins] = useState<{ coinObjectId: string, balance: string }[]>([]);
  const [duration, setDuration] = useState(0);
  const [timeUnit, setTimeUnit] = useState(0); // 0 for minutes, 1 for days
  const [beneficiaries, setBeneficiaries] = useState<string[]>(['']);
  const [allocations, setAllocations] = useState<number[]>([0]);
  const [error, setError] = useState<string | null>(null);

  // Fetch user's SUI coins
  useEffect(() => {
    getCoins().then(setCoins);
  }, [getCoins, registries.length]);

  const selectedCoin = coins.find(c => c.coinObjectId === coinId);
  const coinBalance = selectedCoin ? Number(selectedCoin.balance) : 0;
  const maxLockable = coinBalance > GAS_BUFFER ? coinBalance - GAS_BUFFER : 0;
  const allocationsSum = allocations.reduce((a, b) => a + Number(b), 0);

  // Format SUI from MIST for display
  const formatSui = (val: number | string) =>
    (Number(val) / 1e9).toLocaleString(undefined, { maximumFractionDigits: 9 });

  const handleCreateWallet = async () => {
    setError(null);
    if (!coinId) {
      setError('Please select a coin.');
      return;
    }
    if (allocationsSum <= 0 || allocationsSum > maxLockable) {
      setError(
        `Sum of allocations (${formatSui(allocationsSum)} SUI) must be greater than 0 and less than or equal to max lockable (${formatSui(maxLockable)} SUI).`
      );
      return;
    }
    if (duration <= 0) {
      setError('Duration must be greater than 0.');
      return;
    }
    if (beneficiaries.some((b) => !b)) {
      setError('All beneficiary addresses must be filled.');
      return;
    }
    if (allocations.some((a) => a <= 0)) {
      setError('All allocations must be greater than 0.');
      return;
    }
    try {
      await createWallet(
        coinId,
        duration,
        timeUnit,
        beneficiaries,
        allocations
      );
      setCoinId('');
      setDuration(0);
      setTimeUnit(0);
      setBeneficiaries(['']);
      setAllocations([0]);
      setError(null);
    } catch (error: any) {
      setError(error?.message || 'Error creating wallet');
      console.error('Error creating wallet:', error);
    }
  };

  const handleAddBeneficiary = () => {
    setBeneficiaries([...beneficiaries, '']);
    setAllocations([...allocations, 0]);
  };

  const handleBeneficiaryChange = (index: number, value: string) => {
    const updated = [...beneficiaries];
    updated[index] = value;
    setBeneficiaries(updated);
  };

  const handleAllocationChange = (index: number, value: number) => {
    const updated = [...allocations];
    updated[index] = Math.round(value * 1e9); // store in MIST
    setAllocations(updated);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Zombie Wallet Dashboard</h1>

      {!registries.length && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Create Registry</CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={createRegistry}>Create Registry</Button>
          </CardContent>
        </Card>
      )}

      {registries.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Create Zombie Wallet</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="coinId">Coin</Label>
                <select
                  id="coinId"
                  value={coinId}
                  onChange={e => {
                    setCoinId(e.target.value);
                  }}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="">Select a Coin</option>
                  {coins.map((coin) => (
                    <option key={coin.coinObjectId} value={coin.coinObjectId}>
                      {coin.coinObjectId} (Balance: {formatSui(coin.balance)} SUI)
                    </option>
                  ))}
                </select>
                {selectedCoin && (
                  <div className="text-xs text-gray-500 mt-1">
                    Selected coin balance: <b>{formatSui(selectedCoin.balance)} SUI</b>
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor="duration">Inactivity Duration</Label>
                <Input
                  id="duration"
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  placeholder="Enter duration"
                  min={1}
                />
              </div>

              <div>
                <Label htmlFor="timeUnit">Time Unit</Label>
                <select
                  id="timeUnit"
                  value={timeUnit}
                  onChange={(e) => setTimeUnit(Number(e.target.value))}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value={0}>Minutes</option>
                  <option value={1}>Days</option>
                </select>
              </div>

              <div>
                <Label>Beneficiaries and Allocations</Label>
                {beneficiaries.map((beneficiary, index) => (
                  <div key={index} className="flex space-x-2 mb-2">
                    <Input
                      value={beneficiary}
                      onChange={(e) =>
                        handleBeneficiaryChange(index, e.target.value)
                      }
                      placeholder="Beneficiary Address"
                    />
                    <Input
                      type="number"
                      value={allocations[index] ? allocations[index] / 1e9 : ''}
                      min={0}
                      step={0.000000001}
                      onChange={(e) =>
                        handleAllocationChange(index, Number(e.target.value))
                      }
                      placeholder="Allocation (SUI)"
                    />
                  </div>
                ))}
                <Button type="button" onClick={handleAddBeneficiary}>
                  Add Beneficiary
                </Button>
                <div className="text-xs text-gray-500 mt-2">
                  <b>Sum of allocations to lock:</b> {formatSui(allocationsSum)} SUI
                  {selectedCoin && (
                    <> / <b>{formatSui(maxLockable)} SUI</b> (must be ≤ coin balance minus gas buffer)</>
                  )}
                  {allocationsSum > maxLockable && (
                    <span className="text-red-500 ml-2">
                      Not enough SUI for gas! Reduce allocations to at most {formatSui(maxLockable)} SUI.
                    </span>
                  )}
                </div>
              </div>

              {error && (
                <div className="text-red-500 text-sm">{error}</div>
              )}

              <Button
                onClick={handleCreateWallet}
                disabled={
                  !coinId ||
                  allocationsSum <= 0 ||
                  allocationsSum > maxLockable ||
                  duration <= 0 ||
                  beneficiaries.some((b) => !b) ||
                  allocations.some((a) => a <= 0)
                }
              >
                Create Zombie Wallet
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

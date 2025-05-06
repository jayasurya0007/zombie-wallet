'use client';
import { useState, useEffect } from 'react';
import { useContract } from '@/app/context/ContractContext';
import { useSuiClient, useCurrentAccount } from '@mysten/dapp-kit';

interface CoinBalance {
  objectId: string;
  balance: string;
}

export default function ZombieWalletManager() {
  const { registries, wallets, createRegistry, createWallet, isLoading } = useContract();
  const account = useCurrentAccount();
  const provider = useSuiClient();
  
  const [duration, setDuration] = useState(1);
  const [timeUnit, setTimeUnit] = useState(1);
  const [beneficiaries, setBeneficiaries] = useState<{ address: string; allocation: string }[]>([]);
  const [selectedCoin, setSelectedCoin] = useState('');
  const [zkCommitment, setZkCommitment] = useState('');
  const [coins, setCoins] = useState<CoinBalance[]>([]);

  // Fetch user's SUI coins
  useEffect(() => {
    const fetchCoins = async () => {
      if (!account?.address) return;
      
      const suiCoins = await provider.getCoins({
        owner: account.address,
        coinType: '0x2::sui::SUI',
      });
      
      setCoins(suiCoins.data.map(coin => ({
        objectId: coin.coinObjectId,
        balance: coin.balance,
      })));
    };
    
    fetchCoins();
  }, [account?.address, provider]);

  const isValidSuiId = (id: string) => /^0x[0-9a-fA-F]{64}$/.test(id);

  const addBeneficiary = () => {
    setBeneficiaries([...beneficiaries, { address: '', allocation: '' }]);
  };

  const updateBeneficiary = (index: number, field: 'address' | 'allocation', value: string) => {
    setBeneficiaries(current => 
      current.map((beneficiary, i) => 
        i === index ? { ...beneficiary, [field]: value } : beneficiary
      )
    );
  };

  const handleCreateWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Validate inputs
      if (!selectedCoin || !isValidSuiId(selectedCoin)) {
        throw new Error("Please select a valid SUI coin from the dropdown");
      }

      if (beneficiaries.length === 0) {
        throw new Error("At least one beneficiary required");
      }

      const allocations = beneficiaries.map((b, index) => {
        // Validate beneficiary address
        if (!isValidSuiId(b.address)) {
          throw new Error(`Invalid Sui address for beneficiary ${index + 1}`);
        }

        // Validate allocation
        const suiValue = parseFloat(b.allocation);
        if (isNaN(suiValue)) {
          throw new Error(`Invalid number format for beneficiary ${index + 1}`);
        }
        if (suiValue <= 0) {
          throw new Error(`Allocation must be > 0 for beneficiary ${index + 1}`);
        }

        const mist = Math.round(suiValue * 1_000_000_000);
        if (mist <= 0) {
          throw new Error(`Allocation too small (min 0.000000001 SUI) for beneficiary ${index + 1}`);
        }

        return mist;
      });

      await createWallet(
        selectedCoin,
        duration,
        timeUnit,
        beneficiaries.map(b => b.address),
        allocations,
        zkCommitment
      );
      
      // Reset form
      setBeneficiaries([]);
      setSelectedCoin('');
      setZkCommitment('');
    } catch (error: unknown) {
      console.error("Creation failed:", error);
      alert(error instanceof Error ? error.message : "Unknown error occurred");
    }
  };

  if (wallets.length > 0) return null;

  return (
    <div className="zombie-wallet-section">
      <h2>Create Zombie Wallet</h2>
      
      {registries.length === 0 ? (
        <div className="registry-prompt">
          <p>First time user? Create your registry first.</p>
          <button 
            onClick={createRegistry}
            disabled={isLoading}
            className="registry-button"
          >
            {isLoading ? 'Creating Registry...' : 'Create Registry'}
          </button>
        </div>
      ) : (
        <form onSubmit={handleCreateWallet} className="wallet-form">
          <div className="form-group">
            <label>Inactive Period:</label>
            <div className="duration-input">
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(Math.max(1, Number(e.target.value)))}
                min="1"
                className="duration-field"
              />
              <select
                value={timeUnit}
                onChange={(e) => setTimeUnit(Number(e.target.value))}
                className="time-unit-select"
              >
                <option value={0}>Minutes</option>
                <option value={1}>Days</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Beneficiaries:</label>
            {beneficiaries.map((beneficiary, index) => (
              <div key={index} className="beneficiary-row">
                <input
                  type="text"
                  placeholder="0x..."
                  value={beneficiary.address}
                  onChange={(e) => updateBeneficiary(index, 'address', e.target.value)}
                  className="address-input"
                />
                <input
                  type="number"
                  placeholder="Allocation (SUI)"
                  step="0.000000001"
                  min="0.000000001"
                  value={beneficiary.allocation}
                  onChange={(e) => updateBeneficiary(index, 'allocation', e.target.value)}
                  className="allocation-input"
                />
                <button
                  type="button"
                  onClick={() => setBeneficiaries(b => b.filter((_, i) => i !== index))}
                  className="remove-button"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addBeneficiary}
              className="add-beneficiary-button"
            >
              + Add Beneficiary
            </button>
          </div>

          <div className="form-group">
            <label>Select SUI Coin:</label>
            <select
              value={selectedCoin}
              onChange={(e) => setSelectedCoin(e.target.value)}
              className="coin-select"
              required
            >
              <option value="">Select a Coin</option>
              {coins.map(coin => (
                <option 
                  key={coin.objectId} 
                  value={coin.objectId}
                >
                  {coin.objectId} - {(Number(coin.balance) / 1_000_000_000).toFixed(9)} SUI
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>ZK Commitment:</label>
            <input
              type="text"
              value={zkCommitment}
              onChange={(e) => setZkCommitment(e.target.value)}
              placeholder="0x..."
              className="zk-input"
              pattern="0x[a-fA-F0-9]+"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !selectedCoin || beneficiaries.length === 0}
            className="submit-button"
          >
            {isLoading ? 'Creating Wallet...' : 'Create Zombie Wallet'}
          </button>
        </form>
      )}
    </div>
  );
}
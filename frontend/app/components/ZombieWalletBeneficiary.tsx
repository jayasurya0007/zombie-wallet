'use client';
import { useQuery } from '@apollo/client';
import { useState, useEffect } from 'react';
import client from '@/lib/client';
import { GET_ZOMBIE_WALLETS, ZombieWallet, ZombieWalletData } from '@/lib/queries';

interface ZombieWalletBeneficiaryProps {
  // You can add any props you might need here
  className?: string;
}

export const ZombieWalletBeneficiary = ({ className }: ZombieWalletBeneficiaryProps) => {
  const { loading, error, data } = useQuery<ZombieWalletData>(GET_ZOMBIE_WALLETS, { client });
  const [selectedWallet, setSelectedWallet] = useState<ZombieWallet | null>(null);

  useEffect(() => {
    if (data && data.objects.nodes.length > 0 && !selectedWallet) {
      setSelectedWallet(data.objects.nodes[0]);
    }
  }, [data, selectedWallet]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading wallet data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center text-red-500">
          <p>Error loading wallet data:</p>
          <p className="mt-2">{error.message}</p>
        </div>
      </div>
    );
  }

  const wallets = data?.objects.nodes || [];

  return (
    <div className={`min-h-screen bg-gray-50 ${className}`}>
      <header className="bg-gradient-to-r from-purple-600 to-blue-500 text-white py-8 px-4 shadow-md">
        <div className="container mx-auto">
          <h1 className="text-3xl font-bold">Zombie Wallet Dashboard</h1>
          <p className="mt-2 opacity-90">Track and manage Zombie Wallets on Sui Blockchain</p>
        </div>
      </header>

      <main className="container mx-auto py-8 px-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <WalletList
              wallets={wallets}
              selectedWallet={selectedWallet}
              onSelectWallet={setSelectedWallet}
            />
          </div>
          <div className="lg:col-span-2">
            <WalletDetails wallet={selectedWallet} />
          </div>
        </div>
      </main>
    </div>
  );
};

// Helper components and functions remain the same
const formatAddress = (bytes: number[]) => {
  return '0x' + bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
};

const formatUID = (bytes: number[]) => {
  return '0x' + bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
};

interface WalletDetailsProps {
  wallet: ZombieWallet | null;
}

const WalletDetails: React.FC<WalletDetailsProps> = ({ wallet }) => {
  if (!wallet) {
    return (
      <div className="bg-white rounded-lg shadow p-6 flex items-center justify-center">
        <p className="text-gray-500">Select a wallet to view details</p>
      </div>
    );
  }

  const data = wallet.asMoveObject.contents.data.Struct;
  const id = data.find((f) => f.name === 'id')?.value.UID;
  const owner = data.find((f) => f.name === 'owner')?.value.Address;
  const coinValue = data.find((f) => f.name === 'coin')?.value.Struct[0].value.Number;
  const beneficiaries = data.find((f) => f.name === 'beneficiary_addrs')?.value.Vector || [];

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold text-purple-700 border-b border-gray-200 pb-2 mb-4">
        Wallet Details
      </h2>

      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium text-purple-600 mb-2">Basic Information</h3>
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center">
              <span className="text-sm font-medium text-gray-500 sm:w-32">Address:</span>
              <span className="font-mono text-sm break-all">{wallet.asMoveObject.address}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center">
              <span className="text-sm font-medium text-gray-500 sm:w-32">Type:</span>
              <span className="font-mono text-sm">{wallet.asMoveObject.contents.type.repr}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center">
              <span className="text-sm font-medium text-gray-500 sm:w-32">UID:</span>
              <span className="font-mono text-sm break-all">{id ? formatUID(id) : 'N/A'}</span>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-medium text-purple-600 mb-2">Ownership</h3>
          <div className="flex flex-col sm:flex-row sm:items-center">
            <span className="text-sm font-medium text-gray-500 sm:w-32">Owner:</span>
            <span className="font-mono text-sm break-all">
              {owner ? formatAddress(owner) : 'N/A'}
            </span>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-medium text-purple-600 mb-2">Balance</h3>
          <div className="flex flex-col sm:flex-row sm:items-center">
            <span className="text-sm font-medium text-gray-500 sm:w-32">Coin Value:</span>
            <span className="font-mono text-sm">
              {coinValue ? parseInt(coinValue) / 100000000 : 0} SUI
            </span>
          </div>
        </div>

        {beneficiaries.length > 0 && (
          <div>
            <h3 className="text-lg font-medium text-purple-600 mb-2">Beneficiaries</h3>
            <div className="space-y-2">
              {beneficiaries.map((beneficiary: { Address: number[] }, index: number) => (
                <div key={index} className="flex flex-col sm:flex-row sm:items-center">
                  <span className="text-sm font-medium text-gray-500 sm:w-32">
                    Beneficiary {index + 1}:
                  </span>
                  <span className="font-mono text-sm break-all">
                    {formatAddress(beneficiary.Address)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};


interface WalletListProps {
  wallets: ZombieWallet[];
  selectedWallet: ZombieWallet | null;
  onSelectWallet: (wallet: ZombieWallet) => void;
}

const WalletList: React.FC<WalletListProps> = ({ wallets, selectedWallet, onSelectWallet }) => {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h2 className="text-lg font-semibold text-purple-700 border-b border-gray-200 pb-2 mb-4">
        Wallets ({wallets.length})
      </h2>
      <div className="space-y-2">
        {wallets.map((wallet) => (
          <WalletCard
            key={wallet.asMoveObject.address}
            wallet={wallet}
            isActive={selectedWallet?.asMoveObject.address === wallet.asMoveObject.address}
            onClick={() => onSelectWallet(wallet)}
          />
        ))}
      </div>
    </div>
  );
};


interface WalletCardProps{
  wallet: {
    asMoveObject: {
      address: string;
      contents: {
        data: {
          Struct: Array<{
            name: string;
            value: any;
          }>;
        };
      };
    };
  };
  isActive: boolean;
  onClick: () => void;
}

const WalletCard: React.FC<WalletCardProps> = ({ wallet, isActive, onClick }) => {
  const coinValue = wallet.asMoveObject.contents.data.Struct.find(
    (f) => f.name === 'coin'
  )?.value.Struct[0].value.Number;

  return (
    <div
      className={`p-4 mb-2 rounded-lg cursor-pointer transition-colors ${
        isActive ? 'bg-purple-100 border-l-4 border-purple-500' : 'hover:bg-gray-50'
      }`}
      onClick={onClick}
    >
      <div className="flex justify-between items-center">
        <span className="font-mono text-sm truncate">
          {wallet.asMoveObject.address.substring(0, 12)}...
        </span>
        <span className="font-bold text-purple-600">
          {coinValue ? parseInt(coinValue) / 100000000 : 0} SUI
        </span>
      </div>
    </div>
  );
};
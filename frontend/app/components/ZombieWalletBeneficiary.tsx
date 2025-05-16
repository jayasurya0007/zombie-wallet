'use client';
import { useQuery } from '@apollo/client';
import { useCurrentAccount } from '@mysten/dapp-kit';
import client from '@/lib/client';
import { GET_ZOMBIE_WALLETS_BY_OWNER } from '@/lib/queries';

interface ZombieWalletBeneficiaryProps {
  className?: string;
}

interface WalletData {
  asMoveObject: {
    address: string;
    contents: {
      type: {
        repr: string;
      };
      data: {
        Struct: Array<{
          name: string;
          value: any;
        }>;
      };
    };
    owner: {
      __typename: string;
      owner?: {
        address: string;
      };
    };
  };
}

export const ZombieWalletBeneficiary = ({ className }: ZombieWalletBeneficiaryProps) => {
  const currentAccount = useCurrentAccount();
  const { loading, error, data } = useQuery(GET_ZOMBIE_WALLETS_BY_OWNER, {
    client,
    variables: {
      ownerAddress: currentAccount?.address || ''
    },
    skip: !currentAccount?.address
  });

  const wallet = data?.objects?.nodes?.[0] || null;

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

  return (
    <div className={`min-h-screen bg-gray-50 ${className}`}>
      <header className="bg-gradient-to-r from-purple-600 to-blue-500 text-white py-8 px-4 shadow-md">
        <div className="container mx-auto">
          <h1 className="text-3xl font-bold">My Zombie Wallet</h1>
          <p className="mt-2 opacity-90">Manage your Zombie Wallet on Sui Blockchain</p>
        </div>
      </header>

      <main className="container mx-auto py-8 px-4">
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {!currentAccount ? (
            <div className="p-6 text-center">
              <p className="text-gray-500">Please connect your wallet to view your Zombie Wallet</p>
            </div>
          ) : !wallet ? (
            <div className="p-6 text-center">
              <p className="text-gray-500">No Zombie Wallet found for your connected address</p>
              <p className="text-sm mt-2 text-gray-400">
                Connected address: {formatAddressDisplay(currentAccount.address)}
              </p>
            </div>
          ) : (
            <WalletDetails wallet={wallet} />
          )}
        </div>
      </main>
    </div>
  );
};

interface WalletDetailsProps {
  wallet: WalletData;
}

const WalletDetails = ({ wallet }: WalletDetailsProps) => {
  const data = wallet.asMoveObject.contents.data.Struct;
  const id = data.find((f) => f.name === 'id')?.value.UID;
  const owner = data.find((f) => f.name === 'owner')?.value.Address;
  const coinValue = data.find((f) => f.name === 'coin')?.value.Struct[0]?.value.Number;
  const beneficiaries = data.find((f) => f.name === 'beneficiary_addrs')?.value.Vector || [];

  return (
    <div className="divide-y divide-gray-200">
      <div className="px-6 py-4">
        <h2 className="text-lg font-semibold text-purple-700">Wallet Information</h2>
      </div>
      
      <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <p className="text-sm font-medium text-gray-500">Wallet Address</p>
          <p className="font-mono text-sm break-all">{wallet.asMoveObject.address}</p>
        </div>
        
        <div>
          <p className="text-sm font-medium text-gray-500">Type</p>
          <p className="font-mono text-sm break-all">{wallet.asMoveObject.contents.type.repr}</p>
        </div>
        
        <div>
          <p className="text-sm font-medium text-gray-500">Owner</p>
          <p className="font-mono text-sm break-all">{owner ? formatAddress(owner) : 'N/A'}</p>
        </div>
        
        <div>
          <p className="text-sm font-medium text-gray-500">Balance</p>
          <p className="font-mono text-sm">
            {coinValue ? (parseInt(coinValue) / 100000000) : 0} SUI
          </p>
        </div>
      </div>

      {beneficiaries.length > 0 && (
        <>
          <div className="px-6 py-4">
            <h2 className="text-lg font-semibold text-purple-700">Beneficiaries</h2>
          </div>
          <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {beneficiaries.map((beneficiary: { Address: number[] }, index: number) => (
              <div key={index}>
                <p className="text-sm font-medium text-gray-500">Beneficiary {index + 1}</p>
                <p className="font-mono text-sm break-all">
                  {formatAddress(beneficiary.Address)}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// Helper functions
const formatAddress = (bytes: number[]): string => {
  return '0x' + bytes.map(b => b.toString(16).padStart(2, '0')).join('');
};

const formatAddressDisplay = (address: string): string => {
  return `${address.substring(0, 6)}...${address.slice(-4)}`;
};
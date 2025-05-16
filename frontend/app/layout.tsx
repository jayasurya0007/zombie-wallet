'use client';

import '@mysten/dapp-kit/dist/index.css';
import { SuiClientProvider, WalletProvider } from '@mysten/dapp-kit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getFullnodeUrl } from '@mysten/sui/client';
import { ContractProvider } from '@/app/context/ContractContext';
import { ApolloClient, InMemoryCache, ApolloProvider } from '@apollo/client';

const queryClient = new QueryClient();

const networks = {
  mainnet: { url: getFullnodeUrl('mainnet') },
  testnet: { url: getFullnodeUrl('testnet') },
  devnet: { url: getFullnodeUrl('devnet') },
};

const apolloClient = new ApolloClient({
  uri: 'https://sui-testnet.mystenlabs.com/graphql',
  cache: new InMemoryCache(),
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <QueryClientProvider client={queryClient}>
          <ApolloProvider client={apolloClient}>
            <SuiClientProvider networks={networks} defaultNetwork="testnet">
              <WalletProvider>
                <ContractProvider>
                  {children}
                </ContractProvider>
              </WalletProvider>
            </SuiClientProvider>
          </ApolloProvider>
        </QueryClientProvider>
      </body>
    </html>
  );
}

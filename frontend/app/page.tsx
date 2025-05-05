// app/page.tsx
'use client';

import { ConnectButton, useCurrentAccount } from '@mysten/dapp-kit';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const account = useCurrentAccount();
  const router = useRouter();

  useEffect(() => {
    if (account) {
      router.push('/dashboard');
    }
  }, [account, router]);

  return (
    <main style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 80 }}>
      <h1 style={{ fontSize: 32, marginBottom: 24 }}>Sui dApp Kit + Next.js Example</h1>
      <ConnectButton />
    </main>
  );
}

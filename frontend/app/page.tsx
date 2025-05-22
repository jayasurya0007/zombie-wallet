'use client';

import { ConnectButton, useCurrentAccount } from '@mysten/dapp-kit';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const account = useCurrentAccount();
  const router = useRouter();

  useEffect(() => {
    if (account) router.push('/dashboard');
  }, [account, router]);

  return (
    <main className="min-h-screen zombie-background relative overflow-hidden">
      <div className="absolute inset-0 border-8 border-[rgba(138,3,3,0.3)] mix-blend-multiply -rotate-1 scale-105" />
      <div className="absolute inset-0 border-8 border-[rgba(107,140,33,0.2)] mix-blend-multiply rotate-2 scale-103" />
      
      <div className="flex flex-col items-center justify-center min-h-screen text-center px-4 relative">
        <div className="animate-float mb-8 text-6xl">🧟♂️</div>
        
        <h1 className="text-[var(--blood-red)] drop-shadow-[0_2px_1px_rgba(0,0,0,0.8)] text-4xl md:text-6xl font-zombie">
          Zombie Wallet
        </h1>
        
        <p className="mt-4 mb-8 text-[var(--zombie-green)] max-w-2xl mx-auto text-lg md:text-xl">
          Your undead portal to the decentralized world... <br />
          <span className="text-[var(--blood-red)]">Warning:</span> Enter at your own risk!
        </p>

        <div className="relative group">
          <div className="absolute -inset-1 bg-[rgba(138,3,3,0.3)] rounded-lg blur opacity-75 group-hover:opacity-100 transition-all duration-1000 group-hover:duration-200 animate-tilt" />
          <ConnectButton 
            className="relative px-8 py-4 bg-[var(--zombie-green)] text-white rounded-lg font-zombie text-xl
                      hover:bg-[var(--blood-red)] transition-all duration-300 hover:scale-105
                      border-2 border-[var(--decay-yellow)] shadow-lg hover:shadow-[0_0_15px_rgba(138,3,3,0.5)]" 
          />
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[var(--zombie-dark)]/80 to-transparent" />
      </div>
    </main>
  );
}
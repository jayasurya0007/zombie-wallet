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
      {/* Layered decorative borders */}
      <div className="absolute inset-0 border-8 border-[rgba(138,3,3,0.3)] mix-blend-multiply -rotate-1 scale-105" />
      <div className="absolute inset-0 border-8 border-[rgba(107,140,33,0.2)] mix-blend-multiply rotate-2 scale-103" />
      
      {/* Floating zombie emojis */}
      <div className="absolute top-20 left-10 text-4xl animate-float opacity-30">🧟</div>
      <div className="absolute top-32 right-16 text-3xl animate-float opacity-20" style={{animationDelay: '1s'}}>🧟‍♀️</div>
      <div className="absolute bottom-32 left-20 text-5xl animate-float opacity-25" style={{animationDelay: '2s'}}>💀</div>
      <div className="absolute bottom-20 right-10 text-3xl animate-float opacity-30" style={{animationDelay: '0.5s'}}>⚰️</div>
      
      {/* Main content */}
      <div className="flex flex-col items-center justify-center min-h-screen text-center px-4 relative">
        
        {/* Central zombie icon with glow effect */}
        <div className="relative mb-12">
          <div className="absolute inset-0 bg-[var(--blood-red)] rounded-full blur-3xl opacity-20 scale-150 animate-pulse" />
          <div className="relative animate-float text-8xl md:text-9xl drop-shadow-[0_0_20px_rgba(138,3,3,0.8)]">
            🧟‍♂️
          </div>
        </div>
        
        {/* Main title with enhanced styling */}
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-gradient-to-r from-[var(--blood-red)] to-[var(--zombie-green)] bg-clip-text text-transparent blur-sm scale-105">
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-zombie">
              ZOMBIE WALLET
            </h1>
          </div>
          <h1 className="relative text-[var(--blood-red)] drop-shadow-[0_4px_8px_rgba(0,0,0,0.9)] text-5xl md:text-7xl lg:text-8xl font-zombie animate-tilt">
            ZOMBIE WALLET
          </h1>
        </div>
        
        {/* Subtle tagline */}
        <p className="text-[var(--decay-yellow)] mb-12 text-lg md:text-xl opacity-80 font-semibold tracking-wider">
          The Wallet That Lives After You Don't.
        </p>

        {/* Enhanced connect button */}
        <div className="relative group mb-8">
          <div className="absolute -inset-2 bg-gradient-to-r from-[var(--blood-red)] via-[var(--zombie-green)] to-[var(--blood-red)] rounded-xl blur opacity-60 group-hover:opacity-100 transition-all duration-1000 group-hover:duration-200 animate-tilt" />
          <div className="absolute -inset-1 bg-[rgba(138,3,3,0.4)] rounded-lg blur-sm opacity-75 group-hover:opacity-100 transition-all duration-500" />
          
          <ConnectButton 
            className="relative px-12 py-6 bg-gradient-to-r from-[var(--zombie-green)] to-[var(--zombie-green)] text-white rounded-xl font-zombie text-2xl md:text-3xl
                      hover:from-[var(--blood-red)] hover:to-[var(--blood-red)] transition-all duration-300 hover:scale-110
                      border-3 border-[var(--decay-yellow)] shadow-2xl hover:shadow-[0_0_30px_rgba(138,3,3,0.8)]
                      transform hover:-translate-y-2 active:translate-y-0" 
          />
        </div>

        {/* Decorative elements */}
        <div className="flex space-x-8 text-3xl opacity-40">
          <span className="animate-bounce" style={{animationDelay: '0s'}}>⚡</span>
          <span className="animate-bounce" style={{animationDelay: '0.2s'}}>🔒</span>
          <span className="animate-bounce" style={{animationDelay: '0.4s'}}>💎</span>
          <span className="animate-bounce" style={{animationDelay: '0.6s'}}>🏴‍☠️</span>
        </div>

        {/* Bottom gradient overlay */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[var(--zombie-dark)] via-[var(--zombie-dark)]/60 to-transparent" />
        
        {/* Corner decorations */}
        <div className="absolute top-4 left-4 text-6xl opacity-10 rotate-12">💀</div>
        <div className="absolute top-4 right-4 text-6xl opacity-10 -rotate-12">⚰️</div>
        <div className="absolute bottom-4 left-4 text-6xl opacity-10 -rotate-45">🧟</div>
        <div className="absolute bottom-4 right-4 text-6xl opacity-10 rotate-45">🧟‍♀️</div>
      </div>

      {/* Animated background particles */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/3 w-2 h-2 bg-[var(--blood-red)] rounded-full opacity-30 animate-ping" style={{animationDelay: '2s'}} />
        <div className="absolute top-3/4 right-1/4 w-1 h-1 bg-[var(--zombie-green)] rounded-full opacity-40 animate-ping" style={{animationDelay: '1s'}} />
        <div className="absolute top-1/2 left-1/4 w-1.5 h-1.5 bg-[var(--decay-yellow)] rounded-full opacity-20 animate-ping" style={{animationDelay: '3s'}} />
      </div>
    </main>
  );
}
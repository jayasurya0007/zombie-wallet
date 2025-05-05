'use client';

import { useState } from 'react';
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
} from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';

export default function Dashboard() {
  const account = useCurrentAccount();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState('');

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account) {
      setStatus('Please connect your wallet.');
      return;
    }

    try {
      const tx = new Transaction();
      tx.setSender(account.address);
      tx.setGasBudget(10000000); // Adjust as needed

      // Convert amount to MIST (1 SUI = 1e9 MIST)
      const amountInMist = BigInt(Number(amount) * 1e9);

      // Split the gas coin to create a new coin with the specified amount
      const [coin] = tx.splitCoins(tx.gas, [amountInMist]);

      // Transfer the new coin to the recipient
      tx.transferObjects([coin], recipient);

      // Sign and execute the transaction
      signAndExecuteTransaction(
        {
          transaction: tx,
          chain: 'sui:devnet', // Replace with your desired network
        },
        {
          onSuccess: (result) => {
            console.log('Transaction successful:', result);
            setStatus(`Transaction successful! Digest: ${result.digest}`);
          },
          onError: (error) => {
            console.error('Transaction failed:', error);
            setStatus('Transaction failed. Please check the console for details.');
          },
        }
      );
    } catch (error) {
      console.error('Transfer failed:', error);
      setStatus('Transfer failed. Please check the console for details.');
    }
  };

  return (
    <main>
      <h1>Dashboard</h1>
      <p><strong>Wallet Address:</strong> {account?.address}</p>
      <form onSubmit={handleTransfer}>
        <input
          type="text"
          placeholder="Recipient Address"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          required
        />
        <input
          type="number"
          placeholder="Amount (SUI)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
        <button type="submit">Send SUI</button>
      </form>
      <p>{status}</p>
    </main>
  );
}

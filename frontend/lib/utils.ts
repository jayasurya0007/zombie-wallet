import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatBalance(balance: string): string {
  const num = Number(balance) / 1_000_000_000; // Convert from MIST to SUI
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export const formatAddress = (bytes: number[]): string => {
  return '0x' + bytes.map(b => b.toString(16).padStart(2, '0')).join('');
};

export const formatAddressDisplay = (address: string): string => {
  return `${address.substring(0, 6)}...${address.slice(-4)}`;
};

export function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
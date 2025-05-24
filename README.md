# 🧟‍♂️ Zombie Wallet

Zombie Wallet is a decentralized, smart contract-based inheritance wallet built on the Sui blockchain. It ensures the secure and automated transfer of digital assets (tokens, NFTs) in case of user inactivity or death — without relying on centralized entities, paperwork, or legal intermediaries.

---

## 🔍 What It Does

Zombie Wallet allows users to:

- Create an inheritance vault on-chain
- Set a custom inactivity threshold
- Assign beneficiaries and allocate assets
- Periodically "check in" off-chain to reset inactivity timer
- Reclaim, cancel, or distribute assets anytime
- Let beneficiaries claim assets trustlessly if the owner becomes inactive

---

## 🧠 The Problem It Solves

Traditional digital asset management lacks an easy, trustless way to handle inheritance. Inactive wallets can permanently lock away assets due to:

- Lost keys after death or accidents
- Legal barriers and custodial risks
- No on-chain fallback mechanism

---

## ✨ Features

- Fully on-chain smart contract logic on the Sui network
- Off-chain activity check-in service
- Customizable inactivity period and beneficiary setup
- Safe vault termination and emergency asset distribution
- Claimable assets post-inactivity, enforced via smart contracts

---

## 🛠 Tech Stack

- **Frontend**: Next.js, TypeScript, Tailwind CSS
- **Backend**: JavaScript (Node.js), MongoDB (for storing check-in metadata)
- **Blockchain**: Sui Network
- **Smart Contracts**: Move language
- **Deployment**: Vercel (Frontend Hosting)

---

## 🚧 Challenges Faced

- **Gas Optimization**: Managing multiple assets and minimizing Sui transaction costs.
- **Off-chain Check-in**: Ensuring reliable check-in data without compromising security.
- **Lack of On-chain Timers**: Implemented a claim-based mechanism triggered post-inactivity.

---

## 🚀 Live Demo

[**View Live App**](https://zombie-wallet.vercel.app)

---

## 📄 Smart Contracts

- `Zombie.move`: Vault logic for storing asset allocations and ownership.

---

## 🧪 Local Setup

Clone the repo and run:

```bash
npm install
npx next dev

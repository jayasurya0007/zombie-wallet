module zombiewallet::zombie {
    use sui::coin::{Coin, from_balance, into_balance};
    use sui::balance::{Balance, split, join, value, zero};
    use sui::clock::{Clock, timestamp_ms};
    use sui::object::{new, delete};
    use sui::transfer::public_transfer;
    use sui::tx_context::sender;
    use sui::sui::SUI;
    use sui::table::{Table, contains, add, borrow_mut, borrow, remove, destroy_empty};

    // Error codes
    const EWalletExists: u64 = 0;
    const EInvalidDuration: u64 = 1;
    const EInvalidTimeUnit: u64 = 2;
    const EInvalidAllocations: u64 = 3;
    const EInvalidOwnership: u64 = 4;
    const EInvalidWithdrawAmount: u64 = 6;
    const ENotBeneficiary: u64 = 8;
    const EInactiveThresholdNotMet: u64 = 9;
    const ENoFunds: u64 = 10;

    public struct Registry has key, store {
        id: UID,
        owners: Table<address, bool>
    }

    public struct BeneficiaryData has store, drop {
        last_checkin: u64,
        threshold: u64, // In seconds
        allocation: u64,
    }

    public struct ZombieWallet has key, store {
        id: UID,
        owner: address,
        beneficiaries: Table<address, BeneficiaryData>, // Tracks per-beneficiary timers
        beneficiary_addrs: vector<address>, // Track order and allow iteration
        coin: Balance<SUI>
    }

    /// Helper: Sum all beneficiary allocations
    fun sum_allocations(beneficiaries: &Table<address, BeneficiaryData>, addrs: &vector<address>): u64 {
        let mut sum = 0;
        let len = vector::length(addrs);
        let mut i = 0;
        while (i < len) {
            let addr = *vector::borrow(addrs, i);
            let data = borrow(beneficiaries, addr);
            sum = sum + data.allocation;
            i = i + 1;
        };
        sum
    }

    /// Create a new Registry object and transfer to sender
    public entry fun create_registry(ctx: &mut sui::tx_context::TxContext) {
        let registry = Registry {
            id: new(ctx),
            owners: sui::table::new<address, bool>(ctx)
        };
        public_transfer(registry, sender(ctx));
    }

    public entry fun create_wallet(
        registry: &mut Registry,
        ctx: &mut sui::tx_context::TxContext
    ) {
        let sender_addr = sender(ctx);
        assert!(!contains(&registry.owners, sender_addr), EWalletExists);

        add(&mut registry.owners, sender_addr, true);

        let wallet = ZombieWallet {
            id: new(ctx),
            owner: sender_addr,
            beneficiaries: sui::table::new<address, BeneficiaryData>(ctx),
            beneficiary_addrs: vector::empty<address>(),
            coin: zero()
        };
        public_transfer(wallet, sender_addr);
    }

    public entry fun add_beneficiary(
        wallet: &mut ZombieWallet,
        beneficiary: address,
        allocation: u64,
        duration: u64,
        time_unit: u8, // 0 = minutes, 1 = days
        deposit: Coin<SUI>,
        clock: &Clock,
        ctx: &mut sui::tx_context::TxContext
    ) {
        assert!(wallet.owner == sender(ctx), EInvalidOwnership);
        assert!(allocation > 0, EInvalidAllocations);
        assert!(duration > 0, EInvalidDuration);
        assert!(time_unit <= 1, EInvalidTimeUnit);

        let threshold = duration * (if (time_unit == 0) { 60 } else { 86400 });

        join(&mut wallet.coin, into_balance(deposit));

        let data = BeneficiaryData {
            last_checkin: timestamp_ms(clock),
            threshold,
            allocation,
        };

        add(&mut wallet.beneficiaries, beneficiary, data);
        vector::push_back(&mut wallet.beneficiary_addrs, beneficiary);

        // Ensure coin balance matches sum of allocations
        let total_alloc = sum_allocations(&wallet.beneficiaries, &wallet.beneficiary_addrs);
        let bal = value(&wallet.coin);
        assert!(bal == total_alloc, EInvalidAllocations);
    }

    /// Allow owner or any beneficiary to withdraw from the wallet
    public entry fun withdraw(
        wallet: &mut ZombieWallet,
        amount: u64,
        ctx: &mut sui::tx_context::TxContext
    ) {
        let caller = sender(ctx);
        let is_owner = caller == wallet.owner;
        let is_beneficiary = contains(&wallet.beneficiaries, caller);
        assert!(is_owner || is_beneficiary, ENotBeneficiary);

        let bal = value(&wallet.coin);
        assert!(amount <= bal, EInvalidWithdrawAmount);

        let coin = from_balance(split(&mut wallet.coin, amount), ctx);
        public_transfer(coin, caller);
    }

    /// Beneficiary or owner can check in to reset the inactivity timer
    public entry fun checkin(
        wallet: &mut ZombieWallet,
        beneficiary: address,
        clock: &Clock,
        ctx: &mut sui::tx_context::TxContext
    ) {
        // Only beneficiary or owner can check in
        let caller = sender(ctx);
        assert!(
            caller == beneficiary || caller == wallet.owner,
            ENotBeneficiary
        );
        assert!(contains(&wallet.beneficiaries, beneficiary), ENotBeneficiary);

        let data: &mut BeneficiaryData = borrow_mut(&mut wallet.beneficiaries, beneficiary);
        data.last_checkin = timestamp_ms(clock);
    }

    /// On inactivity, distribute remaining allocations to beneficiaries
    public entry fun execute_transfer(
        wallet: ZombieWallet,
        clock: &Clock,
        ctx: &mut sui::tx_context::TxContext
    ) {
        let now = timestamp_ms(clock);

        // Destructure wallet to move out fields without copy
        let ZombieWallet {
            id,
            owner: _,
            mut beneficiaries,
            beneficiary_addrs,
            coin
        } = wallet;

        let len = vector::length(&beneficiary_addrs);
        assert!(len > 0, EInvalidAllocations);

        // Check inactivity for all beneficiaries
        let mut i = 0;
        while (i < len) {
            let addr = *vector::borrow(&beneficiary_addrs, i);
            let data = borrow(&beneficiaries, addr);
            assert!(
                now > data.last_checkin + (data.threshold * 1000),
                EInactiveThresholdNotMet
            );
            i = i + 1;
        };

        let mut coin_mut = coin;
        let total = value(&coin_mut);
        assert!(total > 0, ENoFunds);

        // Distribute allocations
        let mut sum_alloc = 0;
        i = 0;
        while (i < len - 1) {
            let addr = *vector::borrow(&beneficiary_addrs, i);
            let data = borrow(&beneficiaries, addr);
            let allocation = data.allocation;
            sum_alloc = sum_alloc + allocation;
            let split_balance = split(&mut coin_mut, allocation);
            let coin_portion = from_balance(split_balance, ctx);
            public_transfer(coin_portion, addr);
            // Remove beneficiary from table
            remove(&mut beneficiaries, addr);
            i = i + 1;
        };
        // Last beneficiary gets the rest
        let addr = *vector::borrow(&beneficiary_addrs, len - 1);
        let last_coin = from_balance(coin_mut, ctx);
        public_transfer(last_coin, addr);
        remove(&mut beneficiaries, addr);

        // Destroy the now-empty beneficiaries table
        destroy_empty(beneficiaries);

        // Delete the wallet's UID
        delete(id);
    }
}

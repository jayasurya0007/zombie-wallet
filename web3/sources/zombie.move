module zombiewallet::zombie {
    use sui::coin::{Coin, from_balance, into_balance};
    use sui::balance::{Balance, split, join, value, zero};
    use sui::clock::{Clock, timestamp_ms};
    use sui::object::new;
    use sui::transfer::public_transfer;
    use sui::tx_context::sender;
    use sui::sui::SUI;
    use sui::table::{Table, contains, add, remove, borrow_mut};

    // Error codes
    const EWalletExists: u64 = 0;
    const EInvalidDuration: u64 = 1;
    const EInvalidTimeUnit: u64 = 2;
    const EInvalidAllocations: u64 = 3;
    const EInvalidOwnership: u64 = 4;
    const EInactiveThresholdNotMet: u64 = 5;
    const EInvalidWithdrawAmount: u64 = 6;
    const ENoFunds: u64 = 7;
    const EBeneficiaryAlreadyExists: u64 = 9;

    public struct Registry has key, store {
        id: sui::object::UID,
        owners: Table<address, bool>
    }

    public struct BeneficiaryData has store, drop {
        last_checkin: u64,
        threshold: u64, // In seconds
        allocation: u64,
    }

    public struct ZombieWallet has key, store {
        id: sui::object::UID,
        owner: address,
        beneficiaries: Table<address, BeneficiaryData>, // Tracks per-beneficiary timers
        coin: Balance<SUI>
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
        assert!(!contains(&wallet.beneficiaries, beneficiary), EBeneficiaryAlreadyExists);
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
    }

    public entry fun owner_withdraw(
        wallet: &mut ZombieWallet,
        amount: u64,
        ctx: &mut sui::tx_context::TxContext
    ) {
        assert!(wallet.owner == sender(ctx), EInvalidOwnership);
        let bal = value(&wallet.coin);
        assert!(amount <= bal, EInvalidWithdrawAmount);

        let coin = from_balance(split(&mut wallet.coin, amount), ctx);
        public_transfer(coin, sender(ctx));
    }

    public entry fun execute_transfer(
        _registry: &mut Registry,
        wallet: &mut ZombieWallet,
        beneficiary: address,
        clock: &Clock,
        ctx: &mut sui::tx_context::TxContext
    ) {
        assert!(value(&wallet.coin) > 0, ENoFunds);
        assert!(contains(&wallet.beneficiaries, beneficiary), EInvalidOwnership);

        let data: &mut BeneficiaryData = borrow_mut(&mut wallet.beneficiaries, beneficiary);
        assert!(
            timestamp_ms(clock) > data.last_checkin + data.threshold,
            EInactiveThresholdNotMet
        );

        let amount = data.allocation;
        let coin = from_balance(split(&mut wallet.coin, amount), ctx);
        public_transfer(coin, beneficiary);

        // Remove beneficiary after claiming
        let _removed = remove(&mut wallet.beneficiaries, beneficiary);
        // Must bind the removed value to a variable or use it, since BeneficiaryData has drop
    }
}

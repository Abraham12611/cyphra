module campaign_manager::subscription {
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::event;
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
    use sui::table::{Self, Table};
    use std::string::{Self, String};
    use std::vector;

    /// Error codes
    const EINVALID_SUBSCRIPTION_PRICE: u64 = 1;
    const EINVALID_SUBSCRIPTION_DURATION: u64 = 2;
    const ESUBSCRIPTION_NOT_FOUND: u64 = 3;
    const ESUBSCRIPTION_ALREADY_EXISTS: u64 = 4;
    const ESUBSCRIPTION_EXPIRED: u64 = 5;
    const ENOT_SUBSCRIBER: u64 = 6;
    const ESUBSCRIPTION_ACTIVE: u64 = 7;
    const EINSUFFICIENT_BALANCE: u64 = 8;
    const ENOT_OWNER: u64 = 9;
    const ENO_PAYMENT_CAPABILITY: u64 = 10;
    const EPRICE_OUT_OF_RANGE: u64 = 11;

    /// Constants
    const SECONDS_PER_MONTH: u64 = 2592000; // 30 days in seconds
    const DEFAULT_SUBSCRIPTION_PRICE: u64 = 200_000_000; // 2 SUI
    const MIN_SUBSCRIPTION_PRICE: u64 = 2_000_000; // 2 USDC
    const MAX_SUBSCRIPTION_PRICE: u64 = 50_000_000; // 50 USDC

    /// Delegated payment capability with balance for auto-renewals
    struct DelegatedPaymentCapability<phantom CoinType> has key {
        id: UID,
        owner: address,
        balance: Balance<CoinType>
    }

    /// Subscription with all details
    struct Subscription has store {
        subscriber: address,
        start_time: u64,
        end_time: u64,
        subscription_type: String,
        price: u64,
        is_active: bool,
        auto_renew: bool,
        has_payment_capability: bool
    }

    /// Store of all subscriptions
    struct SubscriptionStore has key {
        id: UID,
        subscriptions: Table<address, Subscription>,
        // Track all subscribers for iteration
        subscribers: vector<address>,
        platform_wallet: address,
        // Mapping from subscription type to price
        subscription_prices: Table<String, u64>
    }

    /// Event emitted for subscription actions
    struct SubscriptionEvent has copy, drop {
        subscriber: address,
        subscription_type: String,
        event_type: String,  // "created", "renewed", "cancelled"
        timestamp: u64,
    }

    /// Event for price changes
    struct PriceUpdateEvent has copy, drop {
        subscription_type: String,
        old_price: u64,
        new_price: u64,
        timestamp: u64,
    }

    /// Module initialization
    fun init(ctx: &mut TxContext) {
        let subscription_store = SubscriptionStore {
            id: object::new(ctx),
            subscriptions: table::new(ctx),
            subscribers: vector::empty(),
            platform_wallet: tx_context::sender(ctx),
            subscription_prices: table::new(ctx)
        };
        
        // Set default price for "standard" subscription
        let subscription_prices = &mut subscription_store.subscription_prices;
        table::add(subscription_prices, string::utf8(b"standard"), DEFAULT_SUBSCRIPTION_PRICE);
        
        transfer::share_object(subscription_store);
    }

    /// Setup a delegated payment capability to allow auto-renewals
    public fun setup_payment_delegation<CoinType>(
        payment: Coin<CoinType>,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        
        // Create new delegated payment capability
        let cap = DelegatedPaymentCapability<CoinType> {
            id: object::new(ctx),
            owner: sender,
            balance: coin::into_balance(payment)
        };
        
        // Transfer capability to sender
        transfer::transfer(cap, sender);
    }

    /// Create a new subscription
    public fun create_subscription<CoinType>(
        store: &mut SubscriptionStore,
        payment: Coin<CoinType>,
        subscription_type: String,
        auto_renew: bool,
        has_capability: bool,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        
        // Get price for subscription type
        let price = if (table::contains(&store.subscription_prices, subscription_type)) {
            *table::borrow(&store.subscription_prices, subscription_type)
        } else {
            DEFAULT_SUBSCRIPTION_PRICE // Fallback to default if type not found
        };
        
        // Verify payment amount
        assert!(coin::value(&payment) == price, EINVALID_SUBSCRIPTION_PRICE);
        
        // Check if subscription already exists
        assert!(!table::contains(&store.subscriptions, sender), ESUBSCRIPTION_ALREADY_EXISTS);

        let current_time = tx_context::epoch(ctx);
        let subscription = Subscription {
            subscriber: sender,
            start_time: current_time,
            end_time: current_time + SECONDS_PER_MONTH,
            subscription_type,
            price,
            is_active: true,
            auto_renew,
            has_payment_capability: has_capability
        };

        // Process payment by transferring to platform wallet
        transfer::public_transfer(payment, store.platform_wallet);

        // Add subscription to store and track subscriber
        table::add(&mut store.subscriptions, sender, subscription);
        vector::push_back(&mut store.subscribers, sender);

        // Emit subscription event
        event::emit(SubscriptionEvent {
            subscriber: sender,
            subscription_type,
            event_type: string::utf8(b"created"),
            timestamp: current_time,
        });
    }

    /// Creates subscription with payment delegation capability
    public fun create_subscription_with_delegation<CoinType>(
        store: &mut SubscriptionStore,
        payment: Coin<CoinType>,
        delegation_payment: Coin<CoinType>,
        subscription_type: String,
        auto_renew: bool,
        ctx: &mut TxContext
    ) {
        // First setup the payment delegation
        setup_payment_delegation(delegation_payment, ctx);
        
        // Then create the subscription
        create_subscription(
            store,
            payment,
            subscription_type,
            auto_renew,
            true, // has capability
            ctx
        );
    }

    /// Renew an existing subscription
    public fun renew_subscription<CoinType>(
        store: &mut SubscriptionStore,
        payment: Coin<CoinType>,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        
        // Check if subscription exists
        assert!(table::contains(&store.subscriptions, sender), ESUBSCRIPTION_NOT_FOUND);
        
        let subscription = table::borrow_mut(&mut store.subscriptions, sender);
        assert!(subscription.is_active, ESUBSCRIPTION_EXPIRED);
        
        // Verify payment matches current subscription price
        assert!(coin::value(&payment) == subscription.price, EINVALID_SUBSCRIPTION_PRICE);
        
        // Process renewal payment
        transfer::public_transfer(payment, store.platform_wallet);

        // Update subscription period
        subscription.start_time = tx_context::epoch(ctx);
        subscription.end_time = subscription.start_time + SECONDS_PER_MONTH;

        // Emit subscription renewal event
        event::emit(SubscriptionEvent {
            subscriber: sender,
            subscription_type: subscription.subscription_type,
            event_type: string::utf8(b"renewed"),
            timestamp: tx_context::epoch(ctx),
        });
    }

    /// Cancel an existing subscription
    public fun cancel_subscription(
        store: &mut SubscriptionStore,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        
        // Check if subscription exists
        assert!(table::contains(&store.subscriptions, sender), ESUBSCRIPTION_NOT_FOUND);
        
        let subscription = table::borrow_mut(&mut store.subscriptions, sender);
        assert!(subscription.is_active, ESUBSCRIPTION_EXPIRED);
        
        // Update subscription status
        subscription.is_active = false;
        subscription.auto_renew = false;

        // Emit subscription cancellation event
        event::emit(SubscriptionEvent {
            subscriber: sender,
            subscription_type: subscription.subscription_type,
            event_type: string::utf8(b"cancelled"),
            timestamp: tx_context::epoch(ctx),
        });
    }

    /// Get subscription status
    public fun get_subscription_status(
        store: &SubscriptionStore,
        subscriber: address,
    ): (bool, u64, String, bool) {
        assert!(table::contains(&store.subscriptions, subscriber), ESUBSCRIPTION_NOT_FOUND);
        
        let subscription = table::borrow(&store.subscriptions, subscriber);
        (
            subscription.is_active,
            subscription.end_time,
            subscription.subscription_type,
            subscription.auto_renew
        )
    }

    /// Check if subscription is active
    public fun is_subscription_active(
        store: &SubscriptionStore,
        subscriber: address,
        ctx: &TxContext
    ): bool {
        if (!table::contains(&store.subscriptions, subscriber)) {
            return false
        };
        
        let subscription = table::borrow(&store.subscriptions, subscriber);
        subscription.is_active && tx_context::epoch(ctx) <= subscription.end_time
    }

    /// Process due renewals for subscribers with delegated payment capabilities
    public fun process_due_renewals<CoinType>(
        store: &mut SubscriptionStore,
        delegated_cap: &mut DelegatedPaymentCapability<CoinType>,
        subscriber: address,
        ctx: &mut TxContext
    ) {
        // Check owner
        assert!(delegated_cap.owner == subscriber, ENOT_SUBSCRIBER);
        
        // Check if subscription exists
        if (!table::contains(&store.subscriptions, subscriber)) {
            return
        };
        
        let subscription = table::borrow_mut(&mut store.subscriptions, subscriber);
        let current_time = tx_context::epoch(ctx);
        
        // Check if due for renewal
        if (subscription.is_active && 
            subscription.auto_renew && 
            current_time > subscription.end_time) {
            
            // Check if enough balance
            if (balance::value(&delegated_cap.balance) >= subscription.price) {
                // Process payment from delegated capability
                let payment = coin::from_balance(
                    balance::split(&mut delegated_cap.balance, subscription.price),
                    ctx
                );
                transfer::public_transfer(payment, store.platform_wallet);
                
                // Update subscription
                subscription.start_time = current_time;
                subscription.end_time = current_time + SECONDS_PER_MONTH;
                
                // Emit renewal event
                event::emit(SubscriptionEvent {
                    subscriber,
                    subscription_type: subscription.subscription_type,
                    event_type: string::utf8(b"auto_renewed"),
                    timestamp: current_time,
                });
            } else {
                // Insufficient funds, deactivate subscription
                subscription.is_active = false;
                subscription.auto_renew = false;
                
                // Emit failed renewal event
                event::emit(SubscriptionEvent {
                    subscriber,
                    subscription_type: subscription.subscription_type,
                    event_type: string::utf8(b"renewal_failed"),
                    timestamp: current_time,
                });
            }
        }
    }

    /// Set subscription price for a specific subscription type
    public fun set_subscription_price(
        store: &mut SubscriptionStore,
        subscription_type: String,
        price: u64,
        ctx: &TxContext
    ) {
        // Only platform wallet can change prices
        assert!(store.platform_wallet == tx_context::sender(ctx), ENOT_OWNER);
        
        // Validate price is within acceptable range
        assert!(price >= MIN_SUBSCRIPTION_PRICE && price <= MAX_SUBSCRIPTION_PRICE, 
                EPRICE_OUT_OF_RANGE);
        
        let old_price = if (table::contains(&store.subscription_prices, subscription_type)) {
            let old = *table::borrow(&store.subscription_prices, subscription_type);
            table::remove(&mut store.subscription_prices, subscription_type);
            old
        } else {
            0
        };
        
        // Add or update price
        table::add(&mut store.subscription_prices, subscription_type, price);
        
        // Emit price update event
        event::emit(PriceUpdateEvent {
            subscription_type,
            old_price,
            new_price: price,
            timestamp: tx_context::epoch(ctx),
        });
    }

    /// Get price for a subscription type
    public fun get_subscription_price(
        store: &SubscriptionStore,
        subscription_type: String
    ): u64 {
        if (table::contains(&store.subscription_prices, subscription_type)) {
            *table::borrow(&store.subscription_prices, subscription_type)
        } else {
            DEFAULT_SUBSCRIPTION_PRICE // Fallback to default
        }
    }

    /// Get number of subscriptions due for renewal
    public fun get_due_renewals_count(
        store: &SubscriptionStore,
        ctx: &TxContext
    ): u64 {
        let due_count = 0;
        let current_time = tx_context::epoch(ctx);
        let i = 0;
        let len = vector::length(&store.subscribers);
        
        while (i < len) {
            let subscriber = *vector::borrow(&store.subscribers, i);
            // Skip if the subscription has been removed
            if (table::contains(&store.subscriptions, subscriber)) {
                let subscription = table::borrow(&store.subscriptions, subscriber);
                
                if (subscription.is_active && 
                    subscription.auto_renew && 
                    current_time > subscription.end_time) {
                    due_count = due_count + 1;
                };
            };
            i = i + 1;
        };
        
        due_count
    }

    /// Set platform wallet address
    public fun set_platform_wallet(
        store: &mut SubscriptionStore,
        new_wallet: address,
        ctx: &TxContext
    ) {
        // Only current platform wallet can change it
        assert!(store.platform_wallet == tx_context::sender(ctx), ENOT_OWNER);
        store.platform_wallet = new_wallet;
    }
} 
module campaign_manager::reputation {
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::event;
    use sui::table::{Self, Table};
    use std::vector;

    // Error codes
    const ENO_REPUTATION_STORE: u64 = 1;
    const EINVALID_REPUTATION_CHANGE: u64 = 2;
    const EINVALID_BADGE_ID: u64 = 3;
    const ENOT_ADMIN: u64 = 4;

    // Constants for reputation thresholds
    const BRONZE_THRESHOLD: u64 = 100;
    const SILVER_THRESHOLD: u64 = 500;
    const GOLD_THRESHOLD: u64 = 1000;
    const PLATINUM_THRESHOLD: u64 = 5000;

    // Contribution thresholds
    const CONTRIBUTION_MILESTONE_1: u64 = 10;  // 10 contributions
    const CONTRIBUTION_MILESTONE_2: u64 = 50;  // 50 contributions
    const CONTRIBUTION_MILESTONE_3: u64 = 100; // 100 contributions

    // Payment thresholds
    const PAYMENT_MILESTONE_1: u64 = 5;   // 5 successful payments
    const PAYMENT_MILESTONE_2: u64 = 25;  // 25 successful payments
    const PAYMENT_MILESTONE_3: u64 = 50;  // 50 successful payments

    // Badge types
    // Contributor badges
    const BADGE_CONTRIBUTOR: u8 = 1;
    const BADGE_TOP_CONTRIBUTOR: u8 = 2;
    const BADGE_EXPERT_CONTRIBUTOR: u8 = 3;

    // Campaign creator badges
    const BADGE_CAMPAIGN_CREATOR: u8 = 10;
    const BADGE_RELIABLE_PAYER: u8 = 11;
    const BADGE_TRUSTED_CREATOR: u8 = 12;
    const BADGE_EXPERT_CREATOR: u8 = 13;

    // Verifier badges
    const BADGE_VERIFIER: u8 = 20;
    const BADGE_TRUSTED_VERIFIER: u8 = 21;
    const BADGE_EXPERT_VERIFIER: u8 = 22;

    // Achievement badges
    const BADGE_FIRST_CONTRIBUTION: u8 = 30;
    const BADGE_FIRST_CAMPAIGN: u8 = 31;
    const BADGE_FIRST_VERIFICATION: u8 = 32;

    /// Badge represents an achievement or status
    struct Badge has store, drop, copy {
        badge_type: u8,
        timestamp: u64,
        description: vector<u8>
    }

    /// Reputation store for a user
    struct ReputationStore has key, store {
        id: UID,
        owner: address,
        reputation_score: u64,
        badges: vector<Badge>,
        contribution_count: u64,
        successful_payments: u64,
    }

    /// Global registry to track all reputation stores
    struct ReputationRegistry has key {
        id: UID,
        user_stores: Table<address, ReputationStore>,
        admin: address,
    }

    /// Event for reputation changes
    struct ReputationChangeEvent has copy, drop {
        user: address,
        points_change: u64,
        is_increase: bool,
        reason: vector<u8>,
        timestamp: u64
    }

    /// Module initializer
    fun init(ctx: &mut TxContext) {
        let registry = ReputationRegistry {
            id: object::new(ctx),
            user_stores: table::new<address, ReputationStore>(ctx),
            admin: tx_context::sender(ctx),
        };
        transfer::share_object(registry);
    }
    
    /// Test-only initializer function for use in tests
    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx)
    }

    /// Create reputation store if it doesn't exist
    public fun ensure_reputation_store_exists(
        registry: &mut ReputationRegistry, 
        user_to_create_for: address,
        ctx: &mut TxContext
    ) {
        if (!table::contains(&registry.user_stores, user_to_create_for)) {
            let store = ReputationStore {
                id: object::new(ctx),
                owner: user_to_create_for,
                reputation_score: 0,
                badges: vector::empty<Badge>(),
                contribution_count: 0,
                successful_payments: 0,
            };
            
            table::add(&mut registry.user_stores, user_to_create_for, store);
        }
    }

    /// Check if user has a reputation store
    public fun has_reputation_store(
        registry: &ReputationRegistry, 
        addr: address
    ): bool {
        table::contains(&registry.user_stores, addr)
    }

    /// Add reputation points to a user
    public fun add_reputation_points(
        registry: &mut ReputationRegistry,
        user_to_reward: address,
        points: u64,
        reason: vector<u8>,
        ctx: &mut TxContext
    ) {
        assert!(table::contains(&registry.user_stores, user_to_reward), ENO_REPUTATION_STORE);
        let reputation_store = table::borrow_mut(&mut registry.user_stores, user_to_reward);
        
        reputation_store.reputation_score = reputation_store.reputation_score + points;
        
        // Emit reputation change event
        event::emit(ReputationChangeEvent {
            user: user_to_reward,
            points_change: points,
            is_increase: true,
            reason,
            timestamp: tx_context::epoch(ctx)
        });

        // Check and award badges based on new score
        check_and_award_badges(reputation_store);
    }

    /// Record a successful contribution
    public fun record_successful_contribution(
        registry: &mut ReputationRegistry,
        ctx: &mut TxContext
    ) {
        let user_address = tx_context::sender(ctx);
        assert!(table::contains(&registry.user_stores, user_address), ENO_REPUTATION_STORE);
        let reputation_store = table::borrow_mut(&mut registry.user_stores, user_address);
        
        reputation_store.contribution_count = reputation_store.contribution_count + 1;
        
        // Also add reputation points
        reputation_store.reputation_score = reputation_store.reputation_score + 10;
        
        // Emit event
        event::emit(ReputationChangeEvent {
            user: reputation_store.owner,
            points_change: 10,
            is_increase: true,
            reason: b"Successful contribution",
            timestamp: tx_context::epoch(ctx)
        });
        
        // Check for badges
        check_and_award_badges(reputation_store);
    }

    /// Record a successful payment
    public fun record_successful_payment(
        registry: &mut ReputationRegistry,
        ctx: &mut TxContext
    ) {
        let user_address = tx_context::sender(ctx);
        assert!(table::contains(&registry.user_stores, user_address), ENO_REPUTATION_STORE);
        let reputation_store = table::borrow_mut(&mut registry.user_stores, user_address);
        
        reputation_store.successful_payments = reputation_store.successful_payments + 1;
        
        // Also add reputation points
        reputation_store.reputation_score = reputation_store.reputation_score + 15;
        
        // Emit event
        event::emit(ReputationChangeEvent {
            user: reputation_store.owner,
            points_change: 15,
            is_increase: true,
            reason: b"Successful payment",
            timestamp: tx_context::epoch(ctx)
        });
        
        // Check for badges
        check_and_award_badges(reputation_store);
    }

    /// Record that a campaign creator received a contribution
    public fun record_campaign_contribution_received(
        registry: &mut ReputationRegistry,
        creator_address: address,
        ctx: &mut TxContext
    ) {
        assert!(table::contains(&registry.user_stores, creator_address), ENO_REPUTATION_STORE);
        let reputation_store = table::borrow_mut(&mut registry.user_stores, creator_address);
        
        // Increment the successful_payments counter
        reputation_store.successful_payments = reputation_store.successful_payments + 1;
        
        // Add 3 reputation points
        reputation_store.reputation_score = reputation_store.reputation_score + 3;
        
        // Emit event
        event::emit(ReputationChangeEvent {
            user: creator_address,
            points_change: 3,
            is_increase: true,
            reason: b"Campaign contribution received",
            timestamp: tx_context::epoch(ctx)
        });
        
        // Check for badges
        check_and_award_badges(reputation_store);
    }

    /// Check for badges to award based on user stats
    fun check_and_award_badges(store: &mut ReputationStore) {
        let score = store.reputation_score;
        let contributions = store.contribution_count;
        let payments = store.successful_payments;
        
        // Reputation-based badges
        if (score >= PLATINUM_THRESHOLD) {
            award_badge(store, BADGE_EXPERT_CONTRIBUTOR, b"Expert Contributor - Achieved highest reputation tier");
            award_badge(store, BADGE_EXPERT_CREATOR, b"Expert Creator - Achieved highest reputation tier");
        } else if (score >= GOLD_THRESHOLD) {
            award_badge(store, BADGE_TOP_CONTRIBUTOR, b"Top Contributor - Achieved gold reputation tier");
            award_badge(store, BADGE_TRUSTED_CREATOR, b"Trusted Creator - Achieved gold reputation tier");
        } else if (score >= SILVER_THRESHOLD) {
            award_badge(store, BADGE_RELIABLE_PAYER, b"Reliable Participant - Achieved silver reputation tier");
        } else if (score >= BRONZE_THRESHOLD) {
            award_badge(store, BADGE_CONTRIBUTOR, b"Active Contributor - Achieved bronze reputation tier");
            award_badge(store, BADGE_CAMPAIGN_CREATOR, b"Campaign Creator - Achieved bronze reputation tier");
        };

        // Contribution milestone badges
        if (contributions >= CONTRIBUTION_MILESTONE_3) {
            award_badge(store, BADGE_EXPERT_CONTRIBUTOR, b"Expert Contributor - Made 100+ contributions");
        } else if (contributions >= CONTRIBUTION_MILESTONE_2) {
            award_badge(store, BADGE_TOP_CONTRIBUTOR, b"Top Contributor - Made 50+ contributions");
        } else if (contributions >= CONTRIBUTION_MILESTONE_1) {
            award_badge(store, BADGE_CONTRIBUTOR, b"Active Contributor - Made 10+ contributions");
        } else if (contributions == 1) {
            award_badge(store, BADGE_FIRST_CONTRIBUTION, b"First Contribution - Made first contribution");
        };

        // Payment milestone badges
        if (payments >= PAYMENT_MILESTONE_3) {
            award_badge(store, BADGE_EXPERT_CREATOR, b"Expert Creator - Made 50+ successful payments");
        } else if (payments >= PAYMENT_MILESTONE_2) {
            award_badge(store, BADGE_TRUSTED_CREATOR, b"Trusted Creator - Made 25+ successful payments");
        } else if (payments >= PAYMENT_MILESTONE_1) {
            award_badge(store, BADGE_RELIABLE_PAYER, b"Reliable Payer - Made 5+ successful payments");
        } else if (payments == 1) {
            award_badge(store, BADGE_FIRST_CAMPAIGN, b"First Campaign - Made first successful payment");
        };
    }

    /// Award a badge if user doesn't already have it
    fun award_badge(store: &mut ReputationStore, badge_type: u8, description: vector<u8>) {
        // Check if badge already exists
        let i = 0;
        let len = vector::length(&store.badges);
        while (i < len) {
            let badge = vector::borrow(&store.badges, i);
            if (badge.badge_type == badge_type) {
                return
            };
            i = i + 1;
        };

        // Award new badge
        let new_badge = Badge {
            badge_type,
            timestamp: 0, // Will be filled in when transferring
            description
        };
        vector::push_back(&mut store.badges, new_badge);
    }

    /// Get reputation score for an address
    public fun get_reputation_score(registry: &ReputationRegistry, user_address: address): u64 {
        assert!(table::contains(&registry.user_stores, user_address), ENO_REPUTATION_STORE);
        let reputation_store = table::borrow(&registry.user_stores, user_address);
        reputation_store.reputation_score
    }

    /// Get badge count for an address
    public fun get_badge_count(registry: &ReputationRegistry, user_address: address): u64 {
        assert!(table::contains(&registry.user_stores, user_address), ENO_REPUTATION_STORE);
        let reputation_store = table::borrow(&registry.user_stores, user_address);
        vector::length(&reputation_store.badges)
    }

    /// Get all badges for an address
    public fun get_badges(registry: &ReputationRegistry, user_address: address): vector<Badge> {
        assert!(table::contains(&registry.user_stores, user_address), ENO_REPUTATION_STORE);
        let reputation_store = table::borrow(&registry.user_stores, user_address);
        reputation_store.badges
    }

    /// Get contribution count for an address
    public fun get_contribution_count(registry: &ReputationRegistry, user_address: address): u64 {
        assert!(table::contains(&registry.user_stores, user_address), ENO_REPUTATION_STORE);
        let reputation_store = table::borrow(&registry.user_stores, user_address);
        reputation_store.contribution_count
    }

    /// Get successful payments count for an address
    public fun get_successful_payments(registry: &ReputationRegistry, user_address: address): u64 {
        assert!(table::contains(&registry.user_stores, user_address), ENO_REPUTATION_STORE);
        let reputation_store = table::borrow(&registry.user_stores, user_address);
        reputation_store.successful_payments
    }

    /// Admin function to update a user's reputation score
    public fun admin_adjust_reputation_score(
        registry: &mut ReputationRegistry, // Now takes &mut ReputationRegistry
        user_address_to_update: address,   // User whose score to update
        points_to_adjust: u64,
        is_increase: bool,
        reason: vector<u8>, 
        ctx: &mut TxContext
    ) {
        // Assert that the sender is the admin
        assert!(tx_context::sender(ctx) == registry.admin, ENOT_ADMIN);

        // Assert that the user store exists
        assert!(table::contains(&registry.user_stores, user_address_to_update), ENO_REPUTATION_STORE);

        let reputation_store = table::borrow_mut(&mut registry.user_stores, user_address_to_update);
        
        let old_score = reputation_store.reputation_score;
        let new_score: u64;

        if (is_increase) {
            new_score = old_score + points_to_adjust;
        } else {
            if (old_score >= points_to_adjust) {
                new_score = old_score - points_to_adjust;
            } else {
                new_score = 0; // Prevent score from going below zero
            }
        };

        reputation_store.reputation_score = new_score;

        // Emit reputation change event
        event::emit(ReputationChangeEvent {
            user: reputation_store.owner, // or user_address_to_update, they should be the same
            points_change: points_to_adjust,
            is_increase: is_increase,
            reason,
            timestamp: tx_context::epoch(ctx)
        });

        // Check and award badges based on new score
        check_and_award_badges(reputation_store);
    }
} 
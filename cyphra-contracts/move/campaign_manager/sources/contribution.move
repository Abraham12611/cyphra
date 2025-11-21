module campaign_manager::contribution {
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::event;
    use sui::table::{Self, Table};
    use std::string::{Self, String};
    use std::vector;
    use campaign_manager::campaign::{Self, CampaignStore};
    use campaign_manager::escrow::{Self, EscrowStore};
    use campaign_manager::verifier::{Self as verifier, VerificationScores};
    use campaign_manager::reputation::{Self};

    // Error codes
    const EINVALID_CONTRIBUTION: u64 = 1;
    const ECAMPAIGN_INACTIVE: u64 = 2;
    const EINVALID_SIGNATURE: u64 = 3;
    const EDUPLICATE_CONTRIBUTION: u64 = 4;
    const ECONTRIBUTION_NOT_FOUND: u64 = 5;
    const ECONTRIBUTION_ALREADY_VERIFIED: u64 = 6;
    const EVERIFIER_LOW_REPUTATION: u64 = 7;
    const ENOT_CONTRIBUTOR: u64 = 8;
    const ENOT_VERIFIER: u64 = 9;

    /// Contribution record for submitted data
    struct Contribution has store, copy, drop {
        contribution_id: String,
        campaign_id: String,
        contributor: address,
        data_url: String,         
        data_hash: vector<u8>,    
        timestamp: u64,
        verification_scores: VerificationScores,
        is_verified: bool,
        reward_released: bool
    }

    /// Shared object that stores all contributions
    struct ContributionStore has key {
        id: UID,
        contributions: Table<String, Contribution>,
        contribution_ids: vector<String>
    }

    // Events
    struct ContributionEvent has copy, drop {
        contribution_id: String,
        campaign_id: String,
        contributor: address,
        data_url: String,
        data_hash: vector<u8>,
        verifier_reputation: u64,
        timestamp: u64,
    }

    struct VerificationEvent has copy, drop {
        contribution_id: String,
        campaign_id: String,
        verification_score: u64,
        timestamp: u64,
    }

    fun init(ctx: &mut TxContext) {
        let contribution_store = ContributionStore {
            id: object::new(ctx),
            contributions: table::new(ctx),
            contribution_ids: vector::empty()
        };
        transfer::share_object(contribution_store);
    }
    
    /// Test-only initializer function for use in tests
    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx)
    }

    /// Submit a contribution to a campaign and release reward if verified
    public fun submit_contribution<CoinType>(
        contribution_store: &mut ContributionStore,
        campaign_store: &mut CampaignStore,
        escrow_store: &mut EscrowStore<CoinType>,
        reputation_registry: &mut reputation::ReputationRegistry,
        campaign_id: String,
        contribution_id: String,
        data_url: String,
        data_hash: vector<u8>,
        quality_score: u64,
        is_campaign_active: bool,
        ctx: &mut TxContext
    ) {
        let contributor_address = tx_context::sender(ctx);
        
        // Ensure the contributor has a reputation store
        reputation::ensure_reputation_store_exists(reputation_registry, contributor_address, ctx);
        
        // Get campaign creator address
        let creator_address = campaign::get_campaign_owner(campaign_store, campaign_id);
        // Ensure creator also has a reputation store
        reputation::ensure_reputation_store_exists(reputation_registry, creator_address, ctx);

        // Verify campaign is active
        assert!(is_campaign_active, ECAMPAIGN_INACTIVE);

        // Verify contribution hasn't been submitted before
        assert!(!table::contains(&contribution_store.contributions, contribution_id), EDUPLICATE_CONTRIBUTION);
        
        // Create verification scores
        let verifier_reputation = 100; // Default to high reputation for initial submissions
        let scores = verifier::create_verification_scores(verifier_reputation, quality_score);
        
        let contribution = Contribution {
            contribution_id,
            campaign_id,
            contributor: contributor_address,
            data_url,
            data_hash,
            timestamp: tx_context::epoch(ctx),
            verification_scores: scores,
            is_verified: true,
            reward_released: true,
        };

        // Add contribution to the store
        table::add(&mut contribution_store.contributions, contribution_id, contribution);
        
        // Add contribution ID to the vector for iteration
        vector::push_back(&mut contribution_store.contribution_ids, contribution_id);

        // Increment the counter on the campaign object
        let _incremented = campaign::increment_contributions(campaign_store, campaign_id);

        // Release the reward from escrow
        // The contributor (sender) will receive the reward.
        escrow::release_reward<CoinType>(escrow_store, campaign_id, contribution_id, ctx);

        // Award reputation points and update activity counters
        reputation::record_successful_contribution(reputation_registry, ctx);
        reputation::record_campaign_contribution_received(reputation_registry, creator_address, ctx);

        // Emit contribution event
        event::emit(ContributionEvent {
            contribution_id,
            campaign_id,
            contributor: contributor_address,
            data_url,
            data_hash,
            verifier_reputation,
            timestamp: tx_context::epoch(ctx),
        });
    }

    /// Mark a contribution as rewarded
    public fun mark_contribution_rewarded(
        contribution_store: &mut ContributionStore,
        contribution_id: String,
    ) {
        assert!(table::contains(&contribution_store.contributions, contribution_id), ECONTRIBUTION_NOT_FOUND);
        
        let contribution = table::borrow_mut(&mut contribution_store.contributions, contribution_id);
        contribution.reward_released = true;
    }

    /// Verify a contribution
    public fun verify_contribution(
        contribution_store: &mut ContributionStore,
        contribution_id: String,
        quality_score: u64,
        ctx: &mut TxContext
    ) {
        assert!(table::contains(&contribution_store.contributions, contribution_id), ECONTRIBUTION_NOT_FOUND);
        
        let contribution = table::borrow_mut(&mut contribution_store.contributions, contribution_id);
        assert!(!contribution.is_verified, ECONTRIBUTION_ALREADY_VERIFIED);
        
        // Update verification status
        contribution.is_verified = true;
        
        // Update verification scores
        contribution.verification_scores = verifier::create_verification_scores(100, quality_score);

        // Emit verification event
        event::emit(VerificationEvent {
            contribution_id,
            campaign_id: contribution.campaign_id,
            verification_score: quality_score,
            timestamp: tx_context::epoch(ctx),
        });
    }

    /// Get contribution details
    public fun get_contribution_details(
        contribution_store: &ContributionStore,
        contribution_id: String
    ): Contribution {
        assert!(table::contains(&contribution_store.contributions, contribution_id), ECONTRIBUTION_NOT_FOUND);
        *table::borrow(&contribution_store.contributions, contribution_id)
    }

    /// Get the address contribution count for a campaign
    public fun get_address_contribution_count(
        contribution_store: &ContributionStore,
        contributor_address: address,
        campaign_id: String
    ): u64 {
        let count = 0u64;
        let i = 0;
        let len = vector::length(&contribution_store.contribution_ids);
        
        while (i < len) {
            let contribution_id = *vector::borrow(&contribution_store.contribution_ids, i);
            if (table::contains(&contribution_store.contributions, contribution_id)) {
                let contribution = table::borrow(&contribution_store.contributions, contribution_id);
                
                if (contribution.contributor == contributor_address && 
                    contribution.campaign_id == campaign_id &&
                    contribution.reward_released) {
                    count = count + 1;
                };
            };
            i = i + 1;
        };
        
        count
    }

    /// Check if a contribution exists
    public fun contribution_exists(
        contribution_store: &ContributionStore,
        contribution_id: String
    ): bool {
        table::contains(&contribution_store.contributions, contribution_id)
    }

    /// Get total contributions for an address
    public fun get_address_total_contributions(
        contribution_store: &ContributionStore,
        contributor_address: address
    ): (u64, u64) {
        let total_count = 0u64;
        let verified_count = 0u64;
        let i = 0;
        let len = vector::length(&contribution_store.contribution_ids);
        
        while (i < len) {
            let contribution_id = *vector::borrow(&contribution_store.contribution_ids, i);
            if (table::contains(&contribution_store.contributions, contribution_id)) {
                let contribution = table::borrow(&contribution_store.contributions, contribution_id);
                
                if (contribution.contributor == contributor_address) {
                    total_count = total_count + 1;
                    if (contribution.is_verified && contribution.reward_released) {
                        verified_count = verified_count + 1;
                    };
                };
            };
            i = i + 1;
        };
        
        (total_count, verified_count)
    }
} 
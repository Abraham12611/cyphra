module campaign_manager::campaign_state {
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::table::{Self, Table};
    use std::string::String;

    const ECAMPAIGN_NOT_FOUND: u64 = 1;
    const ECAMPAIGN_INACTIVE: u64 = 2;

    /// Campaign data structure to track campaign state
    struct Campaign has store {
        campaign_id: String,
        start_time: u64,
        end_time: u64,
        is_active: bool,
        total_contributions: u64,
        owner: address,
    }

    /// Shared object that keeps track of all campaign states
    struct CampaignState has key {
        id: UID,
        campaigns: Table<String, Campaign>,
    }

    fun init(ctx: &mut TxContext) {
        let campaign_state = CampaignState {
            id: object::new(ctx),
            campaigns: table::new(ctx),
        };
        transfer::share_object(campaign_state);
    }
    
    /// Test-only initializer function for use in tests
    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx)
    }

    /// Verify if a campaign is active
    public fun verify_campaign_active(
        campaign_state: &CampaignState,
        campaign_id: String,
        ctx: &TxContext
    ): bool {
        if (!table::contains(&campaign_state.campaigns, campaign_id)) {
            return false
        };
        
        let campaign = table::borrow(&campaign_state.campaigns, campaign_id);
        let current_time = tx_context::epoch(ctx);
        
        campaign.is_active && 
        current_time >= campaign.start_time && 
        current_time <= campaign.end_time
    }

    /// Add a new campaign to the state
    public fun add_campaign(
        campaign_state: &mut CampaignState,
        campaign_id: String,
        start_time: u64,
        end_time: u64,
        owner: address,
    ) {
        let campaign = Campaign {
            campaign_id,
            start_time,
            end_time,
            is_active: true,
            total_contributions: 0,
            owner,
        };
        table::add(&mut campaign_state.campaigns, campaign_id, campaign);
    }

    /// Increment the contributions counter for a campaign
    public fun increment_contributions(
        campaign_state: &mut CampaignState,
        campaign_id: String,
    ): u64 {
        assert!(table::contains(&campaign_state.campaigns, campaign_id), ECAMPAIGN_NOT_FOUND);
        
        let campaign = table::borrow_mut(&mut campaign_state.campaigns, campaign_id);
        campaign.total_contributions = campaign.total_contributions + 1;
        campaign.total_contributions
    }

    /// Deactivate a campaign
    public fun deactivate_campaign(
        campaign_state: &mut CampaignState,
        campaign_id: String,
    ) {
        assert!(table::contains(&campaign_state.campaigns, campaign_id), ECAMPAIGN_NOT_FOUND);
        
        let campaign = table::borrow_mut(&mut campaign_state.campaigns, campaign_id);
        campaign.is_active = false;
    }

    /// Get the owner of a campaign
    public fun get_campaign_owner(
        campaign_state: &CampaignState,
        campaign_id: String,
    ): address {
        assert!(table::contains(&campaign_state.campaigns, campaign_id), ECAMPAIGN_NOT_FOUND);
        
        let campaign = table::borrow(&campaign_state.campaigns, campaign_id);
        campaign.owner
    }
} 
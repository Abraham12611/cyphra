#[test_only]
module campaign_manager::campaign_state_tests {
    use sui::test_scenario::{Self as ts, Scenario};
    use sui::test_utils::{assert_eq};
    use sui::transfer;
    use sui::object::{Self, ID, UID};
    use sui::tx_context::{Self, TxContext};
    use std::string::{Self, String};
    
    use campaign_manager::campaign_state::{Self, CampaignState};

    // Test accounts
    const ADMIN: address = @0xA;
    const CAMPAIGN_OWNER: address = @0xB;
    const USER: address = @0xC;

    // Test constants
    const TEST_CAMPAIGN_ID: vector<u8> = b"test_campaign_1";
    const START_TIME: u64 = 1000;
    const END_TIME: u64 = 2000;

    // Helper function to set up a test scenario with the module initialized
    fun setup_test(): Scenario {
        let scenario = ts::begin(ADMIN);
        
        // Initialize the module
        {
            ts::next_tx(&mut scenario, ADMIN);
            campaign_state::init_for_testing(ts::ctx(&mut scenario));
        };

        scenario
    }

    // Test verifying if a campaign is active
    #[test]
    fun test_verify_campaign_active() {
        let scenario = setup_test();
        
        // First verify a non-existent campaign (should return false)
        {
            ts::next_tx(&mut scenario, ADMIN);
            let campaign_state = ts::take_shared<CampaignState>(&scenario);
            
            let is_active = campaign_state::verify_campaign_active(
                &campaign_state, 
                string::utf8(TEST_CAMPAIGN_ID),
                ts::ctx(&mut scenario)
            );
            
            assert_eq(is_active, false);
            
            ts::return_shared(campaign_state);
        };
        
        ts::end(scenario);
    }

    // Test adding a campaign
    #[test]
    fun test_add_campaign() {
        let scenario = setup_test();
        
        // Add a new campaign
        {
            ts::next_tx(&mut scenario, CAMPAIGN_OWNER);
            let campaign_state = ts::take_shared<CampaignState>(&scenario);
            
            campaign_state::add_campaign(
                &mut campaign_state,
                string::utf8(TEST_CAMPAIGN_ID),
                START_TIME,
                END_TIME,
                CAMPAIGN_OWNER
            );
            
            ts::return_shared(campaign_state);
        };
        
        // Verify the campaign was added and check owner
        {
            ts::next_tx(&mut scenario, ADMIN);
            let campaign_state = ts::take_shared<CampaignState>(&scenario);
            
            let owner = campaign_state::get_campaign_owner(
                &campaign_state,
                string::utf8(TEST_CAMPAIGN_ID)
            );
            
            assert_eq(owner, CAMPAIGN_OWNER);
            
            ts::return_shared(campaign_state);
        };
        
        ts::end(scenario);
    }
    
    // Test incrementing contributions
    #[test]
    fun test_increment_contributions() {
        let scenario = setup_test();
        
        // First add a campaign
        {
            ts::next_tx(&mut scenario, CAMPAIGN_OWNER);
            let campaign_state = ts::take_shared<CampaignState>(&scenario);
            
            campaign_state::add_campaign(
                &mut campaign_state,
                string::utf8(TEST_CAMPAIGN_ID),
                START_TIME,
                END_TIME,
                CAMPAIGN_OWNER
            );
            
            ts::return_shared(campaign_state);
        };
        
        // Increment contributions
        {
            ts::next_tx(&mut scenario, ADMIN);
            let campaign_state = ts::take_shared<CampaignState>(&scenario);
            
            let count = campaign_state::increment_contributions(
                &mut campaign_state,
                string::utf8(TEST_CAMPAIGN_ID)
            );
            
            // First contribution, so count should be 1
            assert_eq(count, 1);
            
            // Increment again
            let count = campaign_state::increment_contributions(
                &mut campaign_state,
                string::utf8(TEST_CAMPAIGN_ID)
            );
            
            // Second contribution, so count should be 2
            assert_eq(count, 2);
            
            ts::return_shared(campaign_state);
        };
        
        ts::end(scenario);
    }
    
    // Test deactivating a campaign
    #[test]
    fun test_deactivate_campaign() {
        let scenario = setup_test();
        
        // First add a campaign
        {
            ts::next_tx(&mut scenario, CAMPAIGN_OWNER);
            let campaign_state = ts::take_shared<CampaignState>(&scenario);
            
            // Add campaign with current time between start and end for active status
            let ctx = ts::ctx(&mut scenario);
            let current_time = tx_context::epoch(ctx);
            
            campaign_state::add_campaign(
                &mut campaign_state,
                string::utf8(TEST_CAMPAIGN_ID),
                0, // start time at the beginning of time
                current_time + 100, // end time in the future
                CAMPAIGN_OWNER
            );
            
            // Verify the campaign is active
            let is_active = campaign_state::verify_campaign_active(
                &campaign_state,
                string::utf8(TEST_CAMPAIGN_ID),
                ctx
            );
            
            assert_eq(is_active, true);
            
            ts::return_shared(campaign_state);
        };
        
        // Deactivate the campaign
        {
            ts::next_tx(&mut scenario, ADMIN);
            let campaign_state = ts::take_shared<CampaignState>(&scenario);
            
            campaign_state::deactivate_campaign(
                &mut campaign_state,
                string::utf8(TEST_CAMPAIGN_ID)
            );
            
            // Verify the campaign is no longer active
            let is_active = campaign_state::verify_campaign_active(
                &campaign_state,
                string::utf8(TEST_CAMPAIGN_ID),
                ts::ctx(&mut scenario)
            );
            
            assert_eq(is_active, false);
            
            ts::return_shared(campaign_state);
        };
        
        ts::end(scenario);
    }
    
    // Test for campaign not found error
    #[test]
    #[expected_failure(abort_code = 1)] // ECAMPAIGN_NOT_FOUND
    fun test_increment_contributions_not_found() {
        let scenario = setup_test();
        
        // Try to increment contributions for a non-existent campaign
        {
            ts::next_tx(&mut scenario, ADMIN);
            let campaign_state = ts::take_shared<CampaignState>(&scenario);
            
            campaign_state::increment_contributions(
                &mut campaign_state,
                string::utf8(TEST_CAMPAIGN_ID)
            );
            
            ts::return_shared(campaign_state);
        };
        
        ts::end(scenario);
    }
} 
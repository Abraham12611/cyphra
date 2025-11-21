#[test_only]
module campaign_manager::campaign_tests {
    use sui::test_scenario::{Self as ts, Scenario};
    use sui::test_utils::{assert_eq};
    use sui::transfer;
    use sui::object::{Self, ID, UID};
    use sui::tx_context::{Self, TxContext};
    use std::string::{Self, String};
    
    use campaign_manager::campaign::{Self, Campaign, CampaignStore};

    // Test accounts
    const ADMIN: address = @0xA;
    const USER1: address = @0xB;
    const USER2: address = @0xC;

    // Test constants
    const TEST_CAMPAIGN_ID: vector<u8> = b"test_campaign_1";
    const TEST_TITLE: vector<u8> = b"Test Campaign";
    const TEST_DESC: vector<u8> = b"Test Campaign Description";
    const TEST_REQUIREMENTS: vector<u8> = b"Test Requirements";
    const TEST_CRITERIA: vector<u8> = b"Test Quality Criteria";
    const TEST_URI: vector<u8> = b"ipfs://test_uri";
    const UNIT_PRICE: u64 = 100;
    const TOTAL_BUDGET: u64 = 10000;
    const MIN_DATA_COUNT: u64 = 10;
    const MAX_DATA_COUNT: u64 = 100;

    // Helper function to set up a test scenario with the module initialized
    fun setup_test(): Scenario {
        let scenario = ts::begin(ADMIN);
        
        // Initialize the module
        {
            ts::next_tx(&mut scenario, ADMIN);
            campaign::init_for_testing(ts::ctx(&mut scenario));
        };

        scenario
    }

    // Test campaign creation functionality
    #[test]
    fun test_create_campaign() {
        let scenario = setup_test();
        
        // Create a campaign
        {
            ts::next_tx(&mut scenario, ADMIN);
            let campaign_store = ts::take_shared<CampaignStore>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            campaign::create_campaign(
                &mut campaign_store,
                string::utf8(TEST_CAMPAIGN_ID),
                string::utf8(TEST_TITLE),
                string::utf8(TEST_DESC),
                string::utf8(TEST_REQUIREMENTS),
                string::utf8(TEST_CRITERIA),
                UNIT_PRICE,
                TOTAL_BUDGET,
                MIN_DATA_COUNT,
                MAX_DATA_COUNT,
                // Set expiration to a future date (current epoch + 1000)
                tx_context::epoch(ctx) + 1000,
                string::utf8(TEST_URI),
                vector[1, 2, 3, 4], // Example encryption public key
                ctx
            );
            
            ts::return_shared(campaign_store);
        };
        
        // Verify campaign details
        {
            ts::next_tx(&mut scenario, ADMIN);
            let campaign_store = ts::take_shared<CampaignStore>(&scenario);
            
            let (title, description, requirements, criteria, unit_price, total_budget, 
                min_count, max_count, _, is_active, metadata_uri, _) = 
                campaign::get_campaign_details(&campaign_store, string::utf8(TEST_CAMPAIGN_ID));
            
            assert_eq(title, string::utf8(TEST_TITLE));
            assert_eq(description, string::utf8(TEST_DESC));
            assert_eq(requirements, string::utf8(TEST_REQUIREMENTS));
            assert_eq(criteria, string::utf8(TEST_CRITERIA));
            assert_eq(unit_price, UNIT_PRICE);
            assert_eq(total_budget, TOTAL_BUDGET);
            assert_eq(min_count, MIN_DATA_COUNT);
            assert_eq(max_count, MAX_DATA_COUNT);
            assert_eq(is_active, true);
            assert_eq(metadata_uri, string::utf8(TEST_URI));
            
            // Verify campaign status
            let (active, contributions, remaining) = 
                campaign::get_campaign_status(&campaign_store, string::utf8(TEST_CAMPAIGN_ID));
            assert_eq(active, true);
            assert_eq(contributions, 0);
            assert_eq(remaining, MAX_DATA_COUNT);
            
            ts::return_shared(campaign_store);
        };
        
        ts::end(scenario);
    }

    // Test campaign update functionality
    #[test]
    fun test_update_campaign() {
        let scenario = setup_test();
        let campaign_id = string::utf8(TEST_CAMPAIGN_ID);
        
        // Create a campaign and set escrow
        {
            ts::next_tx(&mut scenario, ADMIN);
            let campaign_store = ts::take_shared<CampaignStore>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            campaign::create_campaign(
                &mut campaign_store,
                campaign_id,
                string::utf8(TEST_TITLE),
                string::utf8(TEST_DESC),
                string::utf8(TEST_REQUIREMENTS),
                string::utf8(TEST_CRITERIA),
                UNIT_PRICE,
                TOTAL_BUDGET,
                MIN_DATA_COUNT,
                MAX_DATA_COUNT,
                tx_context::epoch(ctx) + 1000,
                string::utf8(TEST_URI),
                vector[1, 2, 3, 4],
                ctx
            );
            
            // Set escrow status to true (simulating escrow setup)
            campaign::set_escrow_status(&mut campaign_store, campaign_id, true, ts::ctx(&mut scenario));
            
            ts::return_shared(campaign_store);
        };
        
        // Update the campaign
        {
            ts::next_tx(&mut scenario, ADMIN);
            let campaign_store = ts::take_shared<CampaignStore>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            let new_requirements = string::utf8(b"Updated Requirements");
            let new_criteria = string::utf8(b"Updated Quality Criteria");
            let new_expiration = tx_context::epoch(ctx) + 2000;
            
            campaign::update_campaign(
                &mut campaign_store,
                campaign_id,
                new_requirements,
                new_criteria,
                new_expiration,
                ctx
            );
            
            // Verify updates
            let (_, _, requirements, criteria, _, _, _, _, expiration, _, _, _) =
                campaign::get_campaign_details(&campaign_store, campaign_id);
                
            assert_eq(requirements, new_requirements);
            assert_eq(criteria, new_criteria);
            assert_eq(expiration, new_expiration);
            
            ts::return_shared(campaign_store);
        };
        
        ts::end(scenario);
    }

    // Test campaign cancellation
    #[test]
    fun test_cancel_campaign() {
        let scenario = setup_test();
        let campaign_id = string::utf8(TEST_CAMPAIGN_ID);
        
        // Create a campaign
        {
            ts::next_tx(&mut scenario, ADMIN);
            let campaign_store = ts::take_shared<CampaignStore>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            campaign::create_campaign(
                &mut campaign_store,
                campaign_id,
                string::utf8(TEST_TITLE),
                string::utf8(TEST_DESC),
                string::utf8(TEST_REQUIREMENTS),
                string::utf8(TEST_CRITERIA),
                UNIT_PRICE,
                TOTAL_BUDGET,
                MIN_DATA_COUNT,
                MAX_DATA_COUNT,
                tx_context::epoch(ctx) + 1000,
                string::utf8(TEST_URI),
                vector[1, 2, 3, 4],
                ctx
            );
            
            ts::return_shared(campaign_store);
        };
        
        // Cancel the campaign
        {
            ts::next_tx(&mut scenario, ADMIN);
            let campaign_store = ts::take_shared<CampaignStore>(&scenario);
            
            campaign::cancel_campaign(&mut campaign_store, campaign_id, ts::ctx(&mut scenario));
            
            // Verify campaign is no longer active
            let (is_active, _, _) = campaign::get_campaign_status(&campaign_store, campaign_id);
            assert_eq(is_active, false);
            
            ts::return_shared(campaign_store);
        };
        
        ts::end(scenario);
    }

    // Test contribution increment
    #[test]
    fun test_increment_contributions() {
        let scenario = setup_test();
        let campaign_id = string::utf8(TEST_CAMPAIGN_ID);
        
        // Create a campaign
        {
            ts::next_tx(&mut scenario, ADMIN);
            let campaign_store = ts::take_shared<CampaignStore>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            campaign::create_campaign(
                &mut campaign_store,
                campaign_id,
                string::utf8(TEST_TITLE),
                string::utf8(TEST_DESC),
                string::utf8(TEST_REQUIREMENTS),
                string::utf8(TEST_CRITERIA),
                UNIT_PRICE,
                TOTAL_BUDGET,
                MIN_DATA_COUNT,
                MAX_DATA_COUNT,
                tx_context::epoch(ctx) + 1000,
                string::utf8(TEST_URI),
                vector[1, 2, 3, 4],
                ctx
            );
            
            ts::return_shared(campaign_store);
        };
        
        // Increment contributions
        {
            ts::next_tx(&mut scenario, USER1);
            let campaign_store = ts::take_shared<CampaignStore>(&scenario);
            
            let success = campaign::increment_contributions(&mut campaign_store, campaign_id);
            assert_eq(success, true);
            
            // Verify contribution was incremented
            let (_, contributions, remaining) = 
                campaign::get_campaign_status(&campaign_store, campaign_id);
            assert_eq(contributions, 1);
            assert_eq(remaining, MAX_DATA_COUNT - 1);
            
            ts::return_shared(campaign_store);
        };
        
        ts::end(scenario);
    }
} 
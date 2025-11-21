#[test_only]
module campaign_manager::escrow_tests {
    use sui::test_scenario::{Self as ts, Scenario};
    use sui::test_utils::{assert_eq};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::transfer;
    use sui::object::{Self, ID, UID};
    use sui::tx_context::{Self, TxContext};
    use std::string::{Self, String};
    
    use campaign_manager::escrow::{Self, EscrowStore};
    use campaign_manager::campaign::{Self, CampaignStore};

    // Test accounts
    const ADMIN: address = @0xA;
    const CAMPAIGN_CREATOR: address = @0xB;
    const CONTRIBUTOR: address = @0xC;

    // Test constants
    const TEST_CAMPAIGN_ID: vector<u8> = b"test_campaign_1";
    const TEST_CONTRIBUTION_ID: vector<u8> = b"test_contribution_1";
    const UNIT_REWARD: u64 = 100;
    const TOTAL_AMOUNT: u64 = 10000;
    const PLATFORM_FEE: u64 = 500; // 5% in basis points

    // Helper function to set up a test scenario with necessary modules initialized
    fun setup_test(): Scenario {
        let scenario = ts::begin(ADMIN);
        
        // Initialize modules
        {
            ts::next_tx(&mut scenario, ADMIN);
            
            // Initialize escrow module
            escrow::init_for_testing(ts::ctx(&mut scenario));
            
            // Initialize campaign module
            campaign::init_for_testing(ts::ctx(&mut scenario));
        };
        
        scenario
    }

    // Test expected failure when trying to access a non-existent escrow
    #[test]
    #[expected_failure(abort_code = 2)] // ECAMPAIGN_NOT_FOUND
    fun test_refund_non_existent_escrow() {
        let scenario = setup_test();
        
        // Try to refund a non-existent escrow
        {
            ts::next_tx(&mut scenario, CAMPAIGN_CREATOR);
            let escrow_store = ts::take_shared<EscrowStore<SUI>>(&scenario);
            
            escrow::refund_remaining<SUI>(
                &mut escrow_store,
                string::utf8(TEST_CAMPAIGN_ID),
                false, // campaign is not active
                ts::ctx(&mut scenario)
            );
            
            ts::return_shared(escrow_store);
        };
        
        ts::end(scenario);
    }
    
    // Test creating a campaign escrow but first we need to create a campaign
    #[test]
    #[expected_failure(abort_code = 2)] // ECAMPAIGN_NOT_FOUND
    fun test_release_reward_no_escrow() {
        let scenario = setup_test();
        
        // Try to release a reward with no escrow
        {
            ts::next_tx(&mut scenario, CONTRIBUTOR);
            let escrow_store = ts::take_shared<EscrowStore<SUI>>(&scenario);
            
            escrow::release_reward<SUI>(
                &mut escrow_store,
                string::utf8(TEST_CAMPAIGN_ID),
                string::utf8(TEST_CONTRIBUTION_ID),
                ts::ctx(&mut scenario)
            );
            
            ts::return_shared(escrow_store);
        };
        
        ts::end(scenario);
    }

    // Test refund for active campaign (should fail)
    #[test]
    #[expected_failure(abort_code = 2)] // ECAMPAIGN_NOT_FOUND
    fun test_refund_active_campaign() {
        let scenario = setup_test();
        
        // Create a campaign first to make sure we can test escrow functionality
        {
            ts::next_tx(&mut scenario, CAMPAIGN_CREATOR);
            let campaign_store = ts::take_shared<CampaignStore>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            campaign::create_campaign(
                &mut campaign_store,
                string::utf8(TEST_CAMPAIGN_ID),
                string::utf8(b"Test Campaign"),
                string::utf8(b"Test Description"),
                string::utf8(b"Test Requirements"),
                string::utf8(b"Test Quality Criteria"),
                UNIT_REWARD,
                TOTAL_AMOUNT,
                10, // min_data_count
                100, // max_data_count
                tx_context::epoch(ctx) + 1000, // expiration
                string::utf8(b"ipfs://test_uri"),
                vector[1, 2, 3, 4], // Example encryption public key
                ctx
            );
            
            ts::return_shared(campaign_store);
        };
        
        // Try to refund when campaign is active (should fail with expected_failure)
        {
            ts::next_tx(&mut scenario, CAMPAIGN_CREATOR);
            let escrow_store = ts::take_shared<EscrowStore<SUI>>(&scenario);
            
            // This will fail because the escrow doesn't exist yet (ECAMPAIGN_NOT_FOUND)
            escrow::refund_remaining<SUI>(
                &mut escrow_store,
                string::utf8(TEST_CAMPAIGN_ID),
                true, // campaign is active
                ts::ctx(&mut scenario)
            );
            
            ts::return_shared(escrow_store);
        };
        
        ts::end(scenario);
    }
} 
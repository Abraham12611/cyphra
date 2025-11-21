#[test_only]
module campaign_manager::contribution_tests {
    use sui::test_scenario::{Self as ts, Scenario};
    use sui::test_utils::{assert_eq};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::transfer;
    use sui::object::{Self, ID, UID};
    use sui::tx_context::{Self, TxContext};
    use std::string::{Self, String};
    use std::vector;
    
    use campaign_manager::contribution::{Self, ContributionStore, Contribution};
    use campaign_manager::campaign::{Self, CampaignStore};
    use campaign_manager::verifier::{Self, VerifierStore};
    use campaign_manager::escrow::{Self, EscrowStore};
    use campaign_manager::reputation::{Self, ReputationRegistry};

    // Test accounts
    const ADMIN: address = @0xA;
    const CONTRIBUTOR1: address = @0xB;
    const CONTRIBUTOR2: address = @0xC;
    const CAMPAIGN_CREATOR: address = @0xD;

    // Test constants
    const TEST_CAMPAIGN_ID: vector<u8> = b"test_campaign_1";
    const TEST_CONTRIBUTION_ID: vector<u8> = b"test_contribution_1";
    const TEST_DATA_URL: vector<u8> = b"ipfs://test_data_url";
    const TEST_DATA_HASH: vector<u8> = vector[1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const TEST_QUALITY_SCORE: u64 = 85;

    // Helper function to set up a test scenario with necessary modules initialized
    fun setup_scenario(): Scenario {
        let scenario = ts::begin(ADMIN);
        
        // Initialize modules
        {
            ts::next_tx(&mut scenario, ADMIN);
            
            // Initialize contribution module
            contribution::init_for_testing(ts::ctx(&mut scenario));
            
            // Initialize campaign module
            campaign::init_for_testing(ts::ctx(&mut scenario));
            
            // Initialize verifier module
            verifier::init_for_testing(ts::ctx(&mut scenario));
            
            // Initialize reputation module
            reputation::init_for_testing(ts::ctx(&mut scenario));
            
            // Initialize escrow module
            escrow::init_for_testing(ts::ctx(&mut scenario));
        };
        
        scenario
    }
    
    // Test checking if a contribution exists
    #[test]
    fun test_contribution_exists() {
        let scenario = setup_scenario();
        
        // Create a contribution manually (simplified version of the real flow)
        {
            ts::next_tx(&mut scenario, ADMIN);
            let contribution_store = ts::take_shared<ContributionStore>(&scenario);
            
            // Check that the contribution does not exist yet
            let exists = contribution::contribution_exists(
                &contribution_store, 
                string::utf8(TEST_CONTRIBUTION_ID)
            );
            assert_eq(exists, false);
            
            ts::return_shared(contribution_store);
        };
        
        ts::end(scenario);
    }
    
    // Test marking a contribution as rewarded
    #[test]
    #[expected_failure(abort_code = 5)] // ECONTRIBUTION_NOT_FOUND
    fun test_mark_contribution_rewarded_not_found() {
        let scenario = setup_scenario();
        
        // Try to mark a non-existent contribution as rewarded
        {
            ts::next_tx(&mut scenario, ADMIN);
            let contribution_store = ts::take_shared<ContributionStore>(&scenario);
            
            contribution::mark_contribution_rewarded(
                &mut contribution_store,
                string::utf8(TEST_CONTRIBUTION_ID)
            );
            
            ts::return_shared(contribution_store);
        };
        
        ts::end(scenario);
    }
    
    // Test verification of a contribution
    #[test]
    #[expected_failure(abort_code = 5)] // ECONTRIBUTION_NOT_FOUND
    fun test_verify_contribution_not_found() {
        let scenario = setup_scenario();
        
        // Try to verify a non-existent contribution
        {
            ts::next_tx(&mut scenario, ADMIN);
            let contribution_store = ts::take_shared<ContributionStore>(&scenario);
            
            contribution::verify_contribution(
                &mut contribution_store,
                string::utf8(TEST_CONTRIBUTION_ID),
                TEST_QUALITY_SCORE,
                ts::ctx(&mut scenario)
            );
            
            ts::return_shared(contribution_store);
        };
        
        ts::end(scenario);
    }
    
    // Test getting contribution details
    #[test]
    #[expected_failure(abort_code = 5)] // ECONTRIBUTION_NOT_FOUND
    fun test_get_contribution_details_not_found() {
        let scenario = setup_scenario();
        
        // Try to get details of a non-existent contribution
        {
            ts::next_tx(&mut scenario, ADMIN);
            let contribution_store = ts::take_shared<ContributionStore>(&scenario);
            
            let _contribution = contribution::get_contribution_details(
                &contribution_store,
                string::utf8(TEST_CONTRIBUTION_ID)
            );
            
            ts::return_shared(contribution_store);
        };
        
        ts::end(scenario);
    }
    
    // Test getting address contribution count
    #[test]
    fun test_get_address_contribution_count() {
        let scenario = setup_scenario();
        
        // Check contribution count for an address
        {
            ts::next_tx(&mut scenario, ADMIN);
            let contribution_store = ts::take_shared<ContributionStore>(&scenario);
            
            let count = contribution::get_address_contribution_count(
                &contribution_store,
                CONTRIBUTOR1,
                string::utf8(TEST_CAMPAIGN_ID)
            );
            
            // Should be 0 as no contributions exist yet
            assert_eq(count, 0);
            
            ts::return_shared(contribution_store);
        };
        
        ts::end(scenario);
    }
    
    // Test getting total contributions for an address
    #[test]
    fun test_get_address_total_contributions() {
        let scenario = setup_scenario();
        
        // Check total contributions for an address
        {
            ts::next_tx(&mut scenario, ADMIN);
            let contribution_store = ts::take_shared<ContributionStore>(&scenario);
            
            let (total, verified) = contribution::get_address_total_contributions(
                &contribution_store,
                CONTRIBUTOR1
            );
            
            // Should be 0 as no contributions exist yet
            assert_eq(total, 0);
            assert_eq(verified, 0);
            
            ts::return_shared(contribution_store);
        };
        
        ts::end(scenario);
    }
} 
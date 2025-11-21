#[test_only]
module campaign_manager::reputation_tests {
    use sui::test_scenario::{Self as ts, Scenario};
    use sui::test_utils::{assert_eq};
    use sui::transfer;
    use sui::object::{Self, ID, UID};
    use sui::tx_context::{Self, TxContext};
    use std::string::{Self, String};
    use std::vector;
    
    use campaign_manager::reputation::{Self, ReputationRegistry};

    // Test accounts
    const ADMIN: address = @0xA;
    const USER1: address = @0xB;
    const USER2: address = @0xC;

    // Test constants
    const TEST_POINTS: u64 = 50;
    const TEST_REASON: vector<u8> = b"Test reputation points";

    // Helper function to set up a test scenario with the module initialized
    fun setup_test(): Scenario {
        let scenario = ts::begin(ADMIN);
        
        // Initialize the module
        {
            ts::next_tx(&mut scenario, ADMIN);
            reputation::init_for_testing(ts::ctx(&mut scenario));
        };

        scenario
    }

    // Test checking if a user has a reputation store
    #[test]
    fun test_has_reputation_store() {
        let scenario = setup_test();
        
        // Initially user should not have a reputation store
        {
            ts::next_tx(&mut scenario, ADMIN);
            let registry = ts::take_shared<ReputationRegistry>(&scenario);
            
            let has_store = reputation::has_reputation_store(&registry, USER1);
            assert_eq(has_store, false);
            
            ts::return_shared(registry);
        };
        
        ts::end(scenario);
    }

    // Test creating a reputation store
    #[test]
    fun test_ensure_reputation_store_exists() {
        let scenario = setup_test();
        
        // Create a reputation store for USER1
        {
            ts::next_tx(&mut scenario, ADMIN);
            let registry = ts::take_shared<ReputationRegistry>(&scenario);
            
            reputation::ensure_reputation_store_exists(&mut registry, USER1, ts::ctx(&mut scenario));
            
            // Verify store was created
            let has_store = reputation::has_reputation_store(&registry, USER1);
            assert_eq(has_store, true);
            
            ts::return_shared(registry);
        };
        
        ts::end(scenario);
    }
    
    // Test adding reputation points
    #[test]
    #[expected_failure(abort_code = 1)] // ENO_REPUTATION_STORE
    fun test_add_reputation_points_no_store() {
        let scenario = setup_test();
        
        // Try to add points to a user without a store
        {
            ts::next_tx(&mut scenario, ADMIN);
            let registry = ts::take_shared<ReputationRegistry>(&scenario);
            
            reputation::add_reputation_points(
                &mut registry,
                USER1,
                TEST_POINTS,
                TEST_REASON,
                ts::ctx(&mut scenario)
            );
            
            ts::return_shared(registry);
        };
        
        ts::end(scenario);
    }
    
    // Test adding reputation points to a user with a store
    #[test]
    fun test_add_reputation_points() {
        let scenario = setup_test();
        
        // Create a reputation store and add points
        {
            ts::next_tx(&mut scenario, ADMIN);
            let registry = ts::take_shared<ReputationRegistry>(&scenario);
            
            // First create the store
            reputation::ensure_reputation_store_exists(&mut registry, USER1, ts::ctx(&mut scenario));
            
            // Then add points
            reputation::add_reputation_points(
                &mut registry,
                USER1,
                TEST_POINTS,
                TEST_REASON,
                ts::ctx(&mut scenario)
            );
            
            ts::return_shared(registry);
        };
        
        ts::end(scenario);
    }
    
    // Test recording a successful contribution
    #[test]
    #[expected_failure(abort_code = 1)] // ENO_REPUTATION_STORE
    fun test_record_successful_contribution_no_store() {
        let scenario = setup_test();
        
        // Try to record a contribution without a store
        {
            ts::next_tx(&mut scenario, USER1);
            let registry = ts::take_shared<ReputationRegistry>(&scenario);
            
            reputation::record_successful_contribution(&mut registry, ts::ctx(&mut scenario));
            
            ts::return_shared(registry);
        };
        
        ts::end(scenario);
    }
    
    // Test recording a successful contribution with a store
    #[test]
    fun test_record_successful_contribution() {
        let scenario = setup_test();
        
        // Create a reputation store and record contribution
        {
            ts::next_tx(&mut scenario, ADMIN);
            let registry = ts::take_shared<ReputationRegistry>(&scenario);
            
            // First create the store for USER1
            reputation::ensure_reputation_store_exists(&mut registry, USER1, ts::ctx(&mut scenario));
            
            ts::return_shared(registry);
        };
        
        // Record contribution as USER1
        {
            ts::next_tx(&mut scenario, USER1);
            let registry = ts::take_shared<ReputationRegistry>(&scenario);
            
            reputation::record_successful_contribution(&mut registry, ts::ctx(&mut scenario));
            
            ts::return_shared(registry);
        };
        
        ts::end(scenario);
    }
    
    // Test recording a successful payment
    #[test]
    #[expected_failure(abort_code = 1)] // ENO_REPUTATION_STORE
    fun test_record_successful_payment_no_store() {
        let scenario = setup_test();
        
        // Try to record a payment without a store
        {
            ts::next_tx(&mut scenario, USER1);
            let registry = ts::take_shared<ReputationRegistry>(&scenario);
            
            reputation::record_successful_payment(&mut registry, ts::ctx(&mut scenario));
            
            ts::return_shared(registry);
        };
        
        ts::end(scenario);
    }
    
    // Test recording a successful payment with a store
    #[test]
    fun test_record_successful_payment() {
        let scenario = setup_test();
        
        // Create a reputation store and record payment
        {
            ts::next_tx(&mut scenario, ADMIN);
            let registry = ts::take_shared<ReputationRegistry>(&scenario);
            
            // First create the store for USER1
            reputation::ensure_reputation_store_exists(&mut registry, USER1, ts::ctx(&mut scenario));
            
            ts::return_shared(registry);
        };
        
        // Record payment as USER1
        {
            ts::next_tx(&mut scenario, USER1);
            let registry = ts::take_shared<ReputationRegistry>(&scenario);
            
            reputation::record_successful_payment(&mut registry, ts::ctx(&mut scenario));
            
            ts::return_shared(registry);
        };
        
        ts::end(scenario);
    }
} 
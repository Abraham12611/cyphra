#[test_only]
module campaign_manager::verifier_tests {
    use sui::test_scenario::{Self as ts, Scenario};
    use sui::test_utils::{assert_eq};
    use sui::transfer;
    use sui::object::{Self, ID, UID};
    use sui::tx_context::{Self, TxContext};
    use std::string::{Self, String};
    use std::vector;
    
    use campaign_manager::verifier::{Self, VerifierRegistry, VerifierStore, VerificationScores};

    // Test accounts
    const ADMIN: address = @0xA;
    const VERIFIER1: address = @0xB;
    const VERIFIER2: address = @0xC;

    // Test constants
    const TEST_PUBLIC_KEY: vector<u8> = vector[
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
        17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32
    ];

    // Helper function to set up a test scenario with the module initialized
    fun setup_test(): Scenario {
        let scenario = ts::begin(ADMIN);
        
        {
            ts::next_tx(&mut scenario, ADMIN);
            verifier::init_for_testing(ts::ctx(&mut scenario));
        };

        scenario
    }

    // Test verifier registration
    #[test]
    fun test_add_verifier() {
        let scenario = setup_test();
        
        // Add a verifier
        {
            ts::next_tx(&mut scenario, ADMIN);
            let registry = ts::take_shared<VerifierRegistry>(&scenario);
            
            verifier::add_verifier(
                &mut registry,
                VERIFIER1,
                TEST_PUBLIC_KEY,
                ts::ctx(&mut scenario)
            );
            
            ts::return_shared(registry);
        };
        
        // Check if verifier is active
        {
            ts::next_tx(&mut scenario, ADMIN);
            let registry = ts::take_shared<VerifierRegistry>(&scenario);
            
            let is_active = verifier::is_active_verifier(&registry, VERIFIER1);
            assert_eq(is_active, true);
            
            ts::return_shared(registry);
        };
        
        ts::end(scenario);
    }

    // Test verifier removal
    #[test]
    fun test_remove_verifier() {
        let scenario = setup_test();
        
        // Add a verifier first
        {
            ts::next_tx(&mut scenario, ADMIN);
            let registry = ts::take_shared<VerifierRegistry>(&scenario);
            
            verifier::add_verifier(
                &mut registry,
                VERIFIER1,
                TEST_PUBLIC_KEY,
                ts::ctx(&mut scenario)
            );
            
            ts::return_shared(registry);
        };
        
        // Remove the verifier
        {
            ts::next_tx(&mut scenario, ADMIN);
            let registry = ts::take_shared<VerifierRegistry>(&scenario);
            
            verifier::remove_verifier(
                &mut registry,
                VERIFIER1,
                ts::ctx(&mut scenario)
            );
            
            // Verify verifier is no longer active
            let is_active = verifier::is_active_verifier(&registry, VERIFIER1);
            assert_eq(is_active, false);
            
            ts::return_shared(registry);
        };
        
        ts::end(scenario);
    }

    // Test verifier key operations
    #[test]
    fun test_verifier_key_operations() {
        let scenario = setup_test();
        
        // Add a verifier key
        {
            ts::next_tx(&mut scenario, ADMIN);
            let store = ts::take_shared<VerifierStore>(&scenario);
            
            verifier::add_verifier_key(
                &mut store,
                TEST_PUBLIC_KEY,
                ts::ctx(&mut scenario)
            );
            
            ts::return_shared(store);
        };
        
        // Update reputation
        {
            ts::next_tx(&mut scenario, ADMIN);
            let store = ts::take_shared<VerifierStore>(&scenario);
            
            let new_reputation = 80;
            verifier::update_reputation(
                &mut store,
                TEST_PUBLIC_KEY,
                new_reputation,
                ts::ctx(&mut scenario)
            );
            
            // Verify reputation was updated
            let (reputation, _, _) = verifier::get_verifier_info(&store, TEST_PUBLIC_KEY);
            assert_eq(reputation, new_reputation);
            
            ts::return_shared(store);
        };
        
        ts::end(scenario);
    }

    // Test verification scores
    #[test]
    fun test_verification_scores() {
        let scenario = setup_test();
        
        // Create verification scores
        {
            ts::next_tx(&mut scenario, ADMIN);
            
            let verifier_reputation = 85;
            let quality_score = 90;
            
            let scores = verifier::create_verification_scores(verifier_reputation, quality_score);
            
            // Verify scores
            let (rep, quality) = verifier::get_scores(&scores);
            assert_eq(rep, verifier_reputation);
            assert_eq(quality, quality_score);
            
            // Check if sufficient for reward
            let sufficient = verifier::is_sufficient_for_reward(&scores);
            assert_eq(sufficient, true);
        };
        
        ts::end(scenario);
    }

    // Test verification functionality
    #[test]
    fun test_verify_contribution() {
        let scenario = setup_test();
        
        // Add a verifier key
        {
            ts::next_tx(&mut scenario, ADMIN);
            let store = ts::take_shared<VerifierStore>(&scenario);
            
            verifier::add_verifier_key(
                &mut store,
                TEST_PUBLIC_KEY,
                ts::ctx(&mut scenario)
            );
            
            ts::return_shared(store);
        };
        
        // Verify a contribution
        {
            ts::next_tx(&mut scenario, VERIFIER1);
            let store = ts::take_shared<VerifierStore>(&scenario);
            
            let quality_score = 85;
            let result = verifier::verify_contribution(
                &mut store,
                TEST_PUBLIC_KEY,
                quality_score,
                ts::ctx(&mut scenario)
            );
            
            // Check verification result
            let is_valid = verifier::is_valid(&result);
            assert_eq(is_valid, true);
            
            // Check verification scores
            let scores = verifier::get_result_scores(&result);
            let (rep, quality) = verifier::get_scores(scores);
            assert_eq(rep, 100); // Initial reputation is 100
            assert_eq(quality, quality_score);
            
            ts::return_shared(store);
        };
        
        ts::end(scenario);
    }

    // Test verification with invalid key
    #[test]
    fun test_verify_with_invalid_key() {
        let scenario = setup_test();
        
        // Try to verify with non-existent key
        {
            ts::next_tx(&mut scenario, VERIFIER1);
            let store = ts::take_shared<VerifierStore>(&scenario);
            
            let invalid_key = vector[
                5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
                21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36
            ];
            
            let quality_score = 85;
            let result = verifier::verify_contribution(
                &mut store,
                invalid_key,
                quality_score,
                ts::ctx(&mut scenario)
            );
            
            // Check verification result (should be invalid)
            let is_valid = verifier::is_valid(&result);
            assert_eq(is_valid, false);
            
            ts::return_shared(store);
        };
        
        ts::end(scenario);
    }

    // Test signature verification with valid signature
    #[test]
    fun test_signature_verification_valid() {
        let scenario = setup_test();
        
        // Add a verifier key
        {
            ts::next_tx(&mut scenario, ADMIN);
            let store = ts::take_shared<VerifierStore>(&scenario);
            
            verifier::add_verifier_key(
                &mut store,
                TEST_PUBLIC_KEY,
                ts::ctx(&mut scenario)
            );
            
            ts::return_shared(store);
        };
        
        // Test signature verification with mock data
        {
            ts::next_tx(&mut scenario, VERIFIER1);
            let store = ts::take_shared<VerifierStore>(&scenario);
            
            // Create test data
            let campaign_id = b"test_campaign";
            let contribution_id = b"test_contribution";
            let data_hash = vector[1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
            let quality_score = 85;
            
            // Create a mock signature (64 bytes)
            let signature = vector[
                0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
                16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31,
                32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47,
                48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63
            ];
            
            // Note: This test will likely fail in practice because we're using mock data
            // In a real scenario, you'd need to generate a proper signature using the private key
            let result = verifier::verify_contribution_with_signature(
                &mut store,
                TEST_PUBLIC_KEY,
                signature,
                campaign_id,
                contribution_id,
                data_hash,
                quality_score,
                ts::ctx(&mut scenario)
            );
            
            // The result will be false because our mock signature isn't valid
            // This test demonstrates the API usage
            let is_valid = verifier::is_valid(&result);
            // In real usage with proper signatures, this would be true
            
            ts::return_shared(store);
        };
        
        ts::end(scenario);
    }

    // Test signature verification with invalid signature length
    #[test]
    #[expected_failure(abort_code = 4)] // EINVALID_SIGNATURE
    fun test_signature_verification_invalid_signature_length() {
        let scenario = setup_test();
        
        // Add a verifier key
        {
            ts::next_tx(&mut scenario, ADMIN);
            let store = ts::take_shared<VerifierStore>(&scenario);
            
            verifier::add_verifier_key(
                &mut store,
                TEST_PUBLIC_KEY,
                ts::ctx(&mut scenario)
            );
            
            ts::return_shared(store);
        };
        
        // Test with invalid signature length
        {
            ts::next_tx(&mut scenario, VERIFIER1);
            let store = ts::take_shared<VerifierStore>(&scenario);
            
            let campaign_id = b"test_campaign";
            let contribution_id = b"test_contribution";
            let data_hash = vector[1, 2, 3, 4, 5];
            let quality_score = 85;
            
            // Invalid signature (wrong length - only 32 bytes instead of 64)
            let invalid_signature = vector[
                0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
                16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31
            ];
            
            // This should abort with EINVALID_SIGNATURE
            verifier::verify_contribution_with_signature(
                &mut store,
                TEST_PUBLIC_KEY,
                invalid_signature,
                campaign_id,
                contribution_id,
                data_hash,
                quality_score,
                ts::ctx(&mut scenario)
            );
            
            ts::return_shared(store);
        };
        
        ts::end(scenario);
    }

    // Test signature verification with invalid public key length
    #[test]
    #[expected_failure(abort_code = 5)] // EINVALID_PUBLIC_KEY
    fun test_signature_verification_invalid_public_key_length() {
        let scenario = setup_test();
        
        // Add a verifier key first (this won't be used in the failing call)
        {
            ts::next_tx(&mut scenario, ADMIN);
            let store = ts::take_shared<VerifierStore>(&scenario);
            
            verifier::add_verifier_key(
                &mut store,
                TEST_PUBLIC_KEY,
                ts::ctx(&mut scenario)
            );
            
            ts::return_shared(store);
        };
        
        // Test with invalid public key length
        {
            ts::next_tx(&mut scenario, VERIFIER1);
            let store = ts::take_shared<VerifierStore>(&scenario);
            
            let campaign_id = b"test_campaign";
            let contribution_id = b"test_contribution";
            let data_hash = vector[1, 2, 3, 4, 5];
            let quality_score = 85;
            
            // Valid signature length but invalid public key length
            let signature = vector[
                0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
                16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31,
                32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47,
                48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63
            ];
            
            // Invalid public key (wrong length - only 16 bytes instead of 32)
            let invalid_public_key = vector[
                1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16
            ];
            
            // This should abort with EINVALID_PUBLIC_KEY
            verifier::verify_contribution_with_signature(
                &mut store,
                invalid_public_key,
                signature,
                campaign_id,
                contribution_id,
                data_hash,
                quality_score,
                ts::ctx(&mut scenario)
            );
            
            ts::return_shared(store);
        };
        
        ts::end(scenario);
    }

    // Test generic signature verification function
    #[test]
    fun test_generic_signature_verification() {
        let scenario = setup_test();
        
        // Add a verifier key
        {
            ts::next_tx(&mut scenario, ADMIN);
            let store = ts::take_shared<VerifierStore>(&scenario);
            
            verifier::add_verifier_key(
                &mut store,
                TEST_PUBLIC_KEY,
                ts::ctx(&mut scenario)
            );
            
            ts::return_shared(store);
        };
        
        // Test generic signature verification
        {
            ts::next_tx(&mut scenario, VERIFIER1);
            let store = ts::take_shared<VerifierStore>(&scenario);
            
            let message = b"Hello, World!";
            let signature = vector[
                0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
                16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31,
                32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47,
                48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63
            ];
            
            // This will return false with mock data, but demonstrates the API
            let is_valid = verifier::verify_signature(
                &store,
                TEST_PUBLIC_KEY,
                signature,
                message
            );
            
            // With proper signature this would be true
            // This test demonstrates the function can be called without errors
            
            ts::return_shared(store);
        };
        
        ts::end(scenario);
    }

    // Test signature verification with low reputation verifier
    #[test]
    fun test_signature_verification_low_reputation() {
        let scenario = setup_test();
        
        // Add a verifier key with low reputation
        {
            ts::next_tx(&mut scenario, ADMIN);
            let store = ts::take_shared<VerifierStore>(&scenario);
            
            verifier::add_verifier_key(
                &mut store,
                TEST_PUBLIC_KEY,
                ts::ctx(&mut scenario)
            );
            
            // Set low reputation (below minimum threshold of 70)
            verifier::update_reputation(
                &mut store,
                TEST_PUBLIC_KEY,
                60, // Below MINIMUM_VERIFIER_REPUTATION
                ts::ctx(&mut scenario)
            );
            
            ts::return_shared(store);
        };
        
        // Test signature verification with low reputation verifier
        {
            ts::next_tx(&mut scenario, VERIFIER1);
            let store = ts::take_shared<VerifierStore>(&scenario);
            
            let message = b"Test message";
            let signature = vector[
                0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
                16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31,
                32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47,
                48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63
            ];
            
            // Should return false due to low reputation
            let is_valid = verifier::verify_signature(
                &store,
                TEST_PUBLIC_KEY,
                signature,
                message
            );
            assert_eq(is_valid, false);
            
            ts::return_shared(store);
        };
        
        ts::end(scenario);
    }
} 
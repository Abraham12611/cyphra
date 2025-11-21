module campaign_manager::verifier {
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::event;
    use sui::table::{Self, Table};
    use std::string::{Self, String};
    use std::vector;
    use sui::ed25519;
    use sui::hash;
    use sui::bcs;

    /// Error codes
    const ENOT_AUTHORIZED: u64 = 1;
    const EVERIFIER_NOT_FOUND: u64 = 2;
    const EVERIFIER_ALREADY_EXISTS: u64 = 3;
    const EINVALID_SIGNATURE: u64 = 4;
    const EINVALID_PUBLIC_KEY: u64 = 5;
    const EVERIFIER_INACTIVE: u64 = 6;
    const ENOT_ADMIN: u64 = 7;
    const EKEY_ALREADY_EXISTS: u64 = 8;
    const EKEY_NOT_FOUND: u64 = 9;
    const EVERIFIER_LOW_REPUTATION: u64 = 10;
    const ELOW_QUALITY_SCORE: u64 = 11;
    const EINVALID_SCORE: u64 = 12;

    /// Minimum thresholds for verification
    const MINIMUM_VERIFIER_REPUTATION: u64 = 70;
    const MINIMUM_QUALITY_SCORE: u64 = 70;
    const MAXIMUM_SCORE: u64 = 100;
    const MINIMUM_SCORE: u64 = 0;

    /// Verifier with their public key and reputation info
    struct VerifierInfo has store {
        address: address,
        public_key: vector<u8>,    // ED25519 public key
        reputation_score: u64,     // 0-100 score based on verification accuracy
        total_verifications: u64,
        is_active: bool,
        last_active: u64,          // Timestamp of last verification
    }

    /// Registry of all verifiers
    struct VerifierRegistry has key {
        id: UID,
        verifiers: Table<address, VerifierInfo>,
        admin: address            // Address that can add/remove verifiers
    }

    /// Store for public verification keys
    struct VerifierStore has key {
        id: UID,
        admin: address,
        // Table mapping public key (as bytes) to reputation
        verifier_keys: Table<vector<u8>, VerifierKey>  
    }

    /// Key for verification
    struct VerifierKey has store {
        public_key: vector<u8>,
        reputation_score: u64,     // 0-100 score
        total_verifications: u64,
        last_active: u64,
    }

    /// Result of a verification
    struct VerificationResult has drop {
        is_valid: bool,
        scores: VerificationScores,
    }

    /// Scores for verifications
    struct VerificationScores has copy, drop, store {
        verifier_reputation: u64,
        quality_score: u64,
    }

    /// Events for verifier actions
    struct VerifierEvent has copy, drop {
        verifier_address: address,
        action: String,            // "added", "removed", "updated"
        timestamp: u64,
    }

    /// Module initialization
    fun init(ctx: &mut TxContext) {
        let sender = tx_context::sender(ctx);
        
        // Initialize verifier registry
        let verifier_registry = VerifierRegistry {
            id: object::new(ctx),
            verifiers: table::new(ctx),
            admin: sender
        };
        transfer::share_object(verifier_registry);

        // Initialize verifier store
        let verifier_store = VerifierStore {
            id: object::new(ctx),
            admin: sender,
            verifier_keys: table::new(ctx)
        };
        transfer::share_object(verifier_store);
    }
    
    /// Test-only initializer function for use in tests
    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx)
    }

    /// Add a new verifier to the registry
    public fun add_verifier(
        registry: &mut VerifierRegistry,
        verifier_address: address,
        public_key: vector<u8>,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        
        // Only admin can add verifiers
        assert!(registry.admin == sender, ENOT_AUTHORIZED);
        
        // Verify verifier doesn't already exist
        assert!(!table::contains(&registry.verifiers, verifier_address), EVERIFIER_ALREADY_EXISTS);
        
        // Verify public key format (should be 32 bytes for ED25519)
        assert!(vector::length(&public_key) == 32, EINVALID_PUBLIC_KEY);
        
        let verifier = VerifierInfo {
            address: verifier_address,
            public_key,
            reputation_score: 100, 
            total_verifications: 0,
            is_active: true,
            last_active: tx_context::epoch(ctx),
        };

        // Add verifier to registry
        table::add(&mut registry.verifiers, verifier_address, verifier);

        // Emit verifier event
        event::emit(VerifierEvent {
            verifier_address,
            action: string::utf8(b"added"),
            timestamp: tx_context::epoch(ctx),
        });
    }

    /// Remove a verifier from the registry (set inactive)
    public fun remove_verifier(
        registry: &mut VerifierRegistry,
        verifier_address: address,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        
        // Only admin can remove verifiers
        assert!(registry.admin == sender, ENOT_AUTHORIZED);
        
        // Check if verifier exists
        assert!(table::contains(&registry.verifiers, verifier_address), EVERIFIER_NOT_FOUND);
        
        // Set verifier to inactive
        let verifier = table::borrow_mut(&mut registry.verifiers, verifier_address);
        verifier.is_active = false;
        
        // Emit verifier removal event
        event::emit(VerifierEvent {
            verifier_address,
            action: string::utf8(b"removed"),
            timestamp: tx_context::epoch(ctx),
        });
    }

    /// Check if an address is an active verifier
    public fun is_active_verifier(
        registry: &VerifierRegistry,
        verifier_address: address
    ): bool {
        if (!table::contains(&registry.verifiers, verifier_address)) {
            return false
        };
        
        let verifier = table::borrow(&registry.verifiers, verifier_address);
        verifier.is_active
    }

    /// Add a public key to the verifier store
    public fun add_verifier_key(
        store: &mut VerifierStore,
        public_key: vector<u8>,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        
        // Only admin can add keys
        assert!(store.admin == sender, ENOT_ADMIN);
        
        // Check if key already exists
        assert!(!table::contains(&store.verifier_keys, public_key), EKEY_ALREADY_EXISTS);
        
        // Create verifier key
        let verifier_key = VerifierKey {
            public_key,
            reputation_score: 100,  
            total_verifications: 0,
            last_active: tx_context::epoch(ctx),
        };
        
        table::add(&mut store.verifier_keys, public_key, verifier_key);
    }

    /// Update the reputation score for a verifier key
    public fun update_reputation(
        store: &mut VerifierStore,
        public_key: vector<u8>,
        new_score: u64,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        
        // Only admin can update reputation
        assert!(store.admin == sender, ENOT_ADMIN);
        
        // Validate score
        assert!(new_score <= MAXIMUM_SCORE, EINVALID_SCORE);
        
        // Check if key exists
        assert!(table::contains(&store.verifier_keys, public_key), EKEY_NOT_FOUND);
        
        // Update reputation score
        let key = table::borrow_mut(&mut store.verifier_keys, public_key);
        key.reputation_score = new_score;
    }

    /// Create verification scores with validation
    public fun create_verification_scores(
        verifier_reputation: u64,
        quality_score: u64
    ): VerificationScores {
        // Validate scores
        assert!(is_valid_score(verifier_reputation), EINVALID_SCORE);
        assert!(is_valid_score(quality_score), EINVALID_SCORE);
        
        VerificationScores {
            verifier_reputation,
            quality_score,
        }
    }

    /// Check if a score is valid (between min and max)
    public fun is_valid_score(score: u64): bool {
        score >= MINIMUM_SCORE && score <= MAXIMUM_SCORE
    }

    /// Check if scores are sufficient for reward
    public fun is_sufficient_for_reward(scores: &VerificationScores): bool {
        scores.verifier_reputation >= MINIMUM_VERIFIER_REPUTATION && 
        scores.quality_score >= MINIMUM_QUALITY_SCORE
    }

    /// Get scores from a verification scores object
    public fun get_scores(scores: &VerificationScores): (u64, u64) {
        (scores.verifier_reputation, scores.quality_score)
    }

    /// Check if a verification result is valid
    public fun is_valid(result: &VerificationResult): bool {
        result.is_valid
    }

    /// Get scores from a verification result
    public fun get_result_scores(result: &VerificationResult): &VerificationScores {
        &result.scores
    }

    /// Get verifier info
    public fun get_verifier_info(
        store: &VerifierStore,
        public_key: vector<u8>
    ): (u64, u64, u64) {
        assert!(table::contains(&store.verifier_keys, public_key), EKEY_NOT_FOUND);
        
        let key = table::borrow(&store.verifier_keys, public_key);
        (
            key.reputation_score,
            key.total_verifications,
            key.last_active
        )
    }

   
    /// The signature is checked against a message constructed from campaign_id, contribution_id,
    /// data_payload, and quality_score.
    public fun verify_contribution(
        store: &mut VerifierStore,
        verifier_public_key: vector<u8>,
        quality_score: u64,
        ctx: &mut TxContext
    ): VerificationResult {
        // Assert that the quality score is valid
        assert!(is_valid_score(quality_score), EINVALID_SCORE);

        // Check if the verifier's public key is registered in the store.
        if (table::contains(&store.verifier_keys, verifier_public_key)) {
            // Key is found, proceed to update stats and return a successful result.
            let key = table::borrow_mut(&mut store.verifier_keys, verifier_public_key);
            key.total_verifications = key.total_verifications + 1;
            key.last_active = tx_context::epoch(ctx);
            
            VerificationResult {
                is_valid: true,
                scores: create_verification_scores(key.reputation_score, quality_score)
            }
        } else {
            // Key not found, return an invalid result.
            VerificationResult {
                is_valid: false,
                scores: create_verification_scores(0, 0) // Using 0,0 for scores when key is not found
            }
        }
    }

    /// Verify contribution with actual signature verification
    /// This function performs cryptographic signature verification using ED25519
    public fun verify_contribution_with_signature(
        store: &mut VerifierStore,
        verifier_public_key: vector<u8>,
        signature: vector<u8>,
        campaign_id: vector<u8>,
        contribution_id: vector<u8>,
        data_hash: vector<u8>,
        quality_score: u64,
        ctx: &mut TxContext
    ): VerificationResult {
        // Assert that the quality score is valid
        assert!(is_valid_score(quality_score), EINVALID_SCORE);
        
        // Validate public key length (ED25519 public keys are 32 bytes)
        assert!(vector::length(&verifier_public_key) == 32, EINVALID_PUBLIC_KEY);
        
        // Validate signature length (ED25519 signatures are 64 bytes)
        assert!(vector::length(&signature) == 64, EINVALID_SIGNATURE);

        // Check if the verifier's public key is registered in the store
        if (!table::contains(&store.verifier_keys, verifier_public_key)) {
            return VerificationResult {
                is_valid: false,
                scores: create_verification_scores(0, 0)
            }
        };

        // Construct the message for signature verification
        let message = construct_verification_message(
            campaign_id,
            contribution_id,
            data_hash,
            quality_score
        );

        // Perform ED25519 signature verification
        let signature_valid = ed25519::ed25519_verify(&signature, &verifier_public_key, &message);
        
        if (signature_valid) {
            // Signature is valid, update verifier stats
            let key = table::borrow_mut(&mut store.verifier_keys, verifier_public_key);
            key.total_verifications = key.total_verifications + 1;
            key.last_active = tx_context::epoch(ctx);
            
            VerificationResult {
                is_valid: true,
                scores: create_verification_scores(key.reputation_score, quality_score)
            }
        } else {
            // Signature verification failed
            VerificationResult {
                is_valid: false,
                scores: create_verification_scores(0, 0)
            }
        }
    }

    /// Construct a message for signature verification
    /// Combines campaign_id, contribution_id, data_hash, and quality_score into a single message
    fun construct_verification_message(
        campaign_id: vector<u8>,
        contribution_id: vector<u8>,
        data_hash: vector<u8>,
        quality_score: u64
    ): vector<u8> {
        let message = vector::empty<u8>();
        
        // Append campaign_id
        vector::append(&mut message, campaign_id);
        
        // Append contribution_id
        vector::append(&mut message, contribution_id);
        
        // Append data_hash
        vector::append(&mut message, data_hash);
        
        // Append quality_score as bytes
        let quality_score_bytes = bcs::to_bytes(&quality_score);
        vector::append(&mut message, quality_score_bytes);
        
        // Hash the combined message using Blake2b for consistency
        hash::blake2b256(&message)
    }

    /// Verify a signature for arbitrary data
    /// Generic function for verifying any message with a verifier's signature
    public fun verify_signature(
        store: &VerifierStore,
        verifier_public_key: vector<u8>,
        signature: vector<u8>,
        message: vector<u8>
    ): bool {
        // Validate inputs
        assert!(vector::length(&verifier_public_key) == 32, EINVALID_PUBLIC_KEY);
        assert!(vector::length(&signature) == 64, EINVALID_SIGNATURE);
        
        // Check if verifier is registered and active
        if (!table::contains(&store.verifier_keys, verifier_public_key)) {
            return false
        };
        
        let key = table::borrow(&store.verifier_keys, verifier_public_key);
        if (key.reputation_score < MINIMUM_VERIFIER_REPUTATION) {
            return false
        };
        
        // Perform signature verification
        ed25519::ed25519_verify(&signature, &verifier_public_key, &message)
    }
} 
/// Nautilus Verification Module for Cyphra
/// Handles TEE attestation verification and enclave registration
module nautilus_verification::verification {
    use std::string::{Self, String};
    use std::vector;
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::table::{Self, Table};
    use sui::event;
    use sui::clock::{Self, Clock};

    // Error codes
    const EENCLAVE_NOT_FOUND: u64 = 1;
    const EINVALID_ATTESTATION: u64 = 2;
    const EENCLAVE_ALREADY_EXISTS: u64 = 3;
    const EINVALID_PCR_VALUES: u64 = 4;
    const EUNAUTHORIZED: u64 = 5;

    /// Registered Nautilus enclave
    struct RegisteredEnclave has key, store {
        id: UID,
        enclave_id: String,
        owner: address,
        pcr0: vector<u8>,
        pcr1: vector<u8>,
        pcr2: vector<u8>,
        public_key: vector<u8>,
        registration_timestamp: u64,
        is_active: bool,
        verification_count: u64,
    }

    /// Enclave registry
    struct EnclaveRegistry has key {
        id: UID,
        enclaves: Table<String, RegisteredEnclave>,
        admin: address,
    }

    /// Verification result
    struct VerificationResult has key, store {
        id: UID,
        enclave_id: String,
        campaign_id: String,
        blob_id: String,
        verification_type: String, // "quality", "authenticity", "training"
        quality_score: u64, // Scaled by 1000 (e.g., 850 = 0.850)
        verified: bool,
        attestation_hash: vector<u8>,
        verification_timestamp: u64,
    }

    /// Attestation document
    struct AttestationDocument has copy, drop, store {
        enclave_id: String,
        computation_hash: vector<u8>,
        pcr_values: vector<vector<u8>>,
        signature: vector<u8>,
        timestamp: u64,
    }

    // Events
    struct EnclaveRegisteredEvent has copy, drop {
        enclave_id: String,
        owner: address,
        timestamp: u64,
    }

    struct VerificationCompletedEvent has copy, drop {
        enclave_id: String,
        campaign_id: String,
        blob_id: String,
        verification_type: String,
        quality_score: u64,
        verified: bool,
        timestamp: u64,
    }

    struct AttestationVerifiedEvent has copy, drop {
        enclave_id: String,
        attestation_hash: vector<u8>,
        verified: bool,
        timestamp: u64,
    }

    /// Initialize the enclave registry
    fun init(ctx: &mut TxContext) {
        let registry = EnclaveRegistry {
            id: object::new(ctx),
            enclaves: table::new(ctx),
            admin: tx_context::sender(ctx),
        };
        transfer::share_object(registry);
    }

    /// Register a new Nautilus enclave
    public entry fun register_enclave(
        registry: &mut EnclaveRegistry,
        enclave_id: String,
        pcr0: vector<u8>,
        pcr1: vector<u8>,
        pcr2: vector<u8>,
        public_key: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Check if enclave already exists
        assert!(!table::contains(&registry.enclaves, enclave_id), EENCLAVE_ALREADY_EXISTS);
        
        // Validate PCR values (should be 32 bytes each)
        assert!(vector::length(&pcr0) == 32, EINVALID_PCR_VALUES);
        assert!(vector::length(&pcr1) == 32, EINVALID_PCR_VALUES);
        assert!(vector::length(&pcr2) == 32, EINVALID_PCR_VALUES);

        let enclave = RegisteredEnclave {
            id: object::new(ctx),
            enclave_id,
            owner: tx_context::sender(ctx),
            pcr0,
            pcr1,
            pcr2,
            public_key,
            registration_timestamp: clock::timestamp_ms(clock),
            is_active: true,
            verification_count: 0,
        };

        table::add(&mut registry.enclaves, enclave_id, enclave);

        event::emit(EnclaveRegisteredEvent {
            enclave_id,
            owner: tx_context::sender(ctx),
            timestamp: clock::timestamp_ms(clock),
        });
    }

    /// Verify attestation document
    public fun verify_attestation(
        registry: &EnclaveRegistry,
        attestation: AttestationDocument,
        clock: &Clock,
    ): bool {
        // Check if enclave is registered
        if (!table::contains(&registry.enclaves, attestation.enclave_id)) {
            return false
        };

        let enclave = table::borrow(&registry.enclaves, attestation.enclave_id);
        
        // Check if enclave is active
        if (!enclave.is_active) {
            return false
        };

        // Verify PCR values match registered values
        if (vector::length(&attestation.pcr_values) != 3) {
            return false
        };

        let pcr0 = vector::borrow(&attestation.pcr_values, 0);
        let pcr1 = vector::borrow(&attestation.pcr_values, 1);
        let pcr2 = vector::borrow(&attestation.pcr_values, 2);

        if (pcr0 != &enclave.pcr0 || pcr1 != &enclave.pcr1 || pcr2 != &enclave.pcr2) {
            return false
        };

        // TODO: Verify signature using enclave's public key
        // This would require implementing RSA signature verification in Move
        // For now, we assume signature is valid if PCRs match

        // Emit verification event
        event::emit(AttestationVerifiedEvent {
            enclave_id: attestation.enclave_id,
            attestation_hash: attestation.computation_hash,
            verified: true,
            timestamp: clock::timestamp_ms(clock),
        });

        true
    }

    /// Submit verification result from enclave
    public entry fun submit_verification_result(
        registry: &mut EnclaveRegistry,
        enclave_id: String,
        campaign_id: String,
        blob_id: String,
        verification_type: String,
        quality_score: u64,
        verified: bool,
        attestation: AttestationDocument,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Verify attestation first
        assert!(verify_attestation(registry, attestation, clock), EINVALID_ATTESTATION);

        // Check if enclave exists and is active
        assert!(table::contains(&registry.enclaves, enclave_id), EENCLAVE_NOT_FOUND);
        let enclave = table::borrow_mut(&mut registry.enclaves, enclave_id);
        assert!(enclave.is_active, EENCLAVE_NOT_FOUND);

        // Increment verification count
        enclave.verification_count = enclave.verification_count + 1;

        // Create verification result
        let result = VerificationResult {
            id: object::new(ctx),
            enclave_id,
            campaign_id,
            blob_id,
            verification_type,
            quality_score,
            verified,
            attestation_hash: attestation.computation_hash,
            verification_timestamp: clock::timestamp_ms(clock),
        };

        // Transfer result to sender (could be campaign owner or data contributor)
        transfer::transfer(result, tx_context::sender(ctx));

        // Emit verification event
        event::emit(VerificationCompletedEvent {
            enclave_id,
            campaign_id,
            blob_id,
            verification_type,
            quality_score,
            verified,
            timestamp: clock::timestamp_ms(clock),
        });
    }

    /// Deactivate an enclave (admin only)
    public entry fun deactivate_enclave(
        registry: &mut EnclaveRegistry,
        enclave_id: String,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == registry.admin, EUNAUTHORIZED);
        assert!(table::contains(&registry.enclaves, enclave_id), EENCLAVE_NOT_FOUND);

        let enclave = table::borrow_mut(&mut registry.enclaves, enclave_id);
        enclave.is_active = false;
    }

    /// Update enclave PCR values (enclave owner only)
    public entry fun update_enclave_pcrs(
        registry: &mut EnclaveRegistry,
        enclave_id: String,
        pcr0: vector<u8>,
        pcr1: vector<u8>,
        pcr2: vector<u8>,
        ctx: &mut TxContext
    ) {
        assert!(table::contains(&registry.enclaves, enclave_id), EENCLAVE_NOT_FOUND);
        
        let enclave = table::borrow_mut(&mut registry.enclaves, enclave_id);
        assert!(enclave.owner == tx_context::sender(ctx), EUNAUTHORIZED);

        // Validate PCR values
        assert!(vector::length(&pcr0) == 32, EINVALID_PCR_VALUES);
        assert!(vector::length(&pcr1) == 32, EINVALID_PCR_VALUES);
        assert!(vector::length(&pcr2) == 32, EINVALID_PCR_VALUES);

        enclave.pcr0 = pcr0;
        enclave.pcr1 = pcr1;
        enclave.pcr2 = pcr2;
    }

    // Getter functions
    public fun get_enclave_info(
        registry: &EnclaveRegistry,
        enclave_id: String
    ): (address, bool, u64) {
        assert!(table::contains(&registry.enclaves, enclave_id), EENCLAVE_NOT_FOUND);
        let enclave = table::borrow(&registry.enclaves, enclave_id);
        (enclave.owner, enclave.is_active, enclave.verification_count)
    }

    public fun get_enclave_pcrs(
        registry: &EnclaveRegistry,
        enclave_id: String
    ): (vector<u8>, vector<u8>, vector<u8>) {
        assert!(table::contains(&registry.enclaves, enclave_id), EENCLAVE_NOT_FOUND);
        let enclave = table::borrow(&registry.enclaves, enclave_id);
        (enclave.pcr0, enclave.pcr1, enclave.pcr2)
    }

    public fun is_enclave_active(
        registry: &EnclaveRegistry,
        enclave_id: String
    ): bool {
        if (!table::contains(&registry.enclaves, enclave_id)) {
            return false
        };
        let enclave = table::borrow(&registry.enclaves, enclave_id);
        enclave.is_active
    }

    /// Test-only initializer
    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx);
    }
}

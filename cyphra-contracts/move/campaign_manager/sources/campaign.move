module campaign_manager::campaign {
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::event;
    use sui::table::{Self, Table};
    use sui::vec_map::{Self, VecMap};
    use std::string::{Self, String};
    use std::vector;

    /// Error codes
    const EINVALID_REWARD_POOL: u64 = 1;
    const EINVALID_UNIT_PRICE: u64 = 2;
    const EINVALID_EXPIRATION: u64 = 3;
    const ECAMPAIGN_NOT_FOUND: u64 = 4;
    const ECAMPAIGN_EXPIRED: u64 = 5;
    const ENOT_CAMPAIGN_OWNER: u64 = 6;
    const EESCROW_NOT_SETUP: u64 = 7;
    const EINVALID_BUDGET: u64 = 8;
    const EINVALID_DURATION: u64 = 9;
    const ECAMPAIGN_ALREADY_EXISTS: u64 = 10;
    const ENOT_OWNER: u64 = 11;
    const ECAMPAIGN_ACTIVE: u64 = 12;
    const EUSERNAME_ALREADY_TAKEN: u64 = 13;
    const EUSERNAME_TOO_LONG: u64 = 14;
    const EUSERNAME_ALREADY_SET: u64 = 15;
    const EUSERNAME_EDIT_LIMIT_REACHED: u64 = 16;
    const ENO_USERNAME: u64 = 17;

    // Username constraints
    const MAX_USERNAME_LENGTH: u64 = 32;
    const MAX_USERNAME_EDITS: u64 = 2;

    /// Campaign object that stores all details about a campaign
    struct Campaign has key, store {
        id: UID,
        campaign_id: String,
        owner: address,
        title: String,
        description: String,
        data_requirements: String,
        quality_criteria: String,
        unit_price: u64,          // Reward per valid contribution
        total_budget: u64,        // Total campaign budget
        min_data_count: u64,      // Minimum number of data points required
        max_data_count: u64,      // Maximum number of data points allowed
        expiration: u64,
        is_active: bool,
        total_contributions: u64,
        metadata_uri: String,     // IPFS/Arweave URI for additional metadata
        escrow_setup: bool,       // Track if escrow is set up
        encryption_pub_key: vector<u8>, // Public encryption key for AES-256-CBC
        
        // Walrus Integration Fields
        walrus_blob_ids: vector<String>,        // Track all campaign-related blobs
        dataset_blob_id: String,                // Main dataset blob ID
        model_artifacts_blob_ids: vector<String>, // Trained model artifacts
        walrus_storage_budget: u64,             // Budget allocated for storage
        walrus_storage_used: u64,               // Storage budget used
        
        // Seal Integration Fields
        seal_policy_id: String,                 // Seal encryption policy ID
        access_control_type: String,            // "subscription", "allowlist", "timelock"
        encrypted_data_hash: vector<u8>,        // Hash of encrypted data
        
        // Nautilus Integration Fields
        verification_required: bool,            // Whether TEE verification is required
        quality_threshold: u64,                 // Minimum quality score (0-100)
        verified_contributions: u64,            // Number of TEE-verified contributions
    }

    /// Shared object that stores all campaigns
    struct CampaignStore has key {
        id: UID,
        campaigns: Table<String, Campaign>,
    }

    // Events
    /// Event emitted when a campaign is created
    struct CampaignCreationEvent has copy, drop {
        campaign_id: String,
        owner: address,
        title: String,
        total_budget: u64,
        unit_price: u64,
        expiration: u64,
    }

    /// Event emitted when a campaign is updated
    struct CampaignUpdateEvent has copy, drop {
        campaign_id: String,
        new_data_requirements: String,
        new_quality_criteria: String,
        new_expiration: u64,
    }

    /// Event emitted for campaign lifecycle events
    struct CampaignEvent has copy, drop {
        campaign_id: String,
        owner: address,
        total_budget: u64,
        event_type: String,  // "created", "cancelled"
        timestamp: u64,
    }

    /// Walrus Blob metadata tracking
    struct WalrusBlobInfo has key, store {
        id: UID,
        blob_id: String,
        campaign_id: String,
        contributor: address,
        file_size: u64,
        content_type: String,
        upload_timestamp: u64,
        verification_status: String, // "pending", "verified", "rejected"
        quality_score: u64,
    }

    /// Event for Walrus blob uploads
    struct WalrusBlobUploadEvent has copy, drop {
        campaign_id: String,
        blob_id: String,
        contributor: address,
        file_size: u64,
        timestamp: u64,
    }

    /// Event for Seal encryption
    struct SealEncryptionEvent has copy, drop {
        campaign_id: String,
        policy_id: String,
        access_control_type: String,
        encrypted_by: address,
        timestamp: u64,
    }

    /// Event for Nautilus verification
    struct NautilusVerificationEvent has copy, drop {
        campaign_id: String,
        blob_id: String,
        quality_score: u64,
        verified: bool,
        timestamp: u64,
    }

    fun init(ctx: &mut TxContext) {
        let campaign_store = CampaignStore {
            id: object::new(ctx),
            campaigns: table::new(ctx),
        };
        transfer::share_object(campaign_store);
    }
    
    /// Test-only initializer function for use in tests
    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx)
    }

    public fun create_campaign(
        campaign_store: &mut CampaignStore,
        campaign_id: String,
        title: String,
        description: String,
        data_requirements: String,
        quality_criteria: String,
        unit_price: u64,
        total_budget: u64,
        min_data_count: u64,
        max_data_count: u64,
        expiration: u64,
        metadata_uri: String,
        encryption_pub_key: vector<u8>,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        
        // Validate inputs
        assert!(unit_price > 0, EINVALID_UNIT_PRICE);
        assert!(total_budget >= unit_price, EINVALID_REWARD_POOL);
        assert!(min_data_count > 0 && min_data_count <= max_data_count, EINVALID_REWARD_POOL);
        assert!(
            expiration > tx_context::epoch(ctx),
            EINVALID_EXPIRATION
        );
        
        // Verify campaign doesn't exist
        assert!(!table::contains(&campaign_store.campaigns, campaign_id), ECAMPAIGN_ALREADY_EXISTS);

        let campaign = Campaign {
            id: object::new(ctx),
            campaign_id,
            owner: sender,
            title,
            description,
            data_requirements,
            quality_criteria,
            unit_price,
            total_budget,
            min_data_count,
            max_data_count,
            expiration,
            is_active: true,
            total_contributions: 0,
            metadata_uri,
            escrow_setup: false,
            encryption_pub_key,
            
            // Initialize Walrus fields
            walrus_blob_ids: vector::empty(),
            dataset_blob_id: string::utf8(b""),
            model_artifacts_blob_ids: vector::empty(),
            walrus_storage_budget: 0,
            walrus_storage_used: 0,
            
            // Initialize Seal fields
            seal_policy_id: string::utf8(b""),
            access_control_type: string::utf8(b"none"),
            encrypted_data_hash: vector::empty(),
            
            // Initialize Nautilus fields
            verification_required: false,
            quality_threshold: 70, // Default 70% quality threshold
            verified_contributions: 0,
        };

        table::add(&mut campaign_store.campaigns, campaign_id, campaign);

        // Emit campaign creation event
        event::emit(CampaignCreationEvent {
            campaign_id,
            owner: sender,
            title,
            total_budget,
            unit_price,
            expiration,
        });
    }

    public fun update_campaign(
        campaign_store: &mut CampaignStore,
        campaign_id: String,
        new_data_requirements: String,
        new_quality_criteria: String,
        new_expiration: u64,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        
        assert!(table::contains(&campaign_store.campaigns, campaign_id), ECAMPAIGN_NOT_FOUND);
        
        let campaign = table::borrow_mut(&mut campaign_store.campaigns, campaign_id);
        assert!(campaign.owner == sender, ENOT_CAMPAIGN_OWNER);
        assert!(campaign.is_active, ECAMPAIGN_EXPIRED);
        assert!(campaign.escrow_setup, EESCROW_NOT_SETUP);
        
        campaign.data_requirements = new_data_requirements;
        campaign.quality_criteria = new_quality_criteria;
        campaign.expiration = new_expiration;

        // Emit campaign update event
        event::emit(CampaignUpdateEvent {
            campaign_id,
            new_data_requirements,
            new_quality_criteria,
            new_expiration,
        });
    }

    public fun cancel_campaign(
        campaign_store: &mut CampaignStore,
        campaign_id: String,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        
        assert!(table::contains(&campaign_store.campaigns, campaign_id), ECAMPAIGN_NOT_FOUND);
        
        let campaign = table::borrow_mut(&mut campaign_store.campaigns, campaign_id);
        assert!(campaign.owner == sender, ENOT_OWNER);
        assert!(campaign.is_active, ECAMPAIGN_EXPIRED);
        
        campaign.is_active = false;

        // Emit campaign cancellation event
        event::emit(CampaignEvent {
            campaign_id,
            owner: sender,
            total_budget: campaign.total_budget,
            event_type: string::utf8(b"cancelled"),
            timestamp: tx_context::epoch(ctx),
        });
    }

    public fun get_campaign_details(
        campaign_store: &CampaignStore,
        campaign_id: String,
    ): (String, String, String, String, u64, u64, u64, u64, u64, bool, String, vector<u8>) {
        assert!(table::contains(&campaign_store.campaigns, campaign_id), ECAMPAIGN_NOT_FOUND);
        
        let campaign = table::borrow(&campaign_store.campaigns, campaign_id);
        
        (
            campaign.title,
            campaign.description,
            campaign.data_requirements,
            campaign.quality_criteria,
            campaign.unit_price,
            campaign.total_budget,
            campaign.min_data_count,
            campaign.max_data_count,
            campaign.expiration,
            campaign.is_active,
            campaign.metadata_uri,
            campaign.encryption_pub_key 
        )
    }

    public fun get_encryption_public_key(
        campaign_store: &CampaignStore,
        campaign_id: String,
    ): vector<u8> {
        assert!(table::contains(&campaign_store.campaigns, campaign_id), ECAMPAIGN_NOT_FOUND);
        
        let campaign = table::borrow(&campaign_store.campaigns, campaign_id);
        campaign.encryption_pub_key
    }

    public fun get_campaign_status(
        campaign_store: &CampaignStore,
        campaign_id: String,
    ): (bool, u64, u64) {
        assert!(table::contains(&campaign_store.campaigns, campaign_id), ECAMPAIGN_NOT_FOUND);
        
        let campaign = table::borrow(&campaign_store.campaigns, campaign_id);
        
        (
            campaign.is_active,
            campaign.total_contributions,
            campaign.max_data_count - campaign.total_contributions
        )
    }

    public fun verify_campaign_active(
        campaign_store: &CampaignStore,
        campaign_id: String,
        ctx: &TxContext
    ): bool {
        if (!table::contains(&campaign_store.campaigns, campaign_id)) {
            return false;
        };
        
        let campaign = table::borrow(&campaign_store.campaigns, campaign_id);
        campaign.is_active && tx_context::epoch(ctx) <= campaign.expiration
    }

    public fun get_unit_price(
        campaign_store: &CampaignStore,
        campaign_id: String,
    ): u64 {
        assert!(table::contains(&campaign_store.campaigns, campaign_id), ECAMPAIGN_NOT_FOUND);
        
        let campaign = table::borrow(&campaign_store.campaigns, campaign_id);
        campaign.unit_price
    }

    public fun increment_contributions(
        campaign_store: &mut CampaignStore,
        campaign_id: String,
    ): bool {
        assert!(table::contains(&campaign_store.campaigns, campaign_id), ECAMPAIGN_NOT_FOUND);
        
        let campaign = table::borrow_mut(&mut campaign_store.campaigns, campaign_id);
        if (campaign.total_contributions < campaign.max_data_count) {
            campaign.total_contributions = campaign.total_contributions + 1;
            return true;
        };
        false
    }

    public fun is_campaign_owner(
        campaign_store: &CampaignStore,
        campaign_id: String,
        owner_address: address
    ): bool {
        if (!table::contains(&campaign_store.campaigns, campaign_id)) {
            return false;
        };
        
        let campaign = table::borrow(&campaign_store.campaigns, campaign_id);
        campaign.owner == owner_address
    }

    public fun get_campaign_remaining_budget(
        campaign_store: &CampaignStore,
        campaign_id: String,
    ): u64 {
        assert!(table::contains(&campaign_store.campaigns, campaign_id), ECAMPAIGN_NOT_FOUND);
        let campaign = table::borrow(&campaign_store.campaigns, campaign_id);
        
        let spent_budget = campaign.unit_price * campaign.total_contributions;
        // total_budget is the initial budget.
        // If spent_budget > campaign.total_budget, it implies an issue or
        // that total_budget wasn't meant to be the absolute cap for this calculation.
        // However, given unit_price * total_contributions is the cost so far,
        // remaining should be total_budget - cost_so_far.
        if (campaign.total_budget >= spent_budget) {
            campaign.total_budget - spent_budget
        } else {
            0 // budget depleted or an inconsistent state
        }
    }

    /// Sets the escrow_setup flag for a campaign.
    /// called by the escrow module after successful escrow creation.
    public fun set_escrow_status(
        campaign_store: &mut CampaignStore,
        campaign_id: String,
        status: bool,
        ctx: &TxContext
    ) {
        assert!(table::contains(&campaign_store.campaigns, campaign_id), ECAMPAIGN_NOT_FOUND);
        let campaign = table::borrow_mut(&mut campaign_store.campaigns, campaign_id);
        campaign.escrow_setup = status;
    }

    /// Get the owner/creator address of a campaign
    public fun get_campaign_owner(
        campaign_store: &CampaignStore,
        campaign_id: String
    ): address {
        assert!(table::contains(&campaign_store.campaigns, campaign_id), ECAMPAIGN_NOT_FOUND);
        let campaign = table::borrow(&campaign_store.campaigns, campaign_id);
        campaign.owner
    }

    // ===== WALRUS INTEGRATION FUNCTIONS =====

    /// Function to add Walrus blob to campaign
    public entry fun add_walrus_blob(
        campaign_store: &mut CampaignStore,
        campaign_id: String,
        blob_id: String,
        file_size: u64,
        content_type: String,
        ctx: &mut TxContext
    ) {
        assert!(table::contains(&campaign_store.campaigns, campaign_id), ECAMPAIGN_NOT_FOUND);
        let campaign = table::borrow_mut(&mut campaign_store.campaigns, campaign_id);
        vector::push_back(&mut campaign.walrus_blob_ids, blob_id);
        
        let blob_info = WalrusBlobInfo {
            id: object::new(ctx),
            blob_id,
            campaign_id,
            contributor: tx_context::sender(ctx),
            file_size,
            content_type,
            upload_timestamp: tx_context::epoch_timestamp_ms(ctx),
            verification_status: string::utf8(b"pending"),
            quality_score: 0,
        };
        
        transfer::share_object(blob_info);
        
        event::emit(WalrusBlobUploadEvent {
            campaign_id,
            blob_id,
            contributor: tx_context::sender(ctx),
            file_size,
            timestamp: tx_context::epoch_timestamp_ms(ctx),
        });
    }

    /// Function to update blob verification status
    public entry fun update_blob_verification(
        blob_info: &mut WalrusBlobInfo,
        status: String,
        quality_score: u64,
        _ctx: &mut TxContext
    ) {
        blob_info.verification_status = status;
        blob_info.quality_score = quality_score;
    }

    // ===== SEAL INTEGRATION FUNCTIONS =====

    /// Set Seal encryption policy for campaign
    public entry fun set_seal_policy(
        campaign_store: &mut CampaignStore,
        campaign_id: String,
        policy_id: String,
        access_control_type: String,
        encrypted_data_hash: vector<u8>,
        ctx: &mut TxContext
    ) {
        assert!(table::contains(&campaign_store.campaigns, campaign_id), ECAMPAIGN_NOT_FOUND);
        let campaign = table::borrow_mut(&mut campaign_store.campaigns, campaign_id);
        assert!(campaign.owner == tx_context::sender(ctx), ENOT_CAMPAIGN_OWNER);
        
        campaign.seal_policy_id = policy_id;
        campaign.access_control_type = access_control_type;
        campaign.encrypted_data_hash = encrypted_data_hash;
        
        event::emit(SealEncryptionEvent {
            campaign_id,
            policy_id,
            access_control_type,
            encrypted_by: tx_context::sender(ctx),
            timestamp: tx_context::epoch_timestamp_ms(ctx),
        });
    }

    // ===== NAUTILUS INTEGRATION FUNCTIONS =====

    /// Enable Nautilus verification for campaign
    public entry fun enable_nautilus_verification(
        campaign_store: &mut CampaignStore,
        campaign_id: String,
        quality_threshold: u64,
        ctx: &mut TxContext
    ) {
        assert!(table::contains(&campaign_store.campaigns, campaign_id), ECAMPAIGN_NOT_FOUND);
        let campaign = table::borrow_mut(&mut campaign_store.campaigns, campaign_id);
        assert!(campaign.owner == tx_context::sender(ctx), ENOT_CAMPAIGN_OWNER);
        assert!(quality_threshold <= 100, EINVALID_REWARD_POOL); // Reuse error code
        
        campaign.verification_required = true;
        campaign.quality_threshold = quality_threshold;
    }

    /// Record Nautilus verification result
    public entry fun record_nautilus_verification(
        campaign_store: &mut CampaignStore,
        campaign_id: String,
        blob_id: String,
        quality_score: u64,
        verified: bool,
        ctx: &mut TxContext
    ) {
        assert!(table::contains(&campaign_store.campaigns, campaign_id), ECAMPAIGN_NOT_FOUND);
        let campaign = table::borrow_mut(&mut campaign_store.campaigns, campaign_id);
        
        if (verified && quality_score >= campaign.quality_threshold) {
            campaign.verified_contributions = campaign.verified_contributions + 1;
        };
        
        event::emit(NautilusVerificationEvent {
            campaign_id,
            blob_id,
            quality_score,
            verified,
            timestamp: tx_context::epoch_timestamp_ms(ctx),
        });
    }

    // ===== GETTER FUNCTIONS FOR NEW FIELDS =====

    /// Get Walrus blob IDs for a campaign
    public fun get_walrus_blob_ids(
        campaign_store: &CampaignStore,
        campaign_id: String
    ): vector<String> {
        assert!(table::contains(&campaign_store.campaigns, campaign_id), ECAMPAIGN_NOT_FOUND);
        let campaign = table::borrow(&campaign_store.campaigns, campaign_id);
        campaign.walrus_blob_ids
    }

    /// Get Seal policy information
    public fun get_seal_policy_info(
        campaign_store: &CampaignStore,
        campaign_id: String
    ): (String, String) {
        assert!(table::contains(&campaign_store.campaigns, campaign_id), ECAMPAIGN_NOT_FOUND);
        let campaign = table::borrow(&campaign_store.campaigns, campaign_id);
        (campaign.seal_policy_id, campaign.access_control_type)
    }

    /// Get Nautilus verification info
    public fun get_nautilus_verification_info(
        campaign_store: &CampaignStore,
        campaign_id: String
    ): (bool, u64, u64) {
        assert!(table::contains(&campaign_store.campaigns, campaign_id), ECAMPAIGN_NOT_FOUND);
        let campaign = table::borrow(&campaign_store.campaigns, campaign_id);
        (campaign.verification_required, campaign.quality_threshold, campaign.verified_contributions)
    }
} 
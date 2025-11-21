module campaign_manager::escrow {
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::coin::{Self, Coin};
    use sui::table::{Self, Table};
    use sui::balance::{Self, Balance};
    use sui::event;
    use std::string::{Self, String};
    use std::type_name;
    use campaign_manager::campaign::{Self as CampaignModule, CampaignStore};

    /// Error codes
    const EINSUFFICIENT_BALANCE: u64 = 1;
    const ECAMPAIGN_NOT_FOUND: u64 = 2;
    const ENOT_CAMPAIGN_OWNER: u64 = 3;
    const ECAMPAIGN_ACTIVE: u64 = 4;
    const ECAMPAIGN_EXPIRED: u64 = 5;
    const ECONTRIBUTION_NOT_VERIFIED: u64 = 6;
    const EREWARD_ALREADY_CLAIMED: u64 = 7;
    const EESCROW_NOT_FOUND: u64 = 8;
    const EINVALID_AMOUNT: u64 = 9;
    const ELOW_QUALITY_SCORE: u64 = 10;

    /// Campaign escrow that holds funds for a campaign
    struct CampaignEscrow<phantom CoinType> has store {
        campaign_id: String,
        owner: address,
        total_locked: u64,         // Total amount locked in escrow
        total_released: u64,       // Total amount released to contributors
        unit_reward: u64,          // Reward per verified contribution
        platform_fee: u64,         // Platform fee percentage (basis points: 100 = 1%)
        is_active: bool,
        funds: Balance<CoinType>,  // Actual funds in the escrow
    }

    struct EscrowStore<phantom CoinType> has key {
        id: UID,
        escrows: Table<String, CampaignEscrow<CoinType>>,
        platform_wallet: address,   // Address to receive platform fees
    }

    // Events
    struct EscrowEvent<phantom CoinType> has copy, drop {
        campaign_id: String,
        owner: address,
        amount: u64,
        event_type: String,        // "locked", "released", "refunded"
        timestamp: u64,
    }

    struct RewardEvent<phantom CoinType> has copy, drop {
        campaign_id: String,
        contributor: address,
        contribution_id: String,
        amount: u64,
        timestamp: u64,
    }

    /// Create an escrow store for a specific coin type
    fun init(ctx: &mut TxContext) {
        // Create a SUI escrow store
        let escrow_store = EscrowStore<sui::sui::SUI> {
            id: object::new(ctx),
            escrows: table::new(ctx),
            platform_wallet: tx_context::sender(ctx),
        };
        transfer::share_object(escrow_store);
    }
    
    /// Test-only initializer function for use in tests
    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx)
    }

    /// Initializes and shares a new EscrowStore for a specific CoinType.
    public fun initialize_escrow_store_for_coin<CoinType>(
        platform_wallet_address: address,
        ctx: &mut TxContext
    ) {
        let escrow_store = EscrowStore<CoinType> {
            id: object::new(ctx),
            escrows: table::new(ctx),
            platform_wallet: platform_wallet_address,
        };
        transfer::share_object(escrow_store);
    }

    /// Creates a campaign escrow for a specific coin type
    public fun create_campaign_escrow<CoinType>(
        escrow_store: &mut EscrowStore<CoinType>,
        campaign_store: &mut CampaignStore,
        campaign_id: String,
        total_amount: u64,
        unit_reward: u64,
        platform_fee: u64,
        payment: Coin<CoinType>,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        
        // Verify payment amount
        assert!(coin::value(&payment) == total_amount, EINVALID_AMOUNT);
        
        let escrow = CampaignEscrow<CoinType> {
            campaign_id,
            owner: sender,
            total_locked: total_amount,
            total_released: 0,
            unit_reward,
            platform_fee,
            is_active: true,
            funds: coin::into_balance(payment),
        };

        table::add(&mut escrow_store.escrows, campaign_id, escrow);

        // Set escrow status in the campaign module
        CampaignModule::set_escrow_status(campaign_store, campaign_id, true, ctx);

        // Emit escrow event
        event::emit(EscrowEvent<CoinType> {
            campaign_id,
            owner: sender,
            amount: total_amount,
            event_type: string::utf8(b"locked"),
            timestamp: tx_context::epoch(ctx),
        });
    }

    /// Releases reward for a verified contribution
    public fun release_reward<CoinType>(
        escrow_store: &mut EscrowStore<CoinType>,
        campaign_id: String,
        contribution_id: String,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        
        assert!(table::contains(&escrow_store.escrows, campaign_id), ECAMPAIGN_NOT_FOUND);
        
        let escrow = table::borrow_mut(&mut escrow_store.escrows, campaign_id);
        assert!(escrow.is_active, ECAMPAIGN_EXPIRED);
        
        // Calculate reward and platform fee
        let reward_amount = escrow.unit_reward;
        let platform_fee_amount = (reward_amount * escrow.platform_fee) / 10000;
        let contributor_amount = reward_amount - platform_fee_amount;

        // Update escrow state
        escrow.total_released = escrow.total_released + reward_amount;

        // Add balance check
        assert!(escrow.total_locked - escrow.total_released >= 0, EINSUFFICIENT_BALANCE);
        
        // Transfer reward to contributor
        if (contributor_amount > 0) {
            let contributor_reward = coin::from_balance(
                balance::split(&mut escrow.funds, contributor_amount), 
                ctx
            );
            transfer::public_transfer(contributor_reward, sender);
        };
        
        // Transfer platform fee
        if (platform_fee_amount > 0) {
            let platform_fee_coin = coin::from_balance(
                balance::split(&mut escrow.funds, platform_fee_amount), 
                ctx
            );
            transfer::public_transfer(platform_fee_coin, escrow_store.platform_wallet);
        };

        // Emit reward event
        event::emit(RewardEvent<CoinType> {
            campaign_id,
            contributor: sender,
            contribution_id,
            amount: contributor_amount,
            timestamp: tx_context::epoch(ctx),
        });
    }

    /// Refunds remaining funds to campaign owner
    public fun refund_remaining<CoinType>(
        escrow_store: &mut EscrowStore<CoinType>,
        campaign_id: String,
        is_campaign_active: bool,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        
        assert!(table::contains(&escrow_store.escrows, campaign_id), ECAMPAIGN_NOT_FOUND);
        
        let escrow = table::borrow_mut(&mut escrow_store.escrows, campaign_id);
        assert!(escrow.owner == sender, ENOT_CAMPAIGN_OWNER);
        assert!(!is_campaign_active, ECAMPAIGN_ACTIVE);

        let remaining_amount = escrow.total_locked - escrow.total_released;
        
        if (remaining_amount > 0) {
            escrow.is_active = false;
            
            // Transfer remaining funds back to campaign owner
            let refund_coin = coin::from_balance(balance::split(&mut escrow.funds, remaining_amount), ctx);
            transfer::public_transfer(refund_coin, sender);

            // Emit escrow event
            event::emit(EscrowEvent<CoinType> {
                campaign_id,
                owner: sender,
                amount: remaining_amount,
                event_type: string::utf8(b"refunded"),
                timestamp: tx_context::epoch(ctx),
            });
        };
    }

    /// Get information about an escrow
    public fun get_escrow_info<CoinType>(
        escrow_store: &EscrowStore<CoinType>,
        campaign_id: String,
    ): (address, u64, u64, u64, u64, bool) {
        assert!(table::contains(&escrow_store.escrows, campaign_id), EESCROW_NOT_FOUND);
        
        let escrow = table::borrow(&escrow_store.escrows, campaign_id);
        
        (
            escrow.owner,
            escrow.total_locked,
            escrow.total_released,
            escrow.unit_reward,
            escrow.platform_fee,
            escrow.is_active
        )
    }

    /// Get available balance in an escrow
    public fun get_available_balance<CoinType>(
        escrow_store: &EscrowStore<CoinType>,
        campaign_id: String,
    ): u64 {
        assert!(table::contains(&escrow_store.escrows, campaign_id), EESCROW_NOT_FOUND);
        
        let escrow = table::borrow(&escrow_store.escrows, campaign_id);
        escrow.total_locked - escrow.total_released
    }

    /// Set the platform wallet address
    public fun set_platform_wallet<CoinType>(
        escrow_store: &mut EscrowStore<CoinType>,
        new_platform_wallet: address,
        ctx: &TxContext
    ) {
        // Only the current platform wallet can change it
        assert!(escrow_store.platform_wallet == tx_context::sender(ctx), ENOT_CAMPAIGN_OWNER);
        escrow_store.platform_wallet = new_platform_wallet;
    }
} 
module cyphra_token::cyphra {
    use std::option;
    use sui::coin::{Self, Coin, TreasuryCap};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};

    /// The one-time witness for the CYPHRA coin.
    struct CYPHRA has drop {}

    #[allow(lint(coin_init))]
    fun init(witness: CYPHRA, ctx: &mut TxContext) {
        let (treasury_cap, metadata) = coin::create_currency<CYPHRA>(
            witness,
            6, // Decimals, e.g., 6 for typical tokens
            b"CYP", // Symbol
            b"Cyphra Token", // Name
            b"The official token for the Cyphra AI Training Data Marketplace.", // Description
            option::none(), // Icon URL
            ctx
        );
        transfer::public_freeze_object(metadata);
        transfer::public_transfer(treasury_cap, tx_context::sender(ctx));
    }

    /// Mints new `Coin<CYPHRA>`.
    /// Only the owner of the `TreasuryCap<CYPHRA>` can call this function.
    public entry fun mint(
        cap: &mut TreasuryCap<CYPHRA>, 
        amount: u64, 
        recipient: address, 
        ctx: &mut TxContext
    ) {
        coin::mint_and_transfer(cap, amount, recipient, ctx);
    }

    /// Burns `Coin<CYPHRA>`.
    /// Only the owner of the `TreasuryCap<CYPHRA>` can call this function.
    public entry fun burn(cap: &mut TreasuryCap<CYPHRA>, coin: Coin<CYPHRA>) {
        coin::burn(cap, coin);
    }

    // Additional utility functions if needed, e.g., for transferring TreasuryCap

    #[test_only]
    /// Test-only initializer function for use in tests
    public fun init_for_testing(ctx: &mut TxContext) {
        init(CYPHRA {}, ctx);
    }
} 
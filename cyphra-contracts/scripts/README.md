# Hyvve Protocol Interaction Scripts

This directory contains TypeScript scripts to interact with the deployed Hyvve Protocol smart contracts on the Sui network. These scripts help with initial setup, environment configuration, and common contract interactions like creating campaigns and fetching data.

## Prerequisites

1.  **Node.js and npm/yarn**: Ensure you have Node.js (preferably a recent LTS version) and a package manager (npm or yarn) installed.
2.  **Sui CLI**: The Sui command-line interface should be installed and configured for the target network (e.g., testnet, devnet).
3.  **Deployed Contracts**:
    - The `hyvve_token` contracts must be deployed.
    - The `campaign_manager` contracts (including `campaign`, `escrow`, `contribution`, `verifier`, `reputation`, `subscription`) must be deployed.
4.  **Dependencies**: Run `npm install` or `yarn install` in the `hyvve-contracts` (or root project) directory to install necessary libraries like `@mysten/sui` and `dotenv`.

## Directory Structure

```
scripts/
├── .env                # Environment variables (created by you, populated by scripts)
├── campaign/
│   ├── createCampaign.ts # Creates a new campaign and its escrow
│   └── getActiveData.ts  # Fetches active campaigns and contributions
├── escrow/
│   └── initializeHyvveEscrow.ts # (Primarily for manual/older setup, now part of setupHyvveInfra.ts)
├── setup/
│   ├── populateEnvFromPublish.ts         # Populates .env after campaign_manager publish
│   ├── populateEnvFromHyvveTokenPublish.ts # Populates .env after hyvve_token publish
│   └── setupHyvveInfra.ts                # Consolidated script for Hyvve Escrow & initial token minting
├── token/
│   └── mintHyvveTokens.ts    # (Primarily for manual/older setup, now part of setupHyvveInfra.ts)
└── README.md             # This file
```

## Initial Setup Workflow (After Contract Deployment)

Follow these steps in order after you have successfully published your contracts to the Sui network.

### 1. Populate .env from `hyvve_token` Publish

After publishing your `hyvve_token` package:

1.  Copy the **Transaction Digest** from the output of your `sui client publish ... hyvve-contracts/move/hyvve_token` command.
2.  Open/create the `hyvve-contracts/scripts/.env` file.
3.  Set the `HYVVE_TOKEN_PUBLISH_DIGEST` variable:
    ```env
    HYVVE_TOKEN_PUBLISH_DIGEST=YOUR_HYVVE_TOKEN_PUBLISH_TRANSACTION_DIGEST
    ```
4.  Ensure `SUI_NETWORK` is set (e.g., `SUI_NETWORK=testnet`).
5.  Run the script from the `hyvve-contracts/scripts` directory:
    ```bash
    npx ts-node setup/populateEnvFromHyvveTokenPublish.ts
    ```
    This will update your `.env` file with `HYVVE_TOKEN_PACKAGE_ID`, `TREASURY_CAP_ID`, and `HYVVE_COIN_METADATA_ID`.

### 2. Populate .env from `campaign_manager` Publish

After publishing your `campaign_manager` package (which includes `campaign`, `escrow`, `contribution`, etc.):

1.  Copy the **Transaction Digest** from the output of your `sui client publish ... hyvve-contracts/move/campaign_manager` command.
2.  In `hyvve-contracts/scripts/.env`, set the `PUBLISH_TRANSACTION_DIGEST` variable:
    ```env
    PUBLISH_TRANSACTION_DIGEST=YOUR_CAMPAIGN_MANAGER_PUBLISH_TRANSACTION_DIGEST
    ```
3.  Run the script from the `hyvve-contracts/scripts` directory:
    ```bash
    npx ts-node setup/populateEnvFromPublish.ts
    ```
    This will update your `.env` file with `CAMPAIGN_MANAGER_PACKAGE_ID` and Object IDs for shared stores like `CAMPAIGN_STORE_ID`, `ESCROW_STORE_ID` (for SUI), `CONTRIBUTION_STORE_ID`, `REPUTATION_REGISTRY_ID`, `VERIFIER_REGISTRY_ID`, `VERIFIER_STORE_ID`, and `SUBSCRIPTION_STORE_ID`.

### 3. Setup Hyvve Specific Infrastructure (Escrow Store & Initial Tokens)

This script initializes the specific `EscrowStore` for your `$Hyvve` token and mints an initial batch of `$Hyvve` tokens. It uses variables populated in the previous steps.

1.  Ensure your `.env` file contains:
    - `ADMIN_PRIVATE_KEY`: Private key of the account that owns the `TREASURY_CAP_ID` (from step 1) and will be the admin for some operations. This key will be used to sign transactions in this script.
    - `CAMPAIGN_MANAGER_PACKAGE_ID` (from step 2)
    - `HYVVE_TOKEN_PACKAGE_ID` (from step 1)
    - `TREASURY_CAP_ID` (from step 1)
    - Optional: `ESCROW_PLATFORM_WALLET_ADDRESS` (defaults to admin's address)
    - Optional: `TOKEN_RECIPIENT_ADDRESS` (defaults to admin's address, e.g., your campaign creator address for initial funding `0xbe9f...`)
    - Optional: `MINT_AMOUNT` (defaults to 1,000,000,000 smallest units)
2.  Run the script from the `hyvve-contracts/scripts` directory:
    ```bash
    npx ts-node setup/setupHyvveInfra.ts
    ```
    This will create the `$Hyvve` `EscrowStore`, mint tokens, and update your `.env` file with `HYVVE_ESCROW_STORE_ID`, `HYVVE_PAYMENT_COIN_ID`, and `HYVVE_TOKEN_TYPE`.

## `.env` File Configuration

Your `hyvve-contracts/scripts/.env` file will store crucial IDs and configurations. Here's a list of important variables the scripts use or populate:

```env
# Network Configuration
SUI_NETWORK=testnet # or devnet, mainnet, localnet

# Private Keys
ADMIN_PRIVATE_KEY=your_admin_private_key_in_bech32m_format # Owns TreasuryCap, general admin
PRIVATE_KEY=your_campaign_creator_private_key_in_bech32m_format # Used by createCampaign.ts, should own HYVVE_PAYMENT_COIN_ID

# Digests for Setup Scripts (temporary, used by populate... scripts)
HYVVE_TOKEN_PUBLISH_DIGEST=
PUBLISH_TRANSACTION_DIGEST=

# Hyvve Token Details (populated by populateEnvFromHyvveTokenPublish.ts)
HYVVE_TOKEN_PACKAGE_ID=
TREASURY_CAP_ID=
HYVVE_COIN_METADATA_ID=

# Campaign Manager Details (populated by populateEnvFromPublish.ts)
CAMPAIGN_MANAGER_PACKAGE_ID=
CAMPAIGN_STORE_ID=
ESCROW_STORE_ID= # For SUI Escrow, if used
CONTRIBUTION_STORE_ID=
REPUTATION_REGISTRY_ID=
VERIFIER_REGISTRY_ID=
VERIFIER_STORE_ID=
SUBSCRIPTION_STORE_ID=

# Hyvve Infrastructure (populated by setupHyvveInfra.ts)
HYVVE_ESCROW_STORE_ID=
HYVVE_PAYMENT_COIN_ID=
HYVVE_TOKEN_TYPE= # e.g., <HYVVE_TOKEN_PACKAGE_ID>::hyvve::HYVVE

# Optional for setupHyvveInfra.ts
ESCROW_PLATFORM_WALLET_ADDRESS= # Defaults to ADMIN_PRIVATE_KEY's address
TOKEN_RECIPIENT_ADDRESS= # Defaults to ADMIN_PRIVATE_KEY's address, set to campaign creator for initial funds
MINT_AMOUNT=1000000000 # Smallest units (e.g., 1000 tokens if 6 decimals)
```

**Note on Private Keys:**

- `ADMIN_PRIVATE_KEY`: This key should correspond to the address that owns the `TREASURY_CAP_ID` of your `$Hyvve` token. It's used by `setupHyvveInfra.ts` and potentially other admin-level scripts.
- `PRIVATE_KEY`: This key is used by scripts like `createCampaign.ts`. The corresponding address should own the `HYVVE_PAYMENT_COIN_ID` to fund campaigns.
- These can be the same key/address if that account serves both roles.

## Running Interaction Scripts

Once the setup is complete and your `.env` file is populated, you can run the interaction scripts.

### Create a Campaign

Script: `campaign/createCampaign.ts`

This script creates a new campaign and sets up its escrow (either with SUI or `$Hyvve` tokens based on `.env` config).

1.  Ensure the following are correctly set in `.env`:
    - `PRIVATE_KEY` (for the campaign creator)
    - `CAMPAIGN_MANAGER_PACKAGE_ID` (or `PACKAGE_ID`)
    - `CAMPAIGN_STORE_ID`
    - If using `$Hyvve` (recommended):
      - `HYVVE_TOKEN_TYPE`
      - `HYVVE_ESCROW_STORE_ID`
      - `HYVVE_PAYMENT_COIN_ID` (ensure this coin is owned by `PRIVATE_KEY`'s address and has sufficient balance for `total_budget`)
    - If using SUI:
      - `ESCROW_STORE_ID` (for SUI)
2.  Modify `campaignDetails` within the script if you want to change title, description, budget, etc.
3.  Run:
    ```bash
    npx ts-node campaign/createCampaign.ts
    ```

### Get Active Campaigns and Contributions

Script: `campaign/getActiveData.ts`

This script fetches and displays all active campaigns and all contributions.

1.  Ensure the following are correctly set in `.env`:
    - `CAMPAIGN_MANAGER_PACKAGE_ID` (or `PACKAGE_ID`)
    - `CAMPAIGN_STORE_ID`
    - `CONTRIBUTION_STORE_ID`
2.  Run:
    ```bash
    npx ts-node campaign/getActiveData.ts
    ```

## Troubleshooting

- **`Error: ... environment variable not set.`**: Double-check your `.env` file for the missing variable.
- **`IncorrectUserSignature`**: The `PRIVATE_KEY` (or `ADMIN_PRIVATE_KEY`) being used to sign the transaction does not correspond to the owner of an object being mutated (e.g., `TreasuryCap` for minting, a specific coin for payment).
- **`TypeMismatch` / `MoveAbort` with error codes**: These often point to incorrect Object IDs being passed to contract functions (e.g., wrong `CAMPAIGN_STORE_ID`, `ESCROW_STORE_ID`, or payment coin not matching expected value/type).
  - Verify Object IDs using a Sui Explorer.
  - Check the contract's `assert!` conditions that correspond to the Move abort code.
- **`Invalid params`**: Often caused by an incorrectly formatted package ID or function target in the script's `moveCall`.
- **Gas Issues**: If transactions fail due to gas, you might need to request more funds from a faucet for your signing address or explicitly set a higher `gasBudget` in the `signAndExecuteTransaction` options within the scripts.

This README should provide a good starting point. Remember to adapt paths and commands if your project structure differs slightly.

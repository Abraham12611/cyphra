// scripts/submitContribution.ts
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { bcs } from '@mysten/sui/bcs';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';

// --- ESM-compatible way to get directory name ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file in the same directory
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// --- Configuration ---
const PACKAGE_ID = process.env.CAMPAIGN_MANAGER_PACKAGE_ID || '';
const CAMPAIGN_STORE_ID = process.env.CAMPAIGN_STORE_ID || '';
const CONTRIBUTION_STORE_ID = process.env.CONTRIBUTION_STORE_ID || '';
const REPUTATION_REGISTRY_ID = process.env.REPUTATION_REGISTRY_ID || '';

// For Hyvve Token
const HYVVE_TOKEN_TYPE = process.env.HYVVE_TOKEN_TYPE || '';
const HYVVE_ESCROW_STORE_ID = process.env.HYVVE_ESCROW_STORE_ID || '';

// Network configuration
const network = 'testnet'; // Or 'devnet', 'mainnet', 'localnet'
const rpcUrl = getFullnodeUrl(network);
const client = new SuiClient({ url: rpcUrl });

// --- Validate Configuration ---
if (!CAMPAIGN_STORE_ID || !CONTRIBUTION_STORE_ID || !REPUTATION_REGISTRY_ID) {
  console.error(
    'Error: Missing CAMPAIGN_STORE_ID, CONTRIBUTION_STORE_ID, or REPUTATION_REGISTRY_ID in .env file or script.'
  );
  process.exit(1);
}
if (!PACKAGE_ID) {
  console.error(
    'Error: Missing PACKAGE_ID in .env file or hardcoded fallback.'
  );
  process.exit(1);
}

// --- Get Keypair from Private Key ---
const privateKeyBech32 = process.env.PRIVATE_KEY;
if (!privateKeyBech32) {
  console.error('Error: PRIVATE_KEY environment variable not set.');
  process.exit(1);
}
let keypair: Ed25519Keypair;
try {
  const { secretKey } = decodeSuiPrivateKey(privateKeyBech32);
  keypair = Ed25519Keypair.fromSecretKey(secretKey);
} catch (error) {
  console.error('Error creating keypair from private key:', error);
  process.exit(1);
}
const senderAddress = keypair.getPublicKey().toSuiAddress();
console.log(`Using address: ${senderAddress} from PRIVATE_KEY`);
console.log(`-----------------------------------\n`);

// --- Contribution Details ---
// IMPORTANT: Replace with the actual ID of an ACTIVE campaign
const targetCampaignId = 'campaign_674bfde87660ce80';

const contributionDetails = {
  campaign_id: targetCampaignId,
  // Generate a unique ID for each contribution attempt
  contribution_id: `contrib_${senderAddress}_${Date.now()}`,
  data_url: 'ipfs://bafybeihdatasamplecidplaceholder', // Replace with actual data URL
  data_hash: Array.from(
    new TextEncoder().encode(Date.now().toString() + 'dummy data')
  ), // Replace with actual hash (as number array)
  quality_score: '81', // Provide as string for u64
};

// --- Function to check if campaign is active ---
async function isCampaignActive(
  campaignStoreId: string,
  packageId: string,
  campaignId: string
): Promise<boolean> {
  console.log(`Checking status for campaign: ${campaignId}`);
  const tx = new Transaction();
  tx.moveCall({
    target: `${packageId}::campaign::verify_campaign_active`,
    arguments: [tx.object(campaignStoreId), tx.pure.string(campaignId)],
  });

  try {
    const result = await client.devInspectTransactionBlock({
      sender: senderAddress, // Sender address is required for devInspect
      transactionBlock: tx,
    });

    if (result.effects.status.status !== 'success') {
      console.error('devInspect failed:', result.effects.status.error);
      return false;
    }

    // Check the return value from the Move call
    // devInspect results might be nested. Adjust parsing as needed.
    // Look for a boolean return value. Example structure assumed:
    if (
      result.results &&
      result.results.length > 0 &&
      result.results[0].returnValues
    ) {
      const returnValueEncoded = result.results[0].returnValues[0];
      // First byte is type tag (1 for bool), second is the value (1 for true, 0 for false)
      if (
        returnValueEncoded &&
        returnValueEncoded[0] && // Check if the Uint8Array is not empty
        returnValueEncoded[0].length === 1 && // Ensure it has only one byte
        returnValueEncoded[0][0] === 1 // Check if the byte value is 1 (true)
      ) {
        console.log(`Campaign ${campaignId} is active.`);
        return true;
      }
    }
    console.log(`Campaign ${campaignId} is NOT active or check failed.`);
    return false;
  } catch (error) {
    console.error(`Error checking campaign status:`, error);
    return false;
  }
}

// --- Main Function ---
async function submitContribution() {
  console.log(
    `Attempting to submit contribution to campaign: ${contributionDetails.campaign_id}`
  );
  console.log(`Using Contribution Store: ${CONTRIBUTION_STORE_ID}`);
  console.log(`Using Package ID: ${PACKAGE_ID}`);
  console.log(`Using Reputation Registry: ${REPUTATION_REGISTRY_ID}`);
  console.log(`Signer Address: ${senderAddress}`);

  // Determine which escrow store and token type to use
  let effectiveEscrowStoreId = HYVVE_ESCROW_STORE_ID;
  let effectiveTokenType = HYVVE_TOKEN_TYPE;

  if (!HYVVE_TOKEN_TYPE || !HYVVE_ESCROW_STORE_ID) {
    console.warn(
      'Warning: HYVVE_TOKEN_TYPE or HYVVE_ESCROW_STORE_ID not set. Falling back to SUI config if available.'
    );
    effectiveEscrowStoreId = process.env.ESCROW_STORE_ID || ''; // Original SUI Escrow Store
    effectiveTokenType = '0x2::sui::SUI';
  }

  if (!effectiveEscrowStoreId) {
    console.error(
      'Error: No effective Escrow Store ID could be determined (HYVVE_ESCROW_STORE_ID or ESCROW_STORE_ID).'
    );
    return;
  }
  if (!effectiveTokenType) {
    console.error(
      'Error: No effective Token Type could be determined (HYVVE_TOKEN_TYPE or fallback to SUI).'
    );
    return;
  }

  console.log(`Using Escrow Store: ${effectiveEscrowStoreId}`);
  console.log(`Using Token Type: ${effectiveTokenType}`);

  // 1. Check campaign status
  const isActive = await isCampaignActive(
    CAMPAIGN_STORE_ID!,
    PACKAGE_ID!,
    contributionDetails.campaign_id
  );

  if (!isActive) {
    console.error(
      `Target campaign ${contributionDetails.campaign_id} is not active. Aborting contribution.`
    );
    return;
  }

  // 2. Proceed with submission
  try {
    const tx = new Transaction();

    // Define the moveCall target
    const target =
      `${PACKAGE_ID}::contribution::submit_contribution` as `${string}::${string}::${string}`;

    // Add the moveCall to the transaction
    tx.moveCall({
      target: target,
      typeArguments: [effectiveTokenType as `${string}::${string}::${string}`],
      arguments: [
        tx.object(CONTRIBUTION_STORE_ID!), // 1. The shared ContributionStore object
        tx.object(CAMPAIGN_STORE_ID!), // 2. The shared CampaignStore object
        tx.object(effectiveEscrowStoreId), // 3. The shared EscrowStore object (Hyvve or SUI)
        tx.object(REPUTATION_REGISTRY_ID!), // 4. The shared ReputationRegistry object
        tx.pure.string(contributionDetails.campaign_id), // 5. campaign_id
        tx.pure.string(contributionDetails.contribution_id), // 6. contribution_id
        tx.pure.string(contributionDetails.data_url), // 7. data_url
        tx.pure(bcs.vector(bcs.U8).serialize(contributionDetails.data_hash)), // 8. data_hash
        tx.pure.u64(contributionDetails.quality_score), // 9. quality_score
        tx.pure.bool(true), // 10. is_active (verified 'is_active' status)
      ],
    });

    console.log('Transaction constructed. Signing and executing...');

    const result = await client.signAndExecuteTransaction({
      signer: keypair,
      transaction: tx,
      options: {
        showEffects: true,
        showObjectChanges: true,
      },
    });

    console.log('\nTransaction Execution Result:');
    console.log(`Status: ${result.effects?.status.status}`);
    console.log(`Digest: ${result.digest}`);

    if (result.effects?.status.status === 'success') {
      console.log('\nContribution submitted successfully!');
    } else {
      console.error('\nContribution submission failed!');
      console.error('Error:', result.effects?.status.error);
    }
  } catch (error) {
    console.error('\nAn error occurred during contribution submission:', error);
    if (error instanceof Error) {
      console.error(`Error Message: ${error.message}`);
      if ('data' in error) {
        console.error(`Error Data: ${JSON.stringify((error as any).data)}`);
      }
    }
  }
}

// --- Run the script ---
submitContribution();

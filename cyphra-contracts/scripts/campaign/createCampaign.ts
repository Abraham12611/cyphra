import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { bcs } from '@mysten/sui/bcs';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file in the same directory
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// --- Configuration ---

const PACKAGE_ID =
  process.env.CAMPAIGN_MANAGER_PACKAGE_ID || process.env.PACKAGE_ID || '';

// Object ID of the CampaignStore confirmed via Suiscan
const CAMPAIGN_STORE_ID = process.env.CAMPAIGN_STORE_ID || '';

// -- SUI Escrow Configuration (Original) --
// const ESCROW_STORE_ID = process.env.ESCROW_STORE_ID || ''; // Keep if SUI campaigns are still an option

// -- HYVVE Token Escrow Configuration --
const HYVVE_TOKEN_TYPE = process.env.HYVVE_TOKEN_TYPE || ''; // e.g., 0x...::hyvve::HYVVE
const HYVVE_ESCROW_STORE_ID = process.env.HYVVE_ESCROW_STORE_ID || '';
const HYVVE_PAYMENT_COIN_ID = process.env.HYVVE_PAYMENT_COIN_ID || ''; // Coin<HYVVE> object ID for funding

// Determine which escrow to use (defaulting to HYVVE if configured)
const USE_HYVVE_ESCROW = !!(
  HYVVE_TOKEN_TYPE &&
  HYVVE_ESCROW_STORE_ID &&
  HYVVE_PAYMENT_COIN_ID
);
const ESCROW_STORE_ID_TO_USE = USE_HYVVE_ESCROW
  ? HYVVE_ESCROW_STORE_ID
  : process.env.ESCROW_STORE_ID || '';
const TOKEN_TYPE_FOR_ESCROW = USE_HYVVE_ESCROW
  ? HYVVE_TOKEN_TYPE
  : '0x2::sui::SUI';

// Network configuration
const network = 'testnet'; // Or 'devnet', 'mainnet', 'localnet'
const rpcUrl = getFullnodeUrl(network);
const client = new SuiClient({ url: rpcUrl });

// --- Get Keypair from Private Key ---
const privateKeyBech32 = process.env.PRIVATE_KEY;
if (!privateKeyBech32) {
  console.error('Error: PRIVATE_KEY environment variable not set.');
  process.exit(1); // Exit if key is not found
}

if (USE_HYVVE_ESCROW) {
  console.log('Configured to use $Hyvve token for escrow.');
  if (!HYVVE_TOKEN_TYPE)
    console.warn('Warning: HYVVE_TOKEN_TYPE is not set in .env');
  if (!HYVVE_ESCROW_STORE_ID)
    console.warn('Warning: HYVVE_ESCROW_STORE_ID is not set in .env');
  if (!HYVVE_PAYMENT_COIN_ID)
    console.warn('Warning: HYVVE_PAYMENT_COIN_ID is not set in .env');
} else {
  console.log(
    'Configured to use SUI token for escrow (or $Hyvve config incomplete).'
  );
  if (!process.env.ESCROW_STORE_ID)
    console.warn('Warning: ESCROW_STORE_ID for SUI is not set in .env');
}

let keypair: Ed25519Keypair;
try {
  // Decode the Bech32m private key to get the scheme and secret bytes
  const { secretKey } = decodeSuiPrivateKey(privateKeyBech32);
  // Create the keypair from the raw secret key bytes
  keypair = Ed25519Keypair.fromSecretKey(secretKey);
} catch (error) {
  console.error('Error creating keypair from private key:', error);
  process.exit(1);
}

const senderAddress = keypair.getPublicKey().toSuiAddress();
console.log(`Using address: ${senderAddress} from PRIVATE_KEY`);
console.log(`-----------------------------------\n`);

// --- Dummy Campaign Details ---
const campaignDetails = {
  campaign_id: `campaign_${Date.now()}`,
  title: 'My Test Campaign',
  description: 'This is a test campaign created via script.',
  data_requirements: 'Submit image URLs.',
  quality_criteria: 'Images must be clear and relevant.',
  unit_price: 1000000n, // 0.001 SUI per contribution (1,000,000 MIST)
  total_budget: 100000000n, // 0.1 SUI (100,000,000 MIST)
  min_data_count: 10n, // Use BigInt for u64 values
  max_data_count: 100n, // Use BigInt for u64 values
  expiration: BigInt(Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60), // Convert to seconds, not milliseconds
  metadata_uri: 'ipfs://dummy-metadata-cid',
  encryption_pub_key: Array.from(crypto.getRandomValues(new Uint8Array(32))),
  platform_fee_basis_points: 100, // Example: 1% platform fee (100 basis points)
};

// --- Main Function ---
async function createCampaign() {
  console.log(
    `Attempting to create campaign "${campaignDetails.title}" on ${network}...`
  );
  console.log(`Using Campaign Store: ${CAMPAIGN_STORE_ID}`);
  console.log(`Using Package ID: ${PACKAGE_ID}`);
  console.log(`Signer Address: ${senderAddress}`);

  // Add a small delay to allow time for faucet funding if running immediately
  // console.log('\nPausing for 15 seconds to allow faucet funding...');
  // await new Promise((resolve) => setTimeout(resolve, 15000));
  // console.log('Resuming execution...');

  try {
    const tx = new Transaction();

    // Define the moveCall target
    const target =
      `${PACKAGE_ID}::campaign::create_campaign` as `${string}::${string}::${string}`;

    // Add the moveCall to the transaction
    tx.moveCall({
      target: target,
      arguments: [
        tx.object(CAMPAIGN_STORE_ID), // The shared CampaignStore object
        tx.pure.string(campaignDetails.campaign_id),
        tx.pure.string(campaignDetails.title),
        tx.pure.string(campaignDetails.description),
        tx.pure.string(campaignDetails.data_requirements),
        tx.pure.string(campaignDetails.quality_criteria),
        tx.pure.u64(campaignDetails.unit_price),
        tx.pure.u64(campaignDetails.total_budget),
        tx.pure.u64(campaignDetails.min_data_count),
        tx.pure.u64(campaignDetails.max_data_count),
        tx.pure.u64(campaignDetails.expiration),
        tx.pure.string(campaignDetails.metadata_uri),
        tx.pure(
          bcs.vector(bcs.u8()).serialize(campaignDetails.encryption_pub_key)
        ),
      ],
    });

    console.log('Transaction constructed. Signing and executing...');

    // Sign and execute the transaction
    const result = await client.signAndExecuteTransaction({
      signer: keypair,
      transaction: tx,
      options: {
        showEffects: true, // Show effects to see created objects, etc.
        showObjectChanges: true,
      },
      // Optional: Set a higher gas budget if needed
      // gasBudget: 100000000,
    });

    console.log('\nTransaction Execution Result:');
    console.log(`Status: ${result.effects?.status.status}`);
    console.log(`Digest: ${result.digest}`);

    if (result.effects?.status.status === 'success') {
      console.log('\nCampaign created successfully!');
      console.log(`Campaign ID: ${campaignDetails.campaign_id}`);

      // Now, create and fund the escrow for this campaign
      console.log(
        `\nAttempting to create escrow for campaign: ${campaignDetails.campaign_id} using ${TOKEN_TYPE_FOR_ESCROW}...`
      );
      console.log(`Using Escrow Store: ${ESCROW_STORE_ID_TO_USE}`);

      if (!ESCROW_STORE_ID_TO_USE) {
        console.error(
          'Error: No Escrow Store ID configured. Please set HYVVE_ESCROW_STORE_ID or ESCROW_STORE_ID in .env'
        );
        return; // Exit if no escrow store ID is available
      }

      const escrowTx = new Transaction();
      let paymentCoinArgument;

      if (USE_HYVVE_ESCROW) {
        if (!HYVVE_PAYMENT_COIN_ID) {
          console.error(
            'Error: HYVVE_PAYMENT_COIN_ID is not set in .env for $Hyvve escrow.'
          );
          return;
        }
        paymentCoinArgument = escrowTx.object(HYVVE_PAYMENT_COIN_ID);
        console.log(`Using $Hyvve payment coin: ${HYVVE_PAYMENT_COIN_ID}`);
      } else {
        // Original SUI logic: split from gas
        paymentCoinArgument = escrowTx.splitCoins(escrowTx.gas, [
          campaignDetails.total_budget.toString(),
        ]);
        console.log('Splitting SUI from gas for payment.');
      }

      escrowTx.moveCall({
        target: `${PACKAGE_ID}::escrow::create_campaign_escrow`,
        typeArguments: [
          TOKEN_TYPE_FOR_ESCROW as `${string}::${string}::${string}`,
        ],
        arguments: [
          escrowTx.object(ESCROW_STORE_ID_TO_USE),
          escrowTx.object(CAMPAIGN_STORE_ID), // The shared CampaignStore object
          escrowTx.pure.string(campaignDetails.campaign_id),
          escrowTx.pure.u64(campaignDetails.total_budget.toString()),
          escrowTx.pure.u64(campaignDetails.unit_price.toString()),
          escrowTx.pure.u64(
            campaignDetails.platform_fee_basis_points.toString()
          ),
          paymentCoinArgument, // The coin object for funding (either $Hyvve or SUI)
        ],
      });

      console.log('Escrow transaction constructed. Signing and executing...');
      const escrowResult = await client.signAndExecuteTransaction({
        signer: keypair,
        transaction: escrowTx,
        options: {
          showEffects: true,
        },
      });

      console.log('\nEscrow Creation Transaction Result:');
      console.log(`  Status: ${escrowResult.effects?.status.status}`);
      console.log(`  Digest: ${escrowResult.digest}`);

      if (escrowResult.effects?.status.status === 'success') {
        console.log('Escrow created and funded successfully!\n');
      } else {
        console.error('\nEscrow creation failed!');
        console.error('  Error:', escrowResult.effects?.status.error);
      }
    } else {
      console.error('\nCampaign creation failed!');
      console.error('Error:', result.effects?.status.error);
    }
  } catch (error) {
    console.error('\nAn error occurred:', error);
    if (error instanceof Error) {
      console.error(`Error Message: ${error.message}`);

      if ('data' in error) {
        console.error(`Error Data: ${JSON.stringify((error as any).data)}`);
      }
    }
  }
}

createCampaign();

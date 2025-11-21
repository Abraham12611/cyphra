import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { fromB64, toHEX } from '@mysten/sui/utils';
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
  process.env.CAMPAIGN_MANAGER_PACKAGE_ID ||
  '0x0bc9b5cf7d261d0288c68b1f834b24a8f4c782c8c13ede9b58bf8b3b06397622';

// Object ID of the CampaignStore
const CAMPAIGN_STORE_ID =
  process.env.CAMPAIGN_STORE_ID ||
  '0x1373af6c8a2013d826572ebd4b88778a56b5e74489aff787c4b604ecd8b19e24';

// Network configuration
const networkMap = {
  testnet: 'testnet',
  mainnet: 'mainnet',
  devnet: 'devnet',
  localnet: 'localnet',
} as const;

const networkInput = process.env.NETWORK || 'testnet';
const network =
  networkMap[networkInput as keyof typeof networkMap] || 'testnet';
const rpcUrl = getFullnodeUrl(network);
const client = new SuiClient({ url: rpcUrl });

// --- Main Function ---
async function getCampaignPubKey(campaignId: string) {
  if (!campaignId) {
    console.error('Error: Campaign ID is required.');
    console.log('Usage: npm run getCampaignPubKey -- <campaign_id>');
    process.exit(1);
  }

  console.log(
    `Fetching public key for campaign: ${campaignId} on ${network}...`
  );
  console.log(`Using Campaign Store: ${CAMPAIGN_STORE_ID}`);
  console.log(`Using Package ID: ${PACKAGE_ID}`);

  try {
    // Create a transaction to call the get_encryption_public_key function
    const tx = new Transaction();

    // Define the moveCall target
    const target =
      `${PACKAGE_ID}::campaign::get_encryption_public_key` as `${string}::${string}::${string}`;

    // Add the moveCall to the transaction
    tx.moveCall({
      target: target,
      arguments: [
        tx.object(CAMPAIGN_STORE_ID), // The shared CampaignStore object
        tx.pure.string(campaignId), // The campaign ID
      ],
    });

    console.log('Transaction constructed. Executing view function...');

    const result = await client.devInspectTransactionBlock({
      transactionBlock: tx,
      sender:
        '0x0000000000000000000000000000000000000000000000000000000000000000',
    });

    if (result.effects.status.status !== 'success') {
      console.error('Error fetching public key:', result.effects.status.error);
      process.exit(1);
    }

    // Parse the result - we expect a vector<u8> return value
    if (
      result.results &&
      result.results.length > 0 &&
      result.results[0].returnValues
    ) {
      const rawPubKey = result.results[0].returnValues[0][0]; // Extract from nested array
      const pubKeyArray = new Uint8Array(rawPubKey);

      console.log('\nEncryption Public Key:');
      console.log(`Hex: ${toHEX(pubKeyArray)}`);

      console.log(`Base64: ${Buffer.from(pubKeyArray).toString('base64')}`);

      return rawPubKey;
    } else {
      console.error('No return value found or unexpected response format.');
      console.log('Raw response:', JSON.stringify(result, null, 2));
    }
  } catch (error) {
    console.error('\nAn error occurred:', error);
    if (error instanceof Error) {
      console.error(`Error Message: ${error.message}`);

      if ('data' in error) {
        console.error(`Error Data: ${JSON.stringify((error as any).data)}`);
      }
    }
    process.exit(1);
  }
}

const campaignId = process.argv[2];
getCampaignPubKey(campaignId);

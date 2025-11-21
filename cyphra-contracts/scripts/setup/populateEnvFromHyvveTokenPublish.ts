import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../.env');

// Load environment variables
dotenv.config({ path: envPath });

// --- Configuration ---
const HYVVE_TOKEN_PUBLISH_DIGEST = process.env.HYVVE_TOKEN_PUBLISH_DIGEST || '';

const network = process.env.SUI_NETWORK || 'testnet';
const rpcUrl = getFullnodeUrl(network as any);
const client = new SuiClient({ url: rpcUrl });

// --- Validations ---
if (!HYVVE_TOKEN_PUBLISH_DIGEST) {
  console.error(
    'Error: HYVVE_TOKEN_PUBLISH_DIGEST environment variable not set.'
  );
  process.exit(1);
}

// --- Helper Function to Update .env file (copied from setupHyvveInfra.ts) ---
function updateEnvFile(updates: Record<string, string>) {
  let content = '';
  if (fs.existsSync(envPath)) {
    content = fs.readFileSync(envPath, 'utf-8');
  }
  const lines = content.split('\n');
  let changed = false;

  for (const key in updates) {
    const value = updates[key];
    if (!value) continue; // Don't write empty values
    let found = false;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith(`${key}=`)) {
        if (lines[i] !== `${key}=${value}`) {
          lines[i] = `${key}=${value}`;
          changed = true;
        }
        found = true;
        break;
      }
    }
    if (!found) {
      lines.push(`${key}=${value}`);
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(envPath, lines.join('\n'));
    console.log(`\nSuccessfully updated .env file at: ${envPath}`);
    for (const key in updates) {
      if (updates[key]) console.log(`  Set ${key}=${updates[key]}`);
    }
  } else {
    console.log('\n.env file already up-to-date or no new values to set.');
  }
}

// --- Main Function ---
async function populateEnvFromHyvveTokenPublish() {
  console.log('--- Populating .env from Hyvve Token Publish Transaction ---');
  console.log(`Transaction Digest: ${HYVVE_TOKEN_PUBLISH_DIGEST}`);
  console.log(`Network: ${network}`);
  console.log('-----------------------------------\n');

  try {
    const txDetails = await client.getTransactionBlock({
      digest: HYVVE_TOKEN_PUBLISH_DIGEST,
      options: {
        showObjectChanges: true,
        showEffects: true,
      },
    });

    if (txDetails.effects?.status.status !== 'success') {
      console.error(
        'Error: Hyvve Token publish transaction was not successful.'
      );
      console.error('Status:', txDetails.effects?.status.error);
      process.exit(1);
    }

    const updates: Record<string, string> = {};

    // Find the new Hyvve Token Package ID
    let newHyvveTokenPackageId = '';
    if (txDetails.objectChanges) {
      for (const change of txDetails.objectChanges) {
        if (change.type === 'published') {
          newHyvveTokenPackageId = change.packageId;
          break;
        }
      }
    }

    if (!newHyvveTokenPackageId) {
      console.error(
        'Could not determine the new Hyvve Token Package ID from the transaction details.'
      );
      process.exit(1);
    }
    updates.HYVVE_TOKEN_PACKAGE_ID = newHyvveTokenPackageId;
    console.log(`Found new Hyvve Token Package ID: ${newHyvveTokenPackageId}`);

    // Define types to look for based on the new package ID
    const treasuryCapType = `0x2::coin::TreasuryCap<${newHyvveTokenPackageId}::hyvve::HYVVE>`;
    const coinMetadataType = `0x2::coin::CoinMetadata<${newHyvveTokenPackageId}::hyvve::HYVVE>`;

    if (txDetails.objectChanges) {
      for (const change of txDetails.objectChanges) {
        if (change.type === 'created') {
          if (change.objectType === treasuryCapType) {
            updates.TREASURY_CAP_ID = change.objectId;
            console.log(
              `  Found TreasuryCap -> TREASURY_CAP_ID: ${change.objectId}`
            );
          } else if (change.objectType === coinMetadataType) {
            updates.HYVVE_COIN_METADATA_ID = change.objectId;
            console.log(
              `  Found CoinMetadata -> HYVVE_COIN_METADATA_ID: ${change.objectId}`
            );
          }
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      updateEnvFile(updates);
    } else {
      console.log(
        'No relevant Hyvve Token objects found to update in the .env file.'
      );
    }
  } catch (error) {
    console.error('Error processing Hyvve Token publish transaction:', error);
    process.exit(1);
  }

  console.log('\n--- .env Population for Hyvve Token Complete! ---');
}

populateEnvFromHyvveTokenPublish();

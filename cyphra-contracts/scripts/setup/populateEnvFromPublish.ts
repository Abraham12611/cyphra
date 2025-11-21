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
const PUBLISH_TRANSACTION_DIGEST = process.env.PUBLISH_TRANSACTION_DIGEST || '';

const network = process.env.SUI_NETWORK || 'testnet';
const rpcUrl = getFullnodeUrl(network as any);
const client = new SuiClient({ url: rpcUrl });

// --- Validations ---
if (!PUBLISH_TRANSACTION_DIGEST) {
  console.error(
    'Error: PUBLISH_TRANSACTION_DIGEST environment variable not set.'
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
async function populateEnvFromPublish() {
  console.log('--- Populating .env from Publish Transaction ---');
  console.log(`Transaction Digest: ${PUBLISH_TRANSACTION_DIGEST}`);
  console.log(`Network: ${network}`);
  console.log('-----------------------------------\n');

  try {
    const txDetails = await client.getTransactionBlock({
      digest: PUBLISH_TRANSACTION_DIGEST,
      options: {
        showObjectChanges: true,
        showEffects: true, // Effects can also list new package ID under effects.created
      },
    });

    if (txDetails.effects?.status.status !== 'success') {
      console.error('Error: Publish transaction was not successful.');
      console.error('Status:', txDetails.effects?.status.error);
      process.exit(1);
    }

    const updates: Record<string, string> = {};

    // Find the new Package ID
    let newPackageId = '';
    if (txDetails.objectChanges) {
      for (const change of txDetails.objectChanges) {
        if (change.type === 'published') {
          newPackageId = change.packageId;
          break;
        }
      }
    }

    if (!newPackageId && txDetails.effects?.created) {
      // Fallback check in effects just in case
      for (const created of txDetails.effects.created) {
        if (
          'packageId' in created.reference &&
          'objectId' in created.reference
        ) {
          // Heuristic: if objectId looks like a packageId (starts with 0x, often shorter or distinct)
          // and owner is Immutable, it might be the package metadata object from which we can infer packageId.
          // However, the `published` type in objectChanges is more direct.
          // This part is more complex, relying on `objectChanges` with type `published` is better.
        }
      }
    }

    if (!newPackageId) {
      console.warn(
        'Could not reliably determine the new Package ID from the transaction details.'
      );
      console.log(
        'Please set CAMPAIGN_MANAGER_PACKAGE_ID manually in .env if it changed.'
      );
    } else {
      updates.CAMPAIGN_MANAGER_PACKAGE_ID = newPackageId;
      console.log(`Found new Campaign Manager Package ID: ${newPackageId}`);
    }

    const currentPackageId =
      newPackageId ||
      process.env.CAMPAIGN_MANAGER_PACKAGE_ID ||
      process.env.PACKAGE_ID;
    if (!currentPackageId) {
      console.error(
        'Error: Could not determine current package ID. Please ensure CAMPAIGN_MANAGER_PACKAGE_ID is set if publish details dont provide it.'
      );
      process.exit(1);
    }

    console.log(`Using Package ID for matching types: ${currentPackageId}`);

    // Define mappings from object type suffix to .env variable name
    const typeToEnvMap: Record<string, string> = {
      [`${currentPackageId}::campaign::CampaignStore`]: 'CAMPAIGN_STORE_ID',
      [`${currentPackageId}::escrow::EscrowStore<0x2::sui::SUI>`]:
        'ESCROW_STORE_ID', // For SUI Escrow
      [`${currentPackageId}::contribution::ContributionStore`]:
        'CONTRIBUTION_STORE_ID',
      [`${currentPackageId}::reputation::ReputationRegistry`]:
        'REPUTATION_REGISTRY_ID',
      [`${currentPackageId}::verifier::VerifierRegistry`]:
        'VERIFIER_REGISTRY_ID',
      [`${currentPackageId}::verifier::VerifierStore`]: 'VERIFIER_STORE_ID',
      [`${currentPackageId}::subscription::SubscriptionStore`]:
        'SUBSCRIPTION_STORE_ID',
    };

    if (txDetails.objectChanges) {
      for (const change of txDetails.objectChanges) {
        if (change.type === 'created') {
          const objectType = change.objectType;
          const envVarName = typeToEnvMap[objectType];
          if (envVarName) {
            updates[envVarName] = change.objectId;
            console.log(
              `  Found ${objectType} -> ${envVarName}: ${change.objectId}`
            );
          }
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      updateEnvFile(updates);
    } else {
      console.log(
        'No relevant objects found to update in the .env file based on the publish transaction.'
      );
    }
  } catch (error) {
    console.error('Error processing publish transaction:', error);
    process.exit(1);
  }

  console.log('\n--- .env Population Complete! ---');
}

populateEnvFromPublish();

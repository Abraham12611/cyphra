// scripts/getReputation.ts
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

// --- ESM-compatible way to get directory name ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file in the same directory
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// --- Configuration ---
const PACKAGE_ID = process.env.CAMPAIGN_MANAGER_PACKAGE_ID || '';
const REPUTATION_REGISTRY_ID = process.env.REPUTATION_REGISTRY_ID || '';

// Network configuration
const network = process.env.NETWORK || 'testnet'; // Or 'devnet', 'mainnet', 'localnet'
const rpcUrl = getFullnodeUrl(
  network as 'testnet' | 'mainnet' | 'devnet' | 'localnet'
);
const client = new SuiClient({ url: rpcUrl });

interface Badge {
  badge_type: number;
  timestamp: string | number;
  description: number[];
}

interface ReputationStore {
  reputation_score: number;
  badges: Badge[];
  contribution_count: number;
  successful_payments: number;
}

function getBadgeTypeName(badge_type: number): string {
  switch (badge_type) {
    // Contributor badges
    case 1:
      return 'Active Contributor';
    case 2:
      return 'Top Contributor';
    case 3:
      return 'Expert Contributor';

    // Campaign creator badges
    case 10:
      return 'Campaign Creator';
    case 11:
      return 'Reliable Payer';
    case 12:
      return 'Trusted Creator';
    case 13:
      return 'Expert Creator';

    // Verifier badges
    case 20:
      return 'Verifier';
    case 21:
      return 'Trusted Verifier';
    case 22:
      return 'Expert Verifier';

    // Achievement badges
    case 30:
      return 'First Contribution';
    case 31:
      return 'First Campaign';
    case 32:
      return 'First Verification';

    default:
      return 'Unknown Badge';
  }
}

async function hasReputationStore(address: string): Promise<boolean> {
  try {
    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::reputation::has_reputation_store`,
      arguments: [tx.object(REPUTATION_REGISTRY_ID), tx.pure.address(address)],
    });

    const result = await client.devInspectTransactionBlock({
      sender: address,
      transactionBlock: tx,
    });

    if (
      result.effects.status.status !== 'success' ||
      !result.results ||
      result.results.length === 0
    ) {
      return false;
    }

    // Parse the boolean return value
    return result.results[0].returnValues?.[0]?.[0]?.[0] === 1;
  } catch (error) {
    console.error('Error checking reputation store:', error);
    return false;
  }
}

async function getReputationStore(
  address: string
): Promise<ReputationStore | null> {
  try {
    // First check if the user has a reputation store
    const hasStore = await hasReputationStore(address);
    if (!hasStore) {
      return null;
    }

    // Get reputation score
    const scoreTx = new Transaction();
    scoreTx.moveCall({
      target: `${PACKAGE_ID}::reputation::get_reputation_score`,
      arguments: [
        scoreTx.object(REPUTATION_REGISTRY_ID),
        scoreTx.pure.address(address),
      ],
    });

    const scoreResult = await client.devInspectTransactionBlock({
      sender: address,
      transactionBlock: scoreTx,
    });

    // Get contribution count
    const contributionTx = new Transaction();
    contributionTx.moveCall({
      target: `${PACKAGE_ID}::reputation::get_contribution_count`,
      arguments: [
        contributionTx.object(REPUTATION_REGISTRY_ID),
        contributionTx.pure.address(address),
      ],
    });

    const contributionResult = await client.devInspectTransactionBlock({
      sender: address,
      transactionBlock: contributionTx,
    });

    // Get successful payments
    const paymentsTx = new Transaction();
    paymentsTx.moveCall({
      target: `${PACKAGE_ID}::reputation::get_successful_payments`,
      arguments: [
        paymentsTx.object(REPUTATION_REGISTRY_ID),
        paymentsTx.pure.address(address),
      ],
    });

    const paymentsResult = await client.devInspectTransactionBlock({
      sender: address,
      transactionBlock: paymentsTx,
    });

    // Get badges
    const badgesTx = new Transaction();
    badgesTx.moveCall({
      target: `${PACKAGE_ID}::reputation::get_badges`,
      arguments: [
        badgesTx.object(REPUTATION_REGISTRY_ID),
        badgesTx.pure.address(address),
      ],
    });

    const badgesResult = await client.devInspectTransactionBlock({
      sender: address,
      transactionBlock: badgesTx,
    });

    // Parse results
    const scoreValue = parseDevInspectUInt(scoreResult);
    const contributionValue = parseDevInspectUInt(contributionResult);
    const paymentsValue = parseDevInspectUInt(paymentsResult);
    const badges = parseDevInspectBadges(badgesResult);

    return {
      reputation_score: scoreValue,
      badges: badges,
      contribution_count: contributionValue,
      successful_payments: paymentsValue,
    };
  } catch (error) {
    console.error('Error fetching reputation store:', error);
    return null;
  }
}

// Helper to parse devInspect result for U64 values
function parseDevInspectUInt(result: any): number {
  if (
    result.effects.status.status !== 'success' ||
    !result.results ||
    result.results.length === 0 ||
    !result.results[0].returnValues
  ) {
    return 0;
  }

  // Convert the returned Uint8Array to a number
  const bytes = result.results[0].returnValues[0][0];
  let value = 0;
  for (let i = 0; i < bytes.length; i++) {
    value += bytes[i] * Math.pow(256, i);
  }
  return value;
}

// Helper to parse devInspect result for badges
function parseDevInspectBadges(result: any): Badge[] {
  if (
    result.effects.status.status !== 'success' ||
    !result.results ||
    result.results.length === 0 ||
    !result.results[0].returnValues
  ) {
    return [];
  }

  try {
    const badgeData = result.results[0].returnValues[0][0];

    const badges: Badge[] = [];

    return badges;
  } catch (error) {
    console.error('Error parsing badges:', error);
    return [];
  }
}

async function displayReputationInfo(
  store: ReputationStore | null,
  address: string
) {
  console.log('\nReputation Information:');
  console.log('======================');
  console.log(`Address: ${address}`);

  if (!store) {
    console.log('No reputation store found for this address.');
    return;
  }

  console.log(`Reputation Score: ${store.reputation_score}`);

  // Display earned badges
  console.log('\nEarned Badges:');
  console.log('=============');
  if (store.badges.length === 0) {
    console.log('No badges earned yet');
  } else {
    store.badges.forEach((badge: Badge) => {
      const badgeName = getBadgeTypeName(badge.badge_type);
      const date = new Date(Number(badge.timestamp) * 1000);
      console.log(`${badgeName} - Earned on ${date.toLocaleDateString()}`);
    });
  }

  // Display badge thresholds and progress
  const thresholds = {
    'Bronze (Active Contributor)': 100,
    'Silver (Reliable Participant)': 500,
    'Gold (Top Contributor)': 1000,
    'Platinum (Expert)': 5000,
  };

  console.log('\nBadge Progress:');
  console.log('==============');
  for (const [badge, threshold] of Object.entries(thresholds)) {
    const progress = Math.min((store.reputation_score / threshold) * 100, 100);
    const progressBar = createProgressBar(progress);
    console.log(`${badge}: ${progressBar} ${progress.toFixed(1)}%`);
  }

  console.log('\nActivity Metrics:');
  console.log('================');
  console.log(`Total Contributions: ${store.contribution_count}`);
  console.log(`Successful Payments: ${store.successful_payments}`);
}

function createProgressBar(percentage: number): string {
  const width = 20;
  const filled = Math.floor((percentage / 100) * width);
  const empty = width - filled;
  return '[' + '='.repeat(filled) + ' '.repeat(empty) + ']';
}

// Get address from private key in environment
function getAddressFromPrivateKey(): string | null {
  const privateKeyBech32 = process.env.PRIVATE_KEY;
  if (!privateKeyBech32) {
    return null;
  }

  try {
    const { secretKey } = decodeSuiPrivateKey(privateKeyBech32);
    const keypair = Ed25519Keypair.fromSecretKey(secretKey);
    return keypair.getPublicKey().toSuiAddress();
  } catch (error) {
    console.error('Error deriving address from private key:', error);
    return null;
  }
}

async function main() {
  try {
    // Validate configuration
    if (!PACKAGE_ID) {
      throw new Error('PACKAGE_ID is not set in .env file');
    }

    if (!REPUTATION_REGISTRY_ID) {
      throw new Error('REPUTATION_REGISTRY_ID is not set in .env file');
    }

    // Parse command line arguments or derive from private key
    let address: string | null = process.argv[2];

    if (!address) {
      // Try to get address from private key
      address = getAddressFromPrivateKey();

      if (address) {
        console.log(
          `No address provided. Using address derived from PRIVATE_KEY: ${address}`
        );
      } else {
        throw new Error(
          'No address provided. Please provide an address as a command line argument or set PRIVATE_KEY in .env file.'
        );
      }
    }

    // address is guaranteed to be a non-null string
    // due to the error throw above if it's null
    const validAddress: string = address;

    console.log(`Fetching reputation for address: ${validAddress}`);
    console.log(`Using package ID: ${PACKAGE_ID}`);
    console.log(`Using reputation registry ID: ${REPUTATION_REGISTRY_ID}`);

    // Get reputation information
    const reputationStore = await getReputationStore(validAddress);

    // Display results
    await displayReputationInfo(reputationStore, validAddress);
  } catch (error) {
    console.error('Error:', error);
    console.log('\nUsage:');
    console.log('npx ts-node scripts/getReputation.ts [address]');
    console.log('- Provide an address to view reputation information');
    console.log(
      '- Make sure PACKAGE_ID and REPUTATION_REGISTRY_ID are set in your .env file'
    );
    process.exit(1);
  }
}

main();

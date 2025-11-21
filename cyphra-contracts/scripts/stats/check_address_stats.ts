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

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// --- Configuration ---
const PACKAGE_ID = process.env.CAMPAIGN_MANAGER_PACKAGE_ID || '';
const CAMPAIGN_STORE_ID = process.env.CAMPAIGN_STORE_ID || '';
const CONTRIBUTION_STORE_ID = process.env.CONTRIBUTION_STORE_ID || '';
const REPUTATION_REGISTRY_ID = process.env.REPUTATION_REGISTRY_ID || '';

// Network configuration
const network = process.env.NETWORK || 'testnet';
const rpcUrl = getFullnodeUrl(
  network as 'testnet' | 'mainnet' | 'devnet' | 'localnet'
);
const client = new SuiClient({ url: rpcUrl });

// Format SUI amounts - 1 SUI = 10^9 MIST
function formatAmount(amount: number | bigint): string {
  const amountNum = Number(amount);
  const sui = amountNum / 1_000_000_000;
  return `${sui.toFixed(9)} SUI (${amountNum} MIST)`;
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

async function getReputationStats(address: string): Promise<{
  score: number;
  contributions: number;
  payments: number;
}> {
  // First check if the user has a reputation store
  const hasStore = await hasReputationStore(address);
  if (!hasStore) {
    return { score: 0, contributions: 0, payments: 0 };
  }

  try {
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

    // Parse results
    const scoreValue = parseDevInspectUInt(scoreResult);
    const contributionValue = parseDevInspectUInt(contributionResult);
    const paymentsValue = parseDevInspectUInt(paymentsResult);

    return {
      score: scoreValue,
      contributions: contributionValue,
      payments: paymentsValue,
    };
  } catch (error) {
    console.error('Error fetching reputation stats:', error);
    return { score: 0, contributions: 0, payments: 0 };
  }
}

async function getContributionStats(address: string): Promise<{
  totalContributions: number;
  verifiedContributions: number;
}> {
  try {
    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::contribution::get_address_total_contributions`,
      arguments: [tx.object(CONTRIBUTION_STORE_ID), tx.pure.address(address)],
    });

    const result = await client.devInspectTransactionBlock({
      sender: address,
      transactionBlock: tx,
    });

    if (
      result.effects.status.status !== 'success' ||
      !result.results ||
      result.results.length === 0 ||
      !result.results[0].returnValues ||
      !result.results[0].returnValues[0][0]
    ) {
      return { totalContributions: 0, verifiedContributions: 0 };
    }

    // Parse the tuple of (total_count, verified_count)
    const totalBytes = result.results[0].returnValues[0][0];
    const verifiedBytes = result.results[0].returnValues[0][1];

    let total = 0;
    for (let i = 0; i < totalBytes.length; i++) {
      total += Number(totalBytes[i]) * Math.pow(256, i);
    }

    let verified = 0;
    for (let i = 0; i < verifiedBytes.length; i++) {
      verified += Number(verifiedBytes[i]) * Math.pow(256, i);
    }

    return {
      totalContributions: total,
      verifiedContributions: verified,
    };
  } catch (error) {
    console.error('Error fetching contribution stats:', error);
    return { totalContributions: 0, verifiedContributions: 0 };
  }
}

async function checkAddressStats(address: string) {
  console.log(`\nFetching stats for address: ${address}`);
  console.log(`Using Package ID: ${PACKAGE_ID}`);
  console.log('--------------------------------------');

  // Get reputation stats
  const reputationStats = await getReputationStats(address);

  // Get contribution stats
  const contributionStats = await getContributionStats(address);

  console.log('\nAddress Statistics:');
  console.log('==================');
  console.log(`Address: ${address}`);

  console.log('\nReputation Metrics:');
  console.log('------------------');
  console.log(`Reputation Score: ${reputationStats.score}`);
  console.log(`Total Contributions: ${reputationStats.contributions}`);
  console.log(`Successful Payments: ${reputationStats.payments}`);

  console.log('\nContribution Metrics:');
  console.log('--------------------');
  console.log(
    `Total Contributions Made: ${contributionStats.totalContributions}`
  );
  console.log(
    `Verified Contributions: ${contributionStats.verifiedContributions}`
  );

  // Calculate success rate
  if (contributionStats.totalContributions > 0) {
    const successRate =
      (contributionStats.verifiedContributions /
        contributionStats.totalContributions) *
      100;
    console.log(`Contribution Success Rate: ${successRate.toFixed(2)}%`);
  } else {
    console.log(`Contribution Success Rate: N/A (no contributions made)`);
  }
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

    if (!CONTRIBUTION_STORE_ID) {
      throw new Error('CONTRIBUTION_STORE_ID is not set in .env file');
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

    // At this point, address is guaranteed to be a non-null string
    await checkAddressStats(address);
  } catch (error) {
    console.error('Error:', error);
    console.log('\nUsage:');
    console.log('npx ts-node scripts/check_address_stats.ts [address]');
    console.log('- Provide an address to view statistics');
    console.log(
      '- Make sure PACKAGE_ID, REPUTATION_REGISTRY_ID, and CONTRIBUTION_STORE_ID are set in your .env file'
    );
    process.exit(1);
  }
}

main();

import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { bcs } from '@mysten/sui/bcs';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file in the same directory
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// --- Configuration ---
const PACKAGE_ID = process.env.CAMPAIGN_MANAGER_PACKAGE_ID || '';

// Object IDs of the shared objects
const CAMPAIGN_STORE_ID = process.env.CAMPAIGN_STORE_ID || '';
const ESCROW_STORE_ID = process.env.ESCROW_STORE_ID || '';

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

// Helper to parse u64 from BCS bytes
function parseU64(bytes: number[]): bigint {
  return BigInt(bcs.u64().parse(Uint8Array.from(bytes)));
}

// Helper to parse string from BCS bytes (assuming UTF8)
function parseString(bytes: number[]): string {
  return Buffer.from(Uint8Array.from(bytes)).toString('utf8');
}

// --- Main Function ---
async function getRemainingBudget(campaignId: string) {
  if (!campaignId) {
    console.error('Error: Campaign ID is required.');
    console.log('Usage: npm run getRemainingBudget -- <campaign_id>');
    process.exit(1);
  }

  console.log(
    `Fetching remaining budget for campaign: ${campaignId} on ${network}...`
  );
  console.log(`Using Campaign Store: ${CAMPAIGN_STORE_ID}`);
  console.log(`Using Escrow Store: ${ESCROW_STORE_ID}`);
  console.log(`Using Package ID: ${PACKAGE_ID}`);

  try {
    // First, get unit price and other details from campaign store
    const campaignDetailsTx = new Transaction();
    const campaignDetailsTarget =
      `${PACKAGE_ID}::campaign::get_campaign_details` as `${string}::${string}::${string}`;

    campaignDetailsTx.moveCall({
      target: campaignDetailsTarget,
      arguments: [
        campaignDetailsTx.object(CAMPAIGN_STORE_ID),
        campaignDetailsTx.pure.string(campaignId),
      ],
    });

    console.log('Fetching campaign details...');
    const campaignDetailsResult = await client.devInspectTransactionBlock({
      transactionBlock: campaignDetailsTx,
      sender:
        '0x0000000000000000000000000000000000000000000000000000000000000000',
    });

    if (campaignDetailsResult.effects.status.status !== 'success') {
      console.error(
        'Error fetching campaign details:',
        campaignDetailsResult.effects.status.error
      );
      process.exit(1);
    }

    // Extract campaign details
    // Return type of get_campaign_details:
    // (String, String, String, String, u64, u64, u64, u64, u64, bool, String, vector<u8>)
    if (
      campaignDetailsResult.results &&
      campaignDetailsResult.results.length > 0 &&
      campaignDetailsResult.results[0].returnValues
    ) {
      const details = campaignDetailsResult.results[0].returnValues;
      if (details && details.length >= 6) {
        // title is String (index 0)
        const titleBytes = details[0][0] as number[];
        const title = parseString(titleBytes);

        // unit_price is u64 (index 4)
        const unitPriceBytes = details[4][0] as number[];
        const unitPrice = parseU64(unitPriceBytes);

        // total_budget is u64 (index 5)
        const totalBudgetBytes = details[5][0] as number[];
        const totalBudget = parseU64(totalBudgetBytes);

        console.log('\nCampaign Details:');
        console.log(`Title: ${title}`);
        console.log(`Unit Price: ${unitPrice} MIST`);
        console.log(
          `Total Budget: ${totalBudget} MIST (${formatSui(totalBudget)} SUI)`
        );
      } else {
        console.warn(
          'Could not parse all campaign details from the result.',
          details
        );
      }
    } else {
      console.warn('No return values found for campaign details.');
    }

    const balanceTx = new Transaction();

    const balanceTarget =
      `${PACKAGE_ID}::escrow::get_available_balance` as `${string}::${string}::${string}`;

    balanceTx.moveCall({
      target: balanceTarget,
      arguments: [
        balanceTx.object(ESCROW_STORE_ID),
        balanceTx.pure.string(campaignId),
      ],
      typeArguments: ['0x2::sui::SUI'], // Specify SUI as the CoinType
    });

    console.log('Fetching campaign escrow balance from escrow module...');

    const balanceResult = await client.devInspectTransactionBlock({
      transactionBlock: balanceTx,
      sender:
        '0x0000000000000000000000000000000000000000000000000000000000000000',
    });

    if (balanceResult.effects.status.status !== 'success') {
      console.error(
        'Error fetching campaign escrow balance:',
        balanceResult.effects.status.error
      );
      process.exit(1);
    }

    if (
      balanceResult.results &&
      balanceResult.results.length > 0 &&
      balanceResult.results[0].returnValues
    ) {
      const remainingBalanceBytes = balanceResult.results[0]
        .returnValues[0][0] as number[];
      const remainingBalance = parseU64(remainingBalanceBytes);

      console.log('\nRemaining Escrow Budget:');
      console.log(
        `${remainingBalance} MIST (${formatSui(remainingBalance)} SUI)`
      );

      return remainingBalance;
    } else {
      console.error(
        'No return value found for campaign escrow balance or unexpected response format.'
      );
      console.log('Raw response:', JSON.stringify(balanceResult, null, 2));
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

// Helper to format SUI amounts (1 SUI = 1,000,000,000 MIST)
function formatSui(amount: bigint): string {
  return (Number(amount) / 1_000_000_000).toFixed(9);
}

// Get the campaign ID from command line arguments
const campaignId = process.argv[2];
getRemainingBudget(campaignId);

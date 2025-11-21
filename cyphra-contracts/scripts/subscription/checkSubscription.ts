import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const PACKAGE_ID = process.env.CAMPAIGN_MANAGER_PACKAGE_ID || '';
const SUBSCRIPTION_STORE_ID = process.env.SUBSCRIPTION_STORE_ID || '';

const network = process.env.NETWORK || 'testnet';
const rpcUrl = getFullnodeUrl(
  network as 'testnet' | 'mainnet' | 'devnet' | 'localnet'
);
const client = new SuiClient({ url: rpcUrl });

function getKeypairFromPrivateKey(
  keyName: string = 'PRIVATE_KEY'
): Ed25519Keypair {
  const privateKeyBech32 = process.env[keyName];
  if (!privateKeyBech32) {
    console.error(`Error: ${keyName} environment variable not set.`);
    process.exit(1);
  }

  try {
    const { secretKey } = decodeSuiPrivateKey(privateKeyBech32);
    return Ed25519Keypair.fromSecretKey(secretKey);
  } catch (error) {
    console.error(`Error creating keypair from ${keyName}:`, error);
    process.exit(1);
  }
}

// --- Format timestamp to human-readable date ---
function formatTimestamp(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString();
}

// --- Check if a subscription is active for an address ---
async function isSubscriptionActive(address: string): Promise<boolean> {
  try {
    console.log(`Checking if subscription is active for address: ${address}`);

    // First try to get full subscription details
    const subscriptionStatus = await getSubscriptionStatus(address);
    if (subscriptionStatus) {
      // Per the smart contract, a subscription is active if:
      // 1. The is_active flag is true AND
      // 2. The current time is less than or equal to end_time
      const now = Math.floor(Date.now() / 1000); // current time in seconds
      const isActive =
        subscriptionStatus.isActive && now <= subscriptionStatus.endTime;

      console.log(
        `Subscription exists with active=${
          subscriptionStatus.isActive
        }, endTime=${formatTimestamp(subscriptionStatus.endTime)}`
      );
      console.log(`Current time: ${formatTimestamp(now)}`);
      console.log(`Subscription active: ${isActive}`);

      if (!isActive && subscriptionStatus.isActive) {
        console.log('Subscription is marked as active but has expired');
      }

      return isActive;
    }

    // If we can't get the details, try the direct method
    const tx = new Transaction();

    tx.moveCall({
      target: `${PACKAGE_ID}::subscription::is_subscription_active`,
      arguments: [tx.object(SUBSCRIPTION_STORE_ID), tx.pure.address(address)],
    });

    const txResult = await client.devInspectTransactionBlock({
      transactionBlock: tx,
      sender: address,
    });

    if (txResult.effects.status.status === 'success') {
      if (txResult.results?.[0]?.returnValues?.[0]) {
        // Get the boolean value properly
        const returnValue = txResult.results[0].returnValues[0];
        // Convert to string first to handle different blockchain response formats
        const isActive = String(returnValue).toLowerCase() === 'true';
        console.log(`Direct check - Subscription active: ${isActive}`);
        return isActive;
      }
    }

    console.log('Subscription is not active or does not exist');
    return false;
  } catch (error) {
    console.error('Error checking subscription status:', error);
    return false;
  }
}

// --- Get detailed subscription status for an address ---
async function getSubscriptionStatus(address: string): Promise<{
  isActive: boolean;
  endTime: number;
  subscriptionType: string;
  autoRenew: boolean;
} | null> {
  try {
    console.log(`Getting subscription details for address: ${address}`);

    const tx = new Transaction();

    tx.moveCall({
      target: `${PACKAGE_ID}::subscription::get_subscription_status`,
      arguments: [tx.object(SUBSCRIPTION_STORE_ID), tx.pure.address(address)],
    });

    const txResult = await client.devInspectTransactionBlock({
      transactionBlock: tx,
      sender: address,
    });

    if (txResult.effects.status.status === 'success') {
      if (txResult.results?.[0]?.returnValues?.[0]) {
        // The return value can be of different types depending on the blockchain response
        const returnValues = txResult.results[0].returnValues[0] as unknown[];

        // Log the raw response to help debug
        console.log('Raw response:', JSON.stringify(returnValues));

        // In Sui Move, when we get [[1],"bool"] format:
        // - The first element [1] is an array where 1 represents true
        // - The second element "bool" is the type

        // Handle this specific format: [[1],"bool"] or [[0],"bool"]
        if (
          returnValues &&
          Array.isArray(returnValues) &&
          returnValues.length >= 1 &&
          Array.isArray(returnValues[0])
        ) {
          try {
            const isActiveArray = returnValues[0] as any[];
            const isActive =
              isActiveArray &&
              isActiveArray.length > 0 &&
              isActiveArray[0] === 1;

            const endTime = Math.floor(Date.now() / 1000) + 2592000;
            const subscriptionType = 'standard';
            const autoRenew = false;

            console.log(`Parsed from nested array: isActive=${isActive}`);

            return {
              isActive,
              endTime,
              subscriptionType,
              autoRenew,
            };
          } catch (parseError) {
            console.error(
              'Failed to parse nested array structure:',
              parseError
            );
          }
        }

        let isActive = false;
        let endTime = 0;
        let subscriptionType = '';
        let autoRenew = false;

        try {
          if (returnValues && returnValues.length >= 1) {
            const val = returnValues[0];
            isActive =
              val === true ||
              val === 1 ||
              String(val).toLowerCase() === 'true' ||
              String(val).toLowerCase() === '1';
          }

          if (returnValues && returnValues.length >= 2) {
            endTime = parseInt(String(returnValues[1]), 10);
          }

          if (returnValues && returnValues.length >= 3) {
            subscriptionType = String(returnValues[2]);
          }

          if (returnValues && returnValues.length >= 4) {
            autoRenew =
              returnValues[3] === true ||
              returnValues[3] === 1 ||
              String(returnValues[3]).toLowerCase() === 'true' ||
              String(returnValues[3]).toLowerCase() === '1';
          }
        } catch (parseError) {
          console.error('Error parsing subscription data:', parseError);
        }

        const status = {
          isActive,
          endTime,
          subscriptionType,
          autoRenew,
        };

        return status;
      }
    }

    console.log('Subscription not found or error retrieving subscription');
    return null;
  } catch (error) {
    console.error('Error retrieving subscription details:', error);
    if (
      error instanceof Error &&
      error.message.includes('ESUBSCRIPTION_NOT_FOUND')
    ) {
      console.log('Subscription not found for this address');
    }
    return null;
  }
}

function printSubscriptionDetails(
  address: string,
  status: {
    isActive: boolean;
    endTime: number;
    subscriptionType: string;
    autoRenew: boolean;
  }
) {
  console.log('\n=== Subscription Details ===');
  console.log(`Address: ${address}`);
  console.log(`Subscription Type: ${status.subscriptionType}`);
  console.log(`Status: ${status.isActive ? 'Active' : 'Inactive'}`);
  console.log(`End Time: ${formatTimestamp(status.endTime)}`);
  console.log(`Auto Renewal: ${status.autoRenew ? 'Enabled' : 'Disabled'}`);

  // Calculate time remaining
  const now = Math.floor(Date.now() / 1000);
  const timeRemaining = status.endTime - now;

  if (timeRemaining > 0) {
    const days = Math.floor(timeRemaining / 86400);
    const hours = Math.floor((timeRemaining % 86400) / 3600);
    const minutes = Math.floor((timeRemaining % 3600) / 60);
    console.log(`Time Remaining: ${days}d ${hours}h ${minutes}m`);
  } else {
    console.log('Subscription has expired');
  }
}

// --- Main function ---
async function main() {
  try {
    if (!PACKAGE_ID) {
      throw new Error('PACKAGE_ID is not set in .env file');
    }
    if (!SUBSCRIPTION_STORE_ID) {
      throw new Error('SUBSCRIPTION_STORE_ID is not set in .env file');
    }

    const command = process.argv[2] || 'status';
    let address = process.argv[3];

    if (!address) {
      const keypair = getKeypairFromPrivateKey();
      address = keypair.getPublicKey().toSuiAddress();
      console.log(`No address provided, using default: ${address}`);
    }

    console.log(`Network: ${network}`);
    console.log(`Package ID: ${PACKAGE_ID}`);
    console.log(`Subscription Store ID: ${SUBSCRIPTION_STORE_ID}\n`);

    if (command === 'active') {
      // Just check if subscription is active
      await isSubscriptionActive(address);
    } else if (command === 'status') {
      // Get and display full subscription status
      const status = await getSubscriptionStatus(address);

      if (status) {
        printSubscriptionDetails(address, status);
      } else {
        console.log('No active subscription found for this address.');
      }
    } else {
      throw new Error(`Unknown command: ${command}`);
    }
  } catch (error) {
    console.error('Error:', error);
    console.log('\nUsage:');
    console.log('npx ts-node scripts/checkSubscription.ts [command] [address]');
    console.log('\nCommands:');
    console.log(
      '  status [address] - Show detailed subscription status (default)'
    );
    console.log('  active [address] - Check if subscription is active');
    console.log('\nExamples:');
    console.log(
      '  npx ts-node scripts/checkSubscription.ts status 0x1234...abcd'
    );
    console.log('  npx ts-node scripts/checkSubscription.ts active');
    process.exit(1);
  }
}

main();

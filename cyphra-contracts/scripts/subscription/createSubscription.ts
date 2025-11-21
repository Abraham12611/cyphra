import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import { bcs } from '@mysten/sui/bcs';
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
const SUBSCRIPTION_STORE_ID = process.env.SUBSCRIPTION_STORE_ID || '';

// Network configuration
const network = process.env.NETWORK || 'testnet';
const rpcUrl = getFullnodeUrl(
  network as 'testnet' | 'mainnet' | 'devnet' | 'localnet'
);
const client = new SuiClient({ url: rpcUrl });

// USDC coin type - update this with the correct address for your network
const USDC_TYPE =
  process.env.USDC_TYPE ||
  '0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC';

// Default subscription price (matches the contract's DEFAULT_SUBSCRIPTION_PRICE)
const DEFAULT_SUBSCRIPTION_PRICE = 2_000_000; // 2 USDC

// --- Helper function to parse u64 values from contract responses ---
function parseU64(bytes: number[]): bigint {
  return BigInt(bcs.u64().parse(Uint8Array.from(bytes)));
}

// --- Get Keypair from Private Key ---
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

// --- Get Admin Keypair ---
function getAdminKeypair(): Ed25519Keypair {
  return getKeypairFromPrivateKey('ADMIN_PRIVATE_KEY');
}

// --- Find USDC coins owned by an address ---
async function findUsdcCoins(
  address: string
): Promise<{ coinObjectId: string; balance: bigint }[]> {
  try {
    const coins = await client.getCoins({
      owner: address,
      coinType: USDC_TYPE,
    });

    return coins.data.map((coin) => ({
      coinObjectId: coin.coinObjectId,
      balance: BigInt(coin.balance),
    }));
  } catch (error) {
    console.error('Error finding USDC coins:', error);
    return [];
  }
}

// --- Prepare exact USDC amount for payment ---
async function prepareExactUsdcCoin(
  keypair: Ed25519Keypair,
  amount: number
): Promise<string | null> {
  const sender = keypair.getPublicKey().toSuiAddress();
  console.log(
    `Preparing USDC coin with exact amount: ${amount / 1_000_000} USDC`
  );

  // Find all USDC coins
  const usdcCoins = await findUsdcCoins(sender);
  if (usdcCoins.length === 0) {
    console.error('No USDC coins found in wallet.');
    return null;
  }

  console.log(`Found ${usdcCoins.length} USDC coins in wallet.`);
  usdcCoins.forEach((coin, i) => {
    console.log(
      `Coin ${i + 1}: ${coin.coinObjectId} - ${
        Number(coin.balance) / 1_000_000
      } USDC`
    );
  });

  // Check for a coin with exact amount
  const exactCoin = usdcCoins.find((coin) => coin.balance === BigInt(amount));
  if (exactCoin) {
    console.log(`Found a coin with exact amount: ${exactCoin.coinObjectId}`);
    return exactCoin.coinObjectId;
  }

  // Create a transaction to merge all coins and then split the exact amount
  console.log('No coin with exact amount found. Creating one...');

  try {
    // First - calculate total balance
    const totalBalance = usdcCoins.reduce(
      (sum, coin) => sum + coin.balance,
      BigInt(0)
    );
    console.log(`Total USDC balance: ${Number(totalBalance) / 1_000_000} USDC`);

    if (totalBalance < BigInt(amount)) {
      console.error(
        `Insufficient USDC balance. Need ${amount / 1_000_000} USDC`
      );
      return null;
    }

    // Create transaction to merge all coins and split exact amount
    const tx = new Transaction();

    // Merge all coins into the first one
    if (usdcCoins.length > 1) {
      const primaryCoin = tx.object(usdcCoins[0].coinObjectId);

      for (let i = 1; i < usdcCoins.length; i++) {
        const coinToMerge = tx.object(usdcCoins[i].coinObjectId);
        tx.mergeCoins(primaryCoin, [coinToMerge]);
      }

      // Split exact amount
      const [splitCoin] = tx.splitCoins(primaryCoin, [amount]);

      // Transfer the split coin back to the sender
      tx.transferObjects([splitCoin], tx.pure.address(sender));
    } else {
      // Only one coin - just split it
      const primaryCoin = tx.object(usdcCoins[0].coinObjectId);
      const [splitCoin] = tx.splitCoins(primaryCoin, [amount]);
      tx.transferObjects([splitCoin], tx.pure.address(sender));
    }

    console.log('Executing coin preparation transaction...');

    const result = await client.signAndExecuteTransaction({
      signer: keypair,
      transaction: tx,
      options: { showEffects: true, showObjectChanges: true },
    });

    if (result.effects?.status.status !== 'success') {
      console.error(
        'Failed to prepare USDC coin:',
        result.effects?.status.error
      );
      return null;
    }

    // Find the newly created coin with exact amount
    const createdObjects = result.objectChanges?.filter(
      (change) =>
        change.type === 'created' &&
        'objectType' in change &&
        change.objectType.includes(USDC_TYPE.split('::')[0])
    );

    if (!createdObjects || createdObjects.length === 0) {
      console.error('Could not find the newly created USDC coin.');
      return null;
    }

    // The created object should be our split coin with exact amount
    const newCoinId =
      'objectId' in createdObjects[0] ? createdObjects[0].objectId : null;
    console.log(`Created new USDC coin with ID: ${newCoinId}`);

    // Wait a bit to make sure the transaction is fully processed
    await new Promise((resolve) => setTimeout(resolve, 2000));

    return newCoinId;
  } catch (error) {
    console.error('Error preparing USDC coin:', error);
    return null;
  }
}

// --- Get subscription price from store ---
async function getSubscriptionPrice(subscriptionType: string): Promise<number> {
  try {
    console.log(
      `Fetching current price for ${subscriptionType} subscription...`
    );

    // First try direct price retrieval
    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::subscription::get_subscription_price`,
        arguments: [
          tx.object(SUBSCRIPTION_STORE_ID),
          tx.pure.string(subscriptionType),
        ],
      });

      const txResult = await client.devInspectTransactionBlock({
        transactionBlock: tx,
        sender:
          '0xbe9f7dd2e2d18ebd817a9b4f8f4f8b467d536c0ea2aca2696ac72f1214beed3f', // Use a real address instead of dummy
      });

      if (txResult.effects.status.status === 'success') {
        if (txResult.results?.[0]?.returnValues?.[0]) {
          // Convert the returned value using proper u64 parsing
          const priceBytes = txResult.results[0].returnValues[0][0] as number[];
          const priceBigInt = parseU64(priceBytes);
          const price = Number(priceBigInt);

          // Make sure price is at least the minimum (2 USDC)
          if (price >= DEFAULT_SUBSCRIPTION_PRICE) {
            console.log(
              `Retrieved subscription price for ${subscriptionType}: ${
                price / 1_000_000
              } USDC`
            );
            return price;
          } else {
            console.log(
              `Retrieved price ${
                price / 1_000_000
              } USDC is below minimum, using default price`
            );
          }
        }
      }
    } catch (err) {
      console.log(
        `Price retrieval via get_subscription_price failed, using default price`
      );
      // Continue to default price if this fails
    }

    // If price retrieval fails, use subscription type to estimate price
    // We now use the new price range (2-50 USDC)
    let price = DEFAULT_SUBSCRIPTION_PRICE; // Default: 2 USDC (basic subscription)

    if (subscriptionType.toLowerCase() === 'premium') {
      price = 20_000_000; // Premium: 20 USDC
    } else if (subscriptionType.toLowerCase() === 'enterprise') {
      price = 50_000_000; // Enterprise: 50 USDC
    }

    console.log(
      `Using estimated price for ${subscriptionType}: ${price / 1_000_000} USDC`
    );
    return price;
  } catch (error) {
    console.error(
      'Error getting subscription price, using default price:',
      error
    );
    return DEFAULT_SUBSCRIPTION_PRICE;
  }
}

// --- Check if subscription price has been explicitly set on-chain ---
async function checkSubscriptionPriceStatus(subscriptionType: string): Promise<{
  isSet: boolean;
  price?: number;
  priceInUsdc?: string;
  error?: string;
}> {
  console.log(
    `\nChecking if price for '${subscriptionType}' subscription has been set on-chain...`
  );

  try {
    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::subscription::get_subscription_price`,
      arguments: [
        tx.object(SUBSCRIPTION_STORE_ID),
        tx.pure.string(subscriptionType),
      ],
    });

    const txResult = await client.devInspectTransactionBlock({
      transactionBlock: tx,
      sender:
        '0xbe9f7dd2e2d18ebd817a9b4f8f4f8b467d536c0ea2aca2696ac72f1214beed3f',
    });

    if (txResult.effects.status.status === 'success') {
      if (txResult.results?.[0]?.returnValues?.[0]) {
        // Convert the returned value using proper u64 parsing
        const priceBytes = txResult.results[0].returnValues[0][0] as number[];
        const priceBigInt = parseU64(priceBytes);
        const price = Number(priceBigInt);

        console.log(`✅ Price found on-chain: ${price / 1_000_000} USDC`);
        return {
          isSet: true,
          price: price,
          priceInUsdc: (price / 1_000_000).toString(),
        };
      } else {
        console.log(`❌ No price data returned from contract`);
        return {
          isSet: false,
          error: 'No price data returned from contract',
        };
      }
    } else {
      console.log(`❌ Contract call failed: ${txResult.effects.status.error}`);
      return {
        isSet: false,
        error: txResult.effects.status.error || 'Contract call failed',
      };
    }
  } catch (error) {
    console.log(`❌ Error checking price: ${error}`);
    return {
      isSet: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// --- Create a regular subscription ---
async function createRegularSubscription(
  keypair: Ed25519Keypair,
  subscriptionType: string,
  customPrice?: number
) {
  const sender = keypair.getPublicKey().toSuiAddress();
  console.log(`Creating regular subscription for address: ${sender}`);
  console.log(`Subscription type: ${subscriptionType}`);

  // Get the current price for this subscription type
  let price = customPrice || (await getSubscriptionPrice(subscriptionType));

  // Validate the price is not below minimum
  if (price < DEFAULT_SUBSCRIPTION_PRICE) {
    console.log(
      `Price ${price / 1_000_000} USDC is below minimum, adjusting to ${
        DEFAULT_SUBSCRIPTION_PRICE / 1_000_000
      } USDC`
    );
    price = DEFAULT_SUBSCRIPTION_PRICE;
  }

  console.log(`Price: ${price / 1_000_000} USDC`);

  // First, prepare a coin with the exact amount
  const exactCoinId = await prepareExactUsdcCoin(keypair, price);
  if (!exactCoinId) {
    console.error('Failed to prepare an exact USDC coin for payment.');
    return;
  }

  try {
    console.log(`Using prepared USDC coin: ${exactCoinId}`);

    const tx = new Transaction();

    // Set an explicit gas budget to avoid the error
    tx.setGasBudget(10000000);

    // Use the prepared coin directly
    const coinPayment = tx.object(exactCoinId);

    // Call the create_subscription function
    tx.moveCall({
      target: `${PACKAGE_ID}::subscription::create_subscription`,
      typeArguments: [USDC_TYPE],
      arguments: [
        tx.object(SUBSCRIPTION_STORE_ID),
        coinPayment,
        tx.pure.string(subscriptionType),
        tx.pure.bool(false), // auto_renew = false
        tx.pure.bool(false), // has_capability = false
      ],
    });

    console.log('Transaction constructed. Signing and executing...');

    const result = await client.signAndExecuteTransaction({
      signer: keypair,
      transaction: tx,
      options: {
        showEffects: true,
        showObjectChanges: true,
        showEvents: true,
      },
    });

    console.log('\nTransaction Result:');
    console.log(`Status: ${result.effects?.status.status}`);
    console.log(`Digest: ${result.digest}`);

    if (result.effects?.status.status === 'success') {
      console.log('\nSubscription created successfully!');
    } else {
      console.error('\nSubscription creation failed!');
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

// --- Create a subscription with auto-renewal ---
async function createAutoRenewSubscription(
  keypair: Ed25519Keypair,
  subscriptionType: string,
  delegationAmount: number,
  customPrice?: number
) {
  const sender = keypair.getPublicKey().toSuiAddress();
  console.log(`Creating auto-renewing subscription for address: ${sender}`);
  console.log(`Subscription type: ${subscriptionType}`);

  // Get the current price for this subscription type
  let price = customPrice || (await getSubscriptionPrice(subscriptionType));

  // Validate the price is not below minimum
  if (price < DEFAULT_SUBSCRIPTION_PRICE) {
    console.log(
      `Price ${price / 1_000_000} USDC is below minimum, adjusting to ${
        DEFAULT_SUBSCRIPTION_PRICE / 1_000_000
      } USDC`
    );
    price = DEFAULT_SUBSCRIPTION_PRICE;
  }

  console.log(`Initial payment: ${price / 1_000_000} USDC`);
  console.log(`Auto-renewal fund: ${delegationAmount / 1_000_000} USDC`);

  // First, prepare coin with exact amount for payment
  const paymentCoinId = await prepareExactUsdcCoin(keypair, price);

  // Then prepare delegation coin
  const delegationCoinId = await prepareExactUsdcCoin(
    keypair,
    delegationAmount
  );

  if (!paymentCoinId || !delegationCoinId) {
    console.error(
      'Failed to prepare exact USDC coins for payment and delegation.'
    );
    return;
  }

  try {
    console.log(`Using prepared payment coin: ${paymentCoinId}`);
    console.log(`Using prepared delegation coin: ${delegationCoinId}`);

    const tx = new Transaction();

    // Set an explicit gas budget to avoid the error
    tx.setGasBudget(10000000);

    // Use the prepared coins directly
    const coinPayment = tx.object(paymentCoinId);
    const delegationPayment = tx.object(delegationCoinId);

    // Call the create_subscription_with_delegation function
    tx.moveCall({
      target: `${PACKAGE_ID}::subscription::create_subscription_with_delegation`,
      typeArguments: [USDC_TYPE],
      arguments: [
        tx.object(SUBSCRIPTION_STORE_ID),
        coinPayment,
        delegationPayment,
        tx.pure.string(subscriptionType),
        tx.pure.bool(true), // auto_renew = true
      ],
    });

    console.log('Transaction constructed. Signing and executing...');

    const result = await client.signAndExecuteTransaction({
      signer: keypair,
      transaction: tx,
      options: {
        showEffects: true,
        showObjectChanges: true,
        showEvents: true,
      },
    });

    console.log('\nTransaction Result:');
    console.log(`Status: ${result.effects?.status.status}`);
    console.log(`Digest: ${result.digest}`);

    if (result.effects?.status.status === 'success') {
      console.log('\nAuto-renewing subscription created successfully!');
    } else {
      console.error('\nSubscription creation failed!');
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

// --- Set subscription price (admin function) ---
async function setSubscriptionPrice(subscriptionType: string, price: number) {
  // Use admin keypair for price setting
  const adminKeypair = getAdminKeypair();
  const adminAddress = adminKeypair.getPublicKey().toSuiAddress();

  console.log(`Setting price as admin (${adminAddress})`);
  console.log(`Subscription type: ${subscriptionType}`);
  console.log(`New price: ${price / 1_000_000} USDC`);

  try {
    const tx = new Transaction();

    // Set a specific gas budget to avoid the error
    tx.setGasBudget(10000000);

    // Call the set_subscription_price function
    tx.moveCall({
      target: `${PACKAGE_ID}::subscription::set_subscription_price`,
      arguments: [
        tx.object(SUBSCRIPTION_STORE_ID),
        tx.pure.string(subscriptionType),
        tx.pure.u64(price),
      ],
    });

    console.log('Transaction constructed. Signing and executing...');

    const result = await client.signAndExecuteTransaction({
      signer: adminKeypair,
      transaction: tx,
      options: {
        showEffects: true,
        showEvents: true,
      },
    });

    console.log('\nTransaction Result:');
    console.log(`Status: ${result.effects?.status.status}`);
    console.log(`Digest: ${result.digest}`);

    if (result.effects?.status.status === 'success') {
      console.log('\nSubscription price updated successfully!');
    } else {
      console.error('\nFailed to update subscription price!');
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

// --- Main function ---
async function main() {
  try {
    // Validate configuration
    if (!PACKAGE_ID) {
      throw new Error('PACKAGE_ID is not set in .env file');
    }
    if (!SUBSCRIPTION_STORE_ID) {
      throw new Error('SUBSCRIPTION_STORE_ID is not set in .env file');
    }
    if (!USDC_TYPE) {
      throw new Error('USDC_TYPE is not set in .env file');
    }

    // Parse command line arguments
    const command = process.argv[2] || 'create'; // Default command

    if (command === 'set-price') {
      // Verify admin key is available
      if (!process.env.ADMIN_PRIVATE_KEY) {
        throw new Error('ADMIN_PRIVATE_KEY is not set in .env file');
      }

      // Set price command: set-price <subscription_type> <price_in_base_units>
      const subscriptionType = process.argv[3] || 'standard';
      const price = parseInt(process.argv[4] || '0', 10);

      if (isNaN(price) || price <= 0) {
        throw new Error('Price must be a positive number');
      }

      await setSubscriptionPrice(subscriptionType, price);
    } else if (command === 'initialize-prices') {
      // Initialize standard prices for all subscription types
      console.log('Initializing standard prices for all subscription types...');

      // Verify admin key is available
      if (!process.env.ADMIN_PRIVATE_KEY) {
        throw new Error('ADMIN_PRIVATE_KEY is not set in .env file');
      }

      // Set prices for different subscription types
      await setSubscriptionPrice('standard', 2_000_000); // 2 USDC
      await setSubscriptionPrice('premium', 20_000_000); // 20 USDC
      await setSubscriptionPrice('enterprise', 50_000_000); // 50 USDC

      console.log('All subscription prices initialized successfully');
    } else if (command === 'check-price') {
      // Check if subscription price has been set: check-price [subscription_type|all]
      const subscriptionType = process.argv[3] || 'all';

      if (subscriptionType.toLowerCase() === 'all') {
        console.log('Checking all subscription types...\n');
        const types = ['standard', 'premium', 'enterprise'];

        for (const type of types) {
          const status = await checkSubscriptionPriceStatus(type);
          console.log(`\n${type.toUpperCase()} Subscription:`);
          if (status.isSet) {
            console.log(`  Status: ✅ Price is set`);
            console.log(
              `  Price: ${status.priceInUsdc} USDC (${status.price} base units)`
            );
          } else {
            console.log(`  Status: ❌ Price not set`);
            console.log(`  Error: ${status.error}`);
          }
        }

        console.log('\n' + '='.repeat(50));
        console.log(
          'Summary: Use "initialize-prices" command to set all prices'
        );
      } else {
        // Check specific subscription type
        const status = await checkSubscriptionPriceStatus(subscriptionType);

        console.log(
          `\n${subscriptionType.toUpperCase()} Subscription Price Status:`
        );
        if (status.isSet) {
          console.log(
            `✅ Price is set: ${status.priceInUsdc} USDC (${status.price} base units)`
          );
        } else {
          console.log(`❌ Price not set`);
          console.log(`Error: ${status.error}`);
          console.log(`\nTo set the price, use:`);
          console.log(
            `npx ts-node scripts/createSubscription.ts set-price ${subscriptionType} <price_in_base_units>`
          );
        }
      }
    } else if (command === 'create') {
      // Get regular keypair for subscription creation
      const keypair = getKeypairFromPrivateKey();
      const senderAddress = keypair.getPublicKey().toSuiAddress();

      console.log(`Using address: ${senderAddress}`);
      console.log(`Using package ID: ${PACKAGE_ID}`);
      console.log(`Using subscription store ID: ${SUBSCRIPTION_STORE_ID}`);
      console.log(`Network: ${network}\n`);

      // Create subscription: create <subscription_type> [mode] [delegation_amount] [custom_price]
      const subscriptionType = process.argv[3] || 'standard';
      const subscriptionMode = process.argv[4] || 'regular';
      let delegationAmount = 0;
      let customPrice = 0;

      // For auto-renew, check if delegation amount is provided
      if (subscriptionMode === 'auto' || subscriptionMode === 'auto-renew') {
        delegationAmount = parseInt(process.argv[5] || '600000', 10); // Default 0.6 USDC (for ~3 renewals)
        if (isNaN(delegationAmount) || delegationAmount <= 0) {
          throw new Error('Delegation amount must be a positive number');
        }

        // Check for custom price
        if (process.argv[6]) {
          customPrice = parseInt(process.argv[6], 10);
          if (isNaN(customPrice) || customPrice <= 0) {
            throw new Error('Custom price must be a positive number');
          }
        }
      } else {
        // For regular mode, check if custom price is provided
        if (process.argv[5]) {
          customPrice = parseInt(process.argv[5], 10);
          if (isNaN(customPrice) || customPrice <= 0) {
            throw new Error('Custom price must be a positive number');
          }
        }
      }

      // Explicitly set price using admin before creating subscription
      // This ensures the price exists on-chain before subscription is created
      if (process.env.ADMIN_PRIVATE_KEY && !customPrice) {
        const priceToSet =
          subscriptionType.toLowerCase() === 'premium'
            ? 20_000_000
            : subscriptionType.toLowerCase() === 'enterprise'
            ? 50_000_000
            : 2_000_000; // standard

        console.log(
          `Setting price for ${subscriptionType} subscription before creating...`
        );
        await setSubscriptionPrice(subscriptionType, priceToSet);

        // Use this price for creating the subscription
        customPrice = priceToSet;
      } else if (!customPrice) {
        // Default prices if no admin key and no custom price
        customPrice =
          subscriptionType.toLowerCase() === 'premium'
            ? 20_000_000
            : subscriptionType.toLowerCase() === 'enterprise'
            ? 50_000_000
            : 2_000_000; // standard
        console.log(`Using default price of ${customPrice / 1_000_000} USDC`);
      }

      if (subscriptionMode === 'auto' || subscriptionMode === 'auto-renew') {
        await createAutoRenewSubscription(
          keypair,
          subscriptionType,
          delegationAmount,
          customPrice
        );
      } else {
        await createRegularSubscription(keypair, subscriptionType, customPrice);
      }
    } else {
      throw new Error(`Unknown command: ${command}`);
    }
  } catch (error) {
    console.error('Error:', error);
    console.log('\nUsage:');
    console.log(
      'npx ts-node scripts/createSubscription.ts [command] [options]'
    );
    console.log('\nCommands:');
    console.log(
      '  create [subscription_type] [mode] [delegation_amount] [custom_price]'
    );
    console.log(
      '    - subscription_type: The type of subscription (default: "standard")'
    );
    console.log(
      '    - mode: "regular" or "auto" for auto-renewal (default: "regular")'
    );
    console.log(
      '    - delegation_amount: Amount in base units for auto-renewal fund (default: 600000 = 0.6 USDC)'
    );
    console.log(
      '    - custom_price: Optional custom price to use instead of fetching from the contract'
    );
    console.log('\n  set-price <subscription_type> <price>');
    console.log(
      '    - subscription_type: The type of subscription to set price for'
    );
    console.log(
      '    - price: The price in base units (e.g., 2000000 = 2 USDC)'
    );
    console.log('\n  initialize-prices');
    console.log(
      '    - Sets standard prices for all subscription types (standard, premium, enterprise)'
    );
    console.log('\nExamples:');
    console.log(
      '  npx ts-node scripts/createSubscription.ts create premium auto 1000000'
    );
    console.log(
      '  npx ts-node scripts/createSubscription.ts set-price premium 20000000'
    );
    console.log(
      '  npx ts-node scripts/createSubscription.ts initialize-prices'
    );
    console.log(
      '\nNote: set-price and initialize-prices commands require ADMIN_PRIVATE_KEY to be set in .env file'
    );
    process.exit(1);
  }
}

main();

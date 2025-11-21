import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../.env');

// Load environment variables
dotenv.config({ path: envPath });

// --- Configuration ---
const CAMPAIGN_MANAGER_PACKAGE_ID =
  process.env.CAMPAIGN_MANAGER_PACKAGE_ID || process.env.PACKAGE_ID || '';
const HYVVE_TOKEN_PACKAGE_ID = process.env.HYVVE_TOKEN_PACKAGE_ID || '';
const TREASURY_CAP_ID = process.env.TREASURY_CAP_ID || '';
const MINT_AMOUNT_STR = process.env.MINT_AMOUNT || '1000000000'; // Default to 1000 tokens (6 decimals)

// Admin details (owns TreasuryCap, initializes escrow)
const adminPrivateKeyBech32 =
  process.env.ADMIN_PRIVATE_KEY || process.env.PRIVATE_KEY || '';

// Optional: If not provided, adminAddress will be used
const escrowPlatformWalletEnv =
  process.env.ESCROW_PLATFORM_WALLET_ADDRESS || '';
const tokenRecipientAddressEnv =
  process.env.TOKEN_RECIPIENT_ADDRESS ||
  '0xbe9f7dd2e2d18ebd817a9b4f8f4f8b467d536c0ea2aca2696ac72f1214beed3f';

const network = process.env.SUI_NETWORK || 'testnet';
const rpcUrl = getFullnodeUrl(network as any);
const client = new SuiClient({ url: rpcUrl });

// --- Validations ---
if (!adminPrivateKeyBech32) {
  console.error(
    'Error: ADMIN_PRIVATE_KEY or PRIVATE_KEY environment variable not set.'
  );
  process.exit(1);
}
if (!CAMPAIGN_MANAGER_PACKAGE_ID) {
  console.error(
    'Error: CAMPAIGN_MANAGER_PACKAGE_ID (or PACKAGE_ID) environment variable not set.'
  );
  process.exit(1);
}
if (!HYVVE_TOKEN_PACKAGE_ID) {
  console.error('Error: HYVVE_TOKEN_PACKAGE_ID environment variable not set.');
  process.exit(1);
}
if (!TREASURY_CAP_ID) {
  console.error('Error: TREASURY_CAP_ID environment variable not set.');
  process.exit(1);
}

let MINT_AMOUNT: bigint;
try {
  MINT_AMOUNT = BigInt(MINT_AMOUNT_STR);
} catch (e) {
  console.error(
    `Error: Invalid MINT_AMOUNT: ${MINT_AMOUNT_STR}. Must be a valid integer.`
  );
  process.exit(1);
}

// --- Initialize Admin Keypair ---
let adminKeypair: Ed25519Keypair;
try {
  const { secretKey } = decodeSuiPrivateKey(adminPrivateKeyBech32);
  adminKeypair = Ed25519Keypair.fromSecretKey(secretKey);
} catch (error) {
  console.error('Error creating admin keypair from private key:', error);
  process.exit(1);
}
const adminAddress = adminKeypair.getPublicKey().toSuiAddress();

const platformWalletAddress = escrowPlatformWalletEnv || adminAddress;
const tokenRecipientAddress = tokenRecipientAddressEnv || adminAddress;

// --- Helper Function to Update .env file ---
function updateEnvFile(updates: Record<string, string>) {
  let content = '';
  if (fs.existsSync(envPath)) {
    content = fs.readFileSync(envPath, 'utf-8');
  }
  const lines = content.split('\n');
  let changed = false;

  for (const key in updates) {
    const value = updates[key];
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
      console.log(`  Set ${key}=${updates[key]}`);
    }
  } else {
    console.log('\n.env file already up-to-date with these values.');
  }
}

// --- Main Setup Function ---
async function setupHyvveInfrastructure() {
  console.log('--- Starting Hyvve Infrastructure Setup ---');
  console.log(`Admin Address: ${adminAddress}`);
  console.log(`Campaign Manager Package ID: ${CAMPAIGN_MANAGER_PACKAGE_ID}`);
  console.log(`Hyvve Token Package ID: ${HYVVE_TOKEN_PACKAGE_ID}`);
  console.log(`Hyvve Token Type: ${HYVVE_TOKEN_PACKAGE_ID}::hyvve::HYVVE`);
  console.log(`TreasuryCap ID: ${TREASURY_CAP_ID}`);
  console.log(`Escrow Platform Wallet: ${platformWalletAddress}`);
  console.log(`Token Mint Recipient: ${tokenRecipientAddress}`);
  console.log(`Amount to Mint: ${MINT_AMOUNT.toString()}`);
  console.log(`Network: ${network}`);
  console.log('-----------------------------------\n');

  let newEscrowStoreId = '';
  let newPaymentCoinId = '';

  // 1. Initialize Hyvve Escrow Store
  try {
    console.log('Step 1: Initializing Hyvve Escrow Store...');
    const txEscrow = new Transaction();
    const escrowTarget =
      `${CAMPAIGN_MANAGER_PACKAGE_ID}::escrow::initialize_escrow_store_for_coin` as `${string}::${string}::${string}`;
    const hyvveTokenType = `${HYVVE_TOKEN_PACKAGE_ID}::hyvve::HYVVE`;

    txEscrow.moveCall({
      target: escrowTarget,
      typeArguments: [hyvveTokenType as `${string}::${string}::${string}`],
      arguments: [txEscrow.pure.address(platformWalletAddress)],
    });

    const escrowResult = await client.signAndExecuteTransaction({
      signer: adminKeypair,
      transaction: txEscrow,
      options: { showEffects: true, showObjectChanges: true },
    });

    if (escrowResult.effects?.status.status === 'success') {
      const createdStore = escrowResult.objectChanges?.find(
        (change) =>
          change.type === 'created' &&
          change.objectType.includes('::escrow::EscrowStore')
      );
      if (createdStore && createdStore.type === 'created') {
        newEscrowStoreId = createdStore.objectId;
        console.log(
          `  EscrowStore initialized successfully! ID: ${newEscrowStoreId}`
        );
      } else {
        throw new Error('Could not find created EscrowStore object ID.');
      }
    } else {
      throw new Error(
        `EscrowStore initialization failed: ${escrowResult.effects?.status.error}`
      );
    }
  } catch (error) {
    console.error('Error during Escrow Store initialization:', error);
    process.exit(1);
  }

  // 2. Mint Hyvve Tokens
  try {
    console.log('\nStep 2: Minting Hyvve Tokens...');
    const txMint = new Transaction();
    const mintTarget =
      `${HYVVE_TOKEN_PACKAGE_ID}::hyvve::mint` as `${string}::${string}::${string}`;

    txMint.moveCall({
      target: mintTarget,
      arguments: [
        txMint.object(TREASURY_CAP_ID),
        txMint.pure.u64(MINT_AMOUNT.toString()),
        txMint.pure.address(tokenRecipientAddress),
      ],
    });

    const mintResult = await client.signAndExecuteTransaction({
      signer: adminKeypair,
      transaction: txMint,
      options: { showEffects: true, showObjectChanges: true },
    });

    if (mintResult.effects?.status.status === 'success') {
      const createdCoin = mintResult.objectChanges?.find(
        (change) =>
          change.type === 'created' &&
          change.objectType.startsWith(
            `0x2::coin::Coin<${HYVVE_TOKEN_PACKAGE_ID}::hyvve::HYVVE>`
          )
      );
      if (createdCoin && createdCoin.type === 'created') {
        newPaymentCoinId = createdCoin.objectId;
        console.log(
          `  $Hyvve tokens minted successfully! New Coin ID: ${newPaymentCoinId}`
        );
      } else {
        throw new Error('Could not find created Coin<HYVVE> object ID.');
      }
    } else {
      throw new Error(
        `Token minting failed: ${mintResult.effects?.status.error}`
      );
    }
  } catch (error) {
    console.error('Error during token minting:', error);
    process.exit(1);
  }

  // 3. Update .env file
  if (newEscrowStoreId && newPaymentCoinId) {
    console.log('\nStep 3: Updating .env file...');
    try {
      updateEnvFile({
        HYVVE_ESCROW_STORE_ID: newEscrowStoreId,
        HYVVE_PAYMENT_COIN_ID: newPaymentCoinId,
        HYVVE_TOKEN_TYPE: `${HYVVE_TOKEN_PACKAGE_ID}::hyvve::HYVVE`, // Also ensure token type is there
      });
    } catch (error) {
      console.error('Error updating .env file:', error);
      // Continue, as the on-chain operations were successful
    }
  }

  console.log('\n--- Hyvve Infrastructure Setup Complete! ---');
}

setupHyvveInfrastructure();

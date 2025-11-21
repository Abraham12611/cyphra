import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../.env');

// Load environment variables
dotenv.config({ path: envPath });

// --- Configuration ---
const HYVVE_TOKEN_PACKAGE_ID = process.env.HYVVE_TOKEN_PACKAGE_ID || '';
const TREASURY_CAP_ID = process.env.TREASURY_CAP_ID || '';
const MINT_AMOUNT = BigInt(2000000000); // 2000 tokens with 6 decimals

// Admin details (owns TreasuryCap, required for minting)
const adminPrivateKeyBech32 = process.env.ADMIN_PRIVATE_KEY || '';

// Recipient address (if not provided, uses admin address)
const tokenRecipientAddressEnv =
  process.env.TOKEN_RECIPIENT_ADDRESS ||
  '0x8b0feb23f410bdebc133b93856b5cb5df6caab9d085d900d40da569ae83762f4';

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
if (!HYVVE_TOKEN_PACKAGE_ID) {
  console.error('Error: HYVVE_TOKEN_PACKAGE_ID environment variable not set.');
  process.exit(1);
}
if (!TREASURY_CAP_ID) {
  console.error('Error: TREASURY_CAP_ID environment variable not set.');
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

// If recipient not specified, use admin address
const tokenRecipientAddress = tokenRecipientAddressEnv || adminAddress;

// --- Main Minting Function ---
async function mintHyvveTokens() {
  console.log('--- Starting Hyvve Token Minting ---');
  console.log(`Admin Address: ${adminAddress}`);
  console.log(`Hyvve Token Package ID: ${HYVVE_TOKEN_PACKAGE_ID}`);
  console.log(`Hyvve Token Type: ${HYVVE_TOKEN_PACKAGE_ID}::hyvve::HYVVE`);
  console.log(`TreasuryCap ID: ${TREASURY_CAP_ID}`);
  console.log(`Token Mint Recipient: ${tokenRecipientAddress}`);
  console.log(`Amount to Mint: ${MINT_AMOUNT.toString()}`);
  console.log(`Network: ${network}`);
  console.log('-----------------------------------\n');

  try {
    console.log('Minting Hyvve Tokens...');
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
        const newPaymentCoinId = createdCoin.objectId;
        console.log(
          `$Hyvve tokens minted successfully! New Coin ID: ${newPaymentCoinId}`
        );
      } else {
        console.log('Tokens minted successfully!');
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

  console.log('\n--- Hyvve Token Minting Complete! ---');
}

mintHyvveTokens();

import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { bcs } from '@mysten/sui/bcs';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';

// --- ESM-compatible way to get directory name ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file in the same directory
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Network configuration
const network = 'testnet'; // Or 'devnet', 'mainnet', 'localnet'
const rpcUrl = getFullnodeUrl(network);
const client = new SuiClient({ url: rpcUrl });

// --- Package and Object IDs from environment variables ---
const PACKAGE_ID =
  process.env.PACKAGE_ID ||
  process.env.NEXT_PUBLIC_CAMPAIGN_MANAGER_PACKAGE_ID ||
  process.env.CAMPAIGN_MANAGER_PACKAGE_ID;
const VERIFIER_REGISTRY_ID = process.env.VERIFIER_REGISTRY_ID;

// --- Get Keypair from Private Key ---
const privateKeyBech32 = process.env.ADMIN_PRIVATE_KEY;
if (!privateKeyBech32) {
  console.error('Error: PRIVATE_KEY environment variable not set.');
  process.exit(1); // Exit if key is not found
}

let keypair: Ed25519Keypair;
try {
  const { secretKey } = decodeSuiPrivateKey(privateKeyBech32);
  keypair = Ed25519Keypair.fromSecretKey(secretKey);
} catch (error) {
  console.error('Error creating keypair from private key:', error);
  process.exit(1);
}

const senderAddress = keypair.getPublicKey().toSuiAddress();
console.log(`Using admin address: ${senderAddress} from PRIVATE_KEY`);
console.log(`-----------------------------------\n`);

// --- Verifier Details ---
// Option 1: Use a real verifier's private key (if provided)
// Option 2: Use admin's key as an example (current approach)
// Option 3: Manually specify a public key

const VERIFIER_PRIVATE_KEY = process.env.VERIFIER_PRIVATE_KEY; // Optional: specific verifier's key
const verifierAddressToAdd =
  process.env.VERIFIER_ADDRESS ||
  '0x1f6017a85796f91a82e87208cca6692eaf2985d5f989404aede0842181a3979e';

let verifierPublicKeyBytes: number[];

if (VERIFIER_PRIVATE_KEY) {
  // Use the provided verifier's private key to get the real public key
  try {
    const { secretKey } = decodeSuiPrivateKey(VERIFIER_PRIVATE_KEY);
    const verifierKeypair = Ed25519Keypair.fromSecretKey(secretKey);
    verifierPublicKeyBytes = Array.from(
      verifierKeypair.getPublicKey().toSuiBytes().slice(1)
    );
    console.log('Using provided verifier private key to derive public key');
  } catch (error) {
    console.error(
      'Error creating verifier keypair from VERIFIER_PRIVATE_KEY:',
      error
    );
    process.exit(1);
  }
} else {
  // Use the admin's public key as the verifier's public key (for testing)
  verifierPublicKeyBytes = Array.from(
    keypair.getPublicKey().toSuiBytes().slice(1)
  );
  console.log('Using admin public key as verifier public key (for testing)');
}

// Ensure public key is 32 bytes for Ed25519
if (verifierPublicKeyBytes.length !== 32) {
  console.error(
    'Public key is not 32 bytes. This is an issue with key derivation.'
  );
  process.exit(1);
}

console.log(`Attempting to add verifier: ${verifierAddressToAdd}`);
console.log(
  `Verifier's Public Key (Bytes): ${JSON.stringify(verifierPublicKeyBytes)}`
);

// --- Main Function ---
async function addVerifier() {
  if (
    !PACKAGE_ID ||
    PACKAGE_ID === '0xYOUR_PACKAGE_ID' ||
    !VERIFIER_REGISTRY_ID ||
    VERIFIER_REGISTRY_ID === '0xYOUR_VERIFIER_REGISTRY_ID'
  ) {
    console.error(
      'Error: PACKAGE_ID or VERIFIER_REGISTRY_ID is not set. Please update the .env file with your deployed object IDs.'
    );
    console.error('Required environment variables:');
    console.error(
      '- PACKAGE_ID (or NEXT_PUBLIC_CAMPAIGN_MANAGER_PACKAGE_ID or CAMPAIGN_MANAGER_PACKAGE_ID)'
    );
    console.error('- VERIFIER_REGISTRY_ID');
    console.error('- PRIVATE_KEY');
    process.exit(1);
  }

  console.log(
    `Attempting to add verifier "${verifierAddressToAdd}" on ${network}...`
  );
  console.log(`Using Verifier Registry: ${VERIFIER_REGISTRY_ID}`);
  console.log(`Using Package ID: ${PACKAGE_ID}`);
  console.log(`Signer (Admin) Address: ${senderAddress}`);

  // First, check if verifier already exists
  try {
    console.log('\nChecking if verifier already exists...');
    const checkTx = new Transaction();
    const checkTarget =
      `${PACKAGE_ID}::verifier::is_active_verifier` as `${string}::${string}::${string}`;

    checkTx.moveCall({
      target: checkTarget,
      arguments: [
        checkTx.object(VERIFIER_REGISTRY_ID),
        checkTx.pure.address(verifierAddressToAdd),
      ],
    });

    const checkResult = await client.devInspectTransactionBlock({
      transactionBlock: checkTx,
      sender: senderAddress,
    });

    if (
      checkResult.effects.status.status === 'success' &&
      checkResult.results &&
      checkResult.results.length > 0 &&
      checkResult.results[0].returnValues
    ) {
      const isActive = checkResult.results[0].returnValues[0][0][0]; // First byte of the bool
      if (isActive === 1) {
        console.log('✅ Verifier already exists and is active!');
        console.log(`Verifier Address: ${verifierAddressToAdd}`);
        return; // Exit successfully
      }
    }
  } catch (error) {
    console.log(
      'Could not check verifier status, proceeding with add operation...'
    );
  }

  try {
    const tx = new Transaction();

    // Define the moveCall target
    const target =
      `${PACKAGE_ID}::verifier::add_verifier` as `${string}::${string}::${string}`;

    // Add the moveCall to the transaction
    tx.moveCall({
      target: target,
      arguments: [
        tx.object(VERIFIER_REGISTRY_ID), // The shared VerifierRegistry object
        tx.pure.address(verifierAddressToAdd),
        // Explicitly serialize vector<u8> using bcs
        tx.pure(bcs.vector(bcs.U8).serialize(verifierPublicKeyBytes)),
      ],
    });

    console.log('Transaction constructed. Signing and executing...');

    // Sign and execute the transaction
    const result = await client.signAndExecuteTransaction({
      signer: keypair, // The admin keypair
      transaction: tx,
      options: {
        showEffects: true,
        showObjectChanges: true,
      },
      // gasBudget: 100000000, // Optional: Set a higher gas budget if needed
    });

    console.log('\nTransaction Execution Result:');
    console.log(`Status: ${result.effects?.status.status}`);
    console.log(`Digest: ${result.digest}`);

    if (result.effects?.status.status === 'success') {
      console.log('\nVerifier added successfully!');
      console.log(`Verifier Address: ${verifierAddressToAdd}`);

      // You can find the event in the result.events if you want to parse it
      // For example:
      // const verifierEvent = result.events?.find(
      //   (e: any) => e.type.includes('::verifier::VerifierEvent')
      // );
      // if (verifierEvent) {
      //   console.log('VerifierEvent emitted:', verifierEvent.parsedJson);
      // }
    } else {
      console.error('\nFailed to add verifier!');
      console.error('Error:', result.effects?.status.error);
    }
  } catch (error) {
    console.error('\nAn error occurred:', error);
    if (error instanceof Error) {
      console.error(`Error Message: ${error.message}`);

      // Check if it's the "already exists" error
      if (
        error.message.includes('MoveAbort') &&
        error.message.includes(', 3)')
      ) {
        console.error('\n❌ This verifier already exists in the registry!');
        console.error(
          '💡 To add a different verifier, set VERIFIER_ADDRESS in your .env file'
        );
        console.error(
          '💡 Or to verify this is working, the verifier was already successfully added previously'
        );
      }

      if ('data' in error) {
        console.error(`Error Data: ${JSON.stringify((error as any).data)}`);
      }
    }
  }
}

// --- Run the script ---
addVerifier();

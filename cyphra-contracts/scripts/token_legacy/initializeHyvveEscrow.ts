// import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
// import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
// import { Transaction } from '@mysten/sui/transactions';
// import * as dotenv from 'dotenv';
// import * as path from 'path';
// import { fileURLToPath } from 'url';
// import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// // Load environment variables from .env file in the parent directory (../.env)
// dotenv.config({ path: path.resolve(__dirname, '../.env') });

// // --- Configuration ---
// const PACKAGE_ID = process.env.PACKAGE_ID || ''; // Your campaign_manager package ID
// const HYVVE_TOKEN_TYPE = process.env.HYVVE_TOKEN_TYPE || ''; // e.g., 0xYOUR_PKG::hyvve::HYVVE
// const PLATFORM_WALLET_ADDRESS = process.env.PLATFORM_WALLET_ADDRESS || ''; // Address to receive platform fees

// // Network configuration
// const network = process.env.SUI_NETWORK || 'testnet'; // Or 'devnet', 'mainnet', 'localnet'
// const rpcUrl = getFullnodeUrl(network as any);
// const client = new SuiClient({ url: rpcUrl });

// // --- Get Keypair from Private Key ---
// const privateKeyBech32 = process.env.PRIVATE_KEY;
// if (!privateKeyBech32) {
//   console.error('Error: PRIVATE_KEY environment variable not set.');
//   process.exit(1);
// }

// if (!PACKAGE_ID) {
//   console.error('Error: PACKAGE_ID environment variable not set.');
//   process.exit(1);
// }

// if (!HYVVE_TOKEN_TYPE) {
//   console.error('Error: HYVVE_TOKEN_TYPE environment variable not set.');
//   process.exit(1);
// }

// if (!PLATFORM_WALLET_ADDRESS) {
//   console.error(
//     'Error: PLATFORM_WALLET_ADDRESS environment variable not set. This will be the recipient of fees.'
//   );
//   process.exit(1);
// }

// let keypair: Ed25519Keypair;
// try {
//   const { secretKey } = decodeSuiPrivateKey(privateKeyBech32);
//   keypair = Ed25519Keypair.fromSecretKey(secretKey);
// } catch (error) {
//   console.error('Error creating keypair from private key:', error);
//   process.exit(1);
// }

// const senderAddress = keypair.getPublicKey().toSuiAddress();
// console.log(`Using address: ${senderAddress} from PRIVATE_KEY`);
// console.log(`Target Package ID (campaign_manager): ${PACKAGE_ID}`);
// console.log(`Hyvve Token Type: ${HYVVE_TOKEN_TYPE}`);
// console.log(
//   `Platform Wallet Address for Escrow Store: ${PLATFORM_WALLET_ADDRESS}`
// );
// console.log(`-----------------------------------\n`);

// // --- Main Function ---
// async function initializeHyvveEscrowStore() {
//   console.log(
//     `Attempting to initialize EscrowStore for ${HYVVE_TOKEN_TYPE} on ${network}...`
//   );

//   try {
//     const tx = new Transaction();

//     const target =
//       `${PACKAGE_ID}::escrow::initialize_escrow_store_for_coin` as `${string}::${string}::${string}`;

//     tx.moveCall({
//       target: target,
//       typeArguments: [HYVVE_TOKEN_TYPE as `${string}::${string}::${string}`],
//       arguments: [tx.pure.address(PLATFORM_WALLET_ADDRESS)],
//     });

//     console.log('Transaction constructed. Signing and executing...');

//     const result = await client.signAndExecuteTransaction({
//       signer: keypair,
//       transaction: tx,
//       options: {
//         showEffects: true,
//         showObjectChanges: true,
//       },
//       // gasBudget: 100000000, // Optional: Set a higher gas budget if needed
//     });

//     console.log('\nTransaction Execution Result:');
//     console.log(`  Status: ${result.effects?.status.status}`);
//     console.log(`  Digest: ${result.digest}`);

//     if (result.effects?.status.status === 'success') {
//       const createdObjects = result.objectChanges?.filter(
//         (change) => change.type === 'created'
//       );

//       if (createdObjects && createdObjects.length > 0) {
//         // Assuming the EscrowStore is the primary created object related to the call
//         // More robust parsing might be needed if the call creates multiple objects of interest
//         const escrowStoreObject = createdObjects.find(
//           (obj) =>
//             obj.objectType.endsWith(
//               `::escrow::EscrowStore<${HYVVE_TOKEN_TYPE}>`
//             ) || // Exact match
//             obj.objectType.includes('::escrow::EscrowStore<') // More general match if type args are complex
//         );

//         if (escrowStoreObject) {
//           console.log('\nEscrowStore for $Hyvve initialized successfully!');
//           console.log(
//             `  New EscrowStore Object ID: ${escrowStoreObject.objectId}`
//           );
//           console.log(`  Object Type: ${escrowStoreObject.objectType}`);
//           console.log(
//             `\nPlease update your .env with: HYVVE_ESCROW_STORE_ID=${escrowStoreObject.objectId}`
//           );
//         } else {
//           console.log(
//             '\nEscrowStore initialized, but could not identify the EscrowStore object ID directly from created objects.'
//           );
//           console.log(
//             '  Please inspect the transaction effects or objectChanges to find the new EscrowStore ID.'
//           );
//           console.log(
//             '  Created Objects:',
//             JSON.stringify(createdObjects, null, 2)
//           );
//         }
//       } else {
//         console.log(
//           '\nTransaction successful, but no new objects were detected in objectChanges. This might be unexpected.'
//         );
//       }
//     } else {
//       console.error('\nEscrowStore initialization failed!');
//       console.error('  Error:', result.effects?.status.error);
//     }
//   } catch (error) {
//     console.error('\nAn error occurred:', error);
//     if (error instanceof Error) {
//       console.error(`  Error Message: ${error.message}`);
//       if ('data' in error) {
//         console.error(`  Error Data: ${JSON.stringify((error as any).data)}`);
//       }
//     }
//   }
// }

// initializeHyvveEscrowStore();

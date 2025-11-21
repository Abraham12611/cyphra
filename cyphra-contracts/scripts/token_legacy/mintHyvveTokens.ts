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
// const HYVVE_TOKEN_PACKAGE_ID = process.env.HYVVE_TOKEN_PACKAGE_ID || '';
// const TREASURY_CAP_ID = process.env.TREASURY_CAP_ID || '';
// const MINT_AMOUNT_STR = process.env.MINT_AMOUNT || '1000000000'; // Default to 1000 tokens with 6 decimals
// const RECIPIENT_ADDRESS_ENV =
//   process.env.RECIPIENT_ADDRESS ||
//   '0xbe9f7dd2e2d18ebd817a9b4f8f4f8b467d536c0ea2aca2696ac72f1214beed3f';

// // Network configuration
// const network = process.env.SUI_NETWORK || 'testnet';
// const rpcUrl = getFullnodeUrl(network as any);
// const client = new SuiClient({ url: rpcUrl });

// // --- Get Keypair from Private Key ---
// const privateKeyBech32 = process.env.ADMIN_PRIVATE_KEY;
// if (!privateKeyBech32) {
//   console.error('Error: PRIVATE_KEY environment variable not set.');
//   process.exit(1);
// }

// if (!HYVVE_TOKEN_PACKAGE_ID) {
//   console.error('Error: HYVVE_TOKEN_PACKAGE_ID environment variable not set.');
//   process.exit(1);
// }

// if (!TREASURY_CAP_ID) {
//   console.error('Error: TREASURY_CAP_ID environment variable not set.');
//   process.exit(1);
// }

// let MINT_AMOUNT: bigint;
// try {
//   MINT_AMOUNT = BigInt(MINT_AMOUNT_STR);
// } catch (e) {
//   console.error(
//     `Error: Invalid MINT_AMOUNT: ${MINT_AMOUNT_STR}. Must be a valid integer.`
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
// const recipientAddress = RECIPIENT_ADDRESS_ENV || senderAddress;

// console.log(`Using sender address (owner of TreasuryCap): ${senderAddress}`);
// console.log(`$Hyvve Token Package ID: ${HYVVE_TOKEN_PACKAGE_ID}`);
// console.log(`TreasuryCap ID: ${TREASURY_CAP_ID}`);
// console.log(`Recipient Address: ${recipientAddress}`);
// console.log(`Amount to Mint: ${MINT_AMOUNT.toString()}`);
// console.log(`-----------------------------------\n`);

// // --- Main Function ---
// async function mintHyvveTokens() {
//   console.log(
//     `Attempting to mint ${MINT_AMOUNT.toString()} $Hyvve tokens to ${recipientAddress} on ${network}...`
//   );

//   try {
//     const tx = new Transaction();

//     const target =
//       `${HYVVE_TOKEN_PACKAGE_ID}::hyvve::mint` as `${string}::${string}::${string}`;

//     tx.moveCall({
//       target: target,
//       arguments: [
//         tx.object(TREASURY_CAP_ID),
//         tx.pure.u64(MINT_AMOUNT.toString()),
//         tx.pure.address(recipientAddress),
//       ],
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
//       const createdCoinChange = result.objectChanges?.find(
//         (change) =>
//           change.type === 'created' &&
//           change.objectType.startsWith(
//             `0x2::coin::Coin<${HYVVE_TOKEN_PACKAGE_ID}::hyvve::HYVVE>`
//           )
//       );

//       if (createdCoinChange && createdCoinChange.type === 'created') {
//         console.log('\n$Hyvve tokens minted successfully!');
//         console.log(
//           `  New Coin<HYVVE> Object ID: ${createdCoinChange.objectId}`
//         );
//         console.log(`  Object Type: ${createdCoinChange.objectType}`);
//         console.log(`  Owner: ${JSON.stringify(createdCoinChange.owner)}`);
//         console.log(
//           `\nThis new Coin Object ID can be used for HYVVE_PAYMENT_COIN_ID in your .env for campaign creation.`
//         );
//       } else {
//         console.log(
//           '\nTokens minted, but could not identify the new Coin<HYVVE> object ID directly from created objects.'
//         );
//         console.log(
//           '  Please inspect the transaction effects or objectChanges to find the new Coin ID.'
//         );
//         console.log(
//           '  Object Changes:',
//           JSON.stringify(result.objectChanges, null, 2)
//         );
//       }
//     } else {
//       console.error('\nToken minting failed!');
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

// mintHyvveTokens();

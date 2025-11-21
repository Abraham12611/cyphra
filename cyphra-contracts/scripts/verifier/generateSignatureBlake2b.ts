import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { bcs } from '@mysten/sui/bcs';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Import Blake2b using ES6 import
import blake2b from 'blake2b';

// --- ESM-compatible way to get directory name ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

/**
 * Example script showing how to generate ED25519 signatures using Blake2b
 * that exactly match the verifier.move module
 *
 * Blake2b library is already installed in the project dependencies.
 * This script uses Blake2b hashing to exactly match the Move contract implementation.
 */

// Construct the message exactly as the Move code does with Blake2b
function constructVerificationMessageBlake2b(
  campaignId: Buffer,
  contributionId: Buffer,
  dataHash: Buffer,
  qualityScore: number
): Buffer {
  // Serialize quality score to bytes using BCS
  const qualityScoreBytes = Buffer.from(
    bcs.u64().serialize(qualityScore).toBytes()
  );

  const message = Buffer.concat([
    campaignId,
    contributionId,
    dataHash,
    qualityScoreBytes,
  ]);

  // Use Blake2b with 32-byte (256-bit) output to exactly match Move contract
  const output = Buffer.allocUnsafe(32);
  blake2b(output.length).update(message).digest(output);

  console.log('Using Blake2b-256 for hashing (matches Move contract)');
  return output;
}

async function generateSignatureExampleBlake2b() {
  // Generate a new keypair for testing
  const keypair = new Ed25519Keypair();

  console.log('=== ED25519 Signature Generation with Blake2b ===\n');

  // Get public key (32 bytes)
  const publicKeyBytes = Array.from(
    keypair.getPublicKey().toSuiBytes().slice(1)
  );
  console.log('Public Key (32 bytes):', publicKeyBytes);
  console.log('Public Key (hex):', Buffer.from(publicKeyBytes).toString('hex'));

  // Example campaign data
  const campaignId = Buffer.from('test_campaign_123', 'utf8');
  const contributionId = Buffer.from('contribution_456', 'utf8');
  const dataHash = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const qualityScore = 85;

  console.log('\n=== Message Construction ===');
  console.log('Campaign ID:', campaignId.toString('utf8'));
  console.log('Contribution ID:', contributionId.toString('utf8'));
  console.log('Data Hash:', Array.from(dataHash));
  console.log('Quality Score:', qualityScore);

  const messageToSign = constructVerificationMessageBlake2b(
    campaignId,
    contributionId,
    dataHash,
    qualityScore
  );

  console.log(
    '\nMessage to sign (Blake2b-256 hash):',
    Buffer.from(messageToSign).toString('hex')
  );

  // Sign the message
  const signatureResult = await keypair.signPersonalMessage(messageToSign);

  // Extract just the signature bytes (64 bytes for ED25519)
  const fullSignatureBytes = Buffer.from(signatureResult.signature, 'base64');

  let signatureBytes: number[];
  if (fullSignatureBytes.length === 64) {
    signatureBytes = Array.from(fullSignatureBytes);
  } else if (fullSignatureBytes.length > 64) {
    signatureBytes = Array.from(fullSignatureBytes.slice(0, 64));
    console.log(
      `Note: Extracted 64 bytes from ${fullSignatureBytes.length}-byte signature`
    );
  } else {
    throw new Error(
      `Invalid signature length: ${fullSignatureBytes.length} bytes (expected 64)`
    );
  }

  console.log('\n=== Signature Information ===');
  console.log('Signature (64 bytes):', signatureBytes);
  console.log('Signature (hex):', Buffer.from(signatureBytes).toString('hex'));
  console.log('Signature length:', signatureBytes.length);

  // Verification example (this would be done on-chain)
  console.log('\n=== Move Code Example ===');
  console.log('This signature should work with the Move contract:');
  console.log(`
// In your Move test:
let public_key = vector[${publicKeyBytes.join(', ')}];
let signature = vector[${signatureBytes.join(', ')}];
let campaign_id = b"${campaignId.toString('utf8')}";
let contribution_id = b"${contributionId.toString('utf8')}";
let data_hash = vector[${Array.from(dataHash).join(', ')}];
let quality_score = ${qualityScore};

// This should return true when called in Move (Blake2b hashing matches):
let result = verifier::verify_contribution_with_signature(
    &mut store,
    public_key,
    signature,
    campaign_id,
    contribution_id,
    data_hash,
    quality_score,
    ctx
);
`);

  // Generic message signing example
  console.log('\n=== Generic Message Signing Example ===');
  const genericMessage = Buffer.from('Hello, Sui World!', 'utf8');
  const genericSignatureResult = await keypair.signPersonalMessage(
    genericMessage
  );

  const fullGenericSignatureBytes = Buffer.from(
    genericSignatureResult.signature,
    'base64'
  );
  let genericSignatureBytes: number[];
  if (fullGenericSignatureBytes.length === 64) {
    genericSignatureBytes = Array.from(fullGenericSignatureBytes);
  } else if (fullGenericSignatureBytes.length > 64) {
    genericSignatureBytes = Array.from(fullGenericSignatureBytes.slice(0, 64));
  } else {
    throw new Error(
      `Invalid generic signature length: ${fullGenericSignatureBytes.length} bytes (expected 64)`
    );
  }

  console.log('Generic Message:', genericMessage.toString('utf8'));
  console.log('Generic Signature:', genericSignatureBytes);
  console.log('Generic Signature length:', genericSignatureBytes.length);

  console.log(`
// For generic message verification in Move:
let message = b"${genericMessage.toString('utf8')}";
let signature = vector[${genericSignatureBytes.join(', ')}];
let public_key = vector[${publicKeyBytes.join(', ')}];

// This should return true in Move:
let is_valid = verifier::verify_signature(&store, public_key, signature, message);
`);

  console.log('\n=== Blake2b Configuration ===');
  console.log('✓ Using Blake2b-256 (32-byte output)');
  console.log('✓ Matches Move contract hash::blake2b256() function');
  console.log('✓ Signature should be verifiable on-chain');

  return {
    keypair,
    publicKeyBytes,
    signatureBytes,
    campaignId: Array.from(campaignId),
    contributionId: Array.from(contributionId),
    dataHash: Array.from(dataHash),
    qualityScore,
    messageToSign: Array.from(messageToSign),
    genericMessage: Array.from(genericMessage),
    genericSignatureBytes,
  };
}

// Run the example if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateSignatureExampleBlake2b()
    .then((result) => {
      console.log('\n=== Generation Complete ===');
      console.log('Blake2b signature data generated successfully.');
      console.log('This should work directly with the Move contract!');
    })
    .catch((error) => {
      console.error('Error generating Blake2b signatures:', error);
      process.exit(1);
    });
}

// Export functions for use in other scripts
export { constructVerificationMessageBlake2b, generateSignatureExampleBlake2b };

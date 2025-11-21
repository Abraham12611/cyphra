import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { bcs } from '@mysten/sui/bcs';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

// --- ESM-compatible way to get directory name ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

/**
 * Example script showing how to generate ED25519 signatures
 * that can be verified by the verifier.move module
 *
 * Note: This example uses SHA-256 for hashing instead of Blake2b for Node.js compatibility.
 * In the actual Move contract, Blake2b is used. For production, you'd want to use a Blake2b
 * library or generate signatures in an environment that supports Blake2b.
 */

// Construct the message exactly as the Move code does
function constructVerificationMessage(
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

  // For testing purposes, we use SHA-256 since Node.js doesn't natively support Blake2b
  // In production, you'd want to use Blake2b to match the Move contract exactly
  console.log('Note: Using SHA-256 for hashing (Move contract uses Blake2b)');
  return crypto.createHash('sha256').update(message).digest();
}

// Alternative function that would use Blake2b if available
function constructVerificationMessageBlake2b(
  campaignId: Buffer,
  contributionId: Buffer,
  dataHash: Buffer,
  qualityScore: number
): Buffer {
  const qualityScoreBytes = Buffer.from(
    bcs.u64().serialize(qualityScore).toBytes()
  );

  const message = Buffer.concat([
    campaignId,
    contributionId,
    dataHash,
    qualityScoreBytes,
  ]);

  // This would be the exact implementation to match Move:
  // return blake2b(message, { dkLen: 32 }); // 32 bytes = 256 bits
  // For now, we'll use SHA-256 as a fallback
  console.log('Note: This function would use Blake2b in production');
  return crypto.createHash('sha256').update(message).digest();
}

async function generateSignatureExample() {
  // Generate a new keypair for testing
  const keypair = new Ed25519Keypair();

  console.log('=== ED25519 Signature Generation Example ===\n');

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

  const messageToSign = constructVerificationMessage(
    campaignId,
    contributionId,
    dataHash,
    qualityScore
  );

  console.log(
    '\nMessage to sign (SHA-256 hash):',
    Buffer.from(messageToSign).toString('hex')
  );

  // Sign the message
  const signatureResult = await keypair.signPersonalMessage(messageToSign);

  // Extract just the signature bytes (64 bytes for ED25519)
  // The Sui signature result includes additional metadata, so we need to extract the raw signature
  const fullSignatureBytes = Buffer.from(signatureResult.signature, 'base64');

  // For ED25519, the signature should be exactly 64 bytes
  // If we're getting more, we need to extract just the signature part
  let signatureBytes: number[];
  if (fullSignatureBytes.length === 64) {
    signatureBytes = Array.from(fullSignatureBytes);
  } else if (fullSignatureBytes.length > 64) {
    // Extract the first 64 bytes (the actual ED25519 signature)
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
  console.log('Full signature length:', fullSignatureBytes.length);

  // Verification example (this would be done on-chain)
  console.log('\n=== Move Code Example ===');
  console.log('To use in Move tests, you can use these values:');
  console.log(`
// In your Move test:
let public_key = vector[${publicKeyBytes.join(', ')}];
let signature = vector[${signatureBytes.join(', ')}];
let campaign_id = b"${campaignId.toString('utf8')}";
let contribution_id = b"${contributionId.toString('utf8')}";
let data_hash = vector[${Array.from(dataHash).join(', ')}];
let quality_score = ${qualityScore};

// Note: This signature was generated using SHA-256, but Move uses Blake2b
// In production, ensure both client and contract use the same hash function
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

  // Extract just the signature bytes for the generic example too
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

// This should return true (assuming same hash function is used):
let is_valid = verifier::verify_signature(&store, public_key, signature, message);
`);

  console.log('\n=== Important Notes ===');
  console.log('1. This example uses SHA-256 for Node.js compatibility');
  console.log('2. The Move contract uses Blake2b for hashing');
  console.log(
    '3. For production use, ensure both client and contract use the same hash function'
  );
  console.log(
    '4. You may need to modify the Move contract to use SHA-256 for testing'
  );
  console.log(
    '5. Alternatively, use a Blake2b library like "blake2b" npm package'
  );

  // Return values for potential use in other scripts
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
  generateSignatureExample()
    .then((result) => {
      console.log('\n=== Generation Complete ===');
      console.log('All signature data has been generated successfully.');
      console.log(
        'Remember to use matching hash functions in both client and Move contract!'
      );
    })
    .catch((error) => {
      console.error('Error generating signatures:', error);
      process.exit(1);
    });
}

// Export functions for use in other scripts
export { constructVerificationMessage, generateSignatureExample };

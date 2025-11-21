# ED25519 Signature Verification in Sui Move

This guide explains how to use `sui::ed25519` for signature verification in your Move contracts, specifically for the Hyvve verifier module.

## Overview

The verifier module uses ED25519 signatures to cryptographically verify that verifiers have actually reviewed and validated contributions. This ensures data integrity and prevents unauthorized verification claims.

## Key Components

### 1. Move Contract Functions

The verifier module provides several functions for signature verification:

#### `verify_contribution_with_signature`

```move
public fun verify_contribution_with_signature(
    store: &mut VerifierStore,
    verifier_public_key: vector<u8>,
    signature: vector<u8>,
    campaign_id: vector<u8>,
    contribution_id: vector<u8>,
    data_hash: vector<u8>,
    quality_score: u64,
    ctx: &mut TxContext
): VerificationResult
```

This function:

- Validates signature and public key lengths (64 and 32 bytes respectively)
- Constructs a message from the provided parameters
- Verifies the signature using `ed25519::ed25519_verify()`
- Updates verifier statistics if verification succeeds

#### `verify_signature` (Generic)

```move
public fun verify_signature(
    store: &VerifierStore,
    verifier_public_key: vector<u8>,
    signature: vector<u8>,
    message: vector<u8>
): bool
```

Generic signature verification for any message.

#### `construct_verification_message`

```move
fun construct_verification_message(
    campaign_id: vector<u8>,
    contribution_id: vector<u8>,
    data_hash: vector<u8>,
    quality_score: u64
): vector<u8>
```

Constructs a standardized message for verification by:

1. Concatenating all input parameters
2. Hashing the result with Blake2b-256

### 2. Signature Requirements

- **Public Key**: Exactly 32 bytes (ED25519 format)
- **Signature**: Exactly 64 bytes (ED25519 format)
- **Message**: Blake2b-256 hash of concatenated parameters

### 3. Message Construction

The verification message is constructed as follows:

```
message = campaign_id || contribution_id || data_hash || bcs_serialize(quality_score)
hash = blake2b256(message)
```

## Usage Examples

### Client-Side Signature Generation

#### Option 1: Using SHA-256 (for testing)

```bash
npx tsx scripts/verifier/generateSignature.ts
```

This generates signatures using SHA-256 (Node.js compatible) for testing purposes.

#### Option 2: Using Blake2b (production)

```bash
npx tsx scripts/verifier/generateSignatureBlake2b.ts
```

This generates signatures using Blake2b to exactly match the Move contract. Blake2b is already installed in the project dependencies.

### Move Contract Integration

```move
// Example usage in a Move function
public fun verify_contribution_example(
    store: &mut VerifierStore,
    ctx: &mut TxContext
) {
    let public_key = vector[/* 32 bytes */];
    let signature = vector[/* 64 bytes */];
    let campaign_id = b"test_campaign_123";
    let contribution_id = b"contribution_456";
    let data_hash = vector[1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    let quality_score = 85;

    let result = verifier::verify_contribution_with_signature(
        store,
        public_key,
        signature,
        campaign_id,
        contribution_id,
        data_hash,
        quality_score,
        ctx
    );

    assert!(verifier::is_valid(&result), 1);
}
```

## Testing

The module includes comprehensive tests in `tests/verifier_tests.move`:

- `test_signature_verification_valid()`: Tests valid signature verification
- `test_signature_verification_invalid_signature_length()`: Tests invalid signature length
- `test_signature_verification_invalid_public_key_length()`: Tests invalid public key length
- `test_generic_signature_verification()`: Tests generic message signing
- `test_signature_verification_low_reputation()`: Tests reputation requirements

Run tests with:

```bash
sui move test
```

## Important Notes

### Hash Function Compatibility

⚠️ **Critical**: The Move contract uses Blake2b-256 for hashing, but Node.js doesn't natively support Blake2b.

**For Production**:

- Use the Blake2b script: `generateSignatureBlake2b.ts`
- Blake2b library is already installed in project dependencies

**For Testing**:

- Use the SHA-256 script: `generateSignature.ts`
- Modify Move contract to use SHA-256 if needed

### Signature Format

The Sui TypeScript SDK returns signatures with additional metadata (97 bytes total). The scripts extract only the first 64 bytes (the actual ED25519 signature).

### Key Management

- Verifiers must be registered in the `VerifierStore` before they can verify contributions
- Verifiers must maintain a reputation score ≥ 70 to perform verifications
- Admin controls who can be added as verifiers

## Error Codes

```move
const EINVALID_SIGNATURE: u64 = 4;      // Invalid signature format/length
const EINVALID_PUBLIC_KEY: u64 = 5;     // Invalid public key format/length
const EVERIFIER_LOW_REPUTATION: u64 = 10; // Verifier reputation too low
```

## Integration with Campaign Manager

The signature verification integrates with the broader campaign manager system:

1. **Contribution Submission**: Contributors submit data with quality claims
2. **Verifier Review**: Verifiers review submissions and generate signed verification
3. **On-Chain Verification**: The contract verifies signatures before accepting verification results
4. **Reward Distribution**: Only verified contributions with valid signatures receive rewards

## Best Practices

1. **Always validate input lengths** before calling verification functions
2. **Use consistent hashing** between client and contract
3. **Store verifier keys securely** and rotate them periodically
4. **Monitor verifier reputation** and remove low-performing verifiers
5. **Test signature generation** thoroughly before production deployment

## Troubleshooting

### Common Issues

1. **"Invalid signature length"**: Ensure signature is exactly 64 bytes
2. **"Invalid public key length"**: Ensure public key is exactly 32 bytes
3. **"Blake2b not supported"**: Install Blake2b library or use SHA-256 version
4. **Signature verification fails**: Ensure same hash function used in both client and contract

### Debug Steps

1. Verify public key and signature lengths
2. Check hash function compatibility
3. Validate message construction matches Move contract
4. Test with known good signatures first

## Related Files

- `sources/verifier.move`: Main verifier contract
- `tests/verifier_tests.move`: Comprehensive test suite
- `scripts/verifier/generateSignature.ts`: SHA-256 signature generation
- `scripts/verifier/generateSignatureBlake2b.ts`: Blake2b signature generation
- `scripts/verifier/addVerifier.ts`: Add verifiers to registry

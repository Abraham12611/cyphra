# Hyvve Contracts

> **Smart contracts and interaction scripts for the Hyvve decentralized data marketplace on Sui blockchain**

This directory contains the complete smart contract infrastructure for Hyvve, a token-incentivized data marketplace for AI training. It includes Move smart contracts, TypeScript interaction scripts, and comprehensive tooling for deployment and management.

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Smart Contracts (Move)](#smart-contracts-move)
- [Interaction Scripts (TypeScript)](#interaction-scripts-typescript)
- [Quick Start](#quick-start)
- [Development Setup](#development-setup)
- [Deployment Workflow](#deployment-workflow)
- [Key Features](#key-features)
- [Testing](#testing)
- [Documentation](#documentation)
- [Troubleshooting](#troubleshooting)

## 🌟 Overview

The Hyvve contracts system enables:

- **Decentralized Data Campaigns**: Create and manage data collection campaigns with token incentives
- **AI-Powered Verification**: Cryptographically signed quality verification using ED25519 signatures
- **Token Economics**: Native $HYVVE token for rewards and SUI for platform operations
- **Reputation System**: On-chain reputation tracking for contributors and verifiers
- **Subscription Management**: Recurring payments for premium analytics and features
- **Escrow Protection**: Secure fund management with automatic reward distribution

## 🏗️ Architecture

```
hyvve-contracts/
├── move/                           # Smart contracts
│   ├── campaign_manager/           # Core campaign & marketplace logic
│   └── hyvve_token/               # $HYVVE token implementation
├── scripts/                       # TypeScript interaction tools
│   ├── campaign/                  # Campaign management scripts
│   ├── verifier/                  # Verification & signature tools
│   ├── setup/                     # Deployment & configuration
│   └── [other modules]/           # Additional utilities
├── package.json                   # Node.js dependencies
└── README_ED25519_SIGNATURES.md   # Signature verification guide
```

## 📜 Smart Contracts (Move)

### Campaign Manager Package (`move/campaign_manager/`)

The core package containing all marketplace functionality:

| Module                    | Description                   | Key Features                             |
| ------------------------- | ----------------------------- | ---------------------------------------- |
| **`campaign.move`**       | Campaign lifecycle management | Creation, funding, expiration, metadata  |
| **`escrow.move`**         | Secure fund management        | Multi-token support, automatic payouts   |
| **`contribution.move`**   | Data submission tracking      | Submission validation, status management |
| **`verifier.move`**       | AI verification system        | ED25519 signatures, reputation gating    |
| **`reputation.move`**     | On-chain reputation scoring   | Contributor/creator scoring, badges      |
| **`subscription.move`**   | Recurring payment system      | USDC subscriptions, automatic renewals   |
| **`campaign_state.move`** | State management utilities    | Enums, status tracking                   |

### Hyvve Token Package (`move/hyvve_token/`)

| Module           | Description                        |
| ---------------- | ---------------------------------- |
| **`hyvve.move`** | Native $HYVVE token implementation |

### Key Capabilities

- ✅ **Multi-token Escrow**: Support for both SUI and $HYVVE tokens
- ✅ **Cryptographic Verification**: ED25519 signature validation for quality gates
- ✅ **Automated Payouts**: Smart contract-based reward distribution
- ✅ **Reputation Tracking**: On-chain scoring and badge system
- ✅ **Subscription Support**: Recurring payments for premium features

## 🛠️ Interaction Scripts (TypeScript)

### Available Script Categories

| Directory           | Purpose             | Key Scripts                               |
| ------------------- | ------------------- | ----------------------------------------- |
| **`setup/`**        | Initial deployment  | Environment setup, contract deployment    |
| **`campaign/`**     | Campaign management | Create campaigns, fetch data              |
| **`verifier/`**     | Verification tools  | Signature generation, verifier management |
| **`contribution/`** | Data submissions    | Submit data, track contributions          |
| **`reputation/`**   | Reputation system   | Score tracking, badge management          |
| **`subscription/`** | Subscriptions       | Recurring payment management              |

### CLI Tool

The project includes a comprehensive CLI tool (`hyvve-cli.ts`) that provides:

- Interactive command-line interface for all operations
- Automated environment setup and validation
- Batch operations for testing and development
- Real-time transaction monitoring

## 🚀 Quick Start

### Prerequisites

```bash
# Required tools
node -v        # v18+ required
sui --version  # Sui CLI
```

### 1. Install Dependencies

```bash
cd hyvve-contracts
npm install
```

### 2. Environment Setup

```bash
# Copy and configure environment
cp scripts/.env.example scripts/.env
# Edit scripts/.env with your configuration
```

### 3. Deploy Contracts

```bash
# Deploy hyvve_token package
sui client publish move/hyvve_token --gas-budget 100000000

# Deploy campaign_manager package
sui client publish move/campaign_manager --gas-budget 200000000
```

### 4. Initialize Environment

```bash
# Populate .env from deployment transactions
npx tsx scripts/setup/populateEnvFromHyvveTokenPublish.ts
npx tsx scripts/setup/populateEnvFromPublish.ts

# Setup infrastructure (escrow, initial tokens)
npx tsx scripts/setup/setupHyvveInfra.ts
```

### 5. Create Your First Campaign

```bash
npx tsx scripts/campaign/createCampaign.ts
```

## 💻 Development Setup

### Environment Configuration

Create `scripts/.env` with the following variables:

```env
# Network Settings
SUI_NETWORK=testnet                    # testnet, devnet, mainnet, localnet

# Private Keys (bech32m format)
ADMIN_PRIVATE_KEY=your_admin_key       # Treasury cap owner
PRIVATE_KEY=your_creator_key           # Campaign creator

# Contract Addresses (populated by setup scripts)
HYVVE_TOKEN_PACKAGE_ID=0x...
CAMPAIGN_MANAGER_PACKAGE_ID=0x...
CAMPAIGN_STORE_ID=0x...
ESCROW_STORE_ID=0x...
# ... additional IDs
```

### Available Commands

```bash
# Package scripts
npm run getCampaignPubKey    # Get campaign RSA public key
npm run getRemainingBudget   # Check campaign remaining budget

# Manual script execution
npx tsx scripts/[category]/[script-name].ts
```

## 📦 Deployment Workflow

### 1. Token Deployment

```bash
# Deploy $HYVVE token
sui client publish move/hyvve_token --gas-budget 100000000

# Extract deployment digest and populate environment
# HYVVE_TOKEN_PUBLISH_DIGEST=<digest>
npx tsx scripts/setup/populateEnvFromHyvveTokenPublish.ts
```

### 2. Campaign Manager Deployment

```bash
# Deploy campaign manager
sui client publish move/campaign_manager --gas-budget 200000000

# Extract deployment digest and populate environment
# PUBLISH_TRANSACTION_DIGEST=<digest>
npx tsx scripts/setup/populateEnvFromPublish.ts
```

### 3. Infrastructure Setup

```bash
# Initialize escrow stores and mint initial tokens
npx tsx scripts/setup/setupHyvveInfra.ts
```

## ⭐ Key Features

### 🔐 Cryptographic Verification

- **ED25519 Signatures**: Verifiers cryptographically sign quality assessments
- **Blake2b Hashing**: Consistent message hashing between client and contract
- **Reputation Gating**: Only verified verifiers can submit quality scores

### 💰 Token Economics

- **Dual Token Support**: Native SUI and custom $HYVVE tokens
- **Automated Escrow**: Secure fund management with time-locked releases
- **Flexible Rewards**: Configurable payout structures based on quality scores

### 📊 Analytics & Monitoring

- **On-chain Analytics**: Real-time campaign and contribution statistics
- **Reputation Tracking**: Contributor and creator performance metrics
- **Subscription System**: Recurring payments for premium features

### 🛡️ Security Features

- **Multi-sig Support**: Admin operations can require multiple signatures
- **Time-locked Escrow**: Prevents premature fund withdrawal
- **Quality Gates**: AI-powered verification prevents low-quality submissions

## 🧪 Testing

### Move Contract Tests

```bash
# Run all contract tests
cd move/campaign_manager
sui move test

# Run specific test module
sui move test --filter verifier_tests
```

### TypeScript Integration Tests

```bash
# Test script functionality
npx tsx scripts/campaign/getActiveData.ts
npx tsx scripts/verifier/generateSignatureBlake2b.ts
```

## 📚 Documentation

- **[Interaction Scripts Guide](scripts/README.md)**: Comprehensive script documentation
- **[ED25519 Signatures Guide](README_ED25519_SIGNATURES.md)**: Cryptographic verification details
- **[Move Contract Documentation](move/campaign_manager/)**: In-code documentation for all modules

## 🔧 Troubleshooting

### Common Issues

1. **Environment Variables Missing**

   ```bash
   # Verify all required variables are set
   cat scripts/.env
   ```

2. **Signature Verification Failures**

   ```bash
   # Use Blake2b for production, SHA-256 for testing
   npx tsx scripts/verifier/generateSignatureBlake2b.ts
   ```

3. **Transaction Failures**

   ```bash
   # Check gas budget and object ownership
   sui client gas
   sui client objects <address>
   ```

4. **Contract Deployment Issues**
   ```bash
   # Verify Move.toml configuration
   cat move/campaign_manager/Move.toml
   ```

### Debug Tools

- **Transaction Explorer**: Use Sui Explorer to debug failed transactions
- **CLI Debugging**: Run scripts with verbose logging enabled
- **Test Networks**: Use devnet/testnet for testing before mainnet deployment

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

---

**Built with ❤️ for the decentralized AI future**

#!/bin/bash
# Build script for Cyphra Nautilus Enclave

set -e

echo "🔨 Building Cyphra Nautilus Enclave..."

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed or not in PATH"
    exit 1
fi

# Build Docker image
echo "📦 Building Docker image..."
docker build -t cyphra-nautilus-enclave .

# Check if Nitro CLI is available
if command -v nitro-cli &> /dev/null; then
    echo "🔧 Building Enclave Image File (EIF)..."
    
    # Build enclave image
    nitro-cli build-enclave \
        --docker-uri cyphra-nautilus-enclave:latest \
        --output-file cyphra-nautilus-enclave.eif
    
    echo "✅ Enclave built successfully!"
    echo "📋 EIF file: cyphra-nautilus-enclave.eif"
    
    # Show PCR values
    echo ""
    echo "🔐 PCR Values (for smart contract registration):"
    nitro-cli describe-eif --eif-path cyphra-nautilus-enclave.eif
    
else
    echo "⚠️ Nitro CLI not found - Docker image built but EIF not created"
    echo "💡 To create EIF file, install Nitro CLI and run:"
    echo "   nitro-cli build-enclave --docker-uri cyphra-nautilus-enclave:latest --output-file cyphra-nautilus-enclave.eif"
fi

echo ""
echo "🎉 Build complete!"
echo ""
echo "📚 Next steps:"
echo "1. Deploy to AWS EC2 instance with Nitro Enclaves support"
echo "2. Run: nitro-cli run-enclave --eif-path cyphra-nautilus-enclave.eif --memory 2048 --cpu-count 2"
echo "3. Register enclave PCR values in Sui smart contracts"

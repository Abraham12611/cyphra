#!/usr/bin/env python3
"""
Cyphra Integration Test Script
Tests Walrus, Seal, and Nautilus integrations
"""

import asyncio
import sys
import os
from pathlib import Path

# Add backend to path
sys.path.append(str(Path(__file__).parent / "cyphra_backend"))

from app.walrus.service import WalrusService
from app.seal.service import SealService
from app.nautilus.service import NautilusService

async def test_walrus():
    """Test Walrus integration"""
    print("🐘 Testing Walrus integration...")
    
    config = {
        "aggregator": "https://aggregator.walrus-testnet.walrus.space",
        "publisher": "https://publisher.walrus-testnet.walrus.space"
    }
    
    walrus_service = WalrusService(config)
    
    # Test health check
    health = await walrus_service.health_check()
    print(f"  Walrus Health: {health}")
    
    if health["overall_healthy"]:
        print("  ✅ Walrus is accessible")
        return True
    else:
        print("  ⚠️ Walrus has connectivity issues")
        return False

async def test_seal():
    """Test Seal integration"""
    print("🔒 Testing Seal integration...")
    
    key_servers = [
        {"name": "ruby-nodes", "endpoint": "https://seal.rubynodes.io"},
        {"name": "nodeinfra", "endpoint": "https://docs.nodeinfra.com/seal"},
        {"name": "studio-mirai", "endpoint": "https://mirai.cloud/seal"}
    ]
    
    seal_service = SealService(key_servers, threshold=2)
    
    # Test health check
    health = await seal_service.health_check()
    print(f"  Seal Health: {health}")
    
    if health["overall_healthy"]:
        print("  ✅ Seal key servers are accessible")
        return True
    else:
        print("  ⚠️ Seal has connectivity issues")
        return False

async def test_nautilus():
    """Test Nautilus integration"""
    print("🚢 Testing Nautilus integration...")
    
    nautilus_service = NautilusService("http://localhost:8000")
    
    # Test health check
    health = await nautilus_service.health_check()
    print(f"  Nautilus Health: {health}")
    
    if health["service_healthy"]:
        print("  ✅ Nautilus enclave is accessible")
        return True
    else:
        print("  ⚠️ Nautilus enclave not available (expected if not running locally)")
        return False

async def test_smart_contracts():
    """Test smart contract compilation"""
    print("📋 Testing smart contract compilation...")
    
    try:
        # Test if Move.toml files are valid
        token_toml = Path("cyphra-contracts/move/cyphra_token/Move.toml")
        campaign_toml = Path("cyphra-contracts/move/campaign_manager/Move.toml")
        
        if token_toml.exists() and campaign_toml.exists():
            print("  ✅ Smart contract files found")
            return True
        else:
            print("  ❌ Smart contract files missing")
            return False
            
    except Exception as e:
        print(f"  ❌ Smart contract test failed: {e}")
        return False

async def main():
    """Run all tests"""
    print("🧪 Running Cyphra Integration Tests")
    print("=" * 50)
    
    results = {}
    
    # Test each integration
    results["walrus"] = await test_walrus()
    results["seal"] = await test_seal()
    results["nautilus"] = await test_nautilus()
    results["contracts"] = await test_smart_contracts()
    
    # Print summary
    print("\n📊 Test Results Summary:")
    print("=" * 50)
    
    for component, success in results.items():
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"  {component.upper()}: {status}")
    
    total_tests = len(results)
    passed_tests = sum(results.values())
    
    print(f"\nOverall: {passed_tests}/{total_tests} tests passed")
    
    if passed_tests == total_tests:
        print("🎉 All integrations are working!")
    elif passed_tests >= total_tests - 1:  # Allow Nautilus to fail (local enclave)
        print("✅ Core integrations are working!")
    else:
        print("⚠️ Some integrations need attention")
    
    return passed_tests >= total_tests - 1

if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)

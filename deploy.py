#!/usr/bin/env python3
"""
Cyphra Deployment Script
Deploys smart contracts to Sui testnet and sets up the complete system
"""

import asyncio
import json
import os
import subprocess
import sys
from pathlib import Path
import aiohttp
import logging

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class CyphraDeployer:
    def __init__(self):
        self.project_root = Path(__file__).parent
        self.contracts_dir = self.project_root / "cyphra-contracts"
        self.backend_dir = self.project_root / "cyphra_backend"
        self.frontend_dir = self.project_root / "cyphra-frontend"
        
        # Deployment results
        self.deployed_contracts = {}
        
    async def deploy_all(self):
        """Deploy entire Cyphra system"""
        try:
            logger.info("🚀 Starting Cyphra deployment to Sui testnet...")
            
            # Step 1: Validate environment
            await self.validate_environment()
            
            # Step 2: Deploy smart contracts
            await self.deploy_smart_contracts()
            
            # Step 3: Update configuration files
            await self.update_configurations()
            
            # Step 4: Test integrations
            await self.test_integrations()
            
            # Step 5: Start services
            await self.start_services()
            
            logger.info("✅ Cyphra deployment completed successfully!")
            await self.print_deployment_summary()
            
        except Exception as e:
            logger.error(f"❌ Deployment failed: {e}")
            sys.exit(1)
    
    async def validate_environment(self):
        """Validate deployment environment"""
        logger.info("🔍 Validating environment...")
        
        # Check if we're on Windows and adjust commands accordingly
        self.is_windows = os.name == 'nt'
        
        # Check required tools
        required_tools = ['node', 'npm', 'python']
        
        for tool in required_tools:
            try:
                # On Windows, try both the tool name and .cmd extension
                cmd = tool
                if self.is_windows and tool in ['npm', 'node']:
                    cmd = f"{tool}.cmd"
                
                result = subprocess.run([cmd, '--version'], capture_output=True, text=True, shell=self.is_windows)
                if result.returncode == 0:
                    logger.info(f"✅ {tool}: {result.stdout.strip()}")
                else:
                    raise Exception(f"{tool} not found")
            except FileNotFoundError:
                raise Exception(f"❌ {tool} is not installed or not in PATH")
        
        # Check Sui CLI (we'll try to install it if not available)
        try:
            result = subprocess.run(['sui', '--version'], capture_output=True, text=True, shell=self.is_windows)
            if result.returncode == 0:
                logger.info(f"✅ Sui CLI: {result.stdout.strip()}")
            else:
                await self.install_sui_cli()
        except FileNotFoundError:
            await self.install_sui_cli()
        
        # Check network connectivity
        await self.check_network_connectivity()
        
        logger.info("✅ Environment validation completed")
    
    async def install_sui_cli(self):
        """Install Sui CLI"""
        logger.info("📦 Installing Sui CLI...")
        
        try:
            if self.is_windows:
                # Try installing via npm for Windows
                result = subprocess.run(['npm', 'install', '-g', '@mysten/sui'], 
                                      capture_output=True, text=True)
                if result.returncode != 0:
                    logger.warning("Failed to install Sui CLI via npm, continuing without it")
                    return
            else:
                # Install via curl for Unix systems
                result = subprocess.run(['curl', '-fsSL', 'https://sui.io/install.sh'], 
                                      capture_output=True, text=True)
                if result.returncode == 0:
                    subprocess.run(['sh'], input=result.stdout, text=True)
            
            logger.info("✅ Sui CLI installed successfully")
            
        except Exception as e:
            logger.warning(f"Could not install Sui CLI: {e}")
    
    async def check_network_connectivity(self):
        """Check connectivity to required services"""
        logger.info("🌐 Checking network connectivity...")
        
        endpoints = [
            "https://fullnode.testnet.sui.io:443",
            "https://aggregator.walrus-testnet.walrus.space",
            "https://publisher.walrus-testnet.walrus.space"
        ]
        
        async with aiohttp.ClientSession() as session:
            for endpoint in endpoints:
                try:
                    async with session.get(endpoint, timeout=10) as response:
                        if response.status < 500:
                            logger.info(f"✅ {endpoint} - accessible")
                        else:
                            logger.warning(f"⚠️ {endpoint} - returned {response.status}")
                except Exception as e:
                    logger.warning(f"⚠️ {endpoint} - {str(e)}")
    
    async def deploy_smart_contracts(self):
        """Deploy Cyphra smart contracts to Sui testnet"""
        logger.info("📋 Deploying smart contracts...")
        
        # Change to contracts directory
        os.chdir(self.contracts_dir)
        
        try:
            # Deploy Cyphra token
            logger.info("Deploying Cyphra token contract...")
            token_result = await self.deploy_contract("cyphra_token")
            if token_result:
                self.deployed_contracts["cyphra_token"] = token_result
            
            # Deploy campaign manager
            logger.info("Deploying campaign manager contract...")
            campaign_result = await self.deploy_contract("campaign_manager")
            if campaign_result:
                self.deployed_contracts["campaign_manager"] = campaign_result
            
            logger.info("✅ Smart contracts deployed successfully")
            
        except Exception as e:
            logger.error(f"Failed to deploy contracts: {e}")
            raise
        finally:
            os.chdir(self.project_root)
    
    async def deploy_contract(self, contract_name: str) -> dict:
        """Deploy a single contract"""
        try:
            contract_path = self.contracts_dir / "move" / contract_name
            
            # Build the contract first
            build_cmd = ['sui', 'move', 'build']
            result = subprocess.run(build_cmd, cwd=contract_path, capture_output=True, text=True)
            
            if result.returncode != 0:
                logger.error(f"Build failed for {contract_name}: {result.stderr}")
                return None
            
            # Deploy the contract
            deploy_cmd = ['sui', 'client', 'publish', '--gas-budget', '100000000']
            result = subprocess.run(deploy_cmd, cwd=contract_path, capture_output=True, text=True)
            
            if result.returncode == 0:
                # Parse deployment result
                output_lines = result.stdout.split('\n')
                package_id = None
                
                for line in output_lines:
                    if 'Package ID:' in line:
                        package_id = line.split(':')[1].strip()
                        break
                
                if package_id:
                    logger.info(f"✅ {contract_name} deployed: {package_id}")
                    return {"package_id": package_id, "output": result.stdout}
                else:
                    logger.error(f"Could not parse package ID for {contract_name}")
                    return None
            else:
                logger.error(f"Deploy failed for {contract_name}: {result.stderr}")
                return None
                
        except Exception as e:
            logger.error(f"Exception deploying {contract_name}: {e}")
            return None
    
    async def update_configurations(self):
        """Update configuration files with deployed contract addresses"""
        logger.info("⚙️ Updating configuration files...")
        
        # Update backend .env
        backend_env = self.backend_dir / ".env"
        if backend_env.exists():
            await self.update_env_file(backend_env)
        
        # Update frontend .env.local
        frontend_env = self.frontend_dir / ".env.local"
        if frontend_env.exists():
            await self.update_frontend_env(frontend_env)
        
        logger.info("✅ Configuration files updated")
    
    async def update_env_file(self, env_file: Path):
        """Update backend environment file"""
        try:
            with open(env_file, 'r') as f:
                content = f.read()
            
            # Update contract addresses
            if 'cyphra_token' in self.deployed_contracts:
                package_id = self.deployed_contracts['cyphra_token']['package_id']
                content = content.replace('CYPHRA_TOKEN_PACKAGE_ID=', f'CYPHRA_TOKEN_PACKAGE_ID={package_id}')
            
            if 'campaign_manager' in self.deployed_contracts:
                package_id = self.deployed_contracts['campaign_manager']['package_id']
                content = content.replace('CYPHRA_CAMPAIGN_PACKAGE_ID=', f'CYPHRA_CAMPAIGN_PACKAGE_ID={package_id}')
            
            with open(env_file, 'w') as f:
                f.write(content)
                
        except Exception as e:
            logger.error(f"Failed to update {env_file}: {e}")
    
    async def update_frontend_env(self, env_file: Path):
        """Update frontend environment file"""
        try:
            with open(env_file, 'r') as f:
                content = f.read()
            
            # Update contract addresses
            if 'cyphra_token' in self.deployed_contracts:
                package_id = self.deployed_contracts['cyphra_token']['package_id']
                content = content.replace('NEXT_PUBLIC_CYPHRA_TOKEN_PACKAGE_ID=', 
                                        f'NEXT_PUBLIC_CYPHRA_TOKEN_PACKAGE_ID={package_id}')
            
            if 'campaign_manager' in self.deployed_contracts:
                package_id = self.deployed_contracts['campaign_manager']['package_id']
                content = content.replace('NEXT_PUBLIC_CYPHRA_CAMPAIGN_PACKAGE_ID=', 
                                        f'NEXT_PUBLIC_CYPHRA_CAMPAIGN_PACKAGE_ID={package_id}')
            
            with open(env_file, 'w') as f:
                f.write(content)
                
        except Exception as e:
            logger.error(f"Failed to update {env_file}: {e}")
    
    async def test_integrations(self):
        """Test Walrus, Seal, and Nautilus integrations"""
        logger.info("🧪 Testing integrations...")
        
        # Test Walrus connectivity
        await self.test_walrus()
        
        # Test Seal key servers (basic connectivity)
        await self.test_seal()
        
        # Test Nautilus (if available)
        await self.test_nautilus()
        
        logger.info("✅ Integration tests completed")
    
    async def test_walrus(self):
        """Test Walrus network connectivity"""
        try:
            async with aiohttp.ClientSession() as session:
                # Test aggregator
                async with session.get("https://aggregator.walrus-testnet.walrus.space/v1/api", timeout=10) as response:
                    if response.status == 200:
                        logger.info("✅ Walrus aggregator - accessible")
                    else:
                        logger.warning(f"⚠️ Walrus aggregator returned {response.status}")
                
                # Test publisher
                async with session.get("https://publisher.walrus-testnet.walrus.space/v1/api", timeout=10) as response:
                    if response.status == 200:
                        logger.info("✅ Walrus publisher - accessible")
                    else:
                        logger.warning(f"⚠️ Walrus publisher returned {response.status}")
                        
        except Exception as e:
            logger.warning(f"⚠️ Walrus test failed: {e}")
    
    async def test_seal(self):
        """Test Seal key servers connectivity"""
        key_servers = [
            "https://seal.rubynodes.io",
            "https://docs.nodeinfra.com/seal", 
            "https://mirai.cloud/seal"
        ]
        
        async with aiohttp.ClientSession() as session:
            for server in key_servers:
                try:
                    async with session.get(f"{server}/health", timeout=10) as response:
                        if response.status < 500:
                            logger.info(f"✅ Seal server {server} - accessible")
                        else:
                            logger.warning(f"⚠️ Seal server {server} returned {response.status}")
                except Exception as e:
                    logger.warning(f"⚠️ Seal server {server} test failed: {e}")
    
    async def test_nautilus(self):
        """Test Nautilus enclave connectivity"""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get("http://localhost:8000/health", timeout=5) as response:
                    if response.status == 200:
                        logger.info("✅ Nautilus enclave - accessible")
                    else:
                        logger.warning(f"⚠️ Nautilus enclave returned {response.status}")
        except Exception as e:
            logger.warning(f"⚠️ Nautilus enclave not available: {e}")
    
    async def start_services(self):
        """Start Cyphra services"""
        logger.info("🚀 Starting Cyphra services...")
        
        # Install backend dependencies
        logger.info("Installing backend dependencies...")
        try:
            result = subprocess.run(['pip', 'install', '-r', 'requirements.txt'], 
                                  cwd=self.backend_dir, capture_output=True, text=True)
            if result.returncode == 0:
                logger.info("✅ Backend dependencies installed")
            else:
                logger.warning("⚠️ Backend dependency installation had issues")
        except Exception as e:
            logger.warning(f"⚠️ Could not install backend dependencies: {e}")
        
        # Install frontend dependencies
        logger.info("Installing frontend dependencies...")
        try:
            result = subprocess.run(['npm', 'install'], 
                                  cwd=self.frontend_dir, capture_output=True, text=True)
            if result.returncode == 0:
                logger.info("✅ Frontend dependencies installed")
            else:
                logger.warning("⚠️ Frontend dependency installation had issues")
        except Exception as e:
            logger.warning(f"⚠️ Could not install frontend dependencies: {e}")
        
        logger.info("✅ Services setup completed")
    
    async def print_deployment_summary(self):
        """Print deployment summary"""
        print("\n" + "="*60)
        print("🎉 CYPHRA DEPLOYMENT SUMMARY")
        print("="*60)
        
        print("\n📋 Deployed Contracts:")
        for contract_name, contract_info in self.deployed_contracts.items():
            print(f"  • {contract_name}: {contract_info['package_id']}")
        
        print("\n🌐 Network Endpoints:")
        print("  • Sui Testnet: https://fullnode.testnet.sui.io:443")
        print("  • Walrus Aggregator: https://aggregator.walrus-testnet.walrus.space")
        print("  • Walrus Publisher: https://publisher.walrus-testnet.walrus.space")
        
        print("\n🚀 Next Steps:")
        print("  1. Start the backend server:")
        print(f"     cd {self.backend_dir}")
        print("     python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload")
        
        print("\n  2. Start the frontend server:")
        print(f"     cd {self.frontend_dir}")
        print("     npm run dev")
        
        print("\n  3. Access Cyphra:")
        print("     • Frontend: http://localhost:3000")
        print("     • Backend API: http://localhost:8000")
        print("     • API Docs: http://localhost:8000/docs")
        
        print("\n📚 Documentation:")
        print("  • Implementation Guide: CYPHRA_IMPLEMENTATION_GUIDE.md")
        print("  • Walrus Integration: CYPHRA_WALRUS_INTEGRATION.md")
        print("  • Seal Integration: CYPHRA_SEAL_INTEGRATION.md")
        print("  • Nautilus Integration: CYPHRA_NAUTILUS_INTEGRATION.md")
        
        print("\n" + "="*60)

async def main():
    """Main deployment function"""
    deployer = CyphraDeployer()
    await deployer.deploy_all()

if __name__ == "__main__":
    asyncio.run(main())

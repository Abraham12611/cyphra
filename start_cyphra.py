#!/usr/bin/env python3
"""
Cyphra Startup Script
Starts the Cyphra backend with proper configuration
"""

import os
import sys
import subprocess
import asyncio
from pathlib import Path

def setup_environment():
    """Set up environment variables for Cyphra"""
    
    # Get the project root
    project_root = Path(__file__).parent
    backend_dir = project_root / "cyphra_backend"
    
    # Load environment variables from .env file
    env_file = backend_dir / ".env"
    
    if env_file.exists():
        print("📋 Loading environment configuration...")
        
        # Read .env file and set environment variables
        with open(env_file, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    os.environ[key] = value
        
        print("✅ Environment configuration loaded")
    else:
        print("⚠️ No .env file found, using default configuration")
        
        # Set default environment variables
        os.environ.setdefault("DATABASE_URL", "sqlite:///./cyphra.db")
        os.environ.setdefault("WALRUS_AGGREGATOR_URL", "https://aggregator.walrus-testnet.walrus.space")
        os.environ.setdefault("WALRUS_PUBLISHER_URL", "https://publisher.walrus-testnet.walrus.space")
        os.environ.setdefault("NAUTILUS_ENCLAVE_ENDPOINT", "http://localhost:8000")
        os.environ.setdefault("API_HOST", "0.0.0.0")
        os.environ.setdefault("API_PORT", "8000")

def install_dependencies():
    """Install required Python dependencies"""
    
    backend_dir = Path(__file__).parent / "cyphra_backend"
    requirements_file = backend_dir / "requirements.txt"
    
    if requirements_file.exists():
        print("📦 Installing Python dependencies...")
        try:
            result = subprocess.run([
                sys.executable, "-m", "pip", "install", "-r", str(requirements_file)
            ], capture_output=True, text=True)
            
            if result.returncode == 0:
                print("✅ Dependencies installed successfully")
            else:
                print(f"⚠️ Some dependencies may have failed to install: {result.stderr}")
        except Exception as e:
            print(f"⚠️ Could not install dependencies: {e}")
    else:
        print("⚠️ No requirements.txt found, installing minimal dependencies...")
        
        # Install minimal required packages
        minimal_packages = ["fastapi", "uvicorn", "aiohttp", "cryptography"]
        for package in minimal_packages:
            try:
                subprocess.run([sys.executable, "-m", "pip", "install", package], 
                             capture_output=True, text=True)
            except:
                pass

def start_backend():
    """Start the Cyphra backend server"""
    
    backend_dir = Path(__file__).parent / "cyphra_backend"
    
    print("🚀 Starting Cyphra backend server...")
    print(f"   Backend directory: {backend_dir}")
    print(f"   API URL: http://{os.getenv('API_HOST', '0.0.0.0')}:{os.getenv('API_PORT', '8000')}")
    print(f"   API Docs: http://localhost:{os.getenv('API_PORT', '8000')}/docs")
    print()
    
    try:
        # Start the FastAPI server using uvicorn
        cmd = [
            sys.executable, "-m", "uvicorn", 
            "app.main:app",
            "--host", os.getenv("API_HOST", "0.0.0.0"),
            "--port", os.getenv("API_PORT", "8000"),
            "--reload"
        ]
        
        # Change to backend directory
        os.chdir(backend_dir)
        
        # Start the server
        subprocess.run(cmd)
        
    except KeyboardInterrupt:
        print("\n🛑 Cyphra backend stopped by user")
    except Exception as e:
        print(f"❌ Failed to start backend: {e}")
        sys.exit(1)

async def test_services():
    """Test that all services are accessible"""
    
    print("🧪 Testing service connectivity...")
    
    # Test Walrus
    try:
        import aiohttp
        async with aiohttp.ClientSession() as session:
            walrus_aggregator = os.getenv("WALRUS_AGGREGATOR_URL")
            async with session.get(f"{walrus_aggregator}/v1/api", timeout=5) as response:
                if response.status == 200:
                    print("✅ Walrus aggregator - accessible")
                else:
                    print(f"⚠️ Walrus aggregator - returned {response.status}")
    except Exception as e:
        print(f"⚠️ Walrus test failed: {e}")
    
    print("✅ Service connectivity test completed")

def print_startup_info():
    """Print startup information"""
    
    print("\n" + "="*60)
    print("🎉 CYPHRA - AI Training Data Marketplace")
    print("="*60)
    print()
    print("🌟 Features:")
    print("  • Walrus: Decentralized blob storage")
    print("  • Seal: Encryption & access control")  
    print("  • Nautilus: Verifiable computation")
    print("  • Sui: Smart contract platform")
    print()
    print("🔗 Endpoints:")
    print("  • API Server: http://localhost:8000")
    print("  • API Documentation: http://localhost:8000/docs")
    print("  • Health Check: http://localhost:8000/health")
    print()
    print("📚 API Routes:")
    print("  • /walrus/* - Decentralized storage operations")
    print("  • /seal/* - Encryption and access control")
    print("  • /nautilus/* - Verifiable computation")
    print("  • /campaigns/* - Campaign management")
    print()
    print("🛠️ Development:")
    print("  • Press Ctrl+C to stop the server")
    print("  • Server will auto-reload on code changes")
    print()
    print("="*60)

def main():
    """Main startup function"""
    
    print_startup_info()
    
    # Setup environment
    setup_environment()
    
    # Install dependencies
    install_dependencies()
    
    # Test services
    asyncio.run(test_services())
    
    # Start backend server
    start_backend()

if __name__ == "__main__":
    main()

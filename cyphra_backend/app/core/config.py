"""
Configuration for Cyphra services
"""

import os
from typing import Dict, Any, List

def get_walrus_config() -> Dict[str, Any]:
    """Get Walrus service configuration"""
    return {
        "aggregator": os.getenv("WALRUS_AGGREGATOR_URL", "https://aggregator.walrus-testnet.walrus.space"),
        "publisher": os.getenv("WALRUS_PUBLISHER_URL", "https://publisher.walrus-testnet.walrus.space"),
        "system_object": os.getenv("WALRUS_SYSTEM_OBJECT"),
        "staking_object": os.getenv("WALRUS_STAKING_OBJECT"),
    }

def get_seal_config() -> Dict[str, Any]:
    """Get Seal service configuration"""
    
    # Parse key servers from environment
    server_names = os.getenv("SEAL_KEY_SERVERS", "ruby-nodes,nodeinfra,studio-mirai").split(",")
    
    key_servers = []
    for name in server_names:
        name = name.strip()
        endpoint_key = f"SEAL_{name.upper().replace('-', '_')}_ENDPOINT"
        endpoint = os.getenv(endpoint_key)
        
        if endpoint:
            key_servers.append({
                "name": name,
                "endpoint": endpoint
            })
    
    # Default key servers if not configured
    if not key_servers:
        key_servers = [
            {
                "name": "ruby-nodes",
                "endpoint": "https://seal.rubynodes.io"
            },
            {
                "name": "nodeinfra", 
                "endpoint": "https://docs.nodeinfra.com/seal"
            },
            {
                "name": "studio-mirai",
                "endpoint": "https://mirai.cloud/seal"
            }
        ]
    
    return {
        "key_servers": key_servers,
        "threshold": int(os.getenv("SEAL_THRESHOLD", "2"))
    }

def get_nautilus_config() -> Dict[str, Any]:
    """Get Nautilus service configuration"""
    return {
        "enclave_endpoint": os.getenv("NAUTILUS_ENCLAVE_ENDPOINT", "http://localhost:8000"),
        "aws_region": os.getenv("NAUTILUS_AWS_REGION", "us-east-1"),
        "enclave_id": os.getenv("NAUTILUS_ENCLAVE_ID", "cyphra-nautilus-v1")
    }

def get_sui_config() -> Dict[str, Any]:
    """Get Sui blockchain configuration"""
    return {
        "network": os.getenv("SUI_NETWORK", "testnet"),
        "rpc_url": os.getenv("SUI_RPC_URL", "https://fullnode.testnet.sui.io:443"),
        "cyphra_token_package_id": os.getenv("CYPHRA_TOKEN_PACKAGE_ID"),
        "cyphra_campaign_package_id": os.getenv("CYPHRA_CAMPAIGN_PACKAGE_ID"),
        "cyphra_treasury_cap_id": os.getenv("CYPHRA_TREASURY_CAP_ID"),
        "campaign_store_id": os.getenv("CAMPAIGN_STORE_ID")
    }

def get_database_config() -> Dict[str, Any]:
    """Get database configuration"""
    return {
        "url": os.getenv("DATABASE_URL", "postgresql://cyphra_user:cyphra_password@localhost:5432/cyphra_db"),
        "echo": os.getenv("DATABASE_ECHO", "false").lower() == "true"
    }

def get_redis_config() -> Dict[str, Any]:
    """Get Redis configuration"""
    return {
        "url": os.getenv("REDIS_URL", "redis://localhost:6379"),
        "decode_responses": True
    }

def get_api_config() -> Dict[str, Any]:
    """Get API configuration"""
    return {
        "host": os.getenv("API_HOST", "0.0.0.0"),
        "port": int(os.getenv("API_PORT", "8000")),
        "workers": int(os.getenv("API_WORKERS", "4")),
        "reload": os.getenv("API_RELOAD", "false").lower() == "true"
    }

def get_security_config() -> Dict[str, Any]:
    """Get security configuration"""
    return {
        "secret_key": os.getenv("SECRET_KEY", "your-secret-key-change-in-production"),
        "jwt_secret": os.getenv("JWT_SECRET", "your-jwt-secret-change-in-production"),
        "algorithm": "HS256",
        "access_token_expire_minutes": 30
    }

def get_logging_config() -> Dict[str, Any]:
    """Get logging configuration"""
    return {
        "level": os.getenv("LOG_LEVEL", "INFO"),
        "file": os.getenv("LOG_FILE", "cyphra.log"),
        "format": "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    }

def get_upload_config() -> Dict[str, Any]:
    """Get file upload configuration"""
    
    # Parse max file size
    max_size_str = os.getenv("MAX_FILE_SIZE", "100MB")
    if max_size_str.endswith("MB"):
        max_size = int(max_size_str[:-2]) * 1024 * 1024
    elif max_size_str.endswith("GB"):
        max_size = int(max_size_str[:-2]) * 1024 * 1024 * 1024
    else:
        max_size = int(max_size_str)
    
    return {
        "max_file_size": max_size,
        "max_files_per_upload": int(os.getenv("MAX_FILES_PER_UPLOAD", "10")),
        "allowed_extensions": [".jpg", ".jpeg", ".png", ".gif", ".pdf", ".txt", ".csv", ".json"],
        "upload_dir": os.getenv("UPLOAD_DIR", "/tmp/cyphra_uploads")
    }

def validate_config() -> bool:
    """Validate that all required configuration is present"""
    
    required_vars = [
        "DATABASE_URL",
        "WALRUS_AGGREGATOR_URL", 
        "WALRUS_PUBLISHER_URL",
        "NAUTILUS_ENCLAVE_ENDPOINT"
    ]
    
    missing_vars = []
    for var in required_vars:
        if not os.getenv(var):
            missing_vars.append(var)
    
    if missing_vars:
        print(f"Missing required environment variables: {', '.join(missing_vars)}")
        return False
    
    return True

def get_all_config() -> Dict[str, Any]:
    """Get all configuration as a single dictionary"""
    return {
        "walrus": get_walrus_config(),
        "seal": get_seal_config(),
        "nautilus": get_nautilus_config(),
        "sui": get_sui_config(),
        "database": get_database_config(),
        "redis": get_redis_config(),
        "api": get_api_config(),
        "security": get_security_config(),
        "logging": get_logging_config(),
        "upload": get_upload_config()
    }

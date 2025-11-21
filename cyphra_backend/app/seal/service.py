"""
Seal Service for Cyphra
Handles decentralized encryption and access control
"""

import asyncio
import aiohttp
import json
import logging
from typing import Optional, Dict, Any, List
from cryptography.hazmat.primitives import hashes, serialization, padding
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
import base64
import os
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

class SealService:
    def __init__(self, key_servers: List[Dict[str, str]], threshold: int):
        self.key_servers = key_servers
        self.threshold = threshold
        
    async def encrypt_data(self, data: bytes, policy_id: str, policy_params: Dict[str, Any] = None) -> Optional[Dict[str, Any]]:
        """Encrypt data with Seal identity-based encryption"""
        try:
            logger.info(f"Encrypting data with policy: {policy_id}")
            
            # Get public keys from key servers
            public_keys = await self._get_public_keys()
            
            if len(public_keys) < self.threshold:
                logger.error(f"Not enough key servers available: {len(public_keys)} < {self.threshold}")
                return None
            
            # Generate symmetric key for actual data encryption
            symmetric_key = os.urandom(32)  # 256-bit key
            iv = os.urandom(16)  # 128-bit IV
            
            # Encrypt data with AES
            cipher = Cipher(algorithms.AES(symmetric_key), modes.CBC(iv), backend=default_backend())
            encryptor = cipher.encryptor()
            
            # Pad data to block size
            padded_data = self._pad_data(data)
            encrypted_data = encryptor.update(padded_data) + encryptor.finalize()
            
            # Encrypt symmetric key with threshold encryption
            encrypted_shares = []
            for i, server in enumerate(self.key_servers[:len(public_keys)]):
                share = await self._encrypt_key_share(symmetric_key, public_keys[i], policy_id, server["name"])
                if share:
                    encrypted_shares.append({
                        "server": server["name"],
                        "share": share
                    })
            
            if len(encrypted_shares) < self.threshold:
                logger.error(f"Failed to encrypt enough key shares: {len(encrypted_shares)} < {self.threshold}")
                return None
            
            result = {
                "encrypted_data": base64.b64encode(encrypted_data).decode(),
                "iv": base64.b64encode(iv).decode(),
                "encrypted_shares": encrypted_shares,
                "policy_id": policy_id,
                "policy_params": policy_params or {},
                "threshold": self.threshold,
                "timestamp": datetime.utcnow().isoformat()
            }
            
            logger.info(f"Successfully encrypted data with {len(encrypted_shares)} key shares")
            return result
            
        except Exception as e:
            logger.error(f"Encryption error: {e}")
            return None
    
    async def decrypt_data(self, encrypted_data: Dict[str, Any], access_token: str) -> Optional[bytes]:
        """Decrypt data using threshold decryption"""
        try:
            logger.info(f"Decrypting data with policy: {encrypted_data.get('policy_id')}")
            
            # Request decryption keys from servers
            decryption_keys = []
            for share in encrypted_data["encrypted_shares"]:
                key = await self._request_decryption_key(
                    share["server"], 
                    encrypted_data["policy_id"],
                    access_token,
                    share["share"]
                )
                if key:
                    decryption_keys.append(key)
            
            # Check if we have enough keys
            if len(decryption_keys) < self.threshold:
                logger.error(f"Not enough decryption keys: {len(decryption_keys)} < {self.threshold}")
                return None
            
            # Combine keys to reconstruct symmetric key
            symmetric_key = self._combine_key_shares(decryption_keys[:self.threshold])
            
            if not symmetric_key:
                logger.error("Failed to reconstruct symmetric key")
                return None
            
            # Decrypt data
            encrypted_bytes = base64.b64decode(encrypted_data["encrypted_data"])
            iv = base64.b64decode(encrypted_data["iv"])
            
            cipher = Cipher(algorithms.AES(symmetric_key), modes.CBC(iv), backend=default_backend())
            decryptor = cipher.decryptor()
            
            padded_data = decryptor.update(encrypted_bytes) + decryptor.finalize()
            data = self._unpad_data(padded_data)
            
            logger.info("Successfully decrypted data")
            return data
            
        except Exception as e:
            logger.error(f"Decryption error: {e}")
            return None
    
    async def create_access_policy(self, policy_type: str, policy_params: Dict[str, Any]) -> str:
        """Create a new access policy"""
        try:
            policy_id = f"{policy_type}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{os.urandom(4).hex()}"
            
            # Store policy configuration
            policy_config = {
                "policy_id": policy_id,
                "policy_type": policy_type,
                "params": policy_params,
                "created_at": datetime.utcnow().isoformat()
            }
            
            # TODO: Store policy in database or smart contract
            logger.info(f"Created access policy: {policy_id} (type: {policy_type})")
            
            return policy_id
            
        except Exception as e:
            logger.error(f"Error creating access policy: {e}")
            return None
    
    async def verify_access_permission(self, policy_id: str, requester_address: str, access_token: str) -> bool:
        """Verify if requester has access permission"""
        try:
            # TODO: Implement actual policy verification
            # This would check against smart contract policies
            
            # For now, return True for demonstration
            logger.info(f"Verifying access for {requester_address} to policy {policy_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error verifying access permission: {e}")
            return False
    
    async def _get_public_keys(self) -> List[bytes]:
        """Get public keys from all key servers"""
        public_keys = []
        
        for server in self.key_servers:
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.get(f"{server['endpoint']}/public-key", timeout=10) as response:
                        if response.status == 200:
                            key_data = await response.json()
                            public_key_bytes = base64.b64decode(key_data["public_key"])
                            public_keys.append(public_key_bytes)
                            logger.info(f"Retrieved public key from {server['name']}")
                        else:
                            logger.warning(f"Failed to get public key from {server['name']}: {response.status}")
            except Exception as e:
                logger.warning(f"Error getting public key from {server['name']}: {e}")
        
        return public_keys
    
    async def _encrypt_key_share(self, symmetric_key: bytes, public_key: bytes, policy_id: str, server_name: str) -> Optional[str]:
        """Encrypt symmetric key share with server's public key"""
        try:
            # Load public key
            public_key_obj = serialization.load_der_public_key(public_key, backend=default_backend())
            
            # Create key share (simplified - in real implementation would use proper secret sharing)
            key_share = symmetric_key  # Simplified: using full key for each share
            
            # Encrypt key share
            encrypted_share = public_key_obj.encrypt(
                key_share,
                padding.OAEP(
                    mgf=padding.MGF1(algorithm=hashes.SHA256()),
                    algorithm=hashes.SHA256(),
                    label=None
                )
            )
            
            return base64.b64encode(encrypted_share).decode()
            
        except Exception as e:
            logger.error(f"Error encrypting key share for {server_name}: {e}")
            return None
    
    async def _request_decryption_key(self, server_name: str, policy_id: str, access_token: str, encrypted_share: str) -> Optional[bytes]:
        """Request decryption key from server"""
        server = next((s for s in self.key_servers if s["name"] == server_name), None)
        if not server:
            return None
        
        try:
            async with aiohttp.ClientSession() as session:
                payload = {
                    "policy_id": policy_id,
                    "access_token": access_token,
                    "encrypted_share": encrypted_share
                }
                
                async with session.post(f"{server['endpoint']}/decrypt", json=payload, timeout=10) as response:
                    if response.status == 200:
                        result = await response.json()
                        decryption_key = base64.b64decode(result["decryption_key"])
                        logger.info(f"Retrieved decryption key from {server_name}")
                        return decryption_key
                    else:
                        logger.warning(f"Failed to get decryption key from {server_name}: {response.status}")
                        return None
                        
        except Exception as e:
            logger.warning(f"Error requesting decryption key from {server_name}: {e}")
            return None
    
    def _combine_key_shares(self, key_shares: List[bytes]) -> Optional[bytes]:
        """Combine key shares to reconstruct symmetric key"""
        try:
            # Simplified: just return the first key share
            # In real implementation, would use proper secret sharing reconstruction
            return key_shares[0] if key_shares else None
            
        except Exception as e:
            logger.error(f"Error combining key shares: {e}")
            return None
    
    def _pad_data(self, data: bytes) -> bytes:
        """Add PKCS7 padding to data"""
        block_size = 16  # AES block size
        padding_length = block_size - (len(data) % block_size)
        padding = bytes([padding_length] * padding_length)
        return data + padding
    
    def _unpad_data(self, padded_data: bytes) -> bytes:
        """Remove PKCS7 padding from data"""
        padding_length = padded_data[-1]
        return padded_data[:-padding_length]
    
    async def health_check(self) -> Dict[str, Any]:
        """Check Seal key servers health"""
        try:
            server_status = []
            
            for server in self.key_servers:
                try:
                    async with aiohttp.ClientSession() as session:
                        async with session.get(f"{server['endpoint']}/health", timeout=5) as response:
                            healthy = response.status == 200
                            server_status.append({
                                "name": server["name"],
                                "endpoint": server["endpoint"],
                                "healthy": healthy
                            })
                except:
                    server_status.append({
                        "name": server["name"],
                        "endpoint": server["endpoint"],
                        "healthy": False
                    })
            
            healthy_count = sum(1 for s in server_status if s["healthy"])
            overall_healthy = healthy_count >= self.threshold
            
            return {
                "servers": server_status,
                "healthy_count": healthy_count,
                "threshold": self.threshold,
                "overall_healthy": overall_healthy
            }
            
        except Exception as e:
            logger.error(f"Exception in Seal health check: {e}")
            return {
                "servers": [],
                "healthy_count": 0,
                "threshold": self.threshold,
                "overall_healthy": False,
                "error": str(e)
            }

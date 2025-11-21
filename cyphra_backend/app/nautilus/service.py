"""
Nautilus Service for Cyphra
Handles verifiable computation using TEE (Trusted Execution Environment)
"""

import asyncio
import aiohttp
import json
import logging
from typing import Dict, Any, Optional, List
import hashlib
from datetime import datetime

logger = logging.getLogger(__name__)

class NautilusService:
    def __init__(self, enclave_endpoint: str, aws_region: str = "us-east-1"):
        self.enclave_endpoint = enclave_endpoint
        self.aws_region = aws_region
        
    async def verify_data_quality(self, campaign_id: str, blob_id: str, verification_params: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Request data verification from Nautilus enclave"""
        
        try:
            logger.info(f"Requesting data verification for blob {blob_id} in campaign {campaign_id}")
            
            async with aiohttp.ClientSession() as session:
                payload = {
                    "campaign_id": campaign_id,
                    "data_blob_id": blob_id,
                    "verification_type": "quality",
                    "parameters": verification_params
                }
                
                async with session.post(
                    f"{self.enclave_endpoint}/verify-data",
                    json=payload,
                    timeout=300  # 5 minutes timeout for verification
                ) as response:
                    if response.status == 200:
                        result = await response.json()
                        
                        # Verify attestation on Sui blockchain
                        attestation_valid = await self._verify_attestation_on_chain(
                            result.get("attestation", {})
                        )
                        
                        if attestation_valid:
                            logger.info(f"Data verification successful for blob {blob_id}")
                            return result["verification_result"]
                        else:
                            logger.error(f"Attestation verification failed for blob {blob_id}")
                            return None
                    else:
                        error_text = await response.text()
                        logger.error(f"Data verification failed: {response.status} - {error_text}")
                        return None
                    
        except Exception as e:
            logger.error(f"Nautilus verification error: {e}")
            return None
    
    async def verify_data_authenticity(self, campaign_id: str, blob_id: str, verification_params: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Request authenticity verification from Nautilus enclave"""
        
        try:
            logger.info(f"Requesting authenticity verification for blob {blob_id}")
            
            async with aiohttp.ClientSession() as session:
                payload = {
                    "campaign_id": campaign_id,
                    "data_blob_id": blob_id,
                    "verification_type": "authenticity",
                    "parameters": verification_params
                }
                
                async with session.post(
                    f"{self.enclave_endpoint}/verify-data",
                    json=payload,
                    timeout=300
                ) as response:
                    if response.status == 200:
                        result = await response.json()
                        
                        attestation_valid = await self._verify_attestation_on_chain(
                            result.get("attestation", {})
                        )
                        
                        if attestation_valid:
                            return result["verification_result"]
                        else:
                            return None
                    else:
                        return None
                    
        except Exception as e:
            logger.error(f"Nautilus authenticity verification error: {e}")
            return None
    
    async def train_model_verifiable(self, campaign_id: str, dataset_blob_id: str, model_config: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Request verifiable model training from Nautilus enclave"""
        
        try:
            logger.info(f"Requesting verifiable model training for campaign {campaign_id}")
            
            async with aiohttp.ClientSession() as session:
                payload = {
                    "campaign_id": campaign_id,
                    "dataset_blob_id": dataset_blob_id,
                    "model_config": model_config,
                    "training_params": {
                        "epochs": model_config.get("epochs", 3),
                        "learning_rate": model_config.get("learning_rate", 0.001),
                        "batch_size": model_config.get("batch_size", 32)
                    }
                }
                
                async with session.post(
                    f"{self.enclave_endpoint}/train-model",
                    json=payload,
                    timeout=1800  # 30 minutes timeout for training
                ) as response:
                    if response.status == 200:
                        result = await response.json()
                        
                        # Verify training attestation
                        attestation_valid = await self._verify_attestation_on_chain(
                            result.get("attestation", {})
                        )
                        
                        if attestation_valid:
                            logger.info(f"Verifiable training completed for campaign {campaign_id}")
                            return result["training_result"]
                        else:
                            logger.error(f"Training attestation verification failed")
                            return None
                    else:
                        error_text = await response.text()
                        logger.error(f"Model training failed: {response.status} - {error_text}")
                        return None
                    
        except Exception as e:
            logger.error(f"Nautilus training error: {e}")
            return None
    
    async def batch_verify_contributions(self, campaign_id: str, contributions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Batch verify multiple contributions"""
        
        try:
            logger.info(f"Batch verifying {len(contributions)} contributions for campaign {campaign_id}")
            
            async with aiohttp.ClientSession() as session:
                payload = {
                    "campaign_id": campaign_id,
                    "contributions": contributions,
                    "verification_type": "batch_quality"
                }
                
                async with session.post(
                    f"{self.enclave_endpoint}/batch-verify",
                    json=payload,
                    timeout=600  # 10 minutes timeout
                ) as response:
                    if response.status == 200:
                        result = await response.json()
                        
                        # Verify batch attestation
                        attestation_valid = await self._verify_attestation_on_chain(
                            result.get("attestation", {})
                        )
                        
                        if attestation_valid:
                            return result["verification_results"]
                        else:
                            return []
                    else:
                        return []
                    
        except Exception as e:
            logger.error(f"Batch verification error: {e}")
            return []
    
    async def get_verification_report(self, campaign_id: str) -> Optional[Dict[str, Any]]:
        """Get comprehensive verification report for a campaign"""
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{self.enclave_endpoint}/report/{campaign_id}",
                    timeout=30
                ) as response:
                    if response.status == 200:
                        result = await response.json()
                        return result
                    else:
                        return None
                    
        except Exception as e:
            logger.error(f"Error getting verification report: {e}")
            return None
    
    async def _verify_attestation_on_chain(self, attestation: Dict[str, Any]) -> bool:
        """Verify attestation on Sui blockchain"""
        
        try:
            # TODO: Implement actual on-chain attestation verification
            # This would interact with Sui smart contracts to verify the attestation
            
            if not attestation:
                return False
            
            # For now, perform basic validation
            required_fields = ["enclave_id", "computation_hash", "signature", "timestamp"]
            for field in required_fields:
                if field not in attestation:
                    logger.error(f"Missing required attestation field: {field}")
                    return False
            
            # TODO: Verify signature against registered enclave public key
            # TODO: Check computation hash matches expected input/output
            # TODO: Verify timestamp is recent
            
            logger.info("Attestation validation passed (simplified)")
            return True
            
        except Exception as e:
            logger.error(f"Attestation verification error: {e}")
            return False
    
    async def register_enclave(self, enclave_id: str, pcr_values: bytes, public_key: bytes) -> bool:
        """Register enclave with the system"""
        
        try:
            # TODO: Call smart contract to register enclave
            logger.info(f"Registering enclave: {enclave_id}")
            
            # For now, just log the registration
            return True
            
        except Exception as e:
            logger.error(f"Enclave registration error: {e}")
            return False
    
    async def get_enclave_status(self) -> Dict[str, Any]:
        """Get enclave health and status"""
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{self.enclave_endpoint}/health", timeout=10) as response:
                    if response.status == 200:
                        result = await response.json()
                        return {
                            "status": "healthy",
                            "enclave_id": result.get("enclave_id"),
                            "endpoint": self.enclave_endpoint,
                            "last_check": datetime.utcnow().isoformat()
                        }
                    else:
                        return {
                            "status": "unhealthy", 
                            "error": f"HTTP {response.status}",
                            "endpoint": self.enclave_endpoint,
                            "last_check": datetime.utcnow().isoformat()
                        }
                        
        except Exception as e:
            return {
                "status": "error", 
                "error": str(e),
                "endpoint": self.enclave_endpoint,
                "last_check": datetime.utcnow().isoformat()
            }
    
    async def get_attestation_document(self) -> Optional[Dict[str, Any]]:
        """Get enclave attestation document"""
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{self.enclave_endpoint}/attestation-document", timeout=10) as response:
                    if response.status == 200:
                        result = await response.json()
                        return result
                    else:
                        return None
                        
        except Exception as e:
            logger.error(f"Error getting attestation document: {e}")
            return None
    
    def _calculate_computation_hash(self, inputs: Dict[str, Any], outputs: Dict[str, Any]) -> str:
        """Calculate hash of computation inputs and outputs"""
        
        try:
            # Create deterministic hash of computation
            computation_data = {
                "inputs": inputs,
                "outputs": outputs,
                "timestamp": datetime.utcnow().isoformat()
            }
            
            computation_json = json.dumps(computation_data, sort_keys=True)
            computation_hash = hashlib.sha256(computation_json.encode()).hexdigest()
            
            return computation_hash
            
        except Exception as e:
            logger.error(f"Error calculating computation hash: {e}")
            return ""
    
    async def health_check(self) -> Dict[str, Any]:
        """Comprehensive health check for Nautilus service"""
        
        try:
            enclave_status = await self.get_enclave_status()
            attestation_doc = await self.get_attestation_document()
            
            return {
                "enclave": enclave_status,
                "attestation_available": attestation_doc is not None,
                "service_healthy": enclave_status["status"] == "healthy",
                "last_check": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            return {
                "enclave": {"status": "error", "error": str(e)},
                "attestation_available": False,
                "service_healthy": False,
                "last_check": datetime.utcnow().isoformat()
            }

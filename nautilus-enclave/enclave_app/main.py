#!/usr/bin/env python3
"""
Cyphra Nautilus Enclave Application
Runs inside AWS Nitro Enclave for verifiable computation
"""

import asyncio
import json
import logging
import socket
import struct
import hashlib
import base64
import os
from datetime import datetime
from typing import Dict, Any, Optional
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.backends import default_backend

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class CyphraNautilusEnclave:
    def __init__(self):
        self.enclave_id = "cyphra-nautilus-v1"
        self.private_key = None
        self.public_key = None
        self.vsock_port = 5000
        self.parent_cid = 3  # Parent instance CID is always 3
        
        # Initialize cryptographic keys
        self._generate_keys()
        
    def _generate_keys(self):
        """Generate RSA key pair for enclave"""
        try:
            self.private_key = rsa.generate_private_key(
                public_exponent=65537,
                key_size=2048,
                backend=default_backend()
            )
            self.public_key = self.private_key.public_key()
            logger.info("✅ Enclave RSA keys generated")
        except Exception as e:
            logger.error(f"❌ Failed to generate keys: {e}")
            raise
    
    def get_public_key_pem(self) -> bytes:
        """Get public key in PEM format"""
        return self.public_key.serialize(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo
        )
    
    def create_attestation_document(self, computation_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create attestation document for computation"""
        
        # Calculate computation hash
        computation_json = json.dumps(computation_data, sort_keys=True)
        computation_hash = hashlib.sha256(computation_json.encode()).hexdigest()
        
        # Create attestation document
        attestation = {
            "enclave_id": self.enclave_id,
            "computation_hash": computation_hash,
            "timestamp": datetime.utcnow().isoformat(),
            "public_key": base64.b64encode(self.get_public_key_pem()).decode(),
            "pcr_values": {
                "PCR0": "0x" + "a" * 64,  # Placeholder - would be real PCR values
                "PCR1": "0x" + "b" * 64,
                "PCR2": "0x" + "c" * 64
            }
        }
        
        # Sign the attestation
        attestation_json = json.dumps(attestation, sort_keys=True)
        signature = self.private_key.sign(
            attestation_json.encode(),
            padding.PSS(
                mgf=padding.MGF1(hashes.SHA256()),
                salt_length=padding.PSS.MAX_LENGTH
            ),
            hashes.SHA256()
        )
        
        attestation["signature"] = base64.b64encode(signature).decode()
        
        return attestation
    
    async def verify_data_quality(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Verify data quality using AI models"""
        
        logger.info(f"🔍 Verifying data quality for blob: {data.get('blob_id')}")
        
        try:
            # Simulate AI-based quality verification
            # In real implementation, this would:
            # 1. Download blob from Walrus
            # 2. Run AI models for quality assessment
            # 3. Check for various quality metrics
            
            blob_id = data.get("blob_id", "unknown")
            data_type = data.get("data_type", "unknown")
            quality_threshold = data.get("quality_threshold", 0.7)
            
            # Simulate quality scoring based on data type
            if data_type == "image":
                quality_metrics = {
                    "resolution_score": 0.85,
                    "clarity_score": 0.78,
                    "noise_level": 0.12,
                    "compression_artifacts": 0.05
                }
                overall_score = (quality_metrics["resolution_score"] + 
                               quality_metrics["clarity_score"] + 
                               (1 - quality_metrics["noise_level"]) + 
                               (1 - quality_metrics["compression_artifacts"])) / 4
            
            elif data_type == "text":
                quality_metrics = {
                    "grammar_score": 0.92,
                    "coherence_score": 0.88,
                    "completeness_score": 0.95,
                    "spelling_errors": 0.02
                }
                overall_score = (quality_metrics["grammar_score"] + 
                               quality_metrics["coherence_score"] + 
                               quality_metrics["completeness_score"] + 
                               (1 - quality_metrics["spelling_errors"])) / 4
            
            else:
                # Generic quality assessment
                quality_metrics = {
                    "format_validity": 0.90,
                    "data_integrity": 0.85,
                    "completeness": 0.88
                }
                overall_score = sum(quality_metrics.values()) / len(quality_metrics)
            
            passes_threshold = overall_score >= quality_threshold
            
            result = {
                "blob_id": blob_id,
                "data_type": data_type,
                "quality_score": round(overall_score, 3),
                "quality_threshold": quality_threshold,
                "passes_threshold": passes_threshold,
                "metrics": quality_metrics,
                "verified": passes_threshold,
                "verification_timestamp": datetime.utcnow().isoformat()
            }
            
            logger.info(f"✅ Quality verification complete: {overall_score:.3f} (threshold: {quality_threshold})")
            
            return result
            
        except Exception as e:
            logger.error(f"❌ Quality verification failed: {e}")
            return {
                "blob_id": data.get("blob_id", "unknown"),
                "verified": False,
                "error": str(e)
            }
    
    async def verify_data_authenticity(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Verify data authenticity (detect AI-generated content)"""
        
        logger.info(f"🔍 Verifying data authenticity for blob: {data.get('blob_id')}")
        
        try:
            blob_id = data.get("blob_id", "unknown")
            data_type = data.get("data_type", "unknown")
            
            # Simulate authenticity verification
            if data_type == "image":
                authenticity_metrics = {
                    "deepfake_probability": 0.15,
                    "ai_generated_probability": 0.08,
                    "metadata_consistency": 0.92,
                    "pixel_analysis_score": 0.88
                }
                authenticity_score = 1 - max(
                    authenticity_metrics["deepfake_probability"],
                    authenticity_metrics["ai_generated_probability"]
                )
            
            elif data_type == "text":
                authenticity_metrics = {
                    "ai_text_probability": 0.12,
                    "human_writing_patterns": 0.85,
                    "linguistic_authenticity": 0.90
                }
                authenticity_score = 1 - authenticity_metrics["ai_text_probability"]
            
            else:
                authenticity_metrics = {
                    "format_authenticity": 0.88,
                    "source_verification": 0.82
                }
                authenticity_score = sum(authenticity_metrics.values()) / len(authenticity_metrics)
            
            authentic = authenticity_score >= 0.7  # 70% threshold for authenticity
            
            result = {
                "blob_id": blob_id,
                "data_type": data_type,
                "authenticity_score": round(authenticity_score, 3),
                "authentic": authentic,
                "metrics": authenticity_metrics,
                "verified": authentic,
                "verification_timestamp": datetime.utcnow().isoformat()
            }
            
            logger.info(f"✅ Authenticity verification complete: {authenticity_score:.3f}")
            
            return result
            
        except Exception as e:
            logger.error(f"❌ Authenticity verification failed: {e}")
            return {
                "blob_id": data.get("blob_id", "unknown"),
                "verified": False,
                "error": str(e)
            }
    
    async def train_model_verifiable(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Perform verifiable model training"""
        
        logger.info(f"🤖 Starting verifiable model training for campaign: {data.get('campaign_id')}")
        
        try:
            campaign_id = data.get("campaign_id", "unknown")
            dataset_blob_id = data.get("dataset_blob_id", "unknown")
            model_config = data.get("model_config", {})
            
            # Simulate model training process
            training_metrics = {
                "epochs_completed": model_config.get("epochs", 3),
                "final_accuracy": 0.892,
                "final_loss": 0.245,
                "training_time_seconds": 1847,
                "samples_processed": 15420,
                "validation_accuracy": 0.876
            }
            
            # Generate model artifact blob ID (would be uploaded to Walrus)
            model_artifact_blob_id = f"model_{campaign_id}_{int(datetime.utcnow().timestamp())}"
            
            # Create verification hash
            training_data = {
                "dataset_blob_id": dataset_blob_id,
                "model_config": model_config,
                "training_metrics": training_metrics
            }
            verification_hash = hashlib.sha256(
                json.dumps(training_data, sort_keys=True).encode()
            ).hexdigest()
            
            result = {
                "campaign_id": campaign_id,
                "dataset_blob_id": dataset_blob_id,
                "model_artifact_blob_id": model_artifact_blob_id,
                "model_config": model_config,
                "training_metrics": training_metrics,
                "verification_hash": verification_hash,
                "training_verified": True,
                "training_timestamp": datetime.utcnow().isoformat()
            }
            
            logger.info(f"✅ Model training complete: {training_metrics['final_accuracy']:.3f} accuracy")
            
            return result
            
        except Exception as e:
            logger.error(f"❌ Model training failed: {e}")
            return {
                "campaign_id": data.get("campaign_id", "unknown"),
                "training_verified": False,
                "error": str(e)
            }
    
    async def handle_request(self, request_data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle incoming computation requests"""
        
        request_type = request_data.get("type", "unknown")
        
        if request_type == "verify_quality":
            result = await self.verify_data_quality(request_data.get("data", {}))
        elif request_type == "verify_authenticity":
            result = await self.verify_data_authenticity(request_data.get("data", {}))
        elif request_type == "train_model":
            result = await self.train_model_verifiable(request_data.get("data", {}))
        elif request_type == "get_public_key":
            result = {
                "public_key": base64.b64encode(self.get_public_key_pem()).decode(),
                "enclave_id": self.enclave_id
            }
        else:
            result = {"error": f"Unknown request type: {request_type}"}
        
        # Create attestation for the computation
        if "error" not in result:
            attestation = self.create_attestation_document({
                "request": request_data,
                "result": result
            })
            result["attestation"] = attestation
        
        return result
    
    async def run_vsock_server(self):
        """Run the vsock server to communicate with parent instance"""
        
        logger.info(f"🚀 Starting Nautilus enclave server on port {self.vsock_port}")
        
        try:
            # Create vsock socket
            sock = socket.socket(socket.AF_VSOCK, socket.SOCK_STREAM)
            sock.bind((socket.VMADDR_CID_ANY, self.vsock_port))
            sock.listen(5)
            
            logger.info(f"✅ Enclave listening on vsock port {self.vsock_port}")
            
            while True:
                try:
                    conn, addr = sock.accept()
                    logger.info(f"📡 Connection from {addr}")
                    
                    # Receive request
                    data_length = struct.unpack('!I', conn.recv(4))[0]
                    request_data = json.loads(conn.recv(data_length).decode())
                    
                    logger.info(f"📥 Received request: {request_data.get('type', 'unknown')}")
                    
                    # Process request
                    response = await self.handle_request(request_data)
                    
                    # Send response
                    response_json = json.dumps(response)
                    response_bytes = response_json.encode()
                    
                    conn.send(struct.pack('!I', len(response_bytes)))
                    conn.send(response_bytes)
                    
                    logger.info(f"📤 Sent response: {len(response_bytes)} bytes")
                    
                    conn.close()
                    
                except Exception as e:
                    logger.error(f"❌ Error handling connection: {e}")
                    if 'conn' in locals():
                        conn.close()
                    
        except Exception as e:
            logger.error(f"❌ Vsock server error: {e}")
            raise
    
    async def run_http_server(self):
        """Run HTTP server for external communication (via parent proxy)"""
        
        from fastapi import FastAPI, HTTPException
        from pydantic import BaseModel
        import uvicorn
        
        app = FastAPI(title="Cyphra Nautilus Enclave", version="1.0.0")
        
        class VerificationRequest(BaseModel):
            type: str
            data: Dict[str, Any]
        
        @app.get("/health")
        async def health_check():
            return {
                "status": "healthy",
                "enclave_id": self.enclave_id,
                "timestamp": datetime.utcnow().isoformat()
            }
        
        @app.get("/attestation-document")
        async def get_attestation_document():
            return self.create_attestation_document({
                "request_type": "attestation_document",
                "timestamp": datetime.utcnow().isoformat()
            })
        
        @app.post("/verify-data")
        async def verify_data(request: VerificationRequest):
            try:
                result = await self.handle_request(request.dict())
                return {"verification_result": result}
            except Exception as e:
                raise HTTPException(status_code=500, detail=str(e))
        
        @app.post("/train-model")
        async def train_model(request: VerificationRequest):
            try:
                result = await self.handle_request({
                    "type": "train_model",
                    "data": request.data
                })
                return {"training_result": result}
            except Exception as e:
                raise HTTPException(status_code=500, detail=str(e))
        
        logger.info("🌐 Starting HTTP server on port 8000")
        
        # Run server
        config = uvicorn.Config(app, host="0.0.0.0", port=8000, log_level="info")
        server = uvicorn.Server(config)
        await server.serve()

async def main():
    """Main enclave application"""
    
    logger.info("🚀 Starting Cyphra Nautilus Enclave")
    
    # Initialize enclave
    enclave = CyphraNautilusEnclave()
    
    # Start both servers concurrently
    await asyncio.gather(
        enclave.run_http_server(),
        # enclave.run_vsock_server()  # Uncomment for vsock communication
    )

if __name__ == "__main__":
    asyncio.run(main())

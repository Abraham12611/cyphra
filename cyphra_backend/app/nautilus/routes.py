"""
Nautilus API Routes for Cyphra
Handles HTTP endpoints for verifiable computation
"""

import logging
from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, Form, BackgroundTasks
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.nautilus.service import NautilusService
from app.nautilus.schemas import (
    NautilusVerificationResponse,
    NautilusTrainingResponse,
    NautilusHealthResponse,
    NautilusReportResponse,
    NautilusBatchVerificationResponse
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/nautilus", tags=["nautilus"])

def get_nautilus_service() -> NautilusService:
    """Get Nautilus service instance with configuration"""
    from app.core.config import get_nautilus_config
    config = get_nautilus_config()
    return NautilusService(config["enclave_endpoint"], config.get("aws_region", "us-east-1"))

@router.post("/verify-quality", response_model=NautilusVerificationResponse)
async def verify_data_quality(
    campaign_id: str = Form(...),
    blob_id: str = Form(...),
    data_type: str = Form(...),  # "image", "text", "audio", etc.
    quality_threshold: float = Form(0.7),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(get_session)
):
    """Verify data quality using Nautilus TEE"""
    
    nautilus_service = get_nautilus_service()
    
    verification_params = {
        "data_type": data_type,
        "quality_threshold": quality_threshold,
        "check_resolution": data_type == "image",
        "check_grammar": data_type == "text",
        "check_noise_level": data_type == "audio"
    }
    
    try:
        logger.info(f"Starting quality verification for blob {blob_id}")
        
        result = await nautilus_service.verify_data_quality(
            campaign_id, blob_id, verification_params
        )
        
        if result:
            # TODO: Update smart contract with verification result
            # background_tasks.add_task(update_blockchain_verification, campaign_id, blob_id, result)
            
            return NautilusVerificationResponse(
                success=True,
                campaign_id=campaign_id,
                blob_id=blob_id,
                verification_type="quality",
                quality_score=result.get("quality_score", 0),
                passes_threshold=result.get("passes_threshold", False),
                metrics=result.get("metrics", {}),
                verified=result.get("passes_threshold", False)
            )
        else:
            raise HTTPException(status_code=500, detail="Quality verification failed")
            
    except Exception as e:
        logger.error(f"Error in quality verification: {e}")
        raise HTTPException(status_code=500, detail=f"Verification error: {str(e)}")

@router.post("/verify-authenticity", response_model=NautilusVerificationResponse)
async def verify_data_authenticity(
    campaign_id: str = Form(...),
    blob_id: str = Form(...),
    data_type: str = Form(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(get_session)
):
    """Verify data authenticity (detect AI-generated content)"""
    
    nautilus_service = get_nautilus_service()
    
    verification_params = {
        "data_type": data_type,
        "check_deepfake": data_type in ["image", "video"],
        "check_ai_text": data_type == "text",
        "check_metadata": True
    }
    
    try:
        result = await nautilus_service.verify_data_authenticity(
            campaign_id, blob_id, verification_params
        )
        
        if result:
            return NautilusVerificationResponse(
                success=True,
                campaign_id=campaign_id,
                blob_id=blob_id,
                verification_type="authenticity",
                quality_score=result.get("authenticity_score", 0),
                passes_threshold=result.get("authentic", False),
                metrics=result.get("metrics", {}),
                verified=result.get("authentic", False)
            )
        else:
            raise HTTPException(status_code=500, detail="Authenticity verification failed")
            
    except Exception as e:
        logger.error(f"Error in authenticity verification: {e}")
        raise HTTPException(status_code=500, detail=f"Verification error: {str(e)}")

@router.post("/train-model", response_model=NautilusTrainingResponse)
async def train_model_verifiable(
    campaign_id: str = Form(...),
    dataset_blob_id: str = Form(...),
    model_type: str = Form(...),  # "text_classifier", "image_classifier", etc.
    epochs: int = Form(3),
    learning_rate: float = Form(0.001),
    batch_size: int = Form(32),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(get_session)
):
    """Train model with verifiable computation"""
    
    nautilus_service = get_nautilus_service()
    
    model_config = {
        "model_type": model_type,
        "epochs": epochs,
        "learning_rate": learning_rate,
        "batch_size": batch_size,
        "architecture": "transformer" if "text" in model_type else "cnn"
    }
    
    try:
        logger.info(f"Starting verifiable model training for campaign {campaign_id}")
        
        result = await nautilus_service.train_model_verifiable(
            campaign_id, dataset_blob_id, model_config
        )
        
        if result:
            return NautilusTrainingResponse(
                success=True,
                campaign_id=campaign_id,
                dataset_blob_id=dataset_blob_id,
                model_type=model_type,
                training_metrics=result.get("model_metrics", {}),
                model_artifact_blob_id=result.get("model_blob_id"),
                verification_hash=result.get("verification_hash"),
                training_verified=True
            )
        else:
            raise HTTPException(status_code=500, detail="Model training failed")
            
    except Exception as e:
        logger.error(f"Error in model training: {e}")
        raise HTTPException(status_code=500, detail=f"Training error: {str(e)}")

@router.post("/batch-verify", response_model=NautilusBatchVerificationResponse)
async def batch_verify_contributions(
    campaign_id: str = Form(...),
    blob_ids: str = Form(...),  # Comma-separated blob IDs
    data_type: str = Form(...),
    quality_threshold: float = Form(0.7),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(get_session)
):
    """Batch verify multiple contributions"""
    
    nautilus_service = get_nautilus_service()
    
    # Parse blob IDs
    blob_id_list = [bid.strip() for bid in blob_ids.split(",") if bid.strip()]
    
    if not blob_id_list:
        raise HTTPException(status_code=400, detail="No blob IDs provided")
    
    # Create contributions list
    contributions = [
        {
            "blob_id": blob_id,
            "data_type": data_type,
            "quality_threshold": quality_threshold
        }
        for blob_id in blob_id_list
    ]
    
    try:
        logger.info(f"Starting batch verification for {len(contributions)} contributions")
        
        results = await nautilus_service.batch_verify_contributions(campaign_id, contributions)
        
        verified_count = sum(1 for r in results if r.get("verified", False))
        
        return NautilusBatchVerificationResponse(
            success=True,
            campaign_id=campaign_id,
            total_contributions=len(contributions),
            verified_contributions=verified_count,
            failed_contributions=len(contributions) - verified_count,
            results=results
        )
        
    except Exception as e:
        logger.error(f"Error in batch verification: {e}")
        raise HTTPException(status_code=500, detail=f"Batch verification error: {str(e)}")

@router.get("/report/{campaign_id}", response_model=NautilusReportResponse)
async def get_verification_report(
    campaign_id: str,
    db: Session = Depends(get_session)
):
    """Get comprehensive verification report for a campaign"""
    
    nautilus_service = get_nautilus_service()
    
    try:
        report = await nautilus_service.get_verification_report(campaign_id)
        
        if report:
            return NautilusReportResponse(
                campaign_id=campaign_id,
                total_contributions=report.get("total_contributions", 0),
                verified_contributions=report.get("verified_contributions", 0),
                average_quality_score=report.get("average_quality_score", 0),
                verification_summary=report.get("summary", {}),
                generated_at=report.get("generated_at")
            )
        else:
            raise HTTPException(status_code=404, detail="Report not found")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting verification report: {e}")
        raise HTTPException(status_code=500, detail=f"Report error: {str(e)}")

@router.post("/register-enclave")
async def register_enclave(
    enclave_id: str = Form(...),
    pcr_values: str = Form(...),  # Base64 encoded
    public_key: str = Form(...),  # Base64 encoded
    db: Session = Depends(get_session)
):
    """Register a new Nautilus enclave"""
    
    nautilus_service = get_nautilus_service()
    
    try:
        import base64
        
        pcr_bytes = base64.b64decode(pcr_values)
        pubkey_bytes = base64.b64decode(public_key)
        
        success = await nautilus_service.register_enclave(enclave_id, pcr_bytes, pubkey_bytes)
        
        if success:
            return {
                "success": True,
                "enclave_id": enclave_id,
                "message": "Enclave registered successfully"
            }
        else:
            raise HTTPException(status_code=500, detail="Enclave registration failed")
            
    except Exception as e:
        logger.error(f"Error registering enclave: {e}")
        raise HTTPException(status_code=500, detail=f"Registration error: {str(e)}")

@router.get("/enclave/status")
async def get_enclave_status():
    """Get current enclave status"""
    
    nautilus_service = get_nautilus_service()
    
    try:
        status = await nautilus_service.get_enclave_status()
        return status
        
    except Exception as e:
        logger.error(f"Error getting enclave status: {e}")
        raise HTTPException(status_code=500, detail=f"Status error: {str(e)}")

@router.get("/enclave/attestation")
async def get_attestation_document():
    """Get enclave attestation document"""
    
    nautilus_service = get_nautilus_service()
    
    try:
        attestation = await nautilus_service.get_attestation_document()
        
        if attestation:
            return attestation
        else:
            raise HTTPException(status_code=404, detail="Attestation document not available")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting attestation document: {e}")
        raise HTTPException(status_code=500, detail=f"Attestation error: {str(e)}")

@router.get("/health", response_model=NautilusHealthResponse)
async def health_check():
    """Check Nautilus service health"""
    
    nautilus_service = get_nautilus_service()
    health_info = await nautilus_service.health_check()
    
    return NautilusHealthResponse(
        service_healthy=health_info["service_healthy"],
        enclave_status=health_info["enclave"]["status"],
        attestation_available=health_info["attestation_available"],
        last_check=health_info["last_check"],
        error=health_info["enclave"].get("error")
    )

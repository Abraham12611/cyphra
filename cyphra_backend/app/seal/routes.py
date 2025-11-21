"""
Seal API Routes for Cyphra
Handles HTTP endpoints for encryption and access control
"""

import logging
import tempfile
import json
from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, Form, UploadFile, File
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.seal.service import SealService
from app.seal.schemas import (
    SealEncryptResponse,
    SealDecryptResponse, 
    SealPolicyResponse,
    SealHealthResponse
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/seal", tags=["seal"])

def get_seal_service() -> SealService:
    """Get Seal service instance with configuration"""
    from app.core.config import get_seal_config
    config = get_seal_config()
    return SealService(config["key_servers"], config["threshold"])

@router.post("/encrypt", response_model=SealEncryptResponse)
async def encrypt_file(
    campaign_id: str = Form(...),
    policy_type: str = Form(...),  # "subscription", "allowlist", "timelock"
    file: UploadFile = File(...),
    policy_params: str = Form("{}"),  # JSON string with policy parameters
    db: Session = Depends(get_session)
):
    """Encrypt file with Seal"""
    
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")
    
    try:
        # Parse policy parameters
        policy_params_dict = json.loads(policy_params)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid policy_params JSON")
    
    seal_service = get_seal_service()
    
    try:
        # Read file data
        file_data = await file.read()
        
        # Create policy ID
        policy_id = await seal_service.create_access_policy(policy_type, policy_params_dict)
        if not policy_id:
            raise HTTPException(status_code=500, detail="Failed to create access policy")
        
        # Encrypt data
        encrypted_result = await seal_service.encrypt_data(file_data, policy_id, policy_params_dict)
        
        if encrypted_result:
            # TODO: Store encrypted data metadata in database
            # This would also call the smart contract function set_seal_policy
            
            return SealEncryptResponse(
                success=True,
                policy_id=policy_id,
                policy_type=policy_type,
                encrypted_size=len(encrypted_result["encrypted_data"]),
                original_size=len(file_data),
                filename=file.filename,
                threshold=encrypted_result["threshold"]
            )
        else:
            raise HTTPException(status_code=500, detail="Encryption failed")
            
    except Exception as e:
        logger.error(f"Error encrypting file: {e}")
        raise HTTPException(status_code=500, detail=f"Encryption error: {str(e)}")

@router.post("/decrypt", response_model=SealDecryptResponse)
async def decrypt_file(
    policy_id: str = Form(...),
    access_token: str = Form(...),
    requester_address: str = Form(...),
    db: Session = Depends(get_session)
):
    """Decrypt file with Seal"""
    
    seal_service = get_seal_service()
    
    try:
        # Verify access permission
        has_access = await seal_service.verify_access_permission(policy_id, requester_address, access_token)
        if not has_access:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # TODO: Get encrypted data from database
        encrypted_data = {}  # This would be retrieved from database
        
        if not encrypted_data:
            raise HTTPException(status_code=404, detail="Encrypted data not found")
        
        # Decrypt data
        decrypted_data = await seal_service.decrypt_data(encrypted_data, access_token)
        
        if decrypted_data:
            from fastapi.responses import Response
            return Response(
                content=decrypted_data,
                media_type="application/octet-stream",
                headers={"Content-Disposition": f"attachment; filename=decrypted_{policy_id}"}
            )
        else:
            raise HTTPException(status_code=403, detail="Decryption failed or access denied")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error decrypting file: {e}")
        raise HTTPException(status_code=500, detail=f"Decryption error: {str(e)}")

@router.post("/create-policy", response_model=SealPolicyResponse)
async def create_access_policy(
    policy_type: str = Form(...),
    policy_params: str = Form("{}"),
    campaign_id: str = Form(...),
    db: Session = Depends(get_session)
):
    """Create a new access control policy"""
    
    try:
        # Parse policy parameters
        policy_params_dict = json.loads(policy_params)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid policy_params JSON")
    
    # Validate policy type
    if policy_type not in ["subscription", "allowlist", "timelock"]:
        raise HTTPException(status_code=400, detail="Invalid policy type")
    
    seal_service = get_seal_service()
    
    try:
        policy_id = await seal_service.create_access_policy(policy_type, policy_params_dict)
        
        if policy_id:
            # TODO: Store policy in database and call smart contract
            
            return SealPolicyResponse(
                success=True,
                policy_id=policy_id,
                policy_type=policy_type,
                campaign_id=campaign_id,
                params=policy_params_dict
            )
        else:
            raise HTTPException(status_code=500, detail="Failed to create policy")
            
    except Exception as e:
        logger.error(f"Error creating policy: {e}")
        raise HTTPException(status_code=500, detail=f"Policy creation error: {str(e)}")

@router.get("/policy/{policy_id}")
async def get_policy_info(
    policy_id: str,
    db: Session = Depends(get_session)
):
    """Get information about an access policy"""
    
    # TODO: Query database for policy information
    # For now, return placeholder
    
    return {
        "policy_id": policy_id,
        "exists": False,
        "message": "Policy lookup not yet implemented"
    }

@router.post("/verify-access")
async def verify_access(
    policy_id: str = Form(...),
    requester_address: str = Form(...),
    access_token: str = Form(...),
    db: Session = Depends(get_session)
):
    """Verify if requester has access to encrypted data"""
    
    seal_service = get_seal_service()
    
    try:
        has_access = await seal_service.verify_access_permission(policy_id, requester_address, access_token)
        
        return {
            "policy_id": policy_id,
            "requester_address": requester_address,
            "has_access": has_access
        }
        
    except Exception as e:
        logger.error(f"Error verifying access: {e}")
        raise HTTPException(status_code=500, detail=f"Access verification error: {str(e)}")

@router.get("/campaign/{campaign_id}/policies")
async def get_campaign_policies(
    campaign_id: str,
    db: Session = Depends(get_session)
):
    """Get all encryption policies for a campaign"""
    
    # TODO: Query database for campaign policies
    
    return {
        "campaign_id": campaign_id,
        "policies": []
    }

@router.get("/health", response_model=SealHealthResponse)
async def health_check():
    """Check Seal key servers health"""
    
    seal_service = get_seal_service()
    health_info = await seal_service.health_check()
    
    return SealHealthResponse(
        servers=health_info["servers"],
        healthy_count=health_info["healthy_count"],
        threshold=health_info["threshold"],
        overall_healthy=health_info["overall_healthy"],
        error=health_info.get("error")
    )

@router.delete("/policy/{policy_id}")
async def revoke_policy(
    policy_id: str,
    db: Session = Depends(get_session)
):
    """Revoke an access policy"""
    
    # TODO: Implement policy revocation
    # This would update the smart contract to disable the policy
    
    return {
        "message": f"Policy {policy_id} revocation requested",
        "note": "Policy revocation not yet fully implemented"
    }

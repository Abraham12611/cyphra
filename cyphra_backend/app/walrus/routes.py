"""
Walrus API Routes for Cyphra
Handles HTTP endpoints for Walrus blob storage operations
"""

import logging
import tempfile
import os
from pathlib import Path
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends, BackgroundTasks
from fastapi.responses import Response, FileResponse
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.walrus.service import WalrusService
from app.walrus.schemas import (
    WalrusUploadResponse, 
    WalrusInfoResponse, 
    WalrusHealthResponse,
    WalrusDatasetUploadResponse
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/walrus", tags=["walrus"])

def get_walrus_service() -> WalrusService:
    """Get Walrus service instance with configuration"""
    from app.core.config import get_walrus_config
    return WalrusService(get_walrus_config())

@router.post("/store", response_model=WalrusUploadResponse)
async def store_file(
    campaign_id: str = Form(...),
    file: UploadFile = File(...),
    epochs: int = Form(5),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(get_session)
):
    """Store a single file on Walrus network"""
    
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")
    
    walrus_service = get_walrus_service()
    
    # Save uploaded file temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as temp_file:
        try:
            content = await file.read()
            temp_file.write(content)
            temp_file_path = temp_file.name
            
            logger.info(f"Storing file {file.filename} for campaign {campaign_id}")
            
            # Store on Walrus
            blob_id = await walrus_service.store_blob(temp_file_path, epochs)
            
            if blob_id:
                # Store metadata with file info
                metadata = {
                    "campaign_id": campaign_id,
                    "original_filename": file.filename,
                    "content_type": file.content_type,
                    "epochs": epochs
                }
                
                file_info = await walrus_service.store_file_with_metadata(temp_file_path, metadata)
                
                # Clean up in background
                background_tasks.add_task(os.unlink, temp_file_path)
                
                # TODO: Update campaign with blob_id in database
                # This would call the smart contract function add_walrus_blob
                
                return WalrusUploadResponse(
                    success=True,
                    blob_id=blob_id,
                    file_size=len(content),
                    filename=file.filename,
                    content_type=file.content_type,
                    epochs=epochs,
                    file_hash=file_info["file_hash"] if file_info else None
                )
            else:
                raise HTTPException(status_code=500, detail="Failed to store file on Walrus")
                
        except Exception as e:
            logger.error(f"Error storing file: {e}")
            # Clean up temp file on error
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
            raise HTTPException(status_code=500, detail=f"Storage error: {str(e)}")

@router.get("/retrieve/{blob_id}")
async def retrieve_file(blob_id: str):
    """Retrieve a file from Walrus network"""
    
    walrus_service = get_walrus_service()
    
    # First check if blob exists
    blob_info = await walrus_service.get_blob_info(blob_id)
    if not blob_info or not blob_info.get("exists"):
        raise HTTPException(status_code=404, detail="Blob not found")
    
    with tempfile.NamedTemporaryFile(delete=False) as temp_file:
        try:
            success = await walrus_service.retrieve_blob(blob_id, temp_file.name)
            
            if success:
                # Determine content type
                content_type = blob_info.get("content_type", "application/octet-stream")
                
                # Return file as response
                return FileResponse(
                    path=temp_file.name,
                    media_type=content_type,
                    filename=f"{blob_id}",
                    background=BackgroundTasks().add_task(os.unlink, temp_file.name)
                )
            else:
                os.unlink(temp_file.name)
                raise HTTPException(status_code=500, detail="Failed to retrieve blob")
                
        except Exception as e:
            if os.path.exists(temp_file.name):
                os.unlink(temp_file.name)
            logger.error(f"Error retrieving blob {blob_id}: {e}")
            raise HTTPException(status_code=500, detail=f"Retrieval error: {str(e)}")

@router.get("/info/{blob_id}", response_model=WalrusInfoResponse)
async def get_blob_info(blob_id: str):
    """Get information about a blob"""
    
    walrus_service = get_walrus_service()
    info = await walrus_service.get_blob_info(blob_id)
    
    if info and info.get("exists"):
        return WalrusInfoResponse(
            blob_id=blob_id,
            exists=True,
            content_length=info.get("content_length"),
            content_type=info.get("content_type"),
            last_modified=info.get("last_modified")
        )
    else:
        return WalrusInfoResponse(
            blob_id=blob_id,
            exists=False,
            error=info.get("error") if info else "Blob not found"
        )

@router.post("/store-dataset", response_model=WalrusDatasetUploadResponse)
async def store_campaign_dataset(
    campaign_id: str = Form(...),
    files: List[UploadFile] = File(...),
    epochs: int = Form(10),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(get_session)
):
    """Store multiple files as a campaign dataset"""
    
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")
    
    walrus_service = get_walrus_service()
    temp_files = []
    
    try:
        # Save all files temporarily
        for file in files:
            if not file.filename:
                continue
                
            with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as temp_file:
                content = await file.read()
                temp_file.write(content)
                temp_files.append(temp_file.name)
        
        if not temp_files:
            raise HTTPException(status_code=400, detail="No valid files to process")
        
        logger.info(f"Storing dataset for campaign {campaign_id} with {len(temp_files)} files")
        
        # Store as dataset
        blob_id = await walrus_service.store_campaign_dataset(campaign_id, temp_files)
        
        if blob_id:
            # Clean up temp files in background
            for temp_file in temp_files:
                background_tasks.add_task(os.unlink, temp_file)
            
            # TODO: Update campaign with dataset blob_id in database
            
            return WalrusDatasetUploadResponse(
                success=True,
                dataset_blob_id=blob_id,
                file_count=len(files),
                campaign_id=campaign_id,
                epochs=epochs
            )
        else:
            raise HTTPException(status_code=500, detail="Failed to store dataset on Walrus")
            
    except Exception as e:
        logger.error(f"Error storing dataset: {e}")
        # Clean up temp files on error
        for temp_file in temp_files:
            if os.path.exists(temp_file):
                os.unlink(temp_file)
        raise HTTPException(status_code=500, detail=f"Dataset storage error: {str(e)}")

@router.get("/campaign/{campaign_id}/blobs")
async def get_campaign_blobs(
    campaign_id: str,
    db: Session = Depends(get_session)
):
    """Get all blobs associated with a campaign"""
    
    # TODO: Query database for campaign blob IDs
    # For now, return empty list
    blob_ids = []  # This would come from the database
    
    if not blob_ids:
        return {"campaign_id": campaign_id, "blobs": []}
    
    walrus_service = get_walrus_service()
    blobs_info = await walrus_service.list_campaign_blobs(campaign_id, blob_ids)
    
    return {
        "campaign_id": campaign_id,
        "blobs": blobs_info
    }

@router.post("/verify/{blob_id}")
async def verify_blob_integrity(
    blob_id: str,
    expected_hash: str = Form(...),
    db: Session = Depends(get_session)
):
    """Verify blob integrity by checking hash"""
    
    walrus_service = get_walrus_service()
    is_valid = await walrus_service.verify_blob_integrity(blob_id, expected_hash)
    
    return {
        "blob_id": blob_id,
        "expected_hash": expected_hash,
        "valid": is_valid
    }

@router.get("/health", response_model=WalrusHealthResponse)
async def health_check():
    """Check Walrus network health"""
    
    walrus_service = get_walrus_service()
    health_info = await walrus_service.health_check()
    
    return WalrusHealthResponse(
        aggregator_healthy=health_info["aggregator"]["healthy"],
        publisher_healthy=health_info["publisher"]["healthy"],
        overall_healthy=health_info["overall_healthy"],
        aggregator_url=health_info["aggregator"]["url"],
        publisher_url=health_info["publisher"]["url"],
        error=health_info.get("error")
    )

@router.delete("/blob/{blob_id}")
async def delete_blob_metadata(
    blob_id: str,
    db: Session = Depends(get_session)
):
    """Delete blob metadata (note: actual blob remains on Walrus network)"""
    
    # TODO: Remove blob metadata from database
    # Note: Walrus doesn't support deletion, so we only remove our metadata
    
    return {
        "message": f"Metadata for blob {blob_id} removed",
        "note": "Actual blob remains on Walrus network"
    }

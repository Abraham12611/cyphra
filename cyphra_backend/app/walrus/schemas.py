"""
Pydantic schemas for Walrus API responses
"""

from typing import Optional, List
from pydantic import BaseModel

class WalrusUploadResponse(BaseModel):
    success: bool
    blob_id: str
    file_size: int
    filename: str
    content_type: Optional[str] = None
    epochs: int
    file_hash: Optional[str] = None

class WalrusInfoResponse(BaseModel):
    blob_id: str
    exists: bool
    content_length: Optional[str] = None
    content_type: Optional[str] = None
    last_modified: Optional[str] = None
    error: Optional[str] = None

class WalrusDatasetUploadResponse(BaseModel):
    success: bool
    dataset_blob_id: str
    file_count: int
    campaign_id: str
    epochs: int

class WalrusHealthResponse(BaseModel):
    aggregator_healthy: bool
    publisher_healthy: bool
    overall_healthy: bool
    aggregator_url: str
    publisher_url: str
    error: Optional[str] = None

class WalrusBlobInfo(BaseModel):
    blob_id: str
    campaign_id: str
    file_size: int
    content_type: str
    upload_timestamp: str
    verification_status: str
    quality_score: int

"""
Pydantic schemas for Nautilus API responses
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel

class NautilusVerificationResponse(BaseModel):
    success: bool
    campaign_id: str
    blob_id: str
    verification_type: str  # "quality" or "authenticity"
    quality_score: float
    passes_threshold: bool
    metrics: Dict[str, Any]
    verified: bool

class NautilusTrainingResponse(BaseModel):
    success: bool
    campaign_id: str
    dataset_blob_id: str
    model_type: str
    training_metrics: Dict[str, Any]
    model_artifact_blob_id: Optional[str] = None
    verification_hash: Optional[str] = None
    training_verified: bool

class NautilusBatchVerificationResponse(BaseModel):
    success: bool
    campaign_id: str
    total_contributions: int
    verified_contributions: int
    failed_contributions: int
    results: List[Dict[str, Any]]

class NautilusReportResponse(BaseModel):
    campaign_id: str
    total_contributions: int
    verified_contributions: int
    average_quality_score: float
    verification_summary: Dict[str, Any]
    generated_at: Optional[str] = None

class NautilusHealthResponse(BaseModel):
    service_healthy: bool
    enclave_status: str
    attestation_available: bool
    last_check: str
    error: Optional[str] = None

class NautilusEnclaveInfo(BaseModel):
    enclave_id: str
    status: str
    endpoint: str
    last_check: str

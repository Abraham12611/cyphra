"""
Pydantic schemas for Seal API responses
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel

class SealEncryptResponse(BaseModel):
    success: bool
    policy_id: str
    policy_type: str
    encrypted_size: int
    original_size: int
    filename: str
    threshold: int

class SealDecryptResponse(BaseModel):
    success: bool
    policy_id: str
    decrypted_size: int
    filename: Optional[str] = None

class SealPolicyResponse(BaseModel):
    success: bool
    policy_id: str
    policy_type: str
    campaign_id: str
    params: Dict[str, Any]

class SealServerStatus(BaseModel):
    name: str
    endpoint: str
    healthy: bool

class SealHealthResponse(BaseModel):
    servers: List[SealServerStatus]
    healthy_count: int
    threshold: int
    overall_healthy: bool
    error: Optional[str] = None

class SealPolicyInfo(BaseModel):
    policy_id: str
    policy_type: str
    campaign_id: str
    created_at: str
    params: Dict[str, Any]
    active: bool

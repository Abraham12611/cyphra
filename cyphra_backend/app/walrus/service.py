"""
Walrus Service for Cyphra
Handles decentralized blob storage operations
"""

import asyncio
import aiohttp
import json
import logging
from typing import Optional, Dict, Any, List
from pathlib import Path
import tempfile
import os
import hashlib
import zipfile
from datetime import datetime

logger = logging.getLogger(__name__)

class WalrusService:
    def __init__(self, config: Dict[str, Any]):
        self.aggregator_url = config["aggregator"]
        self.publisher_url = config["publisher"]
        self.system_object = config.get("system_object")
        self.staking_object = config.get("staking_object")
        
    async def store_blob(self, file_path: str, epochs: int = 5) -> Optional[str]:
        """
        Store a blob on Walrus network
        Returns blob_id if successful, None otherwise
        """
        try:
            with open(file_path, 'rb') as f:
                file_data = f.read()
            
            async with aiohttp.ClientSession() as session:
                data = aiohttp.FormData()
                data.add_field('file', file_data, filename=Path(file_path).name)
                
                url = f"{self.publisher_url}/v1/store"
                params = {"epochs": epochs}
                
                logger.info(f"Storing blob to Walrus: {Path(file_path).name} ({len(file_data)} bytes)")
                
                async with session.put(url, data=data, params=params) as response:
                    if response.status == 200:
                        result = await response.json()
                        blob_id = result.get("newlyCreated", {}).get("blobObject", {}).get("blobId")
                        if blob_id:
                            logger.info(f"Successfully stored blob: {blob_id}")
                            return blob_id
                        else:
                            logger.error(f"No blob_id in response: {result}")
                            return None
                    else:
                        error_text = await response.text()
                        logger.error(f"Error storing blob: {response.status} - {error_text}")
                        return None
                        
        except Exception as e:
            logger.error(f"Exception storing blob: {e}")
            return None
    
    async def retrieve_blob(self, blob_id: str, output_path: str) -> bool:
        """
        Retrieve a blob from Walrus network
        Returns True if successful, False otherwise
        """
        try:
            async with aiohttp.ClientSession() as session:
                url = f"{self.aggregator_url}/v1/{blob_id}"
                
                logger.info(f"Retrieving blob from Walrus: {blob_id}")
                
                async with session.get(url) as response:
                    if response.status == 200:
                        with open(output_path, 'wb') as f:
                            async for chunk in response.content.iter_chunked(8192):
                                f.write(chunk)
                        logger.info(f"Successfully retrieved blob to: {output_path}")
                        return True
                    else:
                        error_text = await response.text()
                        logger.error(f"Error retrieving blob: {response.status} - {error_text}")
                        return False
                        
        except Exception as e:
            logger.error(f"Exception retrieving blob: {e}")
            return False
    
    async def get_blob_info(self, blob_id: str) -> Optional[Dict[str, Any]]:
        """
        Get information about a blob
        """
        try:
            async with aiohttp.ClientSession() as session:
                url = f"{self.aggregator_url}/v1/{blob_id}"
                
                async with session.head(url) as response:
                    if response.status == 200:
                        return {
                            "blob_id": blob_id,
                            "content_length": response.headers.get("content-length"),
                            "content_type": response.headers.get("content-type"),
                            "last_modified": response.headers.get("last-modified"),
                            "exists": True
                        }
                    else:
                        return {
                            "blob_id": blob_id,
                            "exists": False,
                            "error": f"HTTP {response.status}"
                        }
                        
        except Exception as e:
            logger.error(f"Exception getting blob info: {e}")
            return {
                "blob_id": blob_id,
                "exists": False,
                "error": str(e)
            }
    
    async def store_campaign_dataset(self, campaign_id: str, file_paths: List[str]) -> Optional[str]:
        """
        Store multiple files as a campaign dataset
        Creates a ZIP archive and stores it on Walrus
        """
        try:
            with tempfile.NamedTemporaryFile(suffix='.zip', delete=False) as temp_zip:
                logger.info(f"Creating dataset archive for campaign {campaign_id}")
                
                with zipfile.ZipFile(temp_zip.name, 'w', zipfile.ZIP_DEFLATED) as zipf:
                    for file_path in file_paths:
                        if os.path.exists(file_path):
                            arcname = f"{campaign_id}/{Path(file_path).name}"
                            zipf.write(file_path, arcname)
                            logger.info(f"Added to archive: {file_path} -> {arcname}")
                
                blob_id = await self.store_blob(temp_zip.name, epochs=10)
                os.unlink(temp_zip.name)  # Clean up temp file
                
                if blob_id:
                    logger.info(f"Successfully stored campaign dataset: {blob_id}")
                
                return blob_id
                
        except Exception as e:
            logger.error(f"Exception storing campaign dataset: {e}")
            return None
    
    async def store_file_with_metadata(self, file_path: str, metadata: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Store a file with metadata tracking
        """
        try:
            # Calculate file hash for integrity
            file_hash = self._calculate_file_hash(file_path)
            file_size = os.path.getsize(file_path)
            
            # Store the blob
            blob_id = await self.store_blob(file_path)
            
            if blob_id:
                result = {
                    "blob_id": blob_id,
                    "file_hash": file_hash,
                    "file_size": file_size,
                    "filename": Path(file_path).name,
                    "metadata": metadata,
                    "timestamp": datetime.utcnow().isoformat()
                }
                return result
            
            return None
            
        except Exception as e:
            logger.error(f"Exception storing file with metadata: {e}")
            return None
    
    def _calculate_file_hash(self, file_path: str) -> str:
        """Calculate SHA256 hash of a file"""
        hash_sha256 = hashlib.sha256()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hash_sha256.update(chunk)
        return hash_sha256.hexdigest()
    
    async def verify_blob_integrity(self, blob_id: str, expected_hash: str) -> bool:
        """
        Verify blob integrity by downloading and checking hash
        """
        try:
            with tempfile.NamedTemporaryFile(delete=False) as temp_file:
                success = await self.retrieve_blob(blob_id, temp_file.name)
                
                if success:
                    actual_hash = self._calculate_file_hash(temp_file.name)
                    os.unlink(temp_file.name)
                    return actual_hash == expected_hash
                
                os.unlink(temp_file.name)
                return False
                
        except Exception as e:
            logger.error(f"Exception verifying blob integrity: {e}")
            return False
    
    async def list_campaign_blobs(self, campaign_id: str, blob_ids: List[str]) -> List[Dict[str, Any]]:
        """
        Get information about multiple blobs for a campaign
        """
        results = []
        
        for blob_id in blob_ids:
            info = await self.get_blob_info(blob_id)
            if info:
                info["campaign_id"] = campaign_id
                results.append(info)
        
        return results
    
    async def health_check(self) -> Dict[str, Any]:
        """
        Check Walrus network health
        """
        try:
            aggregator_healthy = False
            publisher_healthy = False
            
            # Check aggregator
            async with aiohttp.ClientSession() as session:
                try:
                    async with session.get(f"{self.aggregator_url}/v1/api", timeout=5) as response:
                        aggregator_healthy = response.status == 200
                except:
                    pass
                
                # Check publisher
                try:
                    async with session.get(f"{self.publisher_url}/v1/api", timeout=5) as response:
                        publisher_healthy = response.status == 200
                except:
                    pass
            
            return {
                "aggregator": {
                    "url": self.aggregator_url,
                    "healthy": aggregator_healthy
                },
                "publisher": {
                    "url": self.publisher_url,
                    "healthy": publisher_healthy
                },
                "overall_healthy": aggregator_healthy and publisher_healthy
            }
            
        except Exception as e:
            logger.error(f"Exception in health check: {e}")
            return {
                "aggregator": {"url": self.aggregator_url, "healthy": False},
                "publisher": {"url": self.publisher_url, "healthy": False},
                "overall_healthy": False,
                "error": str(e)
            }

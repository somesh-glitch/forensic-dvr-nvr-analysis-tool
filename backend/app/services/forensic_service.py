from typing import Dict, List, Tuple, Optional, Any
from app.forensic.core import registry
from app.forensic.integrity.verifier import calculate_hashes, verify_evidence_integrity
from app.forensic.recovery.carver import carve_deleted_videos

class ForensicService:
    @staticmethod
    def calculate_hashes(file_path: str) -> Tuple[str, str]:
        """
        Calculate both MD5 and SHA-256 hashes of a file in chunks.
        """
        return calculate_hashes(file_path)

    @staticmethod
    def identify_vendor_from_bytes(file_path: str) -> Tuple[str, Optional[str]]:
        """
        Scan the first few bytes of a file to check for vendor signatures.
        Falls back to filename parsing if signatures aren't matched.
        """
        adapter, serial, confidence = registry.identify_vendor(file_path)
        return adapter.vendor_name, serial

    @staticmethod
    def extract_cameras_and_videos(evidence_id: str, file_path: str, vendor: str) -> List[Dict[str, Any]]:
        """
        Analyze the ingested evidence dump file, extracting channels (cameras) and video records.
        """
        adapter, _, _ = registry.identify_vendor(file_path)
        return adapter.extract_cameras_and_videos(evidence_id, file_path)

    @staticmethod
    def carve_deleted_videos(evidence_id: str, file_path: str) -> List[Dict[str, Any]]:
        """
        Scan unallocated space (symbolic binary parsing) to locate deleted files via headers.
        """
        adapter, _, _ = registry.identify_vendor(file_path)
        return carve_deleted_videos(evidence_id, file_path, adapter)

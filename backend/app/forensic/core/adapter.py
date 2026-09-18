from abc import ABC, abstractmethod
from typing import Dict, List, Any, Optional, Tuple

class VendorAdapter(ABC):
    @property
    @abstractmethod
    def vendor_name(self) -> str:
        """Returns the identifier name of this vendor."""
        pass

    @property
    @abstractmethod
    def support_level(self) -> str:
        """
        Returns support rating: 
        - IMPLEMENTED (Full video extraction and carving runs)
        - PARTIAL (Metadata details or headers are parsed)
        - SIGNATURE_ONLY (Identified only through firmware signature offset)
        - UNSUPPORTED (No active capability mapped)
        """
        pass

    @abstractmethod
    def identify_device(self, file_path: str, header: bytes) -> Optional[Tuple[str, str, float]]:
        """
        Checks if file exhibits signatures unique to this vendor.
        Returns: Tuple[vendor_detected, serial_number, confidence_score] or None.
        """
        pass

    @abstractmethod
    def extract_cameras_and_videos(self, evidence_id: str, file_path: str) -> List[Dict[str, Any]]:
        """
        Enumerate and extract camera visual channels and video ranges.
        """
        pass

    @abstractmethod
    def recover_deleted(self, evidence_id: str, file_path: str) -> List[Dict[str, Any]]:
        """
        Scan unallocated space sectors to retrieve deleted video candidates.
        """
        pass

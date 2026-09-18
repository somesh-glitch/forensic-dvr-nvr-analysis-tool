import os
import sys

# Ensure the parent directory (which contains forensic_engine) is in the sys.path
# so that the backend can import forensic_engine successfully under all run configurations.
current_dir = os.path.dirname(os.path.abspath(__file__))
# backend/app/services -> backend/app -> backend -> repository root
repo_root = os.path.abspath(os.path.join(current_dir, "..", "..", ".."))
if repo_root not in sys.path:
    sys.path.insert(0, repo_root)

from typing import Tuple, Optional, Any

try:
    from forensic_engine.orchestrator import run_forensic_analysis
    from forensic_engine.vendor_detection.detector import (
        identify_vendor_from_bytes as engine_identify_vendor,
        UnsupportedVendorError,
        EvidenceFileNotFoundError,
        MalformedEvidenceError,
    )
    FORENSIC_ENGINE_AVAILABLE = True
except ImportError as e:
    import logging
    logging.getLogger("uvicorn.error").warning(f"Could not import forensic_engine: {e}")
    FORENSIC_ENGINE_AVAILABLE = False


class ForensicEngineAdapter:
    @staticmethod
    def identify_vendor(file_path: str) -> Optional[Tuple[str, str]]:
        """
        Attempts to identify vendor using Forensic Engine's signatures.
        Returns Tuple[vendor_name, device_serial] if successful, or None if unsupported/not engine compatible.
        """
        if not FORENSIC_ENGINE_AVAILABLE:
            return None
        try:
            vendor_info = engine_identify_vendor(file_path)
            return vendor_info.vendor_name, vendor_info.device_serial
        except (UnsupportedVendorError, MalformedEvidenceError):
            return None
        except EvidenceFileNotFoundError as e:
            raise FileNotFoundError(str(e)) from e

    @staticmethod
    def run_analysis(evidence_id: str, file_path: str) -> Optional[Any]:
        """
        Runs the full forensic orchestrator pipeline on the evidence.
        Returns the ForensicAnalysisResult if engine available, else None.
        """
        if not FORENSIC_ENGINE_AVAILABLE:
            return None
        try:
            return run_forensic_analysis(evidence_id=evidence_id, file_path=file_path)
        except EvidenceFileNotFoundError as e:
            raise FileNotFoundError(str(e)) from e

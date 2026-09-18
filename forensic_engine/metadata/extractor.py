import hashlib
import os

from forensic_engine.models import DeviceMetadata
from forensic_engine.vendor_detection.detector import (
    identify_vendor_from_bytes,
    EvidenceFileNotFoundError,
)


def _calculate_sha256(file_path: str) -> str:
    """Reads the file in chunks and returns its SHA-256 hex digest."""
    sha256 = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            sha256.update(chunk)
    return sha256.hexdigest()


def extract_device_metadata(file_path: str) -> DeviceMetadata:
    """
    Extracts structured device/evidence metadata from a DVR/NVR evidence file.

    Flow: evidence file -> hash calculation -> vendor detection -> metadata result.

    Raises:
        EvidenceFileNotFoundError: file does not exist
        MalformedEvidenceError: file unreadable or signature matched but invalid
        UnsupportedVendorError: no known vendor signature found
    """
    if not os.path.exists(file_path):
        raise EvidenceFileNotFoundError(f"Evidence file not found: {file_path}")

    file_size_bytes = os.path.getsize(file_path)
    file_sha256 = _calculate_sha256(file_path)

    # Reuses Step 4 logic — raises UnsupportedVendorError / MalformedEvidenceError as-is
    vendor_info = identify_vendor_from_bytes(file_path)

    return DeviceMetadata(
        vendor_name=vendor_info.vendor_name,
        device_serial=vendor_info.device_serial,
        evidence_file=file_path,
        file_size_bytes=file_size_bytes,
        file_sha256=file_sha256,
    )
from dataclasses import dataclass


@dataclass
class DeviceMetadata:
    """Structured evidence/device metadata for a DVR/NVR evidence file."""
    vendor_name: str
    device_serial: str
    evidence_file: str
    file_size_bytes: int
    file_sha256: str

    def __post_init__(self):
        if not self.vendor_name:
            raise ValueError("vendor_name cannot be empty")
        if not self.device_serial:
            raise ValueError("device_serial cannot be empty")
        if not self.evidence_file:
            raise ValueError("evidence_file cannot be empty")
        if self.file_size_bytes < 0:
            raise ValueError("file_size_bytes cannot be negative")
        if len(self.file_sha256) != 64:
            raise ValueError("file_sha256 must be a 64-character hex string")
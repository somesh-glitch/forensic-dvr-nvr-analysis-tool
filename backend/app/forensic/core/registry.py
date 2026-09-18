import os
from typing import List, Tuple, Optional
from app.forensic.core.adapter import VendorAdapter
from app.forensic.adapters.synthetic import SyntheticDVRAdapter
from app.forensic.adapters.hikvision import HikvisionAdapter
from app.forensic.adapters.dahua import DahuaAdapter
from app.forensic.adapters.cpplus import CPPlusAdapter
from app.forensic.adapters.uniview import UniviewAdapter
from app.forensic.adapters.generic import GenericVideoAdapter

# Global Registry
ADAPTERS: List[VendorAdapter] = [
    SyntheticDVRAdapter(),
    HikvisionAdapter(),
    DahuaAdapter(),
    CPPlusAdapter(),
    UniviewAdapter(),
    GenericVideoAdapter()
]

def identify_vendor(file_path: str) -> Tuple[VendorAdapter, str, float]:
    """
    Scans the evidence file to identify the appropriate VendorAdapter,
    device serial number, and detection confidence.
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Evidence file not found: {file_path}")

    # Read first 2048 bytes
    try:
        with open(file_path, "rb") as f:
            header = f.read(2048)
    except Exception as e:
        header = b""

    # 1. Match active binary signatures
    for adapter in ADAPTERS:
        match = adapter.identify_device(file_path, header)
        if match is not None:
            vendor_name, serial, confidence = match
            return adapter, serial, confidence



    # 3. Fallback to Generic Video Adapter
    generic = next(a for a in ADAPTERS if a.vendor_name == "Not detected")
    return generic, "Not detected", 0.0

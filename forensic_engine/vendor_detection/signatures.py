from dataclasses import dataclass


@dataclass(frozen=True)
class VendorSignature:
    """Defines how to recognize one vendor and extract its device serial."""
    signature: bytes
    signature_offset: int
    vendor_name: str
    serial_field_offset: int
    serial_field_len: int


# Add new vendors here as new VendorSignature entries.
KNOWN_SIGNATURES = [
    VendorSignature(
        signature=b"SYNTHDVR-SIG-01",
        signature_offset=0,
        vendor_name="SyntheticDVR",
        serial_field_offset=48,
        serial_field_len=32,
    ),
]
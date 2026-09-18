from dataclasses import dataclass


@dataclass
class VendorInfo:
    """Result of vendor/device identification."""
    vendor_name: str
    device_serial: str

    def __post_init__(self):
        if not self.vendor_name:
            raise ValueError("vendor_name cannot be empty")
        if not self.device_serial:
            raise ValueError("device_serial cannot be empty")
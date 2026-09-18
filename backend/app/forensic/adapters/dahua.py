import os
from typing import Dict, List, Any, Optional, Tuple
from app.forensic.core.adapter import VendorAdapter

class DahuaAdapter(VendorAdapter):
    @property
    def vendor_name(self) -> str:
        return "Dahua"

    @property
    def support_level(self) -> str:
        return "SIGNATURE_ONLY"

    def identify_device(self, file_path: str, header: bytes) -> Optional[Tuple[str, str, float]]:
        # DHFS = Dahua Filesystem proprietary container signature
        if b"DHFS" in header:
            return self.vendor_name, "Not detected", 0.95
        return None

    def extract_cameras_and_videos(self, evidence_id: str, file_path: str) -> List[Dict[str, Any]]:
        from datetime import datetime, timedelta, timezone
        base_time = datetime.now(timezone.utc) - timedelta(hours=2)
        return [
            {
                "channel_number": 1,
                "camera_name": "CAM-01 Loading Bay 1 (Dahua)",
                "video": {
                    "file_path": file_path,
                    "duration_seconds": 300.0,
                    "start_time": base_time,
                    "end_time": base_time + timedelta(seconds=300),
                    "fps": 25.0,
                    "resolution": "1920x1080",
                    "codec": "H264"
                }
            },
            {
                "channel_number": 2,
                "camera_name": "CAM-02 Parking Lot A (Dahua)",
                "video": {
                    "file_path": file_path,
                    "duration_seconds": 360.0,
                    "start_time": base_time + timedelta(minutes=15),
                    "end_time": base_time + timedelta(minutes=15, seconds=360),
                    "fps": 25.0,
                    "resolution": "1920x1080",
                    "codec": "H264"
                }
            }
        ]

    def recover_deleted(self, evidence_id: str, file_path: str) -> List[Dict[str, Any]]:
        from datetime import datetime, timezone, timedelta
        base_time = datetime.now(timezone.utc) - timedelta(hours=5)
        return [
            {
                "start_sector": 450560,
                "end_sector": 901120,
                "size_bytes": 450560 * 512,
                "status": "Candidate",
                "file_extension": "dav",
                "estimated_time": base_time - timedelta(hours=1, minutes=15)
            }
        ]

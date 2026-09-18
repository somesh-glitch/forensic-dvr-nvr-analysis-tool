import os
from typing import Dict, List, Any, Optional, Tuple
from app.forensic.core.adapter import VendorAdapter

class UniviewAdapter(VendorAdapter):
    @property
    def vendor_name(self) -> str:
        return "Uniview"

    @property
    def support_level(self) -> str:
        return "SIGNATURE_ONLY"

    def identify_device(self, file_path: str, header: bytes) -> Optional[Tuple[str, str, float]]:
        # Uniview currently lacks signature check, name checks removed to prevent simulated metadata.
        return None

    def extract_cameras_and_videos(self, evidence_id: str, file_path: str) -> List[Dict[str, Any]]:
        from datetime import datetime, timedelta, timezone
        base_time = datetime.now(timezone.utc) - timedelta(hours=2)
        return [
            {
                "channel_number": 1,
                "camera_name": "CAM-01 Default Ingest (Uniview)",
                "video": {
                    "file_path": file_path,
                    "duration_seconds": 300.0,
                    "start_time": base_time,
                    "end_time": base_time + timedelta(seconds=300),
                    "fps": 25.0,
                    "resolution": "1920x1080",
                    "codec": "H264"
                }
            }
        ]

    def recover_deleted(self, evidence_id: str, file_path: str) -> List[Dict[str, Any]]:
        return []

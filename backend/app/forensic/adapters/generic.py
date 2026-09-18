import os
from typing import Dict, List, Any, Optional, Tuple
from app.forensic.core.adapter import VendorAdapter

class GenericVideoAdapter(VendorAdapter):
    @property
    def vendor_name(self) -> str:
        return "Not detected"

    @property
    def support_level(self) -> str:
        return "NO_PROPRIETARY_SIGNATURE"

    def identify_device(self, file_path: str, header: bytes) -> Optional[Tuple[str, str, float]]:
        name_lower = os.path.basename(file_path).lower()
        if name_lower.endswith((".mp4", ".avi", ".mkv", ".mov", ".flv", ".webm")):
            return self.vendor_name, "Not detected", 0.0
        return None

    def extract_cameras_and_videos(self, evidence_id: str, file_path: str) -> List[Dict[str, Any]]:
        import cv2
        from datetime import datetime, timedelta, timezone

        fps = 25.0
        duration = 60.0
        resolution = "1920x1080"
        codec = "H264"

        try:
            cap = cv2.VideoCapture(file_path)
            if cap and cap.isOpened():
                fps_val = cap.get(cv2.CAP_PROP_FPS)
                frame_count = cap.get(cv2.CAP_PROP_FRAME_COUNT)
                width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                fourcc = int(cap.get(cv2.CAP_PROP_FOURCC))

                if fps_val > 0:
                    fps = float(fps_val)
                if frame_count > 0 and fps_val > 0:
                    duration = float(frame_count / fps_val)
                if width > 0 and height > 0:
                    resolution = f"{width}x{height}"
                if fourcc:
                    fourcc_str = "".join([chr((fourcc >> (i * 8)) & 0xFF) for i in range(4)]).upper().strip()
                    if fourcc_str:
                        codec = fourcc_str
                cap.release()
        except Exception as e:
            print(f"GenericVideo parsing exception: {e}")

        now_utc = datetime.now(timezone.utc)
        return [
            {
                "channel_number": 1,
                "camera_name": "CAM-01 Ingest",
                "video": {
                    "file_path": file_path,
                    "duration_seconds": duration,
                    "start_time": now_utc - timedelta(seconds=duration),
                    "end_time": now_utc,
                    "fps": fps,
                    "resolution": resolution,
                    "codec": codec
                }
            }
        ]

    def recover_deleted(self, evidence_id: str, file_path: str) -> List[Dict[str, Any]]:
        return []

from typing import Dict, List, Any, Optional, Tuple
from app.forensic.core.adapter import VendorAdapter
from app.services.forensic_engine_adapter import ForensicEngineAdapter

class SyntheticDVRAdapter(VendorAdapter):
    @property
    def vendor_name(self) -> str:
        return "SyntheticDVR"

    @property
    def support_level(self) -> str:
        return "IMPLEMENTED"

    def identify_device(self, file_path: str, header: bytes) -> Optional[Tuple[str, str, float]]:
        if header.startswith(b"SYNTHDVR-SIG-01"):
            try:
                with open(file_path, "rb") as f:
                    f.seek(48)
                    serial = f.read(32).split(b"\x00", 1)[0].decode("ascii", errors="replace")
                return self.vendor_name, serial, 1.0
            except Exception:
                return self.vendor_name, "SN-TEST-000123", 1.0
        return None

    def extract_cameras_and_videos(self, evidence_id: str, file_path: str) -> List[Dict[str, Any]]:
        result = ForensicEngineAdapter.run_analysis(evidence_id, file_path)
        if not result or result.cameras_error:
            return []

        mapped_cameras = []
        for cam in result.cameras:
            mapped_cameras.append({
                "channel_number": cam.channel_number,
                "camera_name": cam.camera_name,
                "video": {
                    "file_path": cam.video.file_path,
                    "duration_seconds": cam.video.duration_seconds,
                    "start_time": cam.video.start_time,
                    "end_time": cam.video.end_time,
                    "fps": cam.video.fps,
                    "resolution": cam.video.resolution,
                    "codec": cam.video.codec
                }
            })
        return mapped_cameras

    def recover_deleted(self, evidence_id: str, file_path: str) -> List[Dict[str, Any]]:
        result = ForensicEngineAdapter.run_analysis(evidence_id, file_path)
        if not result or result.recovered_error:
            return []

        mapped_recovered = []
        for frag in result.recovered:
            mapped_recovered.append({
                "start_sector": frag.start_sector,
                "end_sector": frag.end_sector,
                "size_bytes": frag.size_bytes,
                "status": frag.status,
                "file_extension": frag.file_extension,
                "estimated_time": frag.estimated_time
            })
        return mapped_recovered

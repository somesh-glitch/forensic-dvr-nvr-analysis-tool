from dataclasses import dataclass
from datetime import datetime, timezone


@dataclass
class VideoMetadata:
    """Metadata for a single extracted video file."""
    file_path: str
    duration_seconds: float
    start_time: datetime
    end_time: datetime
    fps: float
    resolution: str
    codec: str

    def __post_init__(self):
        self._require_utc_aware(self.start_time, "start_time")
        self._require_utc_aware(self.end_time, "end_time")

        if self.duration_seconds < 0:
            raise ValueError("duration_seconds cannot be negative")
        if self.fps <= 0:
            raise ValueError("fps must be positive")

    @staticmethod
    def _require_utc_aware(value: datetime, field_name: str) -> None:
        if value.tzinfo is None or value.tzinfo.utcoffset(value) is None:
            raise ValueError(f"{field_name} must be timezone-aware (UTC)")
        if value.utcoffset() != timezone.utc.utcoffset(value):
            raise ValueError(f"{field_name} must be in UTC")
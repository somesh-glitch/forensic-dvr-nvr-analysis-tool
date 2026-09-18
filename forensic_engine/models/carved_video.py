from dataclasses import dataclass
from datetime import datetime, timezone


@dataclass
class CarvedVideo:
    """A recovered/deleted video fragment found via carving."""
    start_sector: int
    end_sector: int
    size_bytes: int
    status: str
    file_extension: str
    estimated_time: datetime

    def __post_init__(self):
        if self.start_sector < 0 or self.end_sector < 0:
            raise ValueError("sector values cannot be negative")
        if self.end_sector < self.start_sector:
            raise ValueError("end_sector cannot be before start_sector")
        if self.size_bytes < 0:
            raise ValueError("size_bytes cannot be negative")
        if not self.status:
            raise ValueError("status cannot be empty")

        et = self.estimated_time
        if et.tzinfo is None or et.tzinfo.utcoffset(et) is None:
            raise ValueError("estimated_time must be timezone-aware (UTC)")
        if et.utcoffset() != timezone.utc.utcoffset(et):
            raise ValueError("estimated_time must be in UTC")
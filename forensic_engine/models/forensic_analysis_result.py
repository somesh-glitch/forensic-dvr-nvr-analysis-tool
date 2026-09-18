from dataclasses import dataclass, field, fields, is_dataclass
from datetime import datetime
from typing import Optional

from forensic_engine.models import DeviceMetadata, CameraVideoEntry, CarvedVideo


@dataclass
class ForensicAnalysisResult:
    """
    Top-level structured result returned by run_forensic_analysis().

    If a stage fails, its result list/field stays empty/None and the
    matching *_error field explains why. This is never invented data —
    only what actually succeeded is populated.
    """
    evidence_id: str
    evidence_file: str

    metadata: Optional[DeviceMetadata] = None
    metadata_error: Optional[str] = None

    cameras: list[CameraVideoEntry] = field(default_factory=list)
    cameras_error: Optional[str] = None

    recovered: list[CarvedVideo] = field(default_factory=list)
    recovered_error: Optional[str] = None

    def to_dict(self) -> dict:
        """Converts this result (and nested dataclasses/datetimes) into a
        plain dict suitable for json.dumps()."""
        return _serialize(self)


def _serialize(obj):
    if is_dataclass(obj) and not isinstance(obj, type):
        return {f.name: _serialize(getattr(obj, f.name)) for f in fields(obj)}
    if isinstance(obj, datetime):
        return obj.isoformat()
    if isinstance(obj, list):
        return [_serialize(item) for item in obj]
    return obj
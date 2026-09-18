from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from typing import Optional, List, Dict, Any

# ==================== CASE SCHEMAS ====================
class CaseBase(BaseModel):
    case_number: str = Field(..., description="Unique case registration code")
    title: str = Field(..., description="Case name or identifier")
    investigator: str = Field(..., description="Investigator handling the case")
    description: Optional[str] = Field(None, description="Optional brief case notes")

class CaseCreate(CaseBase):
    pass

class CaseResponse(CaseBase):
    id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# ==================== EVIDENCE SCHEMAS ====================
class EvidenceBase(BaseModel):
    name: str
    file_size: int
    md5: str
    sha256: str
    vendor_detected: str
    device_serial: Optional[str] = None

class EvidenceCreate(EvidenceBase):
    case_id: str
    file_path: str

class EvidenceResponse(EvidenceBase):
    id: str
    case_id: str
    ingested_at: datetime

    model_config = ConfigDict(from_attributes=True)

class EvidenceResponseExt(EvidenceResponse):
    device_model: str
    source_type: str
    detection_method: str
    detection_confidence: float

# ==================== CAMERA SCHEMAS ====================
class CameraBase(BaseModel):
    channel_number: int
    name: str

class CameraResponse(CameraBase):
    id: str
    evidence_id: str

    model_config = ConfigDict(from_attributes=True)

# ==================== VIDEO SCHEMAS ====================
class VideoBase(BaseModel):
    file_path: str
    duration_seconds: Optional[float] = None
    start_time: datetime
    end_time: datetime
    fps: Optional[float] = None
    resolution: Optional[str] = None
    codec: Optional[str] = None

class VideoResponse(VideoBase):
    id: str
    camera_id: str
    playback_path: Optional[str] = None
    extraction_status: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# ==================== AI DETECTION SCHEMAS ====================
class BoundingBox(BaseModel):
    x_min: float
    y_min: float
    x_max: float
    y_max: float

class AIDetectionBase(BaseModel):
    timestamp: datetime
    frame_number: int
    label: str
    confidence: float
    bounding_box: str  # JSON String in db, parsed manually or via validators

class AIDetectionCreate(AIDetectionBase):
    video_id: str

class AIDetectionResponse(BaseModel):
    id: str
    video_id: str
    camera_id: Optional[str] = None
    timestamp: datetime
    frame_number: int
    label: str
    confidence: float
    bounding_box: Dict[str, float]  # Normalized JSON structure
    inference_source: Optional[str] = "REAL_MODEL"
    model_name: Optional[str] = "YOLOv8n"

    model_config = ConfigDict(from_attributes=True)

# ==================== RECOVERY SCHEMAS ====================
class RecoveredFileBase(BaseModel):
    start_sector: int
    end_sector: int
    size_bytes: int
    status: str
    file_extension: str
    estimated_time: Optional[datetime] = None

class RecoveredFileResponse(RecoveredFileBase):
    id: str
    evidence_id: str

    model_config = ConfigDict(from_attributes=True)

# ==================== CHAIN OF CUSTODY SCHEMAS ====================
class ChainOfCustodyBase(BaseModel):
    timestamp: datetime
    operator: str
    action: str
    description: str

class ChainOfCustodyCreate(BaseModel):
    case_id: str
    evidence_id: Optional[str] = None
    operator: str
    action: str
    description: str

class ChainOfCustodyResponse(ChainOfCustodyBase):
    id: str
    case_id: str
    evidence_id: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

# ==================== REPORT SCHEMAS ====================
class ReportBase(BaseModel):
    title: str
    generated_by: str

class ReportCreate(ReportBase):
    case_id: str

class ReportResponse(ReportBase):
    id: str
    case_id: str
    generated_at: datetime
    content_markdown: str

    model_config = ConfigDict(from_attributes=True)

# ==================== TIMELINE EVENT SCHEMAS ====================
class TimelineEventResponse(BaseModel):
    id: str
    timestamp: datetime
    event_type: str  # INGESTION, AI_DETECTION, MANUAL, RECOVERY
    source: str      # Camera Name, Case, or Evidence Name
    description: str
    context_id: Optional[str] = None  # Relational UUID link to video or detection

    model_config = ConfigDict(from_attributes=True)

# ==================== UTILITY SCHEMAS ====================
class AIAnalysisTrigger(BaseModel):
    classes: List[str] = Field(default=["person", "vehicle"])
    mode: str = Field(default="REAL", description="Execution mode: REAL or SIMULATED")

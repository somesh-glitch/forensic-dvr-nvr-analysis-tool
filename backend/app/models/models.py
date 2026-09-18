import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database.session import Base

def generate_uuid():
    return str(uuid.uuid4())

class Case(Base):
    __tablename__ = "cases"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    case_number = Column(String, unique=True, nullable=False, index=True)
    title = Column(String, nullable=False)
    investigator = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    # Relationships
    evidence = relationship("Evidence", back_populates="case", cascade="all, delete-orphan")
    chain_of_custody_logs = relationship("ChainOfCustody", back_populates="case", cascade="all, delete-orphan")
    reports = relationship("Report", back_populates="case", cascade="all, delete-orphan")


class Evidence(Base):
    __tablename__ = "evidence"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    case_id = Column(String, ForeignKey("cases.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_size = Column(Integer, nullable=False)
    md5 = Column(String, nullable=False)
    sha256 = Column(String, nullable=False)
    vendor_detected = Column(String, nullable=False)
    device_serial = Column(String, nullable=True)
    ingested_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    # Relationships
    case = relationship("Case", back_populates="evidence")
    cameras = relationship("Camera", back_populates="evidence", cascade="all, delete-orphan")
    recovered_files = relationship("RecoveredFile", back_populates="evidence", cascade="all, delete-orphan")
    chain_of_custody_logs = relationship("ChainOfCustody", back_populates="evidence", cascade="all, delete-orphan")


class Camera(Base):
    __tablename__ = "cameras"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    evidence_id = Column(String, ForeignKey("evidence.id", ondelete="CASCADE"), nullable=False)
    channel_number = Column(Integer, nullable=False)
    name = Column(String, nullable=False)
    
    # Relationships
    evidence = relationship("Evidence", back_populates="cameras")
    videos = relationship("Video", back_populates="camera", cascade="all, delete-orphan")


class Video(Base):
    __tablename__ = "videos"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    camera_id = Column(String, ForeignKey("cameras.id", ondelete="CASCADE"), nullable=False)
    file_path = Column(String, nullable=False)        # Original extracted path (may be disc image for proprietary)
    playback_path = Column(String, nullable=True)     # Browser-playable derivative (MP4) — may equal file_path
    extraction_status = Column(String, default="EXTRACTED", nullable=True)  # EXTRACTED | VALIDATED | UNPLAYABLE
    duration_seconds = Column(Float, nullable=True)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    fps = Column(Float, nullable=True)
    resolution = Column(String, nullable=True)
    codec = Column(String, nullable=True)
    
    # Relationships
    camera = relationship("Camera", back_populates="videos")
    ai_detections = relationship("AIDetection", back_populates="video", cascade="all, delete-orphan")


class AIDetection(Base):
    __tablename__ = "ai_detections"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    video_id = Column(String, ForeignKey("videos.id", ondelete="CASCADE"), nullable=False)
    camera_id = Column(String, ForeignKey("cameras.id", ondelete="CASCADE"), nullable=True)
    timestamp = Column(DateTime, nullable=False)
    frame_number = Column(Integer, nullable=False)
    label = Column(String, nullable=False)  # e.g., 'person', 'vehicle', 'motorcycle'
    confidence = Column(Float, nullable=False)
    bounding_box = Column(Text, nullable=False)  # Stored as JSON string (x_min, y_min, x_max, y_max)
    inference_source = Column(String, default="REAL_MODEL", nullable=True)
    model_name = Column(String, default="YOLOv8n", nullable=True)
    
    # Relationships
    video = relationship("Video", back_populates="ai_detections")


class RecoveredFile(Base):
    __tablename__ = "recovered_files"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    evidence_id = Column(String, ForeignKey("evidence.id", ondelete="CASCADE"), nullable=False)
    start_sector = Column(Integer, nullable=False)
    end_sector = Column(Integer, nullable=False)
    size_bytes = Column(Integer, nullable=False)
    status = Column(String, nullable=False)  # 'Scanning', 'Recovered', 'Corrupt'
    file_extension = Column(String, nullable=False)
    estimated_time = Column(DateTime, nullable=True)
    
    # Relationships
    evidence = relationship("Evidence", back_populates="recovered_files")


class ChainOfCustody(Base):
    __tablename__ = "chain_of_custody"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    case_id = Column(String, ForeignKey("cases.id", ondelete="CASCADE"), nullable=False)
    evidence_id = Column(String, ForeignKey("evidence.id", ondelete="SET NULL"), nullable=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    operator = Column(String, nullable=False)
    action = Column(String, nullable=False)       # e.g., 'EVIDENCE_UPLOAD', 'AI_ANALYSIS_START'
    description = Column(Text, nullable=False)
    
    # Relationships
    case = relationship("Case", back_populates="chain_of_custody_logs")
    evidence = relationship("Evidence", back_populates="chain_of_custody_logs")


class Report(Base):
    __tablename__ = "reports"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    case_id = Column(String, ForeignKey("cases.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False)
    generated_by = Column(String, nullable=False)
    generated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    content_markdown = Column(Text, nullable=False)
    
    # Relationships
    case = relationship("Case", back_populates="reports")

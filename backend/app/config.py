import os
from pydantic_settings import BaseSettings

from pydantic import ConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "DVR Forensic Analysis Tool"
    API_V1_STR: str = "/api/v1"
    
    # SQLite Database URL
    DATABASE_URL: str = "sqlite:///./forensic.db"
    
    # Paths
    BASE_DIR: str = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    STORAGE_DIR: str = os.path.join(BASE_DIR, "storage")
    UPLOAD_DIR: str = os.path.join(STORAGE_DIR, "uploads")
    EXTRACTED_DIR: str = os.path.join(STORAGE_DIR, "extracted")
    RECOVERY_DIR: str = os.path.join(STORAGE_DIR, "recovered")
    REPORT_DIR: str = os.path.join(STORAGE_DIR, "reports")
    
    # AI Settings
    AI_CONFIDENCE_THRESHOLD: float = 0.4
    FRAME_SAMPLING_RATE_SECONDS: float = 1.0  # Sample 1 frame per second of video
    
    model_config = ConfigDict(case_sensitive=True)

settings = Settings()

# Set environment variables for the forensic engine to align paths
os.environ.setdefault("FORENSIC_EXTRACTED_DIR", settings.EXTRACTED_DIR)
os.environ.setdefault("FORENSIC_RECOVERED_DIR", settings.RECOVERY_DIR)

# Ensure directories exist
for directory in [settings.STORAGE_DIR, settings.UPLOAD_DIR, settings.EXTRACTED_DIR, settings.RECOVERY_DIR, settings.REPORT_DIR]:
    os.makedirs(directory, exist_ok=True)

import os
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database.session import engine, Base
from app.api import cases, evidence, videos, recovery, ai, timeline, events, chain_of_custody, reports, health

def upgrade_db_schema(db_engine):
    """
    Dynamically patches existing databases to add missing columns
    in SQLite to prevent schema conflicts during testing or migration.
    """
    conn = db_engine.raw_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(ai_detections)")
        columns = [row[1] for row in cursor.fetchall()]
        
        # Patch schema additions — ai_detections
        if "camera_id" not in columns:
            cursor.execute("ALTER TABLE ai_detections ADD COLUMN camera_id TEXT REFERENCES cameras(id) ON DELETE CASCADE")
        if "inference_source" not in columns:
            cursor.execute("ALTER TABLE ai_detections ADD COLUMN inference_source TEXT DEFAULT 'REAL_MODEL'")
        if "model_name" not in columns:
            cursor.execute("ALTER TABLE ai_detections ADD COLUMN model_name TEXT DEFAULT 'YOLOv8n'")

        # Patch schema additions — videos
        cursor.execute("PRAGMA table_info(videos)")
        video_columns = [row[1] for row in cursor.fetchall()]
        if "playback_path" not in video_columns:
            cursor.execute("ALTER TABLE videos ADD COLUMN playback_path TEXT")
        if "extraction_status" not in video_columns:
            cursor.execute("ALTER TABLE videos ADD COLUMN extraction_status TEXT DEFAULT 'EXTRACTED'")
        
        # Clean up legacy Generic vendor records
        cursor.execute("UPDATE evidence SET vendor_detected = 'Not detected', device_serial = 'Not detected' WHERE vendor_detected = 'Generic'")
        
        conn.commit()
    except Exception as e:
        print(f"Database schema patch exception: {str(e)}")
    finally:
        conn.close()

# Automatically create all SQLite database tables on startup
Base.metadata.create_all(bind=engine)
upgrade_db_schema(engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    description="Multi-Vendor DVR/NVR Forensic Analysis Tool REST Backend"
)

# Set up CORS middleware to allow the React Frontend to query endpoints
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Hackathon scale: allow all domains
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Router Modules
app.include_router(cases.router, prefix=settings.API_V1_STR)
app.include_router(evidence.router, prefix=settings.API_V1_STR)
app.include_router(videos.router, prefix=settings.API_V1_STR)
app.include_router(recovery.router, prefix=settings.API_V1_STR)
app.include_router(ai.router, prefix=settings.API_V1_STR)
app.include_router(timeline.router, prefix=settings.API_V1_STR)
app.include_router(events.router, prefix=settings.API_V1_STR)
app.include_router(chain_of_custody.router, prefix=settings.API_V1_STR)
app.include_router(reports.router, prefix=settings.API_V1_STR)
app.include_router(health.router, prefix=settings.API_V1_STR)


# Serve storage files (extracted video clips) statically for web playback
if os.path.exists(settings.STORAGE_DIR):
    app.mount("/static", StaticFiles(directory=settings.STORAGE_DIR), name="static")

@app.get("/")
def read_root():
    return {
        "project": settings.PROJECT_NAME,
        "status": "Operational",
        "documentation": "/docs",
        "api_prefix": settings.API_V1_STR
    }

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

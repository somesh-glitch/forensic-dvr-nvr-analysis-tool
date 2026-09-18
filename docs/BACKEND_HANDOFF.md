# Backend Handoff Guide

This guide is designed for teammates working on Frontend or Forensic Engineering to easily understand how the Backend + AI system operates, how to interact with it, and what technologies are used.

---

## 1. FastAPI Application & Configuration

### WHAT IT DOES
Boots up the REST API, configures Cross-Origin Resource Sharing (CORS), mounts physical media folders to serve static files for web playback, and handles database initialization and schema migration checks upon startup.

### HOW IT WORKS
- **Startup Pipeline**: Automatically runs SQLAlchemy metadata hooks to create tables. It then runs a dynamic SQLite column patch in `upgrade_db_schema()` to guarantee that newly added metrics columns (`camera_id`, `inference_source`, and `model_name`) are configured without database locks.
- **Static Mounting**: Mounts `storage/` at the HTTP resource path `/static` to allow the frontend to stream videos and view generated reports dynamically.
- **Config Management**: Uses Pydantic V2 BaseSettings (`Settings` class in `app/config.py`) to manage local system configurations.

### INPUT & OUTPUT
- **Input**: Environmental configurations or default values in `app/config.py`.
- **Output**: uvicorn server running at `http://localhost:8000`.

### IMPORTANT FILES
- [main.py](file:///C:/Users/somes/.gemini/antigravity/scratch/forensic_dvr_tool/backend/app/main.py)
- [config.py](file:///C:/Users/somes/.gemini/antigravity/scratch/forensic_dvr_tool/backend/app/config.py)
- [session.py](file:///C:/Users/somes/.gemini/antigravity/scratch/forensic_dvr_tool/backend/app/database/session.py)

### HOW OTHER TEAMMATES USE IT
- **Frontend Developer**: All HTTP requests are queried against this server. Playback media is streamed from `/static/uploads/{filename}` or `/static/extracted/{filename}`.
- **Forensic Engineer**: No direct modifications needed here.

---

## 2. API Router Modules

### WHAT IT DOES
Receives incoming HTTP requests, maps them to endpoint routes, parses request payloads, triggers backend processing coordinators, and returns JSON serialization data.

### HOW IT WORKS
- Separated into resource gateways under `app/api/`:
  - **cases.py**: Controls case registration and inventory retrieval.
  - **evidence.py**: Processes multi-part file uploads and maps camera channels.
  - **videos.py**: Retrieves video segments and codec metadata.
  - **recovery.py**: Resolves extracted deleted video sector block fragments.
  - **ai.py**: Triggers frame-by-frame YOLO models.
  - **timeline.py** & **events.py**: Provides unified sorting systems.
  - **chain_of_custody.py**: Returns the historic chain audit logs.
  - **reports.py**: Generates markdown dossiers.

### INPUT & OUTPUT
- Detail listings are documented in [API_REFERENCE.md](file:///C:/Users/somes/.gemini/antigravity/scratch/forensic_dvr_tool/docs/API_REFERENCE.md).

### IMPORTANT FILES
- [app/api/](file:///C:/Users/somes/.gemini/antigravity/scratch/forensic_dvr_tool/backend/app/api/)

### HOW OTHER TEAMMATES USE IT
- **Frontend**: Connects directly to endpoints using standard HTTP libraries (fetch, axios).
- **Forensic Engineer**: Integrating low-level parsers updates database tables which automatically populate standard GET responses.

---

## 3. Database Layer & Models

### WHAT IT DOES
Defines the relational schema mapping for our 8 database tables using SQLAlchemy ORM (SQLite backend) and manages the database transaction connection pool loop.

### HOW IT WORKS
- **SQLAlchemy Base**: Columns and relationships are defined in `app/models/models.py`.
- **Session Pooling**: Connects to the local database file `forensic.db` through SQLAlchemy engines. Dependency yields are implemented in `get_db()` to automatically handle rollbacks and session closing.
- **Cascade Deletion**: Relational foreign keys employ `ondelete="CASCADE"` hooks. Deleting a Case automatically purges related evidence, chain of custody logs, reports, camera channels, video segments, and AI detections.

### INPUT & OUTPUT
- Detail listings are documented in [DATABASE_SCHEMA.md](file:///C:/Users/somes/.gemini/antigravity/docs/DATABASE_SCHEMA.md).

### IMPORTANT FILES
- [models.py](file:///C:/Users/somes/.gemini/antigravity/scratch/forensic_dvr_tool/backend/app/models/models.py)
- [schemas.py](file:///C:/Users/somes/.gemini/antigravity/scratch/forensic_dvr_tool/backend/app/schemas/schemas.py)

### HOW OTHER TEAMMATES USE IT
- **Frontend**: Dictates response structures which mirror Pydantic schemas in `schemas.py`.
- **Forensic Engineer**: Writes findings to `Camera`, `Video`, and `RecoveredFile` instances using SQLAlchemy session helpers.

---

## 4. Evidence Ingestion & Forensic Layout Parser

### WHAT IT DOES
Saves physical disk image dumps, validates files, identifies manufacturer signatures, and initializes camera layout maps.

### HOW IT WORKS
1. **Physical Streaming**: Uploads stream chunkwise (in 1MB parts) to avoid memory overflows.
2. **Integrity Hashing**: Computes MD5 and SHA-256 signatures via block iteration.
3. **Partition Scanning**: Performs binary scans of the file's first 16 bytes. Checks for signature cookies like `HKVS`/`WFS` (Hikvision), `DHFS` (Dahua), and `CPPL` (CP Plus). If signatures aren't matched, parses filenames.
4. **Channel Recovery Pipeline**:
   - **Playable Video**: Instantly processes `.mp4`, `.avi`, or `.mkv` files using OpenCV, dynamically extracting duration, resolution, fps, and registering it as a single camera stream.
   - **Simulated Raw blocks**: If a raw image dump file is processed, simulates channel offsets relative to the detected vendor.
5. **Deleted fragments carving**: Sector scanning generates two mock records inside the `recovered_files` table.

### INPUT & OUTPUT
- **Input**: `case_id` (Form string) and `file` (UploadFile stream) to `/api/v1/evidence/upload`.
- **Output**: JSON representation of the registered `Evidence` schema record.

### IMPORTANT FILES
- [evidence.py](file:///C:/Users/somes/.gemini/antigravity/scratch/forensic_dvr_tool/backend/app/api/evidence.py)
- [forensic_service.py](file:///C:/Users/somes/.gemini/antigravity/scratch/forensic_dvr_tool/backend/app/services/forensic_service.py)

### HOW OTHER TEAMMATES USE IT
- **Frontend**: Triggers this when drag-and-dropping a surveillance HDD dump image or standard MP4 video.
- **Forensic Engineer**: Replace the simulated stubs in `forensic_service.py` with actual filesystem decoders. Detail specifications are listed in [FORENSIC_INTEGRATION.md](file:///C:/Users/somes/.gemini/antigravity/scratch/forensic_dvr_tool/docs/FORENSIC_INTEGRATION.md).

---

## 5. Timeline Correlation Engine

### WHAT IT DOES
Aggregates heterogeneous data sources (video timelines, AI target tracks, carved sector fragments, custody audits) and chronologizes them into a unified list.

### HOW IT WORKS
1. Queries the database for all records under a specified `case_id`.
2. Normalizes model parameters to timezone-aware UTC timestamps.
3. Converts logs to standard `TimelineEventResponse` objects.
4. Sorts output lists chronologically ascending.

### INPUT & OUTPUT
- **Input**: `case_id` (path parameter) and optional filters (camera_id, event_type, start_dt, end_dt, label).
- **Output**: List of chronologically sorted `TimelineEventResponse` objects.

### IMPORTANT FILES
- [timeline.py](file:///C:/Users/somes/.gemini/antigravity/scratch/forensic_dvr_tool/backend/app/api/timeline.py)
- [timeline_service.py](file:///C:/Users/somes/.gemini/antigravity/scratch/forensic_dvr_tool/backend/app/services/timeline_service.py)

### HOW OTHER TEAMMATES USE IT
- **Frontend**: Directly consumes this endpoint to render interactive, searchable timeline visualizers.

---

## 6. Chain of Custody & Reporting Engine

### WHAT IT DOES
Maintains an immutable legal audit ledger tracing all case actions, and builds Markdown summaries detailing evidence items and logs.

### HOW IT WORKS
- **Audit Ledger**: Whenever an action is taken (creating a case, uploading evidence, extracting channels, starting/completing AI models, generating a report, carving a sector), a transaction log is committed to the `chain_of_custody` table. Entries include the investigator's name, timestamps, and description parameters.
- **Report Generation**: Consolidates database tables using markdown markup. Writes reports as physical files to `storage/reports/` with SHA-256 digital validation signature blocks.

### INPUT & OUTPUT
- **Input**: Case parameters sent to `/api/v1/reports/{case_id}`.
- **Output**: JSON representation of the generated report (containing `content_markdown`).

### IMPORTANT FILES
- [reports.py](file:///C:/Users/somes/.gemini/antigravity/scratch/forensic_dvr_tool/backend/app/api/reports.py)
- [chain_of_custody.py](file:///C:/Users/somes/.gemini/antigravity/scratch/forensic_dvr_tool/backend/app/api/chain_of_custody.py)

### HOW OTHER TEAMMATES USE IT
- **Frontend**: Renders the generated report's markdown text in a document viewer and feeds the audit ledger to the timeline interface.

---

## 7. AI Computer Vision Service

### WHAT IT DOES
Runs YOLOv8 object detection on camera feeds to isolate target entities (e.g. persons or vehicles).

### HOW IT WORKS
1. Checks for physical video files on disk.
2. Iterates frames at designated sample rates (default: samples 1 frame per second).
3. Executes YOLOv8n CPU weights inference.
4. Normalizes bounding boxes coordinates.
5. Saves detections with `REAL_MODEL` / `YOLOv8n` headers.
6. Fallback simulated engine: Generated deterministic mock entries if YOLO is not installed or when mock simulation mode is requested.

### INPUT & OUTPUT
- Detail listings are documented in [AI_PIPELINE.md](file:///C:/Users/somes/.gemini/antigravity/scratch/forensic_dvr_tool/docs/AI_PIPELINE.md).

### IMPORTANT FILES
- [ai.py](file:///C:/Users/somes/.gemini/antigravity/scratch/forensic_dvr_tool/backend/app/api/ai.py)
- [ai_service.py](file:///C:/Users/somes/.gemini/antigravity/scratch/forensic_dvr_tool/backend/app/services/ai_service.py)

### HOW OTHER TEAMMATES USE IT
- **Frontend**: Commands this module to evaluate uploaded clips, then queries `/api/v1/analysis/{video_id}` to retrieve bounding coordinates.

---

## 8. Development & Storage Environment

### Local Directory Organization
The workspace expects the following layout under the project root (`forensic_dvr_tool/`):
```
forensic_dvr_tool/
├── backend/                  # FastAPI web server and logic scripts
│   ├── app/
│   │   ├── api/              # Route modules
│   │   ├── database/         # SQLite configuration sessions
│   │   ├── models/           # SQLAlchemy DB declarations
│   │   ├── schemas/          # Pydantic payloads specifications
│   │   └── services/         # Logical services (AI, Timeline, Forensic)
│   ├── tests/                # Test suites
│   ├── requirements.txt      # Project requirements
│   ├── seed.py               # Pre-populates mock data cases
│   └── yolov8n.pt            # Downloaded YOLOv8 weights file
└── storage/                  # Static assets directory (mounted as /static)
    ├── uploads/              # Raw ingested images and video files
    ├── extracted/            # Extracted channel layout clips
    ├── recovered/            # Carved sector fragments
    └── reports/              # physical compiled markdown dossiers
```

### Error Mitigation & Transaction Isolation
- **Atomicity**: The AI scanner registers detections and auditing markers in a single database transaction. If frame scans fail midway, the transaction rolls back, keeping the database persistent.
- **Robust Imports**: The AI Service imports `ultralytics` inside a `try/except` block, preventing application crash loops if PyTorch or YOLO components are missing.
- **Clean Naming**: Incoming files are sanitized to remove path injection characters and prefixed with an 8-character random UUID before storage.

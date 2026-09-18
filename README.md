# Multi-Vendor DVR/NVR Forensic Analysis Tool

A full-stack forensic application to ingest, identify, carve, analyze, and document visual evidence from proprietary surveillance recording systems (e.g. Hikvision, Dahua, CP Plus, Uniview).

---

## 1. Project Overview
Physical DVRs/NVRs often use custom, proprietary filesystems designed for continuous write cycles. This makes their storage drives unreadable on standard operating systems.

This tool solves this by providing:
- **Heuristic Layout Detections**: Identifies proprietary partitions (`HKVS`, `DHFS`, `CPPL`).
- **Forensic Video Reconstructions**: Extracts video segments and channels.
- **Unallocated Disk Carving**: Carves deleted recording fragments directly from raw blocks.
- **Deep-Learning Object Indexing**: Runs YOLOv8 scans to index persons and vehicles.
- **Chain of Custody Ledgers**: Automatically tracks all investigator operations in an audit ledger.
- **Integrity Dossier Generator**: Compiles forensic reports with SHA-256 integrity validation verification.

---

## 2. Architecture & Data Flow

```
   React Client (React UI Dashboard)
               ↓
    FastAPI Rest API Layer
         ├── Database Mapper (SQLite / SQLAlchemy)
         ├── Forensic Parser Service (magic bytes signature verification)
         └── AI Inference Pipeline (OpenCV frame processing / YOLOv8 CPU)
```

- **Frontend**: Query interfaces & custom HTML canvas bounding box overlays.
- **API gateway**: Case registration, file ingestion flows, timeline sorter endpoints.
- **Services**: Coordinate AI tracking, sector mapping, and checksum verification.
- **Storage structures**: Tracks are isolated chunkwise in persistent server directories.

---

## 3. Repository Structure

```
forensic_dvr_tool/
├── backend/                   # FastAPI Web-Backend & Models
│   ├── app/
│   │   ├── api/               # Endpoint routers
│   │   ├── database/          # SQLite hooks
│   │   ├── models/            # SQLAlchemy database declarations
│   │   ├── schemas/           # Pydantic schema validation structures
│   │   └── services/          # AI Service, Forensic Service, Timeline Engine
│   ├── tests/                 # Isolated database API tests
│   ├── requirements.txt       # Python package dependencies
│   ├── seed.py                # Database pre-population script
│   └── yolov8n.pt             # YOLOv8 object detection model weights
├── docs/                      # Technical Handoff manuals
│   ├── PROJECT_OVERVIEW.md    # Problem statement and block diagram
│   ├── ARCHITECTURE.md        # System design & sequences
│   ├── BACKEND_HANDOFF.md     # Technical detail manual
│   ├── API_REFERENCE.md       # API endpoints documentation
│   ├── DATABASE_SCHEMA.md     # Database dictionary and ER diagram
│   ├── AI_PIPELINE.md         # OpenCV & YOLO details
│   ├── FORENSIC_INTEGRATION.md# Forensic parser interfaces
│   ├── TESTING.md             # Execution instructions
│   ├── TODO.md                # Roadmaps
│   └── project_manifest.json  # Manifest files
├── TEAM_HANDOFF.md            # Workstream divisions
└── storage/                   # Physical assets folders
    ├── uploads/               # Raw ingested images
    ├── extracted/             # Extracted channels
    ├── recovered/             # Carved files
    └── reports/               # md dossiers
```

---

## 4. Quick Start Setup

### Step 1: Install Python Dependencies
Run this in the `backend/` directory:
```powershell
pip install -r requirements.txt
```

### Step 2: Pre-populate / Seed Database
Initializes the SQLite database (`forensic.db`) and seeds it with mock cases, evidence directories, camera streams, real/simulated AI object markers, and carved sectors.
```powershell
python seed.py
```

### Step 3: Run the FastAPI Web Backend Server
Starts the uvicorn development server at `http://localhost:8000`:
```powershell
python app/main.py
```
*(The Swagger API docs are accessible at `http://localhost:8000/docs`).*

---

## 5. Running Tests & AI Regression Audits

### 1. Execute Unit/Integration Tests
Runs the test suite against an isolated database `test_forensic.db`:
```powershell
pytest tests/test_api.py -v
```

### 2. Verify YOLO Pipeline Validation
Verifies if real YOLO model weights load and run correctly on `test_media/demo.mp4`:
```powershell
python validate_real_yolo.py
```

### 3. Run E2E System Regression Audit
Runs a complete client session, performing validation checks on ingestion, metadata parsing, YOLO GPU/CPU inference, timeline indexing, and markdown reporting:
```powershell
python e2e_regression_yolo.py
```

---

## 6. Current Implementation Limitations
1. **Synchronous AI Processing**: Large clips block REST execution cycles. Future versions should run AI queries inside background worker processes.
2. **Simulated Parts**: low-level Dahua/Hikvision filesystem carving and layouts reconstruction are currently simulated. Interface hooks are ready in `ForensicService` for Teammate 3 (Forensic Engineering) to integrate.
3. **No GPU Acceleration**: YOLOv8 scans run on the CPU.

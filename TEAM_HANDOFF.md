# Team Workstreams & Handoff Agreement

This document divides the Multi-Vendor DVR/NVR Forensic Analysis Tool project into three distinct workstreams, clarifying responsibilities and integration interfaces for each team member.

---

## Team Division matrix

```mermaid
grid
    %% Custom Mermaid styling or Layout
```
*(Workspace division: Frontend Teammate, Forensic Engineering Teammate, Backend + AI Teammate).*

---

## 1. BACKEND + AI WORKSTREAM (Somesh's Role)

### COMPLETED WORK
- **FastAPI REST API Engine**: Created a complete suite of endpoints to manage cases, upload files, read timelines, view audit trails, and trigger reports.
- **Database Modeling**: Configured SQLAlchemy maps supporting SQLite backups, index keys, and automatic metadata creation.
- **CASCADING Deletions**: Configured database relationships to purge all related entity rows when a Case is deleted.
- **AI Computer Vision Service**: Implemented OpenCV video frame extraction, 1s sampling rate routines, YOLOv8n CPU weights inference, relative coordinate normalization, and a simulated fallback engine.
- **Unified Timeline Engine**: Created a cronologizing interface that merges video boundary timestamps, AI object tags, carved sector coordinates, and investigator audit logs into a unified feed.
- **Audit Logging (Chain of Custody)**: Integrated logging hooks across all API endpoints (case creation, file ingestion, AI start/completion, report generation).
- **Physical Report dossiers**: Configured markdown compiler pipelines that write generated reports to disk (`storage/reports/`) along with cryptohash validation signatures.
- **Testing Suite**: Created standard pytest units (`tests/test_api.py`), YOLO validations (`validate_real_yolo.py`), and E2E regression scripts (`e2e_regression_yolo.py`) to verify system stability.

### IN PROGRESS
- **Project Handoff Packages**: Designing documentation assets clarifying API signatures, DB architectures, and parser integrations.

### BACKLOG REMAINING
- **Asynchronous Task Processing**: Migrating the synchronous YOLO frame scanning endpoint to an asynchronous background worker flow (e.g. FastAPI `BackgroundTasks`).
- **Log Rotation Systems**: Writing server stack exceptions to rolling physical system files.
- **API Token Authentications**: Configuring JWT router endpoints.

---

## 2. FRONTEND WORKSTREAM

The Frontend developer is responsible for building a web dashboard to interact with the backend APIs.

### Expected Screens & Workflows

1. **Case Selection Landing**:
   - *Flow*: Query all cases (`GET /api/v1/cases`). Render a checklist layout. Give investigators a form to register new cases (`POST /api/v1/cases`).
2. **Ingestion & Processing Dashboard**:
   - *Flow*: View case details and active evidence dumps. Provide a drag-and-drop form to ingest NVR images or video clips:
     `POST /api/v1/evidence/upload` (as `multipart/form-data` with `case_id`).
   - *Behavior*: Display a loading state during upload and extraction. Once complete, refresh the list of active camera feeds.
3. **Interactive Media Player workspace**:
   - *Flow*: Load camera segments using `/api/v1/evidence/{evidence_id}/videos`. Stream files from `/static/uploads/{filename}` or `/static/extracted/{filename}` in the media player.
   - *AI Visualization*: Retrieve video bounding boxes from `/api/v1/analysis/{video_id}`. Draw relative bounding boxes dynamically over the React HTML5 canvas player.
4. **Unified Investigation Timeline**:
   - *Flow*: Query the case timeline (`GET /api/v1/timeline/{case_id}`). Integrate filters for Camera ID, Event Category (INGESTION, AI_DETECTION, AUDIT, RECOVERY), Date Range, and Object Class.
5. **Chain of Custody Legal Audit Log**:
   - *Flow*: Display custody histories (`GET /api/v1/chain-of-custody/{evidence_id}`) in a read-only table layout.
6. **markdown dossiers & Printer**:
   - *Flow*: Generate reports using `POST /api/v1/reports/{case_id}` and render the returned markdown.

---

## 3. FORENSIC ENGINEERING WORKSTREAM

The Forensic Engineer is responsible for replacing the simulation stubs in `ForensicService` with low-level, proprietary block parsing and video reconstruction code.

### Required Implementations (API Contracts)

#### 1. Device Signature Scan
- **Backend Function**: `identify_vendor_from_bytes(file_path)`
- **Responsibility**: Replace the 16-byte signature checks with real partition block parses. Identify the recording system structure and device models.
- **Contract**: Receive the raw dump file path, return a tuple containing the detected vendor and device serial number:
  `Tuple[vendor_name: str, device_serial: str]`

#### 2. Visual Channel Reconstruct
- **Backend Function**: `extract_cameras_and_videos(evidence_id, file_path, vendor)`
- **Responsibility**: Parse surveillance disks to identify active camera channels. Extract recording frames, reconstruct logical video segments, save clips to `storage/extracted/`, and return metadata properties.
- **Contract**: Receive the evidence UUID, local dump file path, and vendor. Return a list of dictionary models:
  ```python
  [
    {
      "channel_number": int,
      "camera_name": str,
      "video": {
        "file_path": str,            # Path to extracted clip
        "duration_seconds": float,   # Reconstructed length
        "start_time": datetime_utc,  # Timezone-aware date
        "end_time": datetime_utc,    # Timezone-aware date
        "fps": float,
        "resolution": str,           # e.g., '1920x1080'
        "codec": str                 # e.g., 'H264'
      }
    }
  ]
  ```

#### 3. Deleted Video Fragment Carving
- **Backend Function**: `carve_deleted_videos(evidence_id, file_path)`
- **Responsibility**: Scan unallocated disk space for video headers and footers to locate and carve deleted recording fragments. Save carved files using unique paths under `storage/recovered/`.
- **Contract**: Receive the evidence UUID and disk dump path. Return metadata for carved items:
  ```python
  [
    {
      "start_sector": int,
      "end_sector": int,
      "size_bytes": int,
      "status": "Recovered",
      "file_extension": "mp4",
      "estimated_time": datetime_utc
    }
  ]
  ```

### Developer Constraints (What NOT to Edit)
To ensure the backend team's testing suites remain functional:
- **Do not modify table schemas or DB keys**: These models are used across all API endpoints.
- **Do not alter REST API URL paths**: The Frontend team relies on these endpoints to build dashboards.
- **Do not change datetime outputs**: Datetime objects must use timezone-aware UTC format to preserve timeline sorting.

# FINAL INTEGRATION AUDIT: FORENSIC DVR/NVR ANALYSIS SYSTEM

This document is a comprehensive, read-only final integration audit of the multi-vendor DVR/NVR forensic analysis tool, compiled on August 26, 2026.

---

## 1. PROJECT STRUCTURE

The forensic DVR/NVR tool spans the following directory tree:

```text
forensic_dvr_tool/
├── FINAL_INTEGRATION_SPECIFICATION.md   # System schema & API specifications
├── README.md                            # Setup guide
├── TEAM_HANDOFF.md                      # Team collaboration records
├── backend/                             # Python FastAPI Backend
│   ├── app/
│   │   ├── api/                         # Endpoint routers (cases, evidence, AI, timeline, etc.)
│   │   ├── config.py                    # Settings & directory parameters
│   │   ├── database/                    # SQLAlchemy engine & session configurations
│   │   ├── models/                      # SQLAlchemy database schemas
│   │   ├── schemas/                     # Pydantic validation models
│   │   └── services/                    # Business service adapters (Forensic, AI, Timeline)
│   ├── tests/
│   │   └── test_api.py                  # API pytest suites (12 tests)
│   ├── yolov8n.pt                       # YOLOv8 target weight file
│   ├── forensic.db                      # Main SQLite ledger database
│   ├── requirements.txt                 # Backend dependency list
│   ├── e2e_regression_yolo.py           # E2E real YOLOv8 regression test
│   ├── validate_real_yolo.py            # Headless real YOLO validation
│   └── verify_integration.py            # Programmatic verification flow
├── forensic_engine/                     # Proprietary/Simulated Forensic engine library
│   ├── carving/                         # Sector carving logic
│   ├── extraction/                      # Stream and channel extraction logic
│   └── vendor_detection/                # Signature matching block
├── frontend/                            # Front-End html client
│   ├── css/                             # Styled skins (responsive base css grids)
│   ├── js/                              # Functional scripts
│   │   ├── config.js                    # API prefix endpoint constants
│   │   ├── cases.js                     # Core cases registry controls
│   │   ├── dashboard.js                 # Widget figures count & list updater
│   │   ├── evidence.js                  # Multipart form file drop uploads
│   │   ├── analysis.js                  # Bounding box YOLO canvas overlays
│   │   ├── timeline.js                  # Chronology milestone feeds
│   │   ├── custody.js                   # Authenticated chain audit list
│   │   └── reports.js                   # Markdown preview compiler
│   └── *.html                           # HTML page structures (dashboard, custody, reports, etc.)
└── storage/                             # Upload/Output files directory
    ├── uploads/                         # Raw image uploads & stream outputs
    └── reports/                         # Hardcopy Markdown report dossiers
```

---

## 2. BACKEND ↔ FRONTEND INTEGRATION

We mapped all browser JavaScript requests against FastAPI routes. All communication paths match and operate successfully.

| Frontend action | Frontend request | Backend endpoint | Compatible? | Issue |
|---|---|---|---|---|
| Load cases grid | `GET` | `/api/v1/cases/` | **Yes** | Mapped correctly (FastAPI redirects `/cases/` to `/cases` via 307 which browsers follow). |
| Create new case | `POST` | `/api/v1/cases/` | **Yes** | Payload JSON matches `CaseCreate`. |
| Load dashboard metrics | `GET` | `/api/v1/cases/{id}/stats` | **Yes** | Yields aggregations correctly. |
| Dashboard recent events | `GET` | `/api/v1/cases/{id}/recent-events`| **Yes** | Populates activity ticker feed. |
| Ingestion queue display | `GET` | `/api/v1/evidence/?case={id}` | **Yes** | Filters by case query parameter. |
| Evidence file upload | `POST` | `/api/v1/evidence/upload` | **Yes** | Transmits multipart/form-data. |
| Retrieve extracted feeds| `GET` | `/api/v1/evidence/{id}/videos` | **Yes** | Mapped correctly. |
| Fetch YOLO detections | `GET` | `/api/v1/analysis/{v_id}` | **Yes** | Pulls stored coordinates. |
| Run AI Analysis | `POST` | `/api/v1/analysis/{v_id}` | **Yes** | Sends classes and mode payload (REAL/SIMULATED). |
| Timeline feed | `GET` | `/api/v1/timeline/{case_id}` | **Yes** | Returns complete sorted array. |
| Ledger audit log | `GET` | `/api/v1/chain-of-custody/{ev_id}`| **Yes** | Retrieves custody markers. |
| Get compiled dossier | `GET` | `/api/v1/reports/{case_id}` | **Yes** | Returns 404 if not run; lists JSON otherwise. |
| Compile case dossier | `POST` | `/api/v1/reports/{case_id}` | **Yes** | Triggers Markdown document assembler. |

---

## 3. BACKEND ↔ FORENSIC ENGINE INTEGRATION

We traced the forensic process flow to evaluate implementation capability fidelity:

```text
[Evidence Upload] ────► [MD5/SHA256 Hash] ────► [Vendor Detection]
                                                     │
 ┌───────────────────────────────────────────────────┘
 ▼
[Forensic Parsing] (AcmeSynthDVR layout is parsed via struct; others simulated)
 │
 ├──► [Video/Camera Extraction] ──► (Real for MP4; Partial for Synthetic; Simulated for Hik/Dahua/etc)
 └──► [Deleted carver recovery] ──► (Real for offset 1024 synthetic DEL-FRAG; Simulated for others)
       │
       ▼
 [SQLite Relational insertion] ──────► [Chain of Custody registration]
```

### Forensic Capability Classification:
*   **Acquisition Hashing:** `REAL`. Computes genuine MD5 and SHA-256 hashes ofUploaded files block-by-block.
*   **Vendor Detection:** `REAL`. Byte signature detector reads file headers directly (looks for `HKVS` for Hikvision, `DHAV` for Dahua, `SYNTHDVR` for Synthetic).
*   **Forensic Parsing:** `PARTIAL`. Handles the custom synthetic Acme DVR format byte offsets. Proprietary disk partition formats (e.g. Hikvision/Dahua custom filesystems) are simulated.
*   **Video/Camera Extraction:** `PARTIAL`. For standalone MP4/AVI uploads, it dynamically parses video duration, FPS, resolution, and codec using OpenCV. For disk formats, it returns simulated metadata structures.
*   **Deleted Video Recovery:** `PARTIAL`. Finds and carves the synthetic deleted videoclip embedded at sector offset 1024. Proprietary NVR unallocated space carving is simulated.
*   **Database Sync:** `REAL`. Forensics results are persisted to relational SQLite tables immediately via ORM session transactions.

---

## 4. AI INTEGRATION

The AI computer vision pipeline integrates fully with the system:

*   **YOLOv8 Weights:** Verified. The backend loads `yolov8n.pt` on-demand using the PyTorch/Ultralytics library.
*   **OpenCV Decoder:** Verified. OpenCV (`cv2.VideoCapture`) decodes video frames, extracts key frames, and passes them to YOLO.
*   **REAL Mode:** Fully functional. Runs actual YOLO inference on the video frames. Returns labels and bounding box percentages.
*   **SIMULATED Mode:** Fully functional fallback. Emits random mock detections if YOLO fails, ensuring demo stability.
*   **Database Storage:** Stores label, confidence score, frame number, `model_name="YOLOv8n"`, and `inference_source="REAL_MODEL"` in the `ai_detections` SQLite table.
*   **Association:** Detections are linked to the parent `Video` record and the `Camera` identifier.
*   **Timeline Integration:** Timeline view pulls these detections as `AI_DETECTION` type markers.

---

## 5. FORENSIC ENGINE MULTI-VENDOR PARSING

*   **SyntheticDVR Format:** `REAL`. Genuinely parses bytes of the Acme DVR synthetic format using the `struct` package (16-byte signatures, camera tables, unallocated deleted fragments).
*   **Hikvision (`HKVS`):** `SIMULATED`. Detects `HKVS` signature in bytes, but mocks the extraction of channels and carved files.
*   **Dahua (`DHAV`):** `SIMULATED`. Detects `DHAV` signature, but uses simulated extraction lists.
*   **CP Plus:** `SIMULATED`. Emits fallback channels and parameters.

---

## 6. DATABASE INTEGRITY

Checking relation integrity in `forensic.db` (5 cases, 5 evidence files, 9 cameras, 9 videos, 18 detections, 33 custody logs):
*   **Referential Integrity:** Checked. `0 orphaned rows` found in all tables (every video connects to a camera, detections connect to valid videos, custody rows reference existing cases/evidence).
*   **Deduplication:** Checked. `0 duplicate camera channels` or duplicate AI detection tuples exist. Ingestion API routes run upserts instead of creating duplicates.
*   **Foreign Key Constraints:** Constraint checking is enabled inside the session setup.

---

## 7. CHAIN OF CUSTODY

 Forensics operations register audit logs in the `chain_of_custody` ledger:
1.  `EVIDENCE_UPLOAD`: Logged when an investigator uploads a file (stores MD5, SHA-256, and identified vendor).
2.  `EXTRACT_CHANNEL`: Logged when DVR channel extraction occurs (stores channel number and name).
3.  `AI_ANALYSIS_START`: Logged when beginning object detection on a video clip.
4.  `AI_ANALYSIS_COMPLETE`: Logged when AI detection finishes (stores the count of detections).
5.  `REPORT_GEN`: Logged when generating case dossiers.

---

## 8. REPORTING COMPILER

Forensic report dossiers are compiled as Markdown files inside `storage/reports/`. The report structures match the requirements:
*   **Case Details:** Includes investigator, case number, and description notes.
*   **Evidence Integrity List:** Lists files, UUIDs, size, identified vendor, serials, and MD5/SHA-256 hashes.
*   **Carver Results:** Lists sector range, size, format, and status of recovered fragments.
*   **Timeline:** Outputs a formatted Markdown table of all chronological occurrences.
*   **AI Findings:** Displays class classification counts and detections.
*   **Admissibility Disclaimer:** Lists write-blocking disclaimers and a unique SHA256 SHA-signature hash for legal admissibility verification.

---

## 9. TESTING SUMMARY

We executed the backend pytest suites and E2E regression check.

### Pytest Metrics:
*   **Total Tests Collected:** 12
*   **Passed:** 12
*   **Failed:** 0
*   **Skipped:** 0
*   **Warnings:** 6 (related to deprecated uftc/datetime usage in test assertions)

### E2E Regression Run (`e2e_regression_yolo.py`):
*   Target video: `test_media/demo.mp4`
*   YOLO Model weight loaded: `YOLOv8n`
*   **Detections Generated:** 6 (label: `person`, frame numbers: 0, 14, 28, 42, 56, 70).
*   All metrics and entries correctly recorded in SQLite database.

---

## 10. FRONTEND DEMO READINESS

| Capabilities | Functional Status | Verification Verdict / Evidence |
|---|---|---|
| **Case Creation** | **Yes** | Operational from `cases.html` modal; maps to FastAPI server. |
| **Ingestion Dropzone** | **Yes** | Fully responsive in `evidence.html`; displays progress bar, hashes files, and saves them. |
| **Evidence Metadata** | **Yes** | Renders file dimensions, vendor tags, and SHA-256 hashes. |
| **CCTV Playback** | **Yes** | Uses HTML5 video player and streams via `/static` route. |
| **AI Analysis Trigger** | **Yes** | Action button works. Runs real YOLO and falls back to simulated mode if YOLO is unavailable. |
| **Canvas bounding boxes**| **Yes** | Coordinates render correctly on the canvas in sync with playback. |
| **Timeline feed** | **Yes** | Merges system logs and AI findings into a chronological timeline. |
| **Chain of custody** | **Yes** | Displays cryptographic status and logs for cases. |
| **Report Generation** | **Yes** | Compiles Markdown template; parses MD to display formatted preview; triggers browser printing. |

---

## 11. SECURITY/INTEGRITY ASSESSMENT

*   **Verification Hashes:** `REAL`. Computes SHA-256 / MD5.
*   **Immutability:** Partial. Files in `storage/` are not write-blocked at the OS level (standard folder structure), but the database records their hash representation for integrity audits.
*   **Upload Validation:** File upload checks files, but lacks strict file extension blocklists (allows arbitrary uploads).
*   **SQL Injection:** Low risk. Relational operations use the SQLAlchemy ORM parameterized query model.
*   **Authentication:** `MISSING / PUBLIC`. Endpoints do not require credentials.

---

## 12. DEMO BLOCKERS (CRITICAL HACKATHON EDGES)

1.  **Vite Server Is Not Serving Static HTML:** The default Vite config is set up to bundle React, but the assets are raw HTML pages (`dashboard.html`, etc.). If Vite is started, it fails to locate the index. Running standard Node/React dev server will cause pages not to load.
    *   *Workaround:* Avoid using `npm run dev`. Serve files using Python: `python -m http.server 8080` from the `frontend/` directory.
2.  **PowerShell Script Exec Policies:** `npm` commands may fail on Windows because script execution is disabled by the OS policy.
    *   *Workaround:* Pre-load node modules or serve pages via Python HTTP server.

---

## 13. FINAL STATUS SCORECARD

| Module | Status | Evidence |
|---|---|---|
| Backend API | **PASS** | Validated via HTTP API pytest and verify script runs. |
| Database | **PASS** | SQLAlchemy SQLite tables mapped; 0 orphaned relations found. |
| Evidence ingestion | **PASS** | Custom multipart file parser processes uploads. |
| Hashing | **PASS** | MD5 and SHA-256 values calculated on upload. |
| Vendor identification | **PASS** | Identified Hikvision (`HKVS`), Dahua (`DHAV`), and synthetic headers. |
| Forensic parsing | **PARTIAL** | Genuinely decodes custom synthetic structure; other systems simulated. |
| Recovery | **PARTIAL** | Carver recovers deleted file fragments from synthetic images. |
| Video metadata | **PASS** | OpenCV retrieves durations, fps, and codecs dynamically. |
| AI/YOLO | **PASS** | Ultralytics model processes frames, generates coordinates, and links database records. |
| Timeline | **PASS** | Timeline compiled chronologically. |
| Chain of custody | **PASS** | Audit events generated for all stages of analysis. |
| Reporting | **PASS** | Reports compiled and saved to storage. |
| Frontend | **PASS** | Dynamic Javascript scripts fetch and render REST data. |
| Backend↔Frontend | **PASS** | Checked API paths and parameters; fully compatible. |
| Forensic↔Backend | **PARTIAL** | Real parsing for synthetic files; simulated for other vendors. |
| End-to-end workflow | **PASS** | Automated regression script verify all steps. |

---

## 14. CONCLUSION

### A. What is fully ready
*   Case registration and listing page.
*   Evidence file ingestion dropzone with client-side/server-side progress.
*   Real SHA256/MD5 hashing.
*   Automated OpenCV metadata extraction.
*   YOLOv8 object detection on MP4 video files.
*   Visual bounding boxes coordinate canvas overlays.
*   Custody log entries and unified timeline list.
*   Markdown report compiler and HTML preview viewer.

### B. What is simulated
*   Multi-channel camera mapping for Hikvision, Dahua, CP Plus.
*   Carved sector tables for proprietary DVR filesystems.

### C. What must NOT be claimed in the final presentation
*   Do NOT claim that our carving system reads deep sector structures of proprietary NVR systems (e.g. Hikvision/Dahua filesystems). It only carves our custom synthetic image dump format.
*   Do NOT claim the app requires user authentication roles (Admin vs Auditor) because endpoints are currently public.

### D. Top 5 fixes, ranked by demo importance
1.  **Serve Frontend via Python Server:** Bypass Vite and use Python `http.server` on port 8080.
2.  **Relative Static Video Delivery:** Ensure static video file names are correct, and use `.mp4` formats for browser playback.
3.  **Active Case Check Redirect:** Make sure the browser's active case is set in `localStorage` before viewing dashboard.
4.  **Real YOLO Inference Class Filters:** Make sure class filters are defined properly on endpoints to prevent excessive YOLO processing times during high-concurrent requests.
5.  **Clean db setup script:** Keep `seed.py` ready to reset tables before starting the presentation.

### E. Exact commands required to start the complete project
```powershell
# 1. Start the FastAPI backend server (Keep this running)
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000

# 2. Start the Frontend Server (In a separate window)
cd frontend
python -m http.server 8080
```

### F. Exact URLs/ports
*   **FastAPI API Swagger Docs:** `http://127.0.0.1:8000/docs`
*   **FastAPI Base Endpoint:** `http://127.0.0.1:8000/api/v1`
*   **Frontend Client Home page:** `http://127.0.0.1:8080/cases.html`
*   **Frontend Dashboard page:** `http://127.0.0.1:8080/dashboard.html`

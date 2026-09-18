# REST API Reference Manual

The base URL prefix for this API is `http://localhost:8000/api/v1`.

All endpoints are configured with CORS allowed origins (`*`), enabling instant web requests from the frontend client.

---

## 1. Cases Management

### `POST /api/v1/cases`
Creates and registers a new investigation case.

- **Request Body**: (JSON, `CaseCreate` schema)
  ```json
  {
    "case_number": "CASE-101",
    "title": "Warehouse Intrusion Audit",
    "investigator": "Detective Cooper",
    "description": "Analysis of perimeter fencing cameras."
  }
  ```
- **Response**: (JSON, 201 Created, `CaseResponse` schema)
  ```json
  {
    "id": "e6a2bc4d-ba91-4d3a-8671-8bc6fa82117a",
    "case_number": "CASE-101",
    "title": "Warehouse Intrusion Audit",
    "investigator": "Detective Cooper",
    "description": "Analysis of perimeter fencing cameras.",
    "created_at": "2026-08-24T15:00:23.128Z"
  }
  ```
- **Errors**: 
  - `400 Bad Request`: If the `case_number` is already registered.
- **Database Tables Affected**: `cases`, `chain_of_custody` (inserts transaction `CASE_CREATE`).
- **Frontend Usage**: Displayed on case management screens to register details before ingesting media.

---

### `GET /api/v1/cases`
Lists all cases registered in the system.

- **Response**: (JSON, 200 OK, `List[CaseResponse]`)
  ```json
  [
    {
      "id": "e6a2bc4d-ba91-4d3a-8671-8bc6fa82117a",
      "case_number": "CASE-101",
      "title": "Warehouse Intrusion Audit",
      "investigator": "Detective Cooper",
      "description": "Analysis of perimeter fencing cameras.",
      "created_at": "2026-08-24T15:00:23.128Z"
    }
  ]
  ```
- **Database Tables Affected**: `cases` (Read-only).
- **Frontend Usage**: Populates case selection tables on landing dashboards.

---

### `GET /api/v1/cases/{case_id}`
Retrieves details for a specific case by its database UUID.

- **Path Parameters**:
  - `case_id` (string, required): Relational UUID.
- **Response**: (JSON, 200 OK, `CaseResponse`)
- **Errors**:
  - `404 Not Found`: If the case UUID does not exist.
- **Database Tables Affected**: `cases` (Read-only).
- **Frontend Usage**: Loads case workspace layouts.

---

## 2. Evidence Ingestion & Carving

### `POST /api/v1/evidence/upload`
Uploads a physical disk image dump or single video clip. Consulates signatures, metadata, camera channels, and carves deleted files. See [FORENSIC_INTEGRATION.md](file:///C:/Users/somes/.gemini/antigravity/scratch/forensic_dvr_tool/docs/FORENSIC_INTEGRATION.md) for detailed workflows.

- **Request Body**: (`multipart/form-data`)
  - `case_id` (string Form, required): Associated case registration ID.
  - `file` (Binary File, required): The target NVR dump file or clip.
- **Response**: (JSON, 202 Accepted, `EvidenceResponse` schema)
  ```json
  {
    "id": "31bcf902-ad9f-4318-971c-32b0d87920ab",
    "case_id": "e6a2bc4d-ba91-4d3a-8671-8bc6fa82117a",
    "name": "hik_nvr_dump.img",
    "file_size": 1048560,
    "md5": "0f62bbf0e76479ffad7d1591f868ef42",
    "sha256": "4b68e9f5e3bc83921b7d152c8038b39a2f7c001cf864ebd0a31215b2e9dff381",
    "vendor_detected": "Hikvision",
    "device_serial": "HIK-99238-X8",
    "ingested_at": "2026-08-24T15:05:40.892Z"
  }
  ```
- **Errors**:
  - `404 Not Found`: If the `case_id` is missing.
  - `500 Internal Server Error`: Stream write failures or cryptohash exceptions.
- **Database Tables Affected**: `evidence` (reads case info), `cameras`, `videos`, `recovered_files` (inserts parsed data), and `chain_of_custody` (logs `EVIDENCE_UPLOAD`, `EXTRACT_CHANNEL`, `FILE_CARVE`).
- **Frontend Usage**: Used by drag-and-drop ingestion widgets. Displays a progress loader.

---

### `GET /api/v1/evidence`
Lists all ingested evidence sources associated with a case.

- **Query Parameters**:
  - `case_id` (string, required): Associated case ID.
- **Response**: (JSON, 200 OK, `List[EvidenceResponse]`)
- **Database Tables Affected**: `evidence` (Read-only).
- **Frontend Usage**: Shows available source devices on the Case Ingestion sidebar.

---

### `GET /api/v1/evidence/{evidence_id}`
Retrieves metadata details of a specific evidence disk image.

- **Path Parameters**:
  - `evidence_id` (string, required): Target evidence UUID.
- **Response**: (JSON, 200 OK, `EvidenceResponse`)
- **Errors**:
  - `404 Not Found`: If the registry UUID does not exist.
- **Database Tables Affected**: `evidence` (Read-only).
- **Frontend Usage**: Displays file sizes and cryptohashes on device property cards.

---

## 3. Video Segment Exploration

### `GET /api/v1/evidence/{evidence_id}/videos`
Retrieves video feeds mapped to a selected evidence source.

- **Path Parameters**:
  - `evidence_id` (string, required): Target evidence UUID.
- **Response**: (JSON, 200 OK, `List[VideoResponse]`)
  ```json
  [
    {
      "id": "fa80bc3e-1191-42cd-9bc1-209ebd87654a",
      "camera_id": "97ac8831-29ed-4d92-80ba-33da67beccba",
      "file_path": "C:\\Users\\somes\\.gemini\\antigravity\\scratch\\forensic_dvr_tool\\storage\\uploads\\unique_hik_nvr_dump.img",
      "duration_seconds": 300.0,
      "start_time": "2026-08-24T13:00:00Z",
      "end_time": "2026-08-24T13:05:00Z",
      "fps": 25.0,
      "resolution": "1920x1080",
      "codec": "H264"
    }
  ]
  ```
- **Errors**:
  - `404 Not Found`: If the evidence ID does not exist.
- **Database Tables Affected**: `videos`, `cameras` (Read-only).
- **Frontend Usage**: Populates video player libraries.

---

### `GET /api/v1/videos/{video_id}`
Retrieves direct video record details.

- **Path Parameters**:
  - `video_id` (string, required): Associated video UUID.
- **Response**: (JSON, 200 OK, `VideoResponse`)
- **Errors**:
  - `404 Not Found`: If the video ID does not exist.
- **Database Tables Affected**: `videos` (Read-only).
- **Frontend Usage**: Retrieves file paths to mount video sources.

---

### `GET /api/v1/videos/{video_id}/metadata`
Retrieves video codec configurations extracted via OpenCV.

- **Path Parameters**:
  - `video_id` (string, required): Video UUID.
- **Response**: (JSON, 200 OK)
  ```json
  {
    "codec": "H264",
    "resolution": "1920x1080",
    "fps": 25.0,
    "duration_seconds": 300.0,
    "start_time": "2026-08-24T13:00:00",
    "end_time": "2026-08-24T13:05:00"
  }
  ```
- **Errors**:
  - `404 Not Found`: If the video ID does not exist.
- **Database Tables Affected**: `videos` (Read-only).
- **Frontend Usage**: Shows resolution and frame rates on video player info bar overlays.

---

## 4. Recovered/Carved Fragments

### `GET /api/v1/evidence/{evidence_id}/recovery`
Retrieves deleted fragments carved from unallocated disk spaces.

- **Path Parameters**:
  - `evidence_id` (string, required): Relational evidence UUID.
- **Response**: (JSON, 200 OK, `List[RecoveredFileResponse]`)
  ```json
  [
    {
      "id": "77bb3201-ac19-4ba2-b21c-99fbfa8120ab",
      "evidence_id": "31bcf902-ad9f-4318-971c-32b0d87920ab",
      "start_sector": 2048,
      "end_sector": 18432,
      "size_bytes": 8388608,
      "status": "Recovered",
      "file_extension": "mp4",
      "estimated_time": "2026-08-24T14:20:00"
    }
  ]
  ```
- **Errors**:
  - `404 Not Found`: If the evidence ID does not exist.
- **Database Tables Affected**: `recovered_files` (Read-only).
- **Frontend Usage**: Displays files on the Deleted Video Recovery panel.

---

## 5. AI Computer Vision Analysis

### `POST /api/v1/analysis/{video_id}`
Triggers YOLOv8 object detection on a video segment, logging tracking indices.

- **Path Parameters**:
  - `video_id` (string, required): Target video UUID.
- **Request Body**: (JSON, `AIAnalysisTrigger` schema)
  ```json
  {
    "classes": ["person", "vehicle"],
    "mode": "REAL"
  }
  ```
  - Mode can be `"REAL"` (live YOLO CPU inference) or `"SIMULATED"` (seeded fallback generation).
- **Response**: (JSON, 202 Accepted)
  ```json
  {
    "status": "Completed",
    "mode": "REAL",
    "model_name": "YOLOv8n",
    "detections_count": 8,
    "processing_time": 1.2582,
    "error": null
  }
  ```
- **Errors**:
  - `400 Bad Request`: Parameter issues or invalid modes.
  - `404 Not Found`: Missing video, camera, or case records on disk database.
  - `500 Internal Server Error`: YOLO load anomalies or OpenCV stream parsing issues.
- **Database Tables Affected**: `ai_detections` (inserts detections), `chain_of_custody` (logs `AI_ANALYSIS_START` and `AI_ANALYSIS_COMPLETE` / `AI_ANALYSIS_FAILED`).
- **Frontend Usage**: Triggered by hitting the "Run AI Analysis" button.

---

### `GET /api/v1/analysis/{video_id}`
Retrieves bounding boxes parsed chronologically by timestamp.

- **Path Parameters**:
  - `video_id` (string, required): Associated video UUID.
- **Response**: (JSON, 200 OK, `List[AIDetectionResponse]`)
  ```json
  [
    {
      "id": "e3b8a102-bb92-4c28-98bc-cc38ba41829e",
      "video_id": "fa80bc3e-1191-42cd-9bc1-209ebd87654a",
      "camera_id": "97ac8831-29ed-4d92-80ba-33da67beccba",
      "timestamp": "2026-08-24T13:02:14Z",
      "frame_number": 3350,
      "label": "person",
      "confidence": 0.89,
      "bounding_box": {
        "x_min": 0.125,
        "y_min": 0.334,
        "x_max": 0.245,
        "y_max": 0.781
      },
      "inference_source": "REAL_MODEL",
      "model_name": "YOLOv8n"
    }
  ]
  ```
- **Errors**:
  - `404 Not Found`: If the video ID does not exist.
- **Database Tables Affected**: `ai_detections` (Read-only).
- **Frontend Usage**: Renders overlays containing bounding-box dimensions directly onto custom HTML5 canvas media player layers.

---

## 6. Unified Temporal Timeline

### `GET /api/v1/timeline/{case_id}`
Retrieves chronological forensic logs in a unified feed.

- **Path Parameters**:
  - `case_id` (string, required): Target case UUID.
- **Query Parameters**:
  - `camera_id` (string, optional): Filter events by camera source.
  - `event_type` (string, optional): Filter (e.g. `INGESTION`, `AI_DETECTION`, `AUDIT`, `RECOVERY`).
  - `start_dt` (datetime, optional): Start window.
  - `end_dt` (datetime, optional): End window.
  - `label` (string, optional): Filter detections (e.g. `person`, `vehicle`).
- **Response**: (JSON, 200 OK, `List[TimelineEventResponse]`)
  ```json
  [
    {
      "id": "ingest-start-fa80bc3e-1191-42cd-9bc1-209ebd87654a",
      "timestamp": "2026-08-24T13:00:00Z",
      "event_type": "INGESTION",
      "source": "CAM-01 Main Gate",
      "description": "Extracted footage segment 'CAM-01 Main Gate' starts.",
      "context_id": "fa80bc3e-1191-42cd-9bc1-209ebd87654a"
    },
    {
      "id": "e3b8a102-bb92-4c28-98bc-cc38ba41829e",
      "timestamp": "2026-08-24T13:02:14Z",
      "event_type": "AI_DETECTION",
      "source": "CAM-01 Main Gate",
      "description": "AI object match: 'person' detected (confidence 89%).",
      "context_id": "fa80bc3e-1191-42cd-9bc1-209ebd87654a"
    }
  ]
  ```
- **Database Tables Affected**: Joins and searches `videos`, `ai_detections`, `recovered_files`, and `chain_of_custody` (Read-only).
- **Frontend Usage**: Renders unified feeds for investigators to parse temporal activities.

---

## 7. Chain of Custody & Audit logs

### `GET /api/v1/chain-of-custody/{evidence_id}`
Retrieves chronologically ascending auditing lists.

- **Path Parameters**:
  - `evidence_id` (string, required): Associated evidence UUID.
- **Response**: (JSON, 200 OK, `List[ChainOfCustodyResponse]`)
  ```json
  [
    {
      "id": "f5127ab1-eedf-893c-bc22-caee921389ab",
      "case_id": "e6a2bc4d-ba91-4d3a-8671-8bc6fa82117a",
      "evidence_id": "31bcf902-ad9f-4318-971c-32b0d87920ab",
      "timestamp": "2026-08-24T15:05:40Z",
      "operator": "Detective Cooper",
      "action": "EVIDENCE_UPLOAD",
      "description": "Evidence file 'hik_nvr_dump.img' uploaded. Hashing details: MD5=0f62bbf0e76479ffad7d1591f868ef42, SHA256=4b68e9f5e3bc83921b7d152c8038b39a2f7c001cf864ebd0a31215b2e9dff381. Vendor identified: Hikvision."
    }
  ]
  ```
- **Database Tables Affected**: `chain_of_custody` (Read-only).
- **Frontend Usage**: Renders verified forensic report audit ledgers.

---

## 8. Forensic Report Generation

### `POST /api/v1/reports/{case_id}`
Compiles and generates a detailed Markdown dossier of the investigation.

- **Path Parameters**:
  - `case_id` (string, required): Associated case UUID.
- **Request Body**: (JSON, `ReportBase` schema)
  ```json
  {
    "title": "Police Department Video Forensic Analysis Report",
    "generated_by": "Detective Cooper"
  }
  ```
- **Response**: (JSON, 201 Created, `ReportResponse`)
  ```json
  {
    "id": "99aa8832-1bc8-da01-c89b-f9cae238910b",
    "case_id": "e6a2bc4d-ba91-4d3a-8671-8bc6fa82117a",
    "title": "Police Department Video Forensic Analysis Report - CASE-101",
    "generated_by": "Detective Cooper",
    "generated_at": "2026-08-24T15:10:00Z",
    "content_markdown": "# Police Department Video Forensic Analysis Report - CASE-101\n..."
  }
  ```
- **Database Tables Affected**: `reports`, `chain_of_custody` (logs `REPORT_GEN`).
- **Frontend Usage**: Triggers exports. The returned markdown text satisfies direct print styles.

---

### `GET /api/v1/reports/{case_id}`
Fetches the most recently generated report for a case.

- **Path Parameters**:
  - `case_id` (string, required): Case UUID.
- **Response**: (JSON, 200 OK, `ReportResponse`)
- **Errors**:
  - `404 Not Found`: No reports found.
- **Database Tables Affected**: `reports` (Read-only).
- **Frontend Usage**: Restores saved reports.

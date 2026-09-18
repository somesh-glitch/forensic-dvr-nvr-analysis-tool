# Handoff Backlog Roadmap

This document outlines the remaining tasks required to complete the Multi-Vendor DVR/NVR Forensic Analysis Tool.

---

## 1. BACKEND TODO

- **Asynchronous Task Processing** `[Priority: CRITICAL]`
  - *Description*: AI video scanning runs synchronously in HTTP request loops, which blocks web connections for long clips.
  - *Action*: Integrate background task runners (e.g. FastAPI `BackgroundTasks` or Celery workers) to handle processing asynchronously and update status indicators in the database.
- **Enhanced Error Logging & Diagnostics** `[Priority: MEDIUM]`
  - *Description*: Server exceptions return truncated HTTP stack traces.
  - *Action*: Configure a log rotation library to write backend exceptions to `storage/logs/error.log`.
- **API Token Security & Multi-User Access Control** `[Priority: MEDIUM]`
  - *Description*: All endpoints are open (CORS `*`) without authentication.
  - *Action*: Implement JWT authentication routes and verify investigator role scopes.

---

## 2. AI TODO

- **GPU Acceleration Integration** `[Priority: HIGH]`
  - *Description*: YOLO model searches run in CPU fallback mode, causing long analysis times for large video files.
  - *Action*: Add PyTorch CUDA check logic to run inference on the GPU if drivers are available.
- **Additional Class Detections** `[Priority: MEDIUM]`
  - *Description*: Only persons and wheeled vehicle COCO classes are currently supported.
  - *Action*: Extend the class mapping in `ai_service.py` to support other classes if requested (e.g. bags, phones, knives).
- **Temporal Event De-duplication** `[Priority: LOW]`
  - *Description*: Identifies single objects spanning consecutive frames as redundant, discrete events.
  - *Action*: Group object detections into unified events to reduce timeline clutter.

---

## 3. FRONTEND TODO

- **Visual Dashboard & Ingestion Form** `[Priority: CRITICAL]`
  - *Description*: The UI layout needs interfaces to trigger case creations and drag-and-drop file ingestion.
  - *Action*: Build React drag-and-drop components and case creation forms.
- **Media Player canvas Overlay** `[Priority: CRITICAL]`
  - *Description*: Bounding box coordinates are saved in the DB but need to be rendered in the UI.
  - *Action*: Create an HTML5 canvas overlay on the React media player to render relative coordinates dynamically.
- **Unified Timeline & Search** `[Priority: HIGH]`
  - *Description*: A timeline component is needed to display chronologized events.
  - *Action*: Build a timeline layout component that supports filtering by camera, date ranges, and class tags.
- **Chain of Custody Ledger Panel** `[Priority: HIGH]`
  - *Description*: Immutable audit logs need to be accessible.
  - *Action*: Create an audit panel displaying chronological log lists.
- **markdown Dossier Printer** `[Priority: MEDIUM]`
  - *Description*: Forensic report Markdown needs translation.
  - *Action*: Build a report rendering view with options to print or export as PDF.

---

## 4. FORENSIC ENGINEER TODO

- **Proprietary Filesystem Decoders** `[Priority: CRITICAL]`
  - *Description*: The system currently uses simulation stubs to identify vendors and camera layouts.
  - *Action*: Replace stubs in `forensic_service.py` with real block parsing code to reconstruct actual partitions and active cameras.
- **Disk Carving Extraction** `[Priority: CRITICAL]`
  - *Description*: Deleted file carving is simulated.
  - *Action*: Scan raw image dumps for file headers (e.g., MPEG-PS packets, AVC frames) to identify and carve deleted video segments from unallocated space.
- **Device Metadata Parsing** `[Priority: HIGH]`
  - *Description*: Hardware configuration metrics are simulated.
  - *Action*: Extract hardware data from disk partitions, including NVR serial numbers, models, and firmware settings.

---

## 5. INTEGRATION TODO

- **Forensic Engine & API Data Binding** `[Priority: CRITICAL]`
  - *Description*: Integrating real block parsing should not break existing API schemas.
  - *Action*: Verify that low-level parser outputs conform to database shapes (Camera indexes, start/end dates, Video models).
- **Media Streaming Directory Binding** `[Priority: HIGH]`
  - *Description*: Mapped videos must be playable in the UI.
  - *Action*: Ensure that files written to `storage/extracted/` are saved in browser-compatible formats (like H.264 MP4).

---

## 6. VALIDATION & DEMO TODO

- **Multi-Vendor Hard Disk Image Validation Suite** `[Priority: CRITICAL]`
  - *Description*: The system needs to be tested against real surveillance hardware dumps.
  - *Action*: Gather raw disk images from physical Hikvision/Dahua units to validate parsing and carving.
- **YOLO GPU Benchmarks** `[Priority: LOW]`
  - *Description*: Processing performance metrics are missing.
  - *Action*: Run E2E regression tests on GPU setups to document frame rate processing speeds.

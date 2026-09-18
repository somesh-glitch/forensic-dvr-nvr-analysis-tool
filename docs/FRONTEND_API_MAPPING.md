# FRONTEND API ENDPOINT MAPPING

This document lists the REST API paths utilized by the HTML/JS pages.

| Page | Endpoint Called | HTTP Method | Request Body / Query Params | UI Component Mapping |
|---|---|---|---|---|
| **cases.html** | `/api/v1/cases` | GET | None | Lists available cases |
| | `/api/v1/cases` | POST | Pydantic `CaseCreate` schema | Creates new case |
| **dashboard.html** | `/api/v1/cases/{case_id}/stats` | GET | None | Populates count indicators & charts |
| | `/api/v1/cases/{case_id}/recent-events` | GET | None | Populates recent activity logs |
| **evidence.html** | `/api/v1/evidence/?case_id={case_id}` | GET | `case_id` query param | Populates ingestion queue list |
| | `/api/v1/evidence/upload` | POST | `multipart/form-data` | Handles DVR dumps uploads |
| **analysis.html** | `/api/v1/evidence/?case_id={case_id}` | GET | `case_id` query param | Pulls files under case context |
| | `/api/v1/evidence/{evidence_id}/videos` | GET | None | Populates select picker channels |
| | `/api/v1/analysis/{video_id}` | GET | None | Loads YOLO detections for selected channel |
| | `/api/v1/analysis/{video_id}` | POST | JSON `{"classes": [...], "mode": "REAL"}` | Triggers YOLOv8 object analytics |
| **timeline.html** | `/api/v1/timeline/{case_id}` | GET | None | Compiles unified chronological sequence |
| **custody.html** | `/api/v1/chain-of-custody/{evidence_id}`| GET | None | Fetches audit trail for a channel file |
| **reports.html** | `/api/v1/reports/{case_id}` | GET | None | Fetches latest generated database report |
| | `/api/v1/reports/{case_id}` | POST | JSON `{"title": "...", "generated_by": "..."}`| Launches markdown compiler |

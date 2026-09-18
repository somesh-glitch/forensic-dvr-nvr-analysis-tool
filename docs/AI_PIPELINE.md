# AI Processing Pipeline

The system integrates an object detection pipeline powered by PyTorch, OpenCV, and Ultralytics YOLOv8. It allows investigators to automatically sweep surveillance video feeds, indexing people and vehicles of interest without manual scrubbing.

---

## Architectural Workflow

The AI analysis module executes synchronously within a unified transaction block:

```
[REST Ingestion / Client Trigger]
             ↓
[Query video details on disk]
             ↓
[Record AI_ANALYSIS_START inside Audit Log]
             ↓
[Verify YOLOv8 library load availability]
             ├─────────────────────────────────────────────────┐
    (REAL Mode - Available)                           (SIMULATED Mode / Fallback)
             ↓                                                 ↓
[Open video via cv2.VideoCapture]                      [Seed generator with Video UUID]
             ↓                                                 ↓
[Frame Sampling Loop: 1 fps rate]                      [Generate deterministic log blocks]
             ↓                                                 ↓
[Predict objects via YOLOv8n model]                    [Initialize metadata bounding boxes]
             ↓                                                 ↓
[Validate class weights and thresholds]                        │
             ├─────────────────────────────────────────────────┘
             ↓
[Add detections to database transaction]
             ↓
[Record AI_ANALYSIS_COMPLETE inside Audit Log]
             ↓
[Atomic Database Commit]
```

---

## 1. Frame Sampling Strategy
Surveillance video recordings often span hours; running deep learning inference on every frame is highly resource-intensive. The pipeline uses a target sampling strategy:
- **Sampling Interval**: Reads the source video's FPS and calculates sampling intervals:
  $$\text{Interval} = \text{int}(\text{Video FPS} \times \text{settings.FRAME_SAMPLING_RATE\_SECONDS})$$
  *(Default rate is defined in configuration settings as 1.0 second, sampling exactly 1 frame per second).*
- **Decoder**: Employs `cv2.VideoCapture` to loop through segments. Non-sampled frames are skipped immediately.

---

## 2. Bounding Box & Class Processing

### YOLOv8 Model Configuration
- **Model Model weights**: `yolov8n.pt` (YOLOv8 Nano, optimized for embedded/CPU limits).
- **Execution Engine**: Runs on **CPU** within standard deployments, avoiding heavy CUDA/GPU library needs while remaining resilient.
- **Confidence Threshold**: Configured at a default of `0.4` (`settings.AI_CONFIDENCE_THRESHOLD`), ignoring weak predictions.

### Supported COCO Target Classes
The service filters targets using COCO weight identifiers:
- **`0`**: `person`
- **`2`**: `car`
- **`3`**: `motorcycle`
- **`5`**: `bus`
- **`7`**: `truck`

*Note: If the input target classes payload requests `"vehicle"`, the service searches for matches across all four wheeled index types (`car`, `motorcycle`, `bus`, `truck`).*

### Coordinates Normalization
YOLOv8 returns box coordinates in local pixels $(x_{min}, y_{min}, x_{max}, y_{max})$. To make coordinates scalable for frontend rendering over responsive UI elements:
1. Fetches frame resolution dimensions (Width, Height).
2. Divides pixel coordinate values by dimensions, outputting relative floating ratios between `0.0` and `1.0`:
   $$x_{relative\_min} = \frac{x_{min}}{\text{Width}}, \quad y_{relative\_min} = \frac{y_{min}}{\text{Height}}$$
3. Commits the ratios as a JSON string: `{"x_min": ..., "y_min": ..., "x_max": ..., "y_max": ...}`.

---

## 3. Real vs. Simulated Modes

The endpoint allows clients to specify execution mode parameters:

| Metric / Mode | `REAL` Mode | `SIMULATED` Mode |
|---|---|---|
| **Model Loader** | Dynamic `ultralytics.YOLO` package. | Deterministic seed generator. |
| **Inference Source** | Runs AI inference on video frames. | Mocks bounding box parameters. |
| **Execution Dependency** | Requires uvicorn execution environment to resolve `ultralytics` imports. | Falls back seamlessly if libraries are missing. |
| **Source Field** | `REAL_MODEL` | `SIMULATED` |
| **Model Name Field** | `YOLOv8n` | `Simulated_Fallback` |
| **Deterministic Result** | Depends on visual content on disk. | Derived from Video UUID character sum. |

---

## 4. Successful YOLO Regression Test

The repository includes a successful, real YOLO regression test validates the end-to-end pipeline:
- **File**: `e2e_regression_yolo.py`
- **Asset**: Utilizes the actual included demo video [demo.mp4](file:///C:/Users/somes/.gemini/antigravity/scratch/forensic_dvr_tool/backend/test_media/demo.mp4) (Length: 5.073 seconds, Resolution: 1280x720, FPS: 14.98, Codec: H264).
- **Execution Flow**:
  1. Bootstraps the test DB, registers a case and uploads `demo.mp4`.
  2. Asserts metadata parsing (FPS: 14.98, resolution: 1280x720, duration: 5.073 seconds).
  3. Triggers REAL mode YOLOv8n object detection on the video UUID.
  4. Confirms that `ai_detections` are written to the database with `REAL_MODEL` and `YOLOv8n` parameters.
  5. Validates chain of custody log entries.
- **Regression Status**: Passes successfully, confirming YOLO model execution, OpenCV frame parsing, metadata calculations, and SQLite commits are functional.

---

## 5. Failure Behaviors

If errors occur during YOLO analysis:
1. **Rollback**: Any partially registered database detections are rolled back to keep the database consistent.
2. **Custody Record**: Attempts a separate insert into the Chain of Custody registry, writing an `AI_ANALYSIS_FAILED` audit row containing error details.
3. **HTTP Response**: Propagates errors to the REST client:
   - `404 Not Found` if video files are missing.
   - `400 Bad Request` if input parameters are invalid.
   - `500 Internal Server Error` for system-level errors.

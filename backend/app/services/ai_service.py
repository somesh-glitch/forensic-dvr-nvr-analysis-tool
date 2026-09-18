import os
import time
import json
import random
from datetime import datetime, timedelta
from typing import List, Dict, Any
from sqlalchemy.orm import Session

from app.models.models import Video, AIDetection, ChainOfCustody, Camera
from app.config import settings

# Attempt to load YOLO, but make it optional so that the server remains resilient
# if the environment lacks CUDA/Torch or internet connection to download weights
YOLO_AVAILABLE = False
try:
    from ultralytics import YOLO
    YOLO_AVAILABLE = True
except ImportError:
    pass

import cv2

class AIService:
    @staticmethod
    def analyze_video(
        db: Session, 
        video_id: str, 
        case_id: str, 
        operator_name: str, 
        target_classes: List[str], 
        mode: str = "REAL"
    ) -> Dict[str, Any]:
        """
        Processes video frames, detects targeted objects (e.g. Person, Vehicle, Car, etc.)
        using standard YOLOv8 or simulated fallback, and records them to database.
        Commit is executed in a single atomic database transaction block.
        """
        video = db.query(Video).filter(Video.id == video_id).first()
        if not video:
            raise ValueError(f"Video record not found for ID: {video_id}")

        camera = db.query(Camera).filter(Camera.id == video.camera_id).first()
        camera_id = camera.id if camera else None

        start_time_proc = time.time()

        # Chain of custody start log (not committed yet, will committed atomically at end)
        log_start = ChainOfCustody(
            case_id=case_id,
            evidence_id=camera.evidence_id if camera else None,
            operator=operator_name,
            action="AI_ANALYSIS_START",
            description=f"AI Computer Vision analysis ({mode}) started on video {os.path.basename(video.file_path)}."
        )
        db.add(log_start)

        detections = []

        if mode == "REAL":
            if not YOLO_AVAILABLE:
                raise RuntimeError("REAL mode requested but YOLOv8 library (ultralytics) is not installed/loadable.")

            path = video.file_path
            if not os.path.exists(path):
                raise FileNotFoundError(f"Video file not found at local storage: {path}")

            cap = cv2.VideoCapture(path)
            if not cap or not cap.isOpened():
                raise RuntimeError(f"OpenCV failed to open or parse video file: {path}")

            try:
                # Initialize YOLOv8 Nano (loads from disk or downloads)
                model = YOLO("yolov8n.pt")

                fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
                frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
                if frame_count <= 0:
                    raise ValueError(f"Video file has invalid frame count: {frame_count}")

                # Class maps for YOLOv8 (coco weights):
                # 0: person, 2: car, 3: motorcycle, 5: bus, 7: truck
                class_mapping = {
                    0: "person",
                    2: "car",
                    3: "motorcycle",
                    5: "bus",
                    7: "truck"
                }

                # Sample frame interval
                sample_interval = int(fps * settings.FRAME_SAMPLING_RATE_SECONDS)
                if sample_interval <= 0:
                    sample_interval = 1

                current_frame = 0
                while cap.isOpened():
                    ret, frame = cap.read()
                    if not ret:
                        break

                    if current_frame % sample_interval == 0:
                        # Inference step
                        results = model(frame, verbose=False)[0]
                        boxes = results.boxes

                        relative_seconds = current_frame / fps
                        detection_time = video.start_time + timedelta(seconds=relative_seconds)

                        for box in boxes:
                            cls_id = int(box.cls[0].item())
                            conf = float(box.conf[0].item())

                            if cls_id in class_mapping and conf >= settings.AI_CONFIDENCE_THRESHOLD:
                                label = class_mapping[cls_id]
                                
                                # Check if label matches targeted selection (or vehicle mapping)
                                matches_target = (
                                    label in target_classes or
                                    (label in ["car", "motorcycle", "bus", "truck"] and "vehicle" in target_classes)
                                )

                                if matches_target:
                                    height, width, _ = frame.shape
                                    xyxy = box.xyxy[0].tolist()
                                    bbox = {
                                        "x_min": round(xyxy[0] / width, 4),
                                        "y_min": round(xyxy[1] / height, 4),
                                        "x_max": round(xyxy[2] / width, 4),
                                        "y_max": round(xyxy[3] / height, 4),
                                    }

                                    det = AIDetection(
                                        video_id=video.id,
                                        camera_id=camera_id,
                                        timestamp=detection_time,
                                        frame_number=current_frame,
                                        label=label,
                                        confidence=conf,
                                        bounding_box=json.dumps(bbox),
                                        inference_source="REAL_MODEL",
                                        model_name="YOLOv8n"
                                    )
                                    detections.append(det)
                                    db.add(det)

                    current_frame += 1
            except Exception as e:
                db.rollback()
                raise RuntimeError(f"Real YOLOv8 inference execution error: {str(e)}")
            finally:
                cap.release()

        elif mode == "SIMULATED":
            # Generate simulated detections using seeded generator
            detections = AIService._generate_simulated_detections(video, camera_id, target_classes)
            for det in detections:
                db.add(det)
        else:
            raise ValueError(f"Invalid execution mode specified: {mode}")

        processing_time = round(time.time() - start_time_proc, 4)

        # Chain of custody end log
        log_end = ChainOfCustody(
            case_id=case_id,
            evidence_id=camera.evidence_id if camera else None,
            operator=operator_name,
            action="AI_ANALYSIS_COMPLETE",
            description=f"AI Computer Vision analysis ({mode}) completed. Registered {len(detections)} detections."
        )
        db.add(log_end)

        # Atomic commit on complete success
        db.commit()

        return {
            "status": "Completed",
            "mode": mode,
            "model_name": "YOLOv8n" if mode == "REAL" else "Simulated_Fallback",
            "detections_count": len(detections),
            "processing_time": processing_time,
            "error": None
        }

    @staticmethod
    def _generate_simulated_detections(video: Video, camera_id: str, target_classes: List[str]) -> List[AIDetection]:
        """
        Creates structurally consistent and realistic mock detections when running in simulation mode.
        Detections are deterministic, derived from seed offsets so successive analyses yield coherent visual timelines.
        """
        detections = []
        duration = int(video.duration_seconds)
        fps = video.fps
        
        # Use video ID hash as seed so that the mock events are deterministic
        seed_value = sum(ord(c) for c in video.id)
        random.seed(seed_value)
        
        # Determine number of events (between 2 and 6 per video channel segment)
        num_events = random.randint(2, 6)
        
        # Create timestamps and frame boundaries
        for i in range(num_events):
            offset_seconds = random.randint(10, duration - 10)
            det_time = video.start_time + timedelta(seconds=offset_seconds)
            frame_num = int(offset_seconds * fps)
            
            # Form clean list of matching types (or default)
            possible_labels = [c for c in target_classes if c in ["person", "car", "motorcycle", "bus", "truck", "vehicle"]]
            if not possible_labels:
                possible_labels = ["person"]
            
            label = random.choice(possible_labels)
            confidence = round(random.uniform(0.65, 0.96), 2)
            
            x_min = round(random.uniform(0.05, 0.5), 2)
            y_min = round(random.uniform(0.1, 0.4), 2)
            bbox = {
                "x_min": x_min,
                "y_min": y_min,
                "x_max": round(x_min + random.uniform(0.1, 0.35), 2),
                "y_max": round(y_min + random.uniform(0.2, 0.45), 2)
            }
            
            det = AIDetection(
                video_id=video.id,
                camera_id=camera_id,
                timestamp=det_time,
                frame_number=frame_num,
                label=label,
                confidence=confidence,
                bounding_box=json.dumps(bbox),
                inference_source="SIMULATED",
                model_name="Simulated_Fallback"
            )
            detections.append(det)
            
        return detections

import os
from datetime import datetime, timedelta
from app.database.session import SessionLocal, engine, Base
from app.models import models
from app.services.ai_service import AIService

def run_validation():
    print("====================================================")
    print("STARTING REAL YOLOv8 E2E PIPELINE VALIDATION")
    print("====================================================")

    # Initialize DB (Main forensic.db)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # Locate demo.mp4
    video_path = os.path.abspath("test_media/demo.mp4")
    if not os.path.exists(video_path):
        print(f"Error: Demo video not found at {video_path}")
        return

    print(f"Located target demo video: {video_path}")
    print(f"Video file size: {os.path.getsize(video_path)} bytes")

    try:
        # 1. Register Case
        case = models.Case(
            case_number="CASE-E2E-VAL-99",
            title="Real AI E2E Pipeline Validation",
            investigator="Chief Auditor Jones"
        )
        db.add(case)
        db.commit()
        print(f"Created validation Case with ID: {case.id}")

        # 2. Register Evidence
        evidence = models.Evidence(
            case_id=case.id,
            name="demo.mp4",
            file_path=video_path,
            file_size=os.path.getsize(video_path),
            md5="d59850c90c7493a7ebead5132646d61f",
            sha256="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            vendor_detected="Hikvision"
        )
        db.add(evidence)
        db.commit()
        print(f"Registered Evidence with ID: {evidence.id}")

        # 3. Register Camera
        camera = models.Camera(
            evidence_id=evidence.id,
            channel_number=1,
            name="Main Lobby PTZ"
        )
        db.add(camera)
        db.commit()
        print(f"Registered Camera channel with ID: {camera.id}")

        # 4. Register Video Segment
        start_time = datetime(2026, 8, 23, 14, 0, 0)
        video = models.Video(
            camera_id=camera.id,
            file_path=video_path,
            duration_seconds=10.0,  # Demo video duration
            start_time=start_time,
            end_time=start_time + timedelta(seconds=10.0),
            fps=25.0,
            resolution="640x360",
            codec="h264"
        )
        db.add(video)
        db.commit()
        print(f"Registered Video segment with ID: {video.id}")

        # 5. Trigger REAL YOLOv8 pipeline
        print("\n[AIService] Running real YOLOv8 object detection...")
        result = AIService.analyze_video(
            db=db,
            video_id=video.id,
            case_id=case.id,
            operator_name=case.investigator,
            target_classes=["person", "car", "motorcycle", "bus", "truck"],
            mode="REAL"
        )

        print("\nExecution Report:")
        print(f"  Status: {result['status']}")
        print(f"  Mode: {result['mode']}")
        print(f"  Model Name: {result['model_name']}")
        print(f"  Detections Count: {result['detections_count']}")
        print(f"  Processing Time: {result['processing_time']} seconds")
        print(f"  Error: {result['error']}")

        # 6. Query DB and print stored detections
        detections = db.query(models.AIDetection).filter(models.AIDetection.video_id == video.id).all()
        print(f"\nQuerying Database for Detections (Saved: {len(detections)} items):")
        for i, det in enumerate(detections[:10]):  # Print up to 10
            print(f"  [{i+1}] Label: {det.label} | Conf: {det.confidence:.2f} | Frame: {det.frame_number} | Source: {det.inference_source} | Model: {det.model_name}")
        
        # 7. Query Chain of Custody
        cocs = db.query(models.ChainOfCustody).filter(models.ChainOfCustody.case_id == case.id).all()
        print(f"\nChain of Custody Logs recorded (Saved: {len(cocs)} entries):")
        for coc in cocs:
            print(f"             Action: {coc.action} | Operator: {coc.operator}")
            print(f"             Notes:  {coc.description}")

    except Exception as e:
        db.rollback()
        print(f"\nCRITICAL VALIDATION FAILURE: {str(e)}")
    finally:
        db.close()

if __name__ == "__main__":
    run_validation()

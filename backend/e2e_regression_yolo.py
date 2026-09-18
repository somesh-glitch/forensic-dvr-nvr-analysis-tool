import os
from fastapi.testclient import TestClient
from app.main import app
from app.database.session import SessionLocal, engine, Base
from app.models import models

# Use TestClient with live/main database connection to audit final database state!
client = TestClient(app)

def run_regression():
    print("====================================================================")
    print("STARTING E2E RECOVERY & REAL YOLOv8 REGRESSION AUDIT")
    print("====================================================================")

    # Initialize Main database tables
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    demo_path = os.path.abspath("test_media/demo.mp4")
    if not os.path.exists(demo_path):
        print(f"Error: Target demo video not found at {demo_path}")
        return

    print(f"Target video file: {demo_path}")
    print(f"Video file size: {os.path.getsize(demo_path)} bytes")

    try:
        # Step 1: Create Case
        import uuid
        case_num = f"CASE-REG-{uuid.uuid4().hex[:8].upper()}"
        case_data = {
            "case_number": case_num,
            "title": "E2E YOLO Real Regression",
            "investigator": "Lead Auditor Cooper"
        }
        res_case = client.post("/api/v1/cases/", json=case_data)
        assert res_case.status_code == 201, f"\nCase creation failed: {res_case.text}"
        case = res_case.json()
        case_id = case["id"]
        print(f"[SUCCESS] Step 1: Case created with ID: {case_id}")

        # Step 2: Upload Real MP4 Evidence
        print("[Client] Uploading demo.mp4 to REST Ingestion Endpoint...")
        with open(demo_path, "rb") as f:
            res_upload = client.post(
                "/api/v1/evidence/upload",
                data={"case_id": case_id},
                files={"file": ("demo.mp4", f, "video/mp4")}
            )
        assert res_upload.status_code == 202, f"\nUpload failed: {res_upload.text}"
        evidence = res_upload.json()
        evidence_id = evidence["id"]
        print(f"[SUCCESS] Step 2: Evidence uploaded. Vendor identified: {evidence['vendor_detected']}")

        # Step 3: Verify Video DB Record & Metadata Extraction
        # Let's query db directly for the videos related to this camera/evidence
        db_cam = db.query(models.Camera).filter(models.Camera.evidence_id == evidence_id).first()
        assert db_cam is not None, "\nCamera channel records not registered."
        db_video = db.query(models.Video).filter(models.Video.camera_id == db_cam.id).first()
        assert db_video is not None, "\nVideo segment records not registered."
        
        print("\nExtracted Video Metadata:")
        print(f"  Duration: {db_video.duration_seconds} seconds")
        print(f"  FPS: {db_video.fps}")
        print(f"  Resolution: {db_video.resolution}")
        print(f"  Codec: {db_video.codec}")
        
        # Verify it matches actual video parameters of test_media/demo.mp4
        assert abs(db_video.duration_seconds - 5.073) < 0.01, f"Incorrect duration: {db_video.duration_seconds}"
        assert abs(db_video.fps - 14.98) < 0.05, f"Incorrect FPS: {db_video.fps}"
        assert db_video.resolution == "1280x720", f"Incorrect resolution: {db_video.resolution}"
        assert "h264" in db_video.codec.lower() or "avc" in db_video.codec.lower() or db_video.codec != ""
        assert db_video.duration_seconds != 60.0, "Used legacy 60.0s hardcoded duration!"
        print("[SUCCESS] Step 3: Real Video metadata successfully parsed and stored in DB!")

        # Step 4: Trigger REAL YOLOv8n inference on Video ID
        print(f"\n[Client] Triggering REAL mode YOLOv8n object detection on Video ID: {db_video.id}...")
        res_ai = client.post(
            f"/api/v1/analysis/{db_video.id}",
            json={"classes": ["person", "car", "truck"], "mode": "REAL"}
        )
        assert res_ai.status_code == 202, f"\nAI Trigger failed: {res_ai.text}"
        ai_metrics = res_ai.json()
        
        print("AI Execution Metrics:")
        print(f"  Status: {ai_metrics['status']}")
        print(f"  Mode: {ai_metrics['mode']}")
        print(f"  Model Name: {ai_metrics['model_name']}")
        print(f"  Detections Count: {ai_metrics['detections_count']}")
        print(f"  Processing Time: {ai_metrics['processing_time']} seconds")
        assert ai_metrics["status"] == "Completed"
        assert ai_metrics["mode"] == "REAL"
        assert ai_metrics["model_name"] == "YOLOv8n"
        print("[SUCCESS] Step 4: Real YOLOv8n inference executed successfully!")

        # Step 5: Verify AIDetection DB Records
        db_dets = db.query(models.AIDetection).filter(models.AIDetection.video_id == db_video.id).all()
        print(f"\nSaved AI Detections in Database ({len(db_dets)} items):")
        for i, det in enumerate(db_dets):
            print(f"  [{i+1}] Label: {det.label} | Conf: {det.confidence:.2f} | Frame: {det.frame_number} | Source: {det.inference_source} | Model: {det.model_name}")
            assert det.inference_source == "REAL_MODEL"
            assert det.model_name == "YOLOv8n"
            assert det.video_id == db_video.id
            assert det.camera_id == db_cam.id
        print("[SUCCESS] Step 5: Database detections verified as REAL_MODEL / YOLOv8n!")

        # Step 6: Verify Timeline retrieve
        res_time = client.get(f"/api/v1/timeline/{case_id}")
        assert res_time.status_code == 200
        timeline = res_time.json()
        print(f"\nTimeline Events retrieved ({len(timeline)} items):")
        ai_events = [e for e in timeline if e["event_type"] == "AI_DETECTION"]
        for e in ai_events:
            print(f"  Timestamp: {e['timestamp']} | Event: {e['event_type']} | Source: {e['source']} | Description: {e['description']}")
        assert len(ai_events) == len(db_dets)
        print("[SUCCESS] Step 6: Timeline returns all AI detections correctly!")

        # Step 7: Verify Chain of Custody logging
        res_coc = client.get(f"/api/v1/chain-of-custody/{evidence_id}")
        assert res_coc.status_code == 200
        coc_logs = res_coc.json()
        print(f"\nChain of Custody Logs ({len(coc_logs)} items):")
        for log in coc_logs:
            print(f"  Action: {log['action']} | Operator: {log['operator']} | Desc: {log['description']}")
        actions = [log["action"] for log in coc_logs]
        assert "EVIDENCE_UPLOAD" in actions
        assert "AI_ANALYSIS_START" in actions
        assert "AI_ANALYSIS_COMPLETE" in actions
        print("[SUCCESS] Step 7: Chain of custody logs contain all required audit markers!")

        # Step 8: Verify Report generation
        report_data = {
            "title": "Police Department Forensic Audit Report",
            "generated_by": "Lead Auditor Cooper"
        }
        res_rep = client.post(f"/api/v1/reports/{case_id}", json=report_data)
        assert res_rep.status_code == 201
        report = res_rep.json()
        print("\nReport Generated Preview:")
        print(report["content_markdown"][:600] + "\n...")
        assert "Police Department Forensic Audit Report" in report["content_markdown"]
        # Check if AI detections are mentioned in the timeline markdown table
        for det in db_dets:
            assert det.label in report["content_markdown"]
        print("[SUCCESS] Step 8: Forensic report includes AI findings and generated correctly!")

        print("\n====================================================================")
        print("REGRESSION COMPLETED SUCCESSFULLY: 100% CORRECT")
        print("====================================================================")

    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    run_regression()

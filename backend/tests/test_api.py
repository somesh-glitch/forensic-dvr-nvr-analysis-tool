import os
import pytest
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.database.session import Base, get_db
from app.config import settings
from app.models import models

# Setup isolated test database
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_forensic.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Override get_db dependency
def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)

@pytest.fixture(scope="module", autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

def test_create_and_list_cases():
    # 1. Create case
    case_data = {
        "case_number": "CASE-101",
        "title": "Main Lobby Theft",
        "investigator": "Detective Miller",
        "description": "Footage audit for lobby cameras."
    }
    response = client.post("/api/v1/cases/", json=case_data)
    assert response.status_code == 201
    created_case = response.json()
    assert created_case["case_number"] == "CASE-101"
    assert "id" in created_case

    # 2. List cases
    response = client.get("/api/v1/cases/")
    assert response.status_code == 200
    cases = response.json()
    assert len(cases) >= 1
    assert any(c["case_number"] == "CASE-101" for c in cases)

def test_evidence_ingestion_simulation():
    db = TestingSessionLocal()
    # 1. Create Case
    case = models.Case(case_number="CASE-202", title="Storage Room Fire", investigator="Officer Davis")
    db.add(case)
    db.commit()
    case_id = case.id

    # 2. Upload Evidence using real generator
    from make_hkvs_image import make_hkvs_image
    test_file_name = "hik_evidence_dump.img"
    test_file_path = os.path.join(settings.UPLOAD_DIR, test_file_name)
    
    make_hkvs_image(test_file_path)
        
    try:
        with open(test_file_path, "rb") as f:
            response = client.post(
                "/api/v1/evidence/upload",
                data={"case_id": case_id},
                files={"file": (test_file_name, f, "application/octet-stream")}
            )
        assert response.status_code == 202
        res_data = response.json()
        assert res_data["vendor_detected"] == "Hikvision"
        assert res_data["device_serial"] == "Not detected"
        
        # Verify nested video tracks were extracted
        cam_count = db.query(models.Camera).filter(models.Camera.evidence_id == res_data["id"]).count()
        assert cam_count == 3 # Hikvision mock produces 3 channels
        
        # Fetch Video ID
        camera = db.query(models.Camera).filter(models.Camera.evidence_id == res_data["id"]).first()
        video = db.query(models.Video).filter(models.Video.camera_id == camera.id).first()
        
        # Verify timeline retrieves ingestion markers
        t_response = client.get(f"/api/v1/timeline/{case_id}")
        assert t_response.status_code == 200
        events = t_response.json()
        assert len(events) >= 2 # Ingestion Start & End
        
        # Verify Streaming Endpoint
        stream_resp = client.get(f"/api/v1/videos/{video.id}/stream", headers={"Range": "bytes=0-100"})
        assert stream_resp.status_code in (200, 206)
        
        # Verify Report template compilation
        response = client.post(f"/api/v1/reports/{case_id}", json={
            "title": "Forensic Verification Report",
            "generated_by": "Officer Davis"
        })
        assert response.status_code == 201
        report = response.json()
        assert "Forensic Verification Report" in report["content_markdown"]

    finally:
        db.close()
        if os.path.exists(test_file_path):
            os.remove(test_file_path)

def test_ai_simulated_mode():
    db = TestingSessionLocal()
    # Create Case
    case = models.Case(case_number="CASE-SIM-001", title="Simulated Test", investigator="Tester")
    db.add(case)
    db.commit()

    # Create Evidence, Camera, Video
    ev = models.Evidence(case_id=case.id, name="sim_dev.img", file_path="sim_dev.img", file_size=100, md5="1", sha256="1", vendor_detected="Hikvision")
    db.add(ev)
    db.commit()

    cam = models.Camera(evidence_id=ev.id, channel_number=1, name="Camera 1")
    db.add(cam)
    db.commit()

    vid = models.Video(camera_id=cam.id, file_path="sim_dev.img", duration_seconds=60.0, start_time=datetime.now(timezone.utc), end_time=datetime.now(timezone.utc), fps=25.0, resolution="640x480", codec="H264")
    db.add(vid)
    db.commit()

    # Trigger Simulated Mode
    response = client.post(f"/api/v1/analysis/{vid.id}", json={"classes": ["person"], "mode": "SIMULATED"})
    assert response.status_code == 202
    data = response.json()
    assert data["status"] == "Completed"
    assert data["mode"] == "SIMULATED"
    assert data["model_name"] == "Simulated_Fallback"
    assert data["detections_count"] >= 2
    assert "processing_time" in data

    # Verify database entry has SIMULATED source
    dets = db.query(models.AIDetection).filter(models.AIDetection.video_id == vid.id).all()
    assert len(dets) > 0
    assert dets[0].inference_source == "SIMULATED"
    assert dets[0].model_name == "Simulated_Fallback"
    assert dets[0].camera_id == cam.id

    db.close()

def test_ai_invalid_video():
    db = TestingSessionLocal()
    case = models.Case(case_number="CASE-INV-001", title="Invalid Video Test", investigator="Tester")
    db.add(case)
    db.commit()
    ev = models.Evidence(case_id=case.id, name="inv.img", file_path="inv.img", file_size=100, md5="2", sha256="2", vendor_detected="Hikvision")
    db.add(ev)
    db.commit()
    cam = models.Camera(evidence_id=ev.id, channel_number=1, name="Camera 1")
    db.add(cam)
    db.commit()
    # Storing non-existent path
    vid = models.Video(camera_id=cam.id, file_path="nonexistent_corrupted.mp4", duration_seconds=60.0, start_time=datetime.now(timezone.utc), end_time=datetime.now(timezone.utc), fps=25.0, resolution="640x480", codec="H264")
    db.add(vid)
    db.commit()

    # REAL mode with non-existent file should return error
    response = client.post(f"/api/v1/analysis/{vid.id}", json={"classes": ["person"], "mode": "REAL"})
    assert response.status_code == 404  # FileNotFoundError
    db.close()

def test_ai_missing_video():
    # Attempting to query non-existent ID
    response = client.post("/api/v1/analysis/nonexistent-uuid-1234", json={"classes": ["person"], "mode": "REAL"})
    assert response.status_code == 404

def test_ai_yolo_unavailable(monkeypatch):
    db = TestingSessionLocal()
    case = models.Case(case_number="CASE-NOYOLO-001", title="No YOLO Test", investigator="Tester")
    db.add(case)
    db.commit()
    ev = models.Evidence(case_id=case.id, name="noyolo.img", file_path="noyolo.img", file_size=100, md5="3", sha256="3", vendor_detected="Hikvision")
    db.add(ev)
    db.commit()
    cam = models.Camera(evidence_id=ev.id, channel_number=1, name="Camera 1")
    db.add(cam)
    db.commit()
    vid = models.Video(camera_id=cam.id, file_path="noyolo.img", duration_seconds=60.0, start_time=datetime.now(timezone.utc), end_time=datetime.now(timezone.utc), fps=25.0, resolution="640x480", codec="H264")
    db.add(vid)
    db.commit()

    # Monkeypatch YOLO_AVAILABLE to False
    monkeypatch.setattr("app.services.ai_service.YOLO_AVAILABLE", False)

    response = client.post(f"/api/v1/analysis/{vid.id}", json={"classes": ["person"], "mode": "REAL"})
    # Should fail as YOLO is unavailable
    assert response.status_code == 500
    assert "YOLOv8 library" in response.text
    db.close()

def test_ai_real_inference_path():
    # 1. Create a dummy MP4 video using OpenCV
    import cv2
    import numpy as np
    dummy_video_path = "test_real_inference.mp4"
    
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(dummy_video_path, fourcc, 25.0, (640, 480))
    for _ in range(10): # 10 frames = 0.4 seconds
        img = np.zeros((480, 640, 3), dtype=np.uint8)
        out.write(img)
    out.release()

    db = TestingSessionLocal()
    try:
        case = models.Case(case_number="CASE-REAL-001", title="Real Inference Test", investigator="Tester")
        db.add(case)
        db.commit()
        ev = models.Evidence(case_id=case.id, name=dummy_video_path, file_path=dummy_video_path, file_size=os.path.getsize(dummy_video_path), md5="4", sha256="4", vendor_detected="Hikvision")
        db.add(ev)
        db.commit()
        cam = models.Camera(evidence_id=ev.id, channel_number=1, name="Camera 1")
        db.add(cam)
        db.commit()
        
        start_t = datetime(2026, 8, 23, 12, 0, 0, tzinfo=timezone.utc)
        vid = models.Video(camera_id=cam.id, file_path=dummy_video_path, duration_seconds=0.4, start_time=start_t, end_time=start_t + timedelta(seconds=0.4), fps=25.0, resolution="640x480", codec="H264")
        db.add(vid)
        db.commit()

        # Run REAL mode
        response = client.post(f"/api/v1/analysis/{vid.id}", json={"classes": ["person", "car"], "mode": "REAL"})
        assert response.status_code == 202
        data = response.json()
        assert data["status"] == "Completed"
        assert data["mode"] == "REAL"
        assert data["model_name"] == "YOLOv8n"
        assert "processing_time" in data

        # Check in DB
        dets = db.query(models.AIDetection).filter(models.AIDetection.video_id == vid.id).all()
        # Since it's a black video, YOLO will likely find 0 detections, but it should run successfully:
        assert data["detections_count"] == len(dets)
        
        # Verify schema field formats are returned on get
        get_res = client.get(f"/api/v1/analysis/{vid.id}")
        assert get_res.status_code == 200
        get_data = get_res.json()
        assert len(get_data) == len(dets)

    finally:
        db.close()
        if os.path.exists(dummy_video_path):
            os.remove(dummy_video_path)

def test_ingest_real_video_metadata():
    # 1. Create a dummy MP4 video using OpenCV
    import cv2
    import numpy as np
    dummy_video_path = "test_metadata_extract.mp4"
    
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    # 50 frames at 25 fps = 2.0 seconds duration, 640x360 resolution
    out = cv2.VideoWriter(dummy_video_path, fourcc, 25.0, (640, 360))
    for _ in range(50):
        img = np.zeros((360, 640, 3), dtype=np.uint8)
        out.write(img)
    out.release()

    db = TestingSessionLocal()
    try:
        # Create Case
        case = models.Case(case_number="CASE-META-001", title="Metadata Test", investigator="Tester")
        db.add(case)
        db.commit()

        # Ingest Evidence via API
        with open(dummy_video_path, "rb") as f:
            response = client.post(
                "/api/v1/evidence/upload",
                data={"case_id": case.id},
                files={"file": (dummy_video_path, f, "video/mp4")}
            )
        assert response.status_code == 202
        
        # Verify evidence metadata
        evidence = db.query(models.Evidence).filter(models.Evidence.case_id == case.id).first()
        assert evidence is not None
        assert evidence.name == dummy_video_path

        # Verify that Video record was created with extracted metadata
        camera = db.query(models.Camera).filter(models.Camera.evidence_id == evidence.id).first()
        assert camera is not None
        
        video = db.query(models.Video).filter(models.Video.camera_id == camera.id).first()
        assert video is not None
        
        # Assert extracted properties match our written dummy (duration=2.0s, fps=25.0, res=640x360)
        assert video.duration_seconds == 2.0
        assert video.fps == 25.0
        assert video.resolution == "640x360"
        
        # Make sure it didn't use the legacy 60s hardcoded duration
        assert video.duration_seconds != 60.0

    finally:
        db.close()
        if os.path.exists(dummy_video_path):
            os.remove(dummy_video_path)

def test_case_detail_endpoint():
    db = TestingSessionLocal()
    case = models.Case(case_number="CASE-DETAIL-999", title="Detail Test Case", investigator="Agent Mulder")
    db.add(case)
    db.commit()
    case_id = case.id
    db.close()

    response = client.get(f"/api/v1/cases/{case_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["case_number"] == "CASE-DETAIL-999"
    assert data["title"] == "Detail Test Case"
    assert data["investigator"] == "Agent Mulder"

def test_evidence_hashing_correctness():
    # 1. Create a dummy file with specific content
    import hashlib
    test_filepath = os.path.join(settings.UPLOAD_DIR, "hash_test_file.txt")
    data_content = b"Forensic audit block data 12345!@#$%"
    with open(test_filepath, "wb") as f:
        f.write(data_content)
    
    expected_md5 = hashlib.md5(data_content).hexdigest()
    expected_sha256 = hashlib.sha256(data_content).hexdigest()

    db = TestingSessionLocal()
    try:
        case = models.Case(case_number="CASE-HASH-001", title="Hash Verif Case", investigator="Tester")
        db.add(case)
        db.commit()

        # Ingest Evidence via API
        with open(test_filepath, "rb") as f:
            response = client.post(
                "/api/v1/evidence/upload",
                data={"case_id": case.id},
                files={"file": ("hash_test_file.txt", f, "application/octet-stream")}
            )
        assert response.status_code == 202
        res_data = response.json()
        assert res_data["md5"] == expected_md5
        assert res_data["sha256"] == expected_sha256
    finally:
        db.close()
        if os.path.exists(test_filepath):
            os.remove(test_filepath)

def test_timeline_and_events_filtering():
    db = TestingSessionLocal()
    try:
        case = models.Case(case_number="CASE-TIME-XYZ", title="Time Filter Case", investigator="Special Agent")
        db.add(case)
        db.commit()

        ec = models.Evidence(case_id=case.id, name="time.mp4", file_path="time.mp4", file_size=100, md5="7", sha256="7", vendor_detected="Hikvision")
        db.add(ec)
        db.commit()

        c1 = models.Camera(evidence_id=ec.id, channel_number=1, name="Camera Lobby")
        c2 = models.Camera(evidence_id=ec.id, channel_number=2, name="Camera Exit")
        db.add(c1)
        db.add(c2)
        db.commit()

        base_time = datetime(2026, 8, 20, 10, 0, 0, tzinfo=timezone.utc)
        
        v1 = models.Video(camera_id=c1.id, file_path="v1.mp4", duration_seconds=60.0, start_time=base_time, end_time=base_time + timedelta(seconds=60), fps=25.0, resolution="640x480", codec="H264")
        v2 = models.Video(camera_id=c2.id, file_path="v2.mp4", duration_seconds=60.0, start_time=base_time + timedelta(hours=1), end_time=base_time + timedelta(hours=1, minutes=1), fps=25.0, resolution="640x480", codec="H264")
        db.add(v1)
        db.add(v2)
        db.commit()

        # Add mock detections
        det1 = models.AIDetection(video_id=v1.id, camera_id=c1.id, timestamp=base_time + timedelta(seconds=10), frame_number=250, label="person", confidence=0.85, bounding_box='{"x_min": 0.1, "y_min": 0.2, "x_max": 0.3, "y_max": 0.4}', inference_source="REAL_MODEL", model_name="YOLOv8n")
        det2 = models.AIDetection(video_id=v2.id, camera_id=c2.id, timestamp=base_time + timedelta(hours=1, seconds=15), frame_number=375, label="car", confidence=0.90, bounding_box='{"x_min": 0.4, "y_min": 0.5, "x_max": 0.6, "y_max": 0.7}', inference_source="REAL_MODEL", model_name="YOLOv8n")
        db.add(det1)
        db.add(det2)
        db.commit()

        # 1. Timeline generation check
        response = client.get(f"/api/v1/timeline/{case.id}")
        assert response.status_code == 200
        events = response.json()
        assert len(events) >= 4

        # 2. Filtering by event_type
        response = client.get(f"/api/v1/timeline/{case.id}?event_type=AI_DETECTION")
        assert response.status_code == 200
        ai_events = response.json()
        assert all(ev["event_type"] == "AI_DETECTION" for ev in ai_events)
        assert len(ai_events) == 2

        # 3. Filtering by camera_id
        response = client.get(f"/api/v1/timeline/{case.id}?camera_id={c1.id}")
        assert response.status_code == 200
        cam1_events = response.json()
        assert all(ev["source"] == "Camera Lobby" for ev in cam1_events)

        # 4. Filtering by time range (start/end)
        import urllib.parse
        start_filter = urllib.parse.quote((base_time - timedelta(minutes=5)).isoformat())
        end_filter = urllib.parse.quote((base_time + timedelta(minutes=5)).isoformat())
        response = client.get(f"/api/v1/timeline/{case.id}?start_dt={start_filter}&end_dt={end_filter}")
        assert response.status_code == 200
        time_filtered = response.json()
        # Since v2 is 1 hour later, we should only see v1 boundaries and det1
        assert all(v1.id in ev["description"] or ev["context_id"] == v1.id for ev in time_filtered)

    finally:
        db.close()

def test_chain_of_custody_and_report_ai_findings():
    db = TestingSessionLocal()
    try:
        case = models.Case(case_number="CASE-AUD-007", title="Auditing Case", investigator="James Bond")
        db.add(case)
        db.commit()

        ev = models.Evidence(case_id=case.id, name="audi.img", file_path="audi.img", file_size=200, md5="8", sha256="8", vendor_detected="Hikvision")
        db.add(ev)
        db.commit()

        cam = models.Camera(evidence_id=ev.id, channel_number=1, name="Entrance Camera")
        db.add(cam)
        db.commit()

        vid = models.Video(camera_id=cam.id, file_path="audi.mp4", duration_seconds=30.0, start_time=datetime(2026, 8, 23, 14, 0, 0, tzinfo=timezone.utc), end_time=datetime(2026, 8, 23, 14, 0, 30, tzinfo=timezone.utc), fps=25.0, resolution="640x480", codec="H264")
        db.add(vid)
        db.commit()

        # Add AI detection
        det = models.AIDetection(video_id=vid.id, camera_id=cam.id, timestamp=datetime(2026, 8, 23, 14, 0, 5, tzinfo=timezone.utc), frame_number=125, label="person", confidence=0.98, bounding_box='{"x_min": 0.1, "y_min": 0.1, "x_max": 0.2, "y_max": 0.2}', inference_source="REAL_MODEL", model_name="YOLOv8n")
        db.add(det)

        # Log CoC entry manually
        coc1 = models.ChainOfCustody(case_id=case.id, evidence_id=ev.id, operator="James Bond", action="AI_ANALYSIS_START", description="AI Audit test started.")
        coc2 = models.ChainOfCustody(case_id=case.id, evidence_id=ev.id, operator="James Bond", action="AI_ANALYSIS_COMPLETE", description="AI Audit test finished.")
        db.add(coc1)
        db.add(coc2)
        db.commit()

        # 1. Fetch Chain-of-custody API
        response = client.get(f"/api/v1/chain-of-custody/{ev.id}")
        assert response.status_code == 200
        coc_logs = response.json()
        assert len(coc_logs) == 2
        assert coc_logs[0]["action"] == "AI_ANALYSIS_START"
        assert coc_logs[1]["action"] == "AI_ANALYSIS_COMPLETE"

        # 2. Generate Report via API
        r_payload = {"title": "Full Audit Dossier", "generated_by": "James Bond"}
        report_res = client.post(f"/api/v1/reports/{case.id}", json=r_payload)
        assert report_res.status_code == 201
        report_data = report_res.json()
        assert "content_markdown" in report_data
        
        md_content = report_data["content_markdown"]
        # Confirm report contains AI findings (e.g. "person" and confidence "98%")
        assert "person" in md_content
        assert "James Bond" in md_content

    finally:
        db.close()


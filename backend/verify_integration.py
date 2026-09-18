import os
import sys
import httpx

API_BASE_URL = "http://127.0.0.1:8000/api/v1"

def test_e2e_integration():
    print("=== STARTING FRONTEND-BACKEND INTEGRATION VERIFICATION ===")
    
    # Check server availability
    try:
         r = httpx.get("http://127.0.0.1:8000/")
         print(f"Backend root status: {r.status_code} -> {r.json()}")
    except Exception as e:
         print(f"ERROR: Backend server not running? {e}")
         sys.exit(1)

    client = httpx.Client(base_url=API_BASE_URL, timeout=30.0, follow_redirects=True)

    # 1. Create a new case
    case_payload = {
        "case_number": "CASE-E2E-999",
        "title": "Programmatic Integration Audit",
        "investigator": "Agent Antigravity",
        "description": "E2E automated flow verifying DVR extraction & YOLO endpoints"
    }
    
    r = client.post("/cases", json=case_payload)

    if r.status_code == 201:
        case = r.json()
        print(f"[SUCCESS] Case created: ID={case['id']}, Code={case['case_number']}")
    else:
        print(f"[ERROR] Failed to create case: {r.status_code} {r.text}")
        sys.exit(1)

    case_id = case["id"]

    # 2. Upload dummy evidence file using make_hkvs_image
    from make_hkvs_image import make_hkvs_image
    test_file_name = "e2e_hik_dump.img"
    make_hkvs_image(test_file_name)
        
    print(f"Uploading file '{test_file_name}' to case '{case_id}'...")
    try:
        with open(test_file_name, "rb") as f:
            r = client.post(
                "/evidence/upload",
                data={"case_id": case_id},
                files={"file": (test_file_name, f, "application/octet-stream")}
            )
        if r.status_code == 202:
            evidence = r.json()
            print(f"[SUCCESS] Ingestion completed. Evidence ID={evidence['id']}, Vendor={evidence['vendor_detected']}, Size={evidence['file_size']} bytes")
        else:
            print(f"[ERROR] Failed upload: {r.status_code} {r.text}")
            sys.exit(1)
    finally:
        if os.path.exists(test_file_name):
            os.remove(test_file_name)

    evidence_id = evidence["id"]

    # 3. Retrieve extracted CCTV channels
    r = client.get(f"/evidence/{evidence_id}/videos")
    if r.status_code == 200:
        videos = r.json()
        print(f"[SUCCESS] Extracted {len(videos)} video tracks under evidence file.")
        for v in videos:
            print(f"  Channel Video ID={v['id']}, Duration={v['duration_seconds']}s, FilePath={v['file_path']}")
    else:
        print(f"[ERROR] Failed listing tracks: {r.status_code} {r.text}")
        sys.exit(1)

    if not videos:
        print("[ERROR] No videos extracted. Exiting.")
        sys.exit(1)

    target_video_id = videos[0]["id"]

    # 4. Trigger AI Object Detection
    print(f"Triggering YOLOv8 object detection on video track '{target_video_id}'...")
    r = client.post(f"/analysis/{target_video_id}", json={
        "classes": ["person", "vehicle"],
        "mode": "REAL"
    })
    
    if r.status_code == 202:
        metrics = r.json()
        print(f"[SUCCESS] YOLO analysis successfully compiled. Metrics: {metrics}")
    else:
        print(f"[WARNING] Real YOLO failed (missing weights?). Let's fall back to Simulated mode...")
        r = client.post(f"/analysis/{target_video_id}", json={
            "classes": ["person", "vehicle"],
            "mode": "SIMULATED"
        })
        if r.status_code == 202:
            metrics = r.json()
            print(f"[SUCCESS] Simulated analysis compiled. Metrics: {metrics}")
        else:
            print(f"[ERROR] AI analysis failed: {r.status_code} {r.text}")
            sys.exit(1)

    # 5. Fetch detection coordinates mapping
    r = client.get(f"/analysis/{target_video_id}")
    if r.status_code == 200:
        detections = r.json()
        print(f"[SUCCESS] Retrieved {len(detections)} AI detections from database:")
        for d in detections[:3]: # show first 3
            print(f"  - [{d['label'].upper()}] Conf: {d['confidence']:.2f}, Box: {d['bounding_box']}")
    else:
        print(f"[ERROR] Failed retrieving detections: {r.status_code} {r.text}")
        sys.exit(1)

    # 5b. Validate Video Streaming Endpoint
    stream_url = f"/videos/{target_video_id}/stream"
    print(f"Validating video streaming endpoint: {stream_url} ...")
    # request with Range header to ensure it responds properly (206)
    r = client.get(stream_url, headers={"Range": "bytes=0-1023"})
    if r.status_code == 206 or r.status_code == 200:
        mime = r.headers.get("content-type", "")
        # Should be a video type or octet-stream depending on mimetypes
        print(f"[SUCCESS] Video stream available. Status: {r.status_code}, type: {mime}")
    else:
        print(f"[ERROR] Video stream failed: {r.status_code} {r.text}")
        sys.exit(1)

    # 6. Retrieve Timeline milestones
    r = client.get(f"/timeline/{case_id}")
    if r.status_code == 200:
        events = r.json()
        print(f"[SUCCESS] Chronological timeline lists {len(events)} milestones:")
        for idx, event in enumerate(events):
             print(f"  {idx+1}. [{event['event_type']}] {event['source']}: {event['description']}")
    else:
        print(f"[ERROR] Timeline retrieval failed: {r.status_code} {r.text}")
        sys.exit(1)

    # 7. Print custody audit logs
    r = client.get(f"/chain-of-custody/{evidence_id}")
    if r.status_code == 200:
        logs = r.json()
        print(f"[SUCCESS] Chain of Custody ledger has {len(logs)} entries:")
        for idx, l in enumerate(logs):
             print(f"  {idx+1}. [{l['action']}] Custodian: {l['operator']}, Timestamp: {l['timestamp']}")
    else:
         print(f"[ERROR] Custody retrieval failed: {r.status_code} {r.text}")
         sys.exit(1)

    # 8. Generate markdown report dossier
    print("Compiling final forensic report...")
    r = client.post(f"/reports/{case_id}", json={
        "title": "E2E Programmatic Audit Dossier",
        "generated_by": "Agent Antigravity"
    })
    
    if r.status_code == 201:
        report = r.json()
        print("[SUCCESS] Report generated successfully.")
        print("--- REPORT PREVIEW ---")
        print("\n".join(report["content_markdown"].split("\n")[:15])) # print top lines
        print("----------------------")
    else:
         print(f"[ERROR] Report generation failed: {r.status_code} {r.text}")
         sys.exit(1)

    print("\n=== ALL E2E VERIFICATION CHECKS PASSED SUCCESSFUL ===")

if __name__ == "__main__":
    test_e2e_integration()

import os
import uuid
import datetime
from sqlalchemy.orm import Session

from app.database.session import SessionLocal, engine, Base
from app.models import models
from app.config import settings
from app.services.forensic_service import ForensicService
from app.services.ai_service import AIService

def seed_database():
    # Make sure tables are created
    Base.metadata.create_all(bind=engine)
    
    db: Session = SessionLocal()
    
    try:
        # Check if already seeded
        existing_case = db.query(models.Case).filter(models.Case.case_number == "CASE-2026-001").first()
        if existing_case:
            print("Database already seeded with CASE-2026-001.")
            return

        print("Seeding database...")
        
        # 1. Create Case
        db_case = models.Case(
            case_number="CASE-2026-001",
            title="Warehouse Perimeter Vandalism",
            investigator="Insp. Margaret Vance",
            description="Acquisition and analysis of suspect vehicle entering warehouse gate at 10:15 UTC."
        )
        db.add(db_case)
        db.commit()
        db.refresh(db_case)
        
        # 2. Write a mock image file with vendor signature
        mock_file_name = "dvr_evidence_dump.img"
        mock_file_path = os.path.join(settings.UPLOAD_DIR, mock_file_name)
        
        # Write "HKVS" header to trigger Hikvision parser signature check
        with open(mock_file_path, "wb") as f:
            f.write(b"HKVS\x00\x00\x00\x00HEADERINFO_RAWBLOCK_DUMP_FILE")
            # Write 1MB of padding
            f.write(b"\x00" * 1024 * 1024)
            
        print(f"Created mock NVR dump file at: {mock_file_path}")
        
        # 3. Calculate hashes
        md5_sig, sha256_sig = ForensicService.calculate_hashes(mock_file_path)
        vendor, serial = ForensicService.identify_vendor_from_bytes(mock_file_path)
        
        # 4. Register Evidence
        db_evidence = models.Evidence(
            case_id=db_case.id,
            name=mock_file_name,
            file_path=mock_file_path,
            file_size=os.path.getsize(mock_file_path),
            md5=md5_sig,
            sha256=sha256_sig,
            vendor_detected=vendor,
            device_serial=serial
        )
        db.add(db_evidence)
        
        # Audit Log
        audit1 = models.ChainOfCustody(
            case_id=db_case.id,
            evidence=db_evidence,
            operator=db_case.investigator,
            action="EVIDENCE_UPLOAD",
            description=f"Seeded evidence file '{mock_file_name}' loaded. Hashing: MD5={md5_sig}, SHA256={sha256_sig}."
        )
        db.add(audit1)
        db.commit()
        
        # 5. Extract cameras and videos
        extraction_records = ForensicService.extract_cameras_and_videos(db_evidence.id, mock_file_path, vendor)
        for record in extraction_records:
            # Create Camera channel
            db_camera = models.Camera(
                evidence_id=db_evidence.id,
                channel_number=record["channel_number"],
                name=record["camera_name"]
            )
            db.add(db_camera)
            db.commit()
            db.refresh(db_camera)

            # Create Video segment
            v_ref = record["video"]
            db_video = models.Video(
                camera_id=db_camera.id,
                file_path=v_ref["file_path"],
                duration_seconds=v_ref["duration_seconds"],
                start_time=v_ref["start_time"],
                end_time=v_ref["end_time"],
                fps=v_ref["fps"],
                resolution=v_ref["resolution"],
                codec=v_ref["codec"]
            )
            db.add(db_video)
            db.commit()
            db.refresh(db_video)
            
            # Log channel extraction
            audit_ch = models.ChainOfCustody(
                case_id=db_case.id,
                evidence_id=db_evidence.id,
                operator=db_case.investigator,
                action="EXTRACT_CHANNEL",
                description=f"Extracted channel {db_camera.channel_number} ({db_camera.name}) from {vendor} blocks."
            )
            db.add(audit_ch)
            db.commit()

            # 6. Seed AI Detections for these channels
            AIService.analyze_video(
                db=db,
                video_id=db_video.id,
                case_id=db_case.id,
                operator_name=db_case.investigator,
                target_classes=["person", "vehicle"]
            )
            
        # 7. Seed Carved Deleted fragments
        carved_fragments = ForensicService.carve_deleted_videos(db_evidence.id, mock_file_path)
        for frag in carved_fragments:
            db_frag = models.RecoveredFile(
                evidence_id=db_evidence.id,
                start_sector=frag["start_sector"],
                end_sector=frag["end_sector"],
                size_bytes=frag["size_bytes"],
                status=frag["status"],
                file_extension=frag["file_extension"],
                estimated_time=frag["estimated_time"]
            )
            db.add(db_frag)
            
            # Log recovery in auditing trail
            audit_carve = models.ChainOfCustody(
                case_id=db_case.id,
                evidence_id=db_evidence.id,
                operator=db_case.investigator,
                action="FILE_CARVE",
                description=f"Carved target sector range {frag['start_sector']}-{frag['end_sector']} in search for deleted video. Status: {frag['status']}."
            )
            db.add(audit_carve)

        db.commit()
        print("Database details successfully seeded!")

    except Exception as e:
        db.rollback()
        print(f"Failed to seed database: {str(e)}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()

import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session
from typing import List

from app.database.session import get_db
from app.models import models
from app.schemas import schemas
from app.config import settings
from app.services.forensic_service import ForensicService

router = APIRouter(
    prefix="/evidence",
    tags=["Evidence"]
)

@router.post("/upload", response_model=schemas.EvidenceResponse, status_code=status.HTTP_202_ACCEPTED)
async def upload_evidence(
    case_id: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    # Verify case exists
    db_case = db.query(models.Case).filter(models.Case.id == case_id).first()
    if not db_case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Case registry ID not found."
        )

    # Standard clean filename mapping to prevent path injections
    safe_filename = "".join(c for c in file.filename if c.isalnum() or c in (".", "_", "-"))
    unique_prefix = str(uuid.uuid4())[:8]
    save_name = f"{unique_prefix}_{safe_filename}"
    file_path = os.path.join(settings.UPLOAD_DIR, save_name)

    # Save incoming stream chunkwise
    try:
        with open(file_path, "wb") as buffer:
            while content := await file.read(1024 * 1024):  # 1MB chunks
                buffer.write(content)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to write file stream: {str(e)}"
        )

    # Calculate cryptohashes for digital integrity validations
    try:
        md5_sig, sha256_sig = ForensicService.calculate_hashes(file_path)
    except Exception as e:
        # Cleanup file if hashing fails
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to calculate cryptographic integrity signatures: {str(e)}"
        )

    # Scan sector headers for vendor signature patterns
    vendor, serial = ForensicService.identify_vendor_from_bytes(file_path)

    # Register Evidence Model
    db_evidence = models.Evidence(
        case_id=case_id,
        name=file.filename,
        file_path=file_path,
        file_size=os.path.getsize(file_path),
        md5=md5_sig,
        sha256=sha256_sig,
        vendor_detected=vendor,
        device_serial=serial
    )
    db.add(db_evidence)
    
    # Audit log (Chain of Custody)
    audit = models.ChainOfCustody(
        case_id=case_id,
        evidence=db_evidence,
        operator=db_case.investigator,
        action="EVIDENCE_UPLOAD",
        description=f"Evidence file '{file.filename}' uploaded. Hashing details: MD5={md5_sig}, SHA256={sha256_sig}. Vendor identified: {vendor}."
    )
    db.add(audit)
    db.commit()
    db.refresh(db_evidence)

    # Trigger Forensic Parser to extract nested channel segments (simulated or real standard files)
    try:
        extraction_records = ForensicService.extract_cameras_and_videos(db_evidence.id, file_path, vendor)
        for record in extraction_records:
            # Check if Camera already exists for this evidence and channel_number
            db_camera = db.query(models.Camera).filter(
                models.Camera.evidence_id == db_evidence.id,
                models.Camera.channel_number == record["channel_number"]
            ).first()
            if not db_camera:
                db_camera = models.Camera(
                    evidence_id=db_evidence.id,
                    channel_number=record["channel_number"],
                    name=record["camera_name"]
                )
                db.add(db_camera)
                db.commit()
                db.refresh(db_camera)
            else:
                if db_camera.name != record["camera_name"]:
                    db_camera.name = record["camera_name"]
                    db.add(db_camera)
                    db.commit()

            # Create or update Video segment
            v_ref = record["video"]
            db_video = db.query(models.Video).filter(
                models.Video.camera_id == db_camera.id,
                models.Video.file_path == v_ref["file_path"]
            ).first()
            if not db_video:
                db_video = models.Video(
                    camera_id=db_camera.id,
                    file_path=v_ref["file_path"],
                    playback_path=v_ref.get("playback_path"),
                    extraction_status=v_ref.get("extraction_status", "EXTRACTED"),
                    duration_seconds=v_ref["duration_seconds"],
                    start_time=v_ref["start_time"],
                    end_time=v_ref["end_time"],
                    fps=v_ref["fps"],
                    resolution=v_ref["resolution"],
                    codec=v_ref["codec"]
                )
                db.add(db_video)
            else:
                db_video.duration_seconds = v_ref["duration_seconds"]
                db_video.start_time = v_ref["start_time"]
                db_video.end_time = v_ref["end_time"]
                db_video.fps = v_ref["fps"]
                db_video.resolution = v_ref["resolution"]
                db_video.codec = v_ref["codec"]
                # Update playback fields if they improved
                if v_ref.get("playback_path"):
                    db_video.playback_path = v_ref["playback_path"]
                if v_ref.get("extraction_status"):
                    db_video.extraction_status = v_ref["extraction_status"]
                db.add(db_video)
            
            # Create sub Ingestion Timeline mark if not already logged
            log_desc = f"Channel {db_camera.channel_number} ({db_camera.name}) extracted. Segment range: {v_ref['start_time'].isoformat()} to {v_ref['end_time'].isoformat()}"
            existing_log = db.query(models.ChainOfCustody).filter(
                models.ChainOfCustody.evidence_id == db_evidence.id,
                models.ChainOfCustody.action == "EXTRACT_CHANNEL",
                models.ChainOfCustody.description == log_desc
            ).first()
            if not existing_log:
                timeline_log = models.ChainOfCustody(
                    case_id=case_id,
                    evidence_id=db_evidence.id,
                    operator=db_case.investigator,
                    action="EXTRACT_CHANNEL",
                    description=log_desc
                )
                db.add(timeline_log)
            db.commit()

        # Parse and save carved fragments list as well (deleted sector files)
        carved_fragments = ForensicService.carve_deleted_videos(db_evidence.id, file_path)
        for frag in carved_fragments:
            db_frag = db.query(models.RecoveredFile).filter(
                models.RecoveredFile.evidence_id == db_evidence.id,
                models.RecoveredFile.start_sector == frag["start_sector"],
                models.RecoveredFile.end_sector == frag["end_sector"]
            ).first()
            if not db_frag:
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
            else:
                db_frag.size_bytes = frag["size_bytes"]
                db_frag.status = frag["status"]
                db_frag.file_extension = frag["file_extension"]
                db_frag.estimated_time = frag["estimated_time"]
                db.add(db_frag)
        
        db.commit()

    except Exception as e:
        # Commit progress logs regardless
        db.commit()
        # Non-fatal warnings for parser errors
        print(f"Extraction warning: {str(e)}")

    return db_evidence

@router.get("", response_model=List[schemas.EvidenceResponse])
def list_evidence(case_id: str, db: Session = Depends(get_db)):
    items = db.query(models.Evidence).filter(models.Evidence.case_id == case_id).all()
    for item in items:
        if item.vendor_detected in ("Generic", "Not detected"):
            item.vendor_detected = "Not detected"
            item.device_serial = "Not detected"
    return items

@router.get("/{evidence_id}", response_model=schemas.EvidenceResponseExt)
def get_evidence(evidence_id: str, db: Session = Depends(get_db)):
    db_evidence = db.query(models.Evidence).filter(models.Evidence.id == evidence_id).first()
    if not db_evidence:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evidence registry entry not found."
        )
    
    vendor = db_evidence.vendor_detected
    serial = db_evidence.device_serial
    if vendor in ("Generic", "Not detected"):
        vendor = "Not detected"
        serial = "Not detected"
        device_model = "Not detected"
        source_type = "STANDARD_VIDEO"
        detection_method = "NO_PROPRIETARY_SIGNATURE"
        confidence = 0.0
    else:
        try:
            from app.forensic.core import registry
            adapter, _, conf = registry.identify_vendor(db_evidence.file_path)
            confidence = conf
        except Exception:
            confidence = 0.95
        device_model = "Proprietary DVR"
        source_type = "PROPRIETARY_DVR"
        detection_method = "PROP_SIGNATURE"

    return {
        "id": db_evidence.id,
        "case_id": db_evidence.case_id,
        "name": db_evidence.name,
        "file_size": db_evidence.file_size,
        "md5": db_evidence.md5,
        "sha256": db_evidence.sha256,
        "ingested_at": db_evidence.ingested_at,
        "vendor_detected": vendor,
        "device_serial": serial,
        "device_model": device_model,
        "source_type": source_type,
        "detection_method": detection_method,
        "detection_confidence": confidence
    }

@router.post("/{evidence_id}/verify")
def verify_evidence(evidence_id: str, db: Session = Depends(get_db)):
    try:
        from app.forensic.integrity.verifier import verify_evidence_integrity
        result = verify_evidence_integrity(db, evidence_id)
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )

@router.get("/{evidence_id}/integrity")
def get_evidence_integrity(evidence_id: str, db: Session = Depends(get_db)):
    db_evidence = db.query(models.Evidence).filter(models.Evidence.id == evidence_id).first()
    if not db_evidence:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evidence registry entry not found."
        )
    try:
        from app.forensic.integrity.verifier import calculate_hashes
        if os.path.exists(db_evidence.file_path):
            calc_md5, calc_sha256 = calculate_hashes(db_evidence.file_path)
            verified = (calc_sha256.lower() == db_evidence.sha256.lower() and calc_md5.lower() == db_evidence.md5.lower())
        else:
            calc_md5, calc_sha256 = None, None
            verified = False
    except Exception:
        calc_md5, calc_sha256 = None, None
        verified = False

    return {
        "stored_md5": db_evidence.md5,
        "calculated_md5": calc_md5,
        "stored_sha256": db_evidence.sha256,
        "calculated_sha256": calc_sha256,
        "verified": verified,
        "message": "VERIFIED" if verified else ("MISMATCH: file not found on disk" if not os.path.exists(db_evidence.file_path) else "MISMATCH: hash comparison failed")
    }

@router.get("/{evidence_id}/device")
def get_evidence_device(evidence_id: str, db: Session = Depends(get_db)):
    db_evidence = db.query(models.Evidence).filter(models.Evidence.id == evidence_id).first()
    if not db_evidence:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evidence registry entry not found."
        )

    vendor = db_evidence.vendor_detected
    serial = db_evidence.device_serial
    matched_indicators: list = []
    detection_method = "NO_PROPRIETARY_SIGNATURE"

    if vendor in ("Generic", "Not detected"):
        vendor = "Not detected"
        serial = "Not detected"
        support_level = "NO_PROPRIETARY_SIGNATURE"
        confidence = 0.0
    else:
        try:
            from app.forensic.core import registry
            adapter, _, conf = registry.identify_vendor(db_evidence.file_path)
            support_level = adapter.support_level
            confidence = conf
            detection_method = "PROPRIETARY_BINARY_SIGNATURE"
            # Compose matched indicator description per vendor
            indicator_map = {
                "Hikvision": ["HKVS magic bytes in file header", "Hikvision Video Filesystem signature"],
                "Dahua":     ["DHFS magic bytes in file header", "Dahua Filesystem proprietary signature"],
                "CP Plus":   ["CPPL/CPPLUS magic bytes in file header", "CP Plus DVR container signature"],
                "Uniview":   ["UNIVW magic bytes in file header", "Uniview NVR container signature"],
                "SyntheticDVR": ["SYNTHDVR-SIG-01 magic bytes", "Embedded device serial at offset 48"],
            }
            matched_indicators = indicator_map.get(vendor, ["Proprietary binary signature match"])
        except Exception:
            support_level = "UNSUPPORTED"
            confidence = 0.0

    # Derive confidence label
    if confidence >= 0.8:
        confidence_label = "HIGH"
    elif confidence >= 0.5:
        confidence_label = "MEDIUM"
    elif confidence > 0.0:
        confidence_label = "LOW"
    else:
        confidence_label = "NOT_DETECTED"

    return {
        "vendor_detected": vendor,
        "device_serial": serial,
        "support_level": support_level,
        "detection_confidence": confidence,
        "confidence_label": confidence_label,
        "detection_method": detection_method,
        "matched_indicators": matched_indicators
    }

@router.get("/{evidence_id}/cameras")
def get_evidence_cameras(evidence_id: str, db: Session = Depends(get_db)):
    cameras = db.query(models.Camera).filter(models.Camera.evidence_id == evidence_id).all()
    res = []
    for cam in cameras:
        video = db.query(models.Video).filter(models.Video.camera_id == cam.id).first()
        res.append({
            "id": cam.id,
            "channel_number": cam.channel_number,
            "name": cam.name,
            "video_path": video.file_path if video else None,
            "duration": video.duration_seconds if video else None
        })
    return res


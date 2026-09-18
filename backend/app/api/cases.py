from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database.session import get_db
from app.models import models
from app.schemas import schemas

router = APIRouter(
    prefix="/cases",
    tags=["Cases"]
)

@router.post("", response_model=schemas.CaseResponse, status_code=status.HTTP_201_CREATED)
def create_case(case_data: schemas.CaseCreate, db: Session = Depends(get_db)):
    # Check if case number already exists
    existing_case = db.query(models.Case).filter(models.Case.case_number == case_data.case_number).first()
    if existing_case:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Case number '{case_data.case_number}' is already registered."
        )
        
    db_case = models.Case(
        case_number=case_data.case_number,
        title=case_data.title,
        investigator=case_data.investigator,
        description=case_data.description
    )
    db.add(db_case)
    db.commit()
    db.refresh(db_case)
    
    # Audit log
    audit = models.ChainOfCustody(
        case_id=db_case.id,
        operator=db_case.investigator,
        action="CASE_CREATE",
        description=f"Case '{db_case.case_number}' created/registered by {db_case.investigator}."
    )
    db.add(audit)
    db.commit()
    
    return db_case

@router.get("", response_model=List[schemas.CaseResponse])
def list_cases(db: Session = Depends(get_db)):
    return db.query(models.Case).all()

@router.get("/{case_id}", response_model=schemas.CaseResponse)
def get_case(case_id: str, db: Session = Depends(get_db)):
    db_case = db.query(models.Case).filter(models.Case.id == case_id).first()
    if not db_case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Case not found."
        )
    return db_case

@router.get("/{case_id}/summary")
def get_case_summary(case_id: str, db: Session = Depends(get_db)):
    db_case = db.query(models.Case).filter(models.Case.id == case_id).first()
    if not db_case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Case not found."
        )

    evidence_list = db.query(models.Evidence).filter(models.Evidence.case_id == case_id).all()
    evidence_ids = [e.id for e in evidence_list]

    evidence_count = len(evidence_list)
    camera_count = db.query(models.Camera).filter(models.Camera.evidence_id.in_(evidence_ids)).count() if evidence_ids else 0

    camera_ids = [c.id for c in db.query(models.Camera).filter(models.Camera.evidence_id.in_(evidence_ids)).all()] if evidence_ids else []
    video_count = db.query(models.Video).filter(models.Video.camera_id.in_(camera_ids)).count() if camera_ids else 0

    recovered_count = db.query(models.RecoveredFile).filter(models.RecoveredFile.evidence_id.in_(evidence_ids)).count() if evidence_ids else 0

    unverified_count = 0
    for ev in evidence_list:
        failure_log = db.query(models.ChainOfCustody).filter(
            models.ChainOfCustody.evidence_id == ev.id,
            models.ChainOfCustody.action == "INTEGRITY_FAILURE"
        ).order_by(models.ChainOfCustody.timestamp.desc()).first()

        success_log = db.query(models.ChainOfCustody).filter(
            models.ChainOfCustody.evidence_id == ev.id,
            models.ChainOfCustody.action == "INTEGRITY_VERIFICATION"
        ).order_by(models.ChainOfCustody.timestamp.desc()).first()

        if failure_log:
            if not success_log or failure_log.timestamp > success_log.timestamp:
                unverified_count += 1
        elif not success_log:
            unverified_count += 1

    return {
        "case_id": case_id,
        "case_number": db_case.case_number,
        "title": db_case.title,
        "investigator": db_case.investigator,
        "evidence_count": evidence_count,
        "camera_count": camera_count,
        "video_count": video_count,
        "recovered_count": recovered_count,
        "unverified_count": unverified_count
    }

@router.get("/{case_id}/stats")
def get_case_stats(case_id: str, db: Session = Depends(get_db)):
    db_case = db.query(models.Case).filter(models.Case.id == case_id).first()
    if not db_case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Case not found."
        )

    evidence_list = db.query(models.Evidence).filter(models.Evidence.case_id == case_id).all()
    evidence_ids = [e.id for e in evidence_list]

    evidence_count = len(evidence_list)
    camera_count = db.query(models.Camera).filter(models.Camera.evidence_id.in_(evidence_ids)).count() if evidence_ids else 0

    camera_ids = [c.id for c in db.query(models.Camera).filter(models.Camera.evidence_id.in_(evidence_ids)).all()] if evidence_ids else []
    video_count = db.query(models.Video).filter(models.Video.camera_id.in_(camera_ids)).count() if camera_ids else 0

    recovered_count = db.query(models.RecoveredFile).filter(models.RecoveredFile.evidence_id.in_(evidence_ids)).count() if evidence_ids else 0

    unverified_count = 0
    for ev in evidence_list:
        failure_log = db.query(models.ChainOfCustody).filter(
            models.ChainOfCustody.evidence_id == ev.id,
            models.ChainOfCustody.action == "INTEGRITY_FAILURE"
        ).order_by(models.ChainOfCustody.timestamp.desc()).first()

        success_log = db.query(models.ChainOfCustody).filter(
            models.ChainOfCustody.evidence_id == ev.id,
            models.ChainOfCustody.action == "INTEGRITY_VERIFICATION"
        ).order_by(models.ChainOfCustody.timestamp.desc()).first()

        if failure_log:
            if not success_log or failure_log.timestamp > success_log.timestamp:
                unverified_count += 1
        elif not success_log:
            unverified_count += 1

    return {
        "case_id": case_id,
        "case_number": db_case.case_number,
        "title": db_case.title,
        "investigator": db_case.investigator,
        "evidence_count": evidence_count,
        "camera_count": camera_count,
        "video_count": video_count,
        "recovered_count": recovered_count,
        "unverified_count": unverified_count,
        "event_count": video_count + evidence_count + recovered_count,
        "evidenceCount": evidence_count,
        "cameraCount": camera_count,
        "videoCount": video_count,
        "recoveredCount": recovered_count,
        "unverifiedCount": unverified_count,
        "eventCount": video_count + evidence_count + recovered_count,
        "integrityStatus": "COMPROMISED" if unverified_count > 0 else "UNCOMPROMISED"
    }


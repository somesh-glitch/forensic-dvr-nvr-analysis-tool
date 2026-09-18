import os
import json
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any

from app.database.session import get_db
from app.models import models
from app.schemas import schemas
from app.services.ai_service import AIService

router = APIRouter(
    prefix="/analysis",
    tags=["AI Video Detection"]
)

@router.post("/{video_id}", status_code=status.HTTP_202_ACCEPTED)
def trigger_video_analysis(
    video_id: str,
    payload: schemas.AIAnalysisTrigger,
    db: Session = Depends(get_db)
):
    """
    Trigger object detection analysis on a specific video.
    Runs analysis (REAL or SIMULATED) synchronously and returns detailed execution metrics.
    """
    video = db.query(models.Video).filter(models.Video.id == video_id).first()
    if not video:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Video record not found."
        )
        
    camera = db.query(models.Camera).filter(models.Camera.id == video.camera_id).first()
    if not camera:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Camera record linked to video not found."
        )

    evidence = db.query(models.Evidence).filter(models.Evidence.id == camera.evidence_id).first()
    if not evidence:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evidence record linked to camera not found."
        )

    case = db.query(models.Case).filter(models.Case.id == evidence.case_id).first()
    if not case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Case record linked to evidence not found."
        )
    
    try:
        result = AIService.analyze_video(
            db=db,
            video_id=video.id,
            case_id=case.id,
            operator_name=case.investigator,
            target_classes=payload.classes,
            mode=payload.mode
        )
        return result
    except Exception as e:
        db.rollback()
        # Log failure transaction to Chain of Custody ledger
        try:
            log_fail = models.ChainOfCustody(
                case_id=case.id,
                evidence_id=evidence.id,
                operator=case.investigator,
                action="AI_ANALYSIS_FAILED",
                description=f"AI Computer Vision analysis ({payload.mode}) failed: {str(e)}"
            )
            db.add(log_fail)
            db.commit()
        except Exception:
            db.rollback()

        # Handle exceptions gracefully
        if isinstance(e, FileNotFoundError):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Video file not found: {str(e)}"
            )
        elif isinstance(e, ValueError):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=str(e)
            )

@router.get("/{video_id}", response_model=List[schemas.AIDetectionResponse])
def get_video_detections(video_id: str, db: Session = Depends(get_db)):
    """
    Get all AI detection labels found in a specific video segment.
    """
    video = db.query(models.Video).filter(models.Video.id == video_id).first()
    if not video:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Video record not found."
        )
        
    detections = db.query(models.AIDetection).filter(models.AIDetection.video_id == video_id).all()
    
    # Format coordinate output from text to Dict
    formatted = []
    for det in detections:
        try:
            bbox_dict = json.loads(det.bounding_box)
        except Exception:
            bbox_dict = {"x_min": 0.0, "y_min": 0.0, "x_max": 0.0, "y_max": 0.0}
            
        formatted.append(
            schemas.AIDetectionResponse(
                id=det.id,
                video_id=det.video_id,
                camera_id=det.camera_id,
                timestamp=det.timestamp,
                frame_number=det.frame_number,
                label=det.label,
                confidence=det.confidence,
                bounding_box=bbox_dict,
                inference_source=det.inference_source,
                model_name=det.model_name
            )
        )
    return formatted

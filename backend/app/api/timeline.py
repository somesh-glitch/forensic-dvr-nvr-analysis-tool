from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Optional

from app.database.session import get_db
from app.schemas import schemas
from app.services.timeline_service import TimelineService

router = APIRouter(
    tags=["Timeline & Event Correlation"]
)

@router.get("/timeline/{case_id}", response_model=List[schemas.TimelineEventResponse])
def get_unified_timeline(
    case_id: str,
    camera_id: Optional[str] = Query(None, description="Filter by Camera ID"),
    event_type: Optional[str] = Query(None, description="Filter by Event Type (INGESTION, AI_DETECTION, AUDIT, RECOVERY)"),
    start_dt: Optional[datetime] = Query(None, description="Start date-time boundary"),
    end_dt: Optional[datetime] = Query(None, description="End date-time boundary"),
    label: Optional[str] = Query(None, description="Filter AI detections by label (e.g. person, vehicle)"),
    db: Session = Depends(get_db)
):
    """
    Get a chronologically sorted unified timeline of all forensic events inside a case.
    """
    # Verify case exists
    from app.models import models
    db_case = db.query(models.Case).filter(models.Case.id == case_id).first()
    if not db_case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Case registry ID not found."
        )

    return TimelineService.get_timeline(
        db=db,
        case_id=case_id,
        camera_id=camera_id,
        event_type=event_type,
        start_dt=start_dt,
        end_dt=end_dt,
        label=label
    )

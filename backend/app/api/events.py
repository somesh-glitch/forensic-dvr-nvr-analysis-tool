from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Optional

from app.database.session import get_db
from app.schemas import schemas
from app.services.timeline_service import TimelineService

router = APIRouter(
    prefix="/events",
    tags=["Events Search"]
)

@router.get("/{case_id}", response_model=List[schemas.TimelineEventResponse])
def get_case_events(
    case_id: str,
    db: Session = Depends(get_db)
):
    """
    Retrieve all events associated with a case.
    """
    return TimelineService.get_timeline(db=db, case_id=case_id)

@router.get("/{case_id}/search", response_model=List[schemas.TimelineEventResponse])
def search_case_events(
    case_id: str,
    camera_id: Optional[str] = Query(None),
    event_type: Optional[str] = Query(None),
    start_dt: Optional[datetime] = Query(None),
    end_dt: Optional[datetime] = Query(None),
    label: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Search case events using targeted filtering coordinates.
    """
    return TimelineService.get_timeline(
        db=db,
        case_id=case_id,
        camera_id=camera_id,
        event_type=event_type,
        start_dt=start_dt,
        end_dt=end_dt,
        label=label
    )

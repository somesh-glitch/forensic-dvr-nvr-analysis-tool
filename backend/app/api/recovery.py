from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database.session import get_db
from app.models import models
from app.schemas import schemas

router = APIRouter(
    tags=["Recovery"]
)

@router.get("/evidence/{evidence_id}/recovery", response_model=List[schemas.RecoveredFileResponse])
def get_recovery_fragments(evidence_id: str, db: Session = Depends(get_db)):
    """
    Retrieve any carved or recovered file fragments located in the unallocated space
    of the analyzed evidence source file.
    """
    evidence_check = db.query(models.Evidence).filter(models.Evidence.id == evidence_id).first()
    if not evidence_check:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evidence file registry not found."
        )
        
    fragments = db.query(models.RecoveredFile).filter(models.RecoveredFile.evidence_id == evidence_id).all()
    return fragments

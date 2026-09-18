from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database.session import get_db
from app.models import models
from app.schemas import schemas

router = APIRouter(
    prefix="/chain-of-custody",
    tags=["Chain of Custody Ledger"]
)

# IMPORTANT: The /case/{case_id} route MUST be declared before /{evidence_id}
# to prevent FastAPI from treating the literal string "case" as an evidence UUID.

@router.get("/case/{case_id}", response_model=List[schemas.ChainOfCustodyResponse])
def get_custody_history_for_case(case_id: str, db: Session = Depends(get_db)):
    """
    Retrieve the complete Chain of Custody ledger for an entire case.
    Includes case-level events (CASE_CREATE, REPORT_GEN) with evidence_id=NULL,
    as well as all per-evidence events (INGEST, VERIFY, AI_ANALYSIS, etc).
    Sorted chronologically ascending.
    """
    # Verify case exists
    case_check = db.query(models.Case).filter(models.Case.id == case_id).first()
    if not case_check:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Case not found."
        )

    logs = (
        db.query(models.ChainOfCustody)
        .filter(models.ChainOfCustody.case_id == case_id)
        .order_by(models.ChainOfCustody.timestamp.asc())
        .all()
    )
    return logs


@router.get("/{evidence_id}", response_model=List[schemas.ChainOfCustodyResponse])
def get_custody_history(evidence_id: str, db: Session = Depends(get_db)):
    """
    Retrieve the complete Chain of Custody ledger audit trail for a specific evidence item.
    """
    evidence_check = db.query(models.Evidence).filter(models.Evidence.id == evidence_id).first()
    if not evidence_check:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evidence file registry not found."
        )
        
    logs = (
        db.query(models.ChainOfCustody)
        .filter(models.ChainOfCustody.evidence_id == evidence_id)
        .order_by(models.ChainOfCustody.timestamp.asc())
        .all()
    )
    return logs

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.database.session import get_db

router = APIRouter(
    prefix="/system",
    tags=["System"]
)

@router.get("/health")
def system_health(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        db_status = "Healthy"
    except Exception as e:
        db_status = f"Unhealthy: {str(e)}"

    try:
        from app.forensic.core.registry import ADAPTERS
        adapter_count = len(ADAPTERS)
        adapters = [a.vendor_name for a in ADAPTERS]
    except Exception as e:
        adapter_count = 0
        adapters = []

    return {
        "status": "Healthy" if "Unhealthy" not in db_status else "Degraded",
        "database": db_status,
        "adapters_loaded": adapter_count,
        "vendors_supported": adapters
    }

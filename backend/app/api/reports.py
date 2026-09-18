import os
import hashlib
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from app.database.session import get_db
from app.models import models
from app.schemas import schemas
from app.config import settings
from app.services.timeline_service import TimelineService

router = APIRouter(
    prefix="/reports",
    tags=["Forensic Reports"]
)

@router.post("/{case_id}", response_model=schemas.ReportResponse, status_code=status.HTTP_201_CREATED)
def generate_forensic_report(
    case_id: str,
    payload: schemas.ReportBase,
    db: Session = Depends(get_db)
):
    """
    Compile a complete, legally structured forensic dossier containing ingestion parameters,
    evidence integrity validations, file recovery carvings, AI findings, and chain-of-custody audit logs.
    """
    # Fetch case details
    case = db.query(models.Case).filter(models.Case.id == case_id).first()
    if not case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Case registry ID not found."
        )

    # Fetch evidence files
    evidence_list = db.query(models.Evidence).filter(models.Evidence.case_id == case_id).all()
    
    # Fetch recovery files
    recovery_files = (
        db.query(models.RecoveredFile)
        .join(models.Evidence)
        .filter(models.Evidence.case_id == case_id)
        .all()
    )

    # Fetch timeline entries (which normalized and aggregated all logs)
    timeline_events = TimelineService.get_timeline(db=db, case_id=case_id)

    # Build PDF report markup (Markdown format)
    report_title = f"{payload.title or 'CCTV Forensic Audit Report'} - {case.case_number}"
    
    content = []
    content.append(f"# {report_title}")
    content.append(f"**Date Generated:** {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')} UTC")
    content.append(f"**Lead Investigator:** {case.investigator}")
    content.append(f"**Report Author:** {payload.generated_by}")
    content.append("\n## 1. Case Information")
    content.append(f"- **Case Identifier:** {case.case_number}")
    content.append(f"- **Title:** {case.title}")
    content.append(f"- **Description:** {case.description or 'No notes provided.'}")

    content.append("\n## 2. Evidence Ingestion Details")
    if not evidence_list:
        content.append("*No evidence files ingested for this case.*")
    else:
        for idx, ev in enumerate(evidence_list):
            content.append(f"### Evidence #{idx+1}: {ev.name}")
            content.append(f"- **Evidence UUID:** `{ev.id}`")
            content.append(f"- **Identified Vendor:** {ev.vendor_detected}")
            content.append(f"- **Device Serial Number:** {ev.device_serial or 'Undetermined'}")
            content.append(f"- **FileSize:** {ev.file_size:,} bytes")
            content.append(f"- **Integrity Hash (MD5):** `{ev.md5}`")
            content.append(f"- **Integrity Hash (SHA-256):** `{ev.sha256}`")
            content.append(f"- **Ingestion Start:** {ev.ingested_at.strftime('%Y-%m-%d %H:%M:%S')} UTC")
            
            # Show cameras extracted under this evidence file
            cameras = db.query(models.Camera).filter(models.Camera.evidence_id == ev.id).all()
            if cameras:
                content.append("  * **Extracted Visual Channels:**")
                for cam in cameras:
                    content.append(f"    * Channel {cam.channel_number}: {cam.name}")
            content.append("")

    content.append("\n## 3. Storage Carver Analysis (Deleted Video Recovery)")
    if not recovery_files:
        content.append("*No deleted video fragments recovered during disk sector scan.*")
    else:
        content.append("| Sector Range | Size (Bytes) | Format | Estimated Timestamp | Status |")
        content.append("|---|---|---|---|---|")
        for frag in recovery_files:
            est_time_str = frag.estimated_time.strftime('%Y-%m-%d %H:%M:%S') if frag.estimated_time else 'Unknown'
            content.append(f"| {frag.start_sector} - {frag.end_sector} | {frag.size_bytes:,} | {frag.file_extension} | {est_time_str} UTC | {frag.status} |")

    content.append("\n## 4. Normalized Temporal Event Timeline")
    if not timeline_events:
        content.append("*No logs or activity markers logged inside the system.*")
    else:
        content.append("| Timestamp (UTC) | Category | Source | Event Description |")
        content.append("|---|---|---|---|")
        for event in timeline_events:
            ts_str = event.timestamp.strftime('%Y-%m-%d %H:%M:%S')
            content.append(f"| {ts_str} | {event.event_type} | {event.source} | {event.description} |")

    content.append("\n## 5. Methodology & Acquisition Notes")
    content.append("> This report contains findings produced by the DVR/NVR Forensic Analysis Tool (prototype).")
    content.append("> ")
    content.append("> **Evidence Integrity Method:** SHA-256 / MD5 hash comparison (acquisition vs. current file state)")
    content.append("> **Write-Blocking Acquisition:** NOT IMPLEMENTED IN THIS PROTOTYPE")
    content.append("> **Digital Signature:** NOT IMPLEMENTED")
    content.append("> **Proprietary Filesystem Parsing:** PARTIAL \u2014 supported only for recognized DVR binary signatures")

    content.append("\n## 6. Limitations")
    content.append("- This prototype does not implement hardware write-blockers or physical acquisition protocols.")
    content.append("- Vendor identification relies on binary signature analysis; standard MP4/AVI files will show Vendor: Not detected.")
    content.append("- AI detections are produced by YOLOv8n running on uploaded video frames; accuracy depends on video quality.")
    content.append("- Deleted file recovery requires proprietary DVR filesystem formats; standard video files yield 0 candidates.")
    content.append("- No cryptographic signing infrastructure is implemented; the report digest is for integrity tracking only.")

    # Build the complete report body first, then compute integrity digest over it
    report_markdown = "\n".join(content)
    digest = hashlib.sha256(report_markdown.encode()).hexdigest()
    report_markdown = report_markdown + f"\n\n---\n**Report Integrity Digest (SHA-256):** `{digest}`"

    # Save report model
    db_report = models.Report(
        case_id=case_id,
        title=report_title,
        generated_by=payload.generated_by,
        content_markdown=report_markdown
    )
    db.add(db_report)
    
    # Audit log (Chain of Custody)
    audit = models.ChainOfCustody(
        case_id=case_id,
        operator=payload.generated_by,
        action="REPORT_GEN",
        description=f"Forensic Report generated for Case '{case.case_number}' by {payload.generated_by}."
    )
    db.add(audit)
    db.commit()
    db.refresh(db_report)

    # Save local markdown file (as a physical artifact export)
    report_file_name = f"Report_{case.case_number}_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.md"
    report_path = os.path.join(settings.REPORT_DIR, report_file_name)
    try:
        with open(report_path, "w", encoding="utf-8") as f:
            f.write(report_markdown)
    except Exception as e:
        print(f"Physical report save failed: {str(e)}")

    return db_report

@router.get("/{case_id}", response_model=schemas.ReportResponse)
def get_reports_by_case(case_id: str, db: Session = Depends(get_db)):
    db_report = db.query(models.Report).filter(models.Report.case_id == case_id).order_by(models.Report.generated_at.desc()).first()
    if not db_report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No reports found for this case."
        )
    return db_report

from fastapi.responses import PlainTextResponse

@router.get("/download/{case_id}")
def download_forensic_report(case_id: str, db: Session = Depends(get_db)):
    db_report = db.query(models.Report).filter(models.Report.case_id == case_id).order_by(models.Report.generated_at.desc()).first()
    if not db_report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No reports found for this case."
        )
    return PlainTextResponse(
        content=db_report.content_markdown,
        headers={"Content-Disposition": f"attachment; filename=Report_{case_id}.md"}
    )


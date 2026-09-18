from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Optional

from app.models import models
from app.schemas import schemas

class TimelineService:
    @staticmethod
    def get_timeline(
        db: Session,
        case_id: str,
        camera_id: Optional[str] = None,
        event_type: Optional[str] = None,
        start_dt: Optional[datetime] = None,
        end_dt: Optional[datetime] = None,
        label: Optional[str] = None
    ) -> List[schemas.TimelineEventResponse]:
        """
        Gathers, normalizes, and chronologizes case events from:
          1. Video segment files (INGESTION)
          2. AI objects label tracks (AI_DETECTION)
          3. Unallocated carving detections (RECOVERY)
          4. Examiner chain logs (AUDIT)
        """
        from datetime import timezone
        if start_dt and start_dt.tzinfo is not None:
            start_dt = start_dt.astimezone(timezone.utc).replace(tzinfo=None)
        if end_dt and end_dt.tzinfo is not None:
            end_dt = end_dt.astimezone(timezone.utc).replace(tzinfo=None)

        timeline_events = []

        # 1. Video Boundary Events
        videos_query = (
            db.query(models.Video)
            .join(models.Camera)
            .join(models.Evidence)
            .filter(models.Evidence.case_id == case_id)
        )
        if camera_id:
            videos_query = videos_query.filter(models.Video.camera_id == camera_id)
        
        videos = videos_query.all()
        
        if not event_type or event_type.upper() == "INGESTION":
            for video in videos:
                camera = video.camera
                
                # Ingestion Start
                if (not start_dt or video.start_time >= start_dt) and (not end_dt or video.start_time <= end_dt):
                    if not label:
                        timeline_events.append(
                            schemas.TimelineEventResponse(
                                id=f"ingest-start-{video.id}",
                                timestamp=video.start_time,
                                event_type="INGESTION",
                                source=camera.name,
                                description=f"Extracted footage segment '{camera.name}' starts.",
                                context_id=video.id
                            )
                        )
                
                # Ingestion End
                if (not start_dt or video.end_time >= start_dt) and (not end_dt or video.end_time <= end_dt):
                    if not label:
                        timeline_events.append(
                            schemas.TimelineEventResponse(
                                id=f"ingest-end-{video.id}",
                                timestamp=video.end_time,
                                event_type="INGESTION",
                                source=camera.name,
                                description=f"Extracted footage segment '{camera.name}' ends.",
                                context_id=video.id
                            )
                        )

        # 2. AI Detections
        ai_query = (
            db.query(models.AIDetection)
            .join(models.Video)
            .join(models.Camera)
            .join(models.Evidence)
            .filter(models.Evidence.case_id == case_id)
        )
        if camera_id:
            ai_query = ai_query.filter(models.Video.camera_id == camera_id)
        if start_dt:
            ai_query = ai_query.filter(models.AIDetection.timestamp >= start_dt)
        if end_dt:
            ai_query = ai_query.filter(models.AIDetection.timestamp <= end_dt)
        if label:
            ai_query = ai_query.filter(models.AIDetection.label == label.lower())

        ai_detections = ai_query.all()
        
        if not event_type or event_type.upper() == "AI_DETECTION":
            for det in ai_detections:
                camera_name = det.video.camera.name
                timeline_events.append(
                    schemas.TimelineEventResponse(
                        id=det.id,
                        timestamp=det.timestamp,
                        event_type="AI_DETECTION",
                        source=camera_name,
                        description=f"AI object match: '{det.label}' detected (confidence {int(det.confidence * 100)}%).",
                        context_id=det.video_id
                    )
                )

        # 3. Recovered sector blocks fragments
        if not label and (not event_type or event_type.upper() == "RECOVERY"):
            recovery_query = (
                db.query(models.RecoveredFile)
                .join(models.Evidence)
                .filter(models.Evidence.case_id == case_id)
            )
            if start_dt:
                recovery_query = recovery_query.filter(models.RecoveredFile.estimated_time >= start_dt)
            if end_dt:
                recovery_query = recovery_query.filter(models.RecoveredFile.estimated_time <= end_dt)
                
            fragments = recovery_query.all()
            for frag in fragments:
                evidence_name = frag.evidence.name
                if camera_id:
                    continue
                    
                est_time = frag.estimated_time or frag.evidence.ingested_at
                timeline_events.append(
                    schemas.TimelineEventResponse(
                        id=frag.id,
                        timestamp=est_time,
                        event_type="RECOVERY",
                        source=evidence_name,
                        description=f"Deleted block sector carved status '{frag.status}'. Size: {frag.size_bytes} bytes. Ext: {frag.file_extension} (Sectors: {frag.start_sector}-{frag.end_sector})",
                        context_id=frag.evidence_id
                    )
                )

        # 4. Chain of Custody Audit
        if not label and (not event_type or event_type.upper() == "AUDIT"):
            audit_query = db.query(models.ChainOfCustody).filter(models.ChainOfCustody.case_id == case_id)
            if start_dt:
                audit_query = audit_query.filter(models.ChainOfCustody.timestamp >= start_dt)
            if end_dt:
                audit_query = audit_query.filter(models.ChainOfCustody.timestamp <= end_dt)
                
            logs = audit_query.all()
            for log in logs:
                if camera_id:
                    continue
                    
                timeline_events.append(
                    schemas.TimelineEventResponse(
                        id=log.id,
                        timestamp=log.timestamp,
                        event_type="AUDIT",
                        source=log.operator,
                        description=f"Audit: [{log.action}] {log.description}",
                        context_id=log.evidence_id
                    )
                )

        timeline_events.sort(key=lambda x: x.timestamp)
        return timeline_events

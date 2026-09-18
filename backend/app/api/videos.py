import os
import mimetypes
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Dict, Any

from app.database.session import get_db
from app.models import models
from app.schemas import schemas

router = APIRouter(
    tags=["Videos"]
)

MIME_FALLBACK = "video/mp4"

def _resolve_playback_path(db_video: models.Video) -> str:
    """
    Return the best available playback path for a video record.
    Preference: playback_path (validated derivative) → file_path.
    """
    candidate = db_video.playback_path or db_video.file_path
    return candidate


@router.get("/evidence/{evidence_id}/videos", response_model=List[schemas.VideoResponse])
def list_videos_by_evidence(evidence_id: str, db: Session = Depends(get_db)):
    """
    Get all extracted video segments linked to an evidence file by joining Cameras and Videos.
    """
    evidence_check = db.query(models.Evidence).filter(models.Evidence.id == evidence_id).first()
    if not evidence_check:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evidence file registry not found."
        )
    videos = (
        db.query(models.Video)
        .join(models.Camera)
        .filter(models.Camera.evidence_id == evidence_id)
        .all()
    )
    return videos


@router.get("/videos/{video_id}", response_model=schemas.VideoResponse)
def get_video_details(video_id: str, db: Session = Depends(get_db)):
    db_video = db.query(models.Video).filter(models.Video.id == video_id).first()
    if not db_video:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Video record not found."
        )
    return db_video


@router.get("/videos/{video_id}/metadata", response_model=Dict[str, Any])
def get_video_metadata(video_id: str, db: Session = Depends(get_db)):
    db_video = db.query(models.Video).filter(models.Video.id == video_id).first()
    if not db_video:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Video record not found."
        )
    return {
        "codec": db_video.codec,
        "resolution": db_video.resolution,
        "fps": db_video.fps,
        "duration_seconds": db_video.duration_seconds,
        "start_time": db_video.start_time.isoformat(),
        "end_time": db_video.end_time.isoformat(),
        "extraction_status": db_video.extraction_status,
        "playback_path": db_video.playback_path,
    }


@router.get("/videos/{video_id}/stream")
def stream_video(video_id: str, request: Request, db: Session = Depends(get_db)):
    """
    Stream the video file for browser playback.

    - Returns the browser-playable derivative (playback_path) if available,
      falling back to file_path.
    - Supports HTTP Range requests (206 Partial Content) via Starlette FileResponse,
      which is required by all HTML5 video players.
    - Returns 404 if video record or file is not found on disk.
    - Returns 422 if extraction_status is UNPLAYABLE and no derivative exists.
    """
    db_video = db.query(models.Video).filter(models.Video.id == video_id).first()
    if not db_video:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Video record not found."
        )

    serve_path = _resolve_playback_path(db_video)

    if not serve_path or not os.path.exists(serve_path):
        # Provide a helpful diagnostic in the response body
        status_label = db_video.extraction_status or "UNKNOWN"
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                f"Video file not found on disk. "
                f"Extraction status: {status_label}. "
                f"Expected path: {serve_path or 'not set'}"
            )
        )

    if db_video.extraction_status == "UNPLAYABLE":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "This video was extracted from a proprietary disc image but could not be "
                "converted to a browser-compatible format. The original evidence is preserved."
            )
        )

    # Detect MIME type from file extension
    mime_type, _ = mimetypes.guess_type(serve_path)
    if not mime_type or not mime_type.startswith("video/"):
        mime_type = MIME_FALLBACK

    # FileResponse handles Range headers (206 Partial Content) automatically via Starlette
    return FileResponse(
        path=serve_path,
        media_type=mime_type,
        filename=os.path.basename(serve_path),
        headers={
            "Accept-Ranges": "bytes",
            "Cache-Control": "no-cache",
            "X-Extraction-Status": db_video.extraction_status or "UNKNOWN",
        }
    )

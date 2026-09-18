from forensic_engine.models import ForensicAnalysisResult, VendorInfo
from forensic_engine.metadata.extractor import extract_device_metadata
from forensic_engine.extraction.camera_video_extractor import extract_cameras_and_videos
from forensic_engine.carving.carver import carve_deleted_videos
from forensic_engine.vendor_detection.detector import (
    EvidenceFileNotFoundError,
    UnsupportedVendorError,
    MalformedEvidenceError,
)


def run_forensic_analysis(evidence_id: str, file_path: str) -> ForensicAnalysisResult:
    """
    Orchestrates the full Core Forensic Engine pipeline for one evidence file:

        evidence file -> device metadata (hash + vendor)
                       -> camera/video extraction (needs vendor)
                       -> deleted-video carving (independent of vendor)
                       -> ForensicAnalysisResult

    This is the ONE function the Backend teammate should call.

    Args:
        evidence_id: caller-assigned identifier for this evidence (used to
                     name output files under storage/extracted/ and storage/recovered/)
        file_path: path to the evidence file on disk

    Returns:
        ForensicAnalysisResult — always returned if the file exists, even if
        some stages failed. Check *_error fields to see which stages failed.

    Raises:
        EvidenceFileNotFoundError: if file_path does not exist. This is the
        only failure that aborts the entire analysis, since nothing can run
        without the evidence file.
    """
    result = ForensicAnalysisResult(evidence_id=evidence_id, evidence_file=file_path)

    # Stage 1: device metadata (includes SHA-256 hash + vendor detection).
    # A missing file here is a hard stop for the whole pipeline.
    vendor: VendorInfo | None = None
    try:
        result.metadata = extract_device_metadata(file_path)
        vendor = VendorInfo(
            vendor_name=result.metadata.vendor_name,
            device_serial=result.metadata.device_serial,
        )
    except EvidenceFileNotFoundError:
        raise
    except (UnsupportedVendorError, MalformedEvidenceError) as e:
        result.metadata_error = str(e)

    # Stage 2: camera/video extraction (needs a detected vendor).
    if vendor is not None:
        try:
            result.cameras = extract_cameras_and_videos(evidence_id, file_path, vendor)
        except (UnsupportedVendorError, MalformedEvidenceError) as e:
            result.cameras_error = str(e)
    else:
        result.cameras_error = "Skipped: vendor detection failed, cannot extract cameras/videos"

    # Stage 3: deleted-video carving (independent of vendor detection).
    try:
        result.recovered = carve_deleted_videos(evidence_id, file_path)
    except EvidenceFileNotFoundError:
        raise  # already would have raised in Stage 1, kept for safety
    except Exception as e:
        result.recovered_error = f"Carving failed: {e}"

    return result
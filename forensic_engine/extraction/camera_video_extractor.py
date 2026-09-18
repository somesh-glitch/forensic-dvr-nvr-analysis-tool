import os
from datetime import datetime, timedelta, timezone

from forensic_engine.models import VendorInfo, VideoMetadata, CameraVideoEntry
from forensic_engine.utils.sample_evidence_format import (
    NUM_CAMERAS_OFFSET,
    CAMERA_RECORD_OFFSET,
    CAMERA_RECORD_SIZE,
    VIDEO_PAYLOAD_SIZE,
    video_payload_section_offset,
    decode_camera_record,
)
from forensic_engine.vendor_detection.detector import (
    EvidenceFileNotFoundError,
    UnsupportedVendorError,
    MalformedEvidenceError,
)

# Vendors this extractor currently knows how to parse camera tables for.
SUPPORTED_VENDORS = {"SyntheticDVR"}

OUTPUT_DIR = os.getenv("FORENSIC_EXTRACTED_DIR", "storage/extracted")


def _build_output_path(evidence_id: str, channel_number: int) -> str:
    return os.path.join(OUTPUT_DIR, f"{evidence_id}_cam{channel_number:02d}.mp4")


def extract_cameras_and_videos(
    evidence_id: str, file_path: str, vendor: VendorInfo
) -> list[CameraVideoEntry]:
    """
    Extracts camera/video entries from a DVR/NVR evidence file and writes
    the associated video payload bytes to disk under storage/extracted/.

    NOTE (hackathon prototype): The written .mp4 files contain SYNTHETIC
    PLACEHOLDER bytes, not real decodable video streams. This demonstrates
    the extraction/reconstruction pipeline (locate -> carve -> save -> return
    metadata) without a real proprietary DVR/NVR parser or video codec
    library. Real vendor-specific parsing would replace only the "locate
    and read payload" step below.

    Raises:
        EvidenceFileNotFoundError: file does not exist
        UnsupportedVendorError: vendor not supported by this extractor
        MalformedEvidenceError: file too short / camera table or payload missing
    """
    if not os.path.exists(file_path):
        raise EvidenceFileNotFoundError(f"Evidence file not found: {file_path}")

    if not isinstance(vendor, VendorInfo) or vendor.vendor_name not in SUPPORTED_VENDORS:
        raise UnsupportedVendorError(
            f"Camera/video extraction not supported for vendor: "
            f"{getattr(vendor, 'vendor_name', vendor)}"
        )

    with open(file_path, "rb") as f:
        data = f.read()

    if len(data) <= NUM_CAMERAS_OFFSET:
        raise MalformedEvidenceError("File too short to contain camera table")

    num_cameras = data[NUM_CAMERAS_OFFSET]
    if num_cameras == 0:
        raise MalformedEvidenceError("No camera/video metadata present in evidence file")

    table_end = CAMERA_RECORD_OFFSET + (num_cameras * CAMERA_RECORD_SIZE)
    if len(data) < table_end:
        raise MalformedEvidenceError("File too short for declared number of cameras")

    payload_section_start = video_payload_section_offset(num_cameras)
    payload_section_end = payload_section_start + (num_cameras * VIDEO_PAYLOAD_SIZE)
    if len(data) < payload_section_end:
        raise MalformedEvidenceError("File too short for declared video payloads")

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    entries = []
    for i in range(num_cameras):
        record_start = CAMERA_RECORD_OFFSET + (i * CAMERA_RECORD_SIZE)
        record_bytes = data[record_start:record_start + CAMERA_RECORD_SIZE]
        record = decode_camera_record(record_bytes)

        payload_start = payload_section_start + (i * VIDEO_PAYLOAD_SIZE)
        payload = data[payload_start:payload_start + VIDEO_PAYLOAD_SIZE]

        output_path = _build_output_path(evidence_id, record["channel_number"])
        with open(output_path, "wb") as out_f:
            out_f.write(payload)

        start_time = datetime.fromtimestamp(record["start_time_unix"], tz=timezone.utc)
        end_time = start_time + timedelta(seconds=record["duration_seconds"])

        video = VideoMetadata(
            file_path=output_path,
            duration_seconds=float(record["duration_seconds"]),
            start_time=start_time,
            end_time=end_time,
            fps=float(record["fps"]),
            resolution=record["resolution"],
            codec=record["codec"],
        )

        entries.append(
            CameraVideoEntry(
                channel_number=record["channel_number"],
                camera_name=record["camera_name"],
                video=video,
            )
        )

    return entries
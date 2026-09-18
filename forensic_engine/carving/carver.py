import os
from datetime import datetime, timezone

from forensic_engine.models import CarvedVideo
from forensic_engine.vendor_detection.detector import EvidenceFileNotFoundError
from forensic_engine.carving.signatures import KNOWN_CARVING_SIGNATURES, CarvingSignature

SECTOR_SIZE = 512  # bytes/sector — hackathon-prototype assumption, NOT accurate for every device
OUTPUT_DIR = os.getenv("FORENSIC_RECOVERED_DIR", "storage/recovered")


def _next_available_path(evidence_id: str, extension: str) -> str:
    """Finds a unique output filename so previously recovered files are never overwritten."""
    index = 1
    while True:
        path = os.path.join(OUTPUT_DIR, f"{evidence_id}_recovered_{index:03d}{extension}")
        if not os.path.exists(path):
            return path
        index += 1


def _try_extract_candidate(data: bytes, start_pos: int, sig: CarvingSignature):
    """
    Validates one candidate fragment starting at start_pos.
    Returns (start_offset, end_offset, fragment_bytes) or None if invalid.
    """
    search_window_end = min(len(data), start_pos + sig.max_search_window)
    end_sig_pos = data.find(sig.end_signature, start_pos, search_window_end)

    if end_sig_pos == -1:
        return None  # no valid end boundary within window -> skip, not a fake result

    end_offset = end_sig_pos + len(sig.end_signature)
    fragment_bytes = data[start_pos:end_offset]

    if len(fragment_bytes) == 0 or len(fragment_bytes) < sig.min_fragment_size:
        return None  # too small to be meaningful -> skip

    return start_pos, end_offset, fragment_bytes


def carve_deleted_videos(evidence_id: str, file_path: str) -> list[CarvedVideo]:
    """
    Scans raw evidence bytes for known deleted-video signatures and carves
    validated candidate fragments into storage/recovered/.

    HACKATHON PROTOTYPE: supports only the documented synthetic signature
    (see forensic_engine/utils/sample_evidence_format.py). This is NOT a
    complete proprietary DVR/NVR filesystem recovery system. Sector numbers
    use a fixed SECTOR_SIZE=512 assumption that will not match every real
    device's actual sector size.

    Returns an empty list if no valid fragments are found — this is a
    normal outcome, not an error.

    Raises:
        EvidenceFileNotFoundError: file does not exist
    """
    if not os.path.exists(file_path):
        raise EvidenceFileNotFoundError(f"Evidence file not found: {file_path}")

    with open(file_path, "rb") as f:
        data = f.read()

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    recovered: list[CarvedVideo] = []

    for sig in KNOWN_CARVING_SIGNATURES:
        pos = data.find(sig.start_signature)
        while pos != -1:
            candidate = _try_extract_candidate(data, pos, sig)
            if candidate is not None:
                start_offset, end_offset, fragment_bytes = candidate

                output_path = _next_available_path(evidence_id, sig.file_extension)
                with open(output_path, "wb") as out_f:
                    out_f.write(fragment_bytes)

                recovered.append(
                    CarvedVideo(
                        start_sector=start_offset // SECTOR_SIZE,
                        end_sector=end_offset // SECTOR_SIZE,
                        size_bytes=len(fragment_bytes),
                        status="Recovered",
                        file_extension=sig.file_extension,
                        estimated_time=datetime.now(timezone.utc),
                    )
                )
            pos = data.find(sig.start_signature, pos + 1)

    return recovered
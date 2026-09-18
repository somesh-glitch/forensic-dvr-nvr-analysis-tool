from dataclasses import dataclass
from forensic_engine.utils.sample_evidence_format import (
    DELETED_FRAGMENT_SIGNATURE,
    DELETED_FRAGMENT_END_SIGNATURE,
    DELETED_FRAGMENT_FILE_EXTENSION,
)


@dataclass(frozen=True)
class CarvingSignature:
    """Defines how to recognize and bound one recoverable fragment type."""
    start_signature: bytes
    end_signature: bytes
    file_extension: str
    min_fragment_size: int   # candidate below this size is not "meaningful" -> skip
    max_search_window: int   # how far past start_signature to look for end_signature


# Add new recoverable formats here as new CarvingSignature entries.
KNOWN_CARVING_SIGNATURES = [
    CarvingSignature(
        start_signature=DELETED_FRAGMENT_SIGNATURE,
        end_signature=DELETED_FRAGMENT_END_SIGNATURE,
        file_extension=DELETED_FRAGMENT_FILE_EXTENSION,
        min_fragment_size=32,
        max_search_window=2048,
    ),
]
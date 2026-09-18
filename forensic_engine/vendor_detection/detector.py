import os
from forensic_engine.vendor_detection.signatures import KNOWN_SIGNATURES
from forensic_engine.models import VendorInfo


class EvidenceFileNotFoundError(Exception):
    """Raised when the evidence file path does not exist."""
    pass


class UnsupportedVendorError(Exception):
    """Raised when no known vendor signature is found in the file."""
    pass


class MalformedEvidenceError(Exception):
    """Raised when a signature matches but the file data around it is invalid."""
    pass


def _extract_field(data: bytes, offset: int, length: int) -> str:
    """Reads a null-padded ASCII field and strips trailing null bytes."""
    raw = data[offset:offset + length]
    return raw.split(b"\x00", 1)[0].decode("ascii", errors="replace")


def identify_vendor_from_bytes(file_path: str) -> VendorInfo:
    """
    Inspects the binary evidence file and identifies a supported vendor
    based on a known byte signature.

    Returns:
        VendorInfo(vendor_name, device_serial)

    Raises:
        EvidenceFileNotFoundError: file does not exist
        MalformedEvidenceError: file unreadable, or signature matched but data is invalid
        UnsupportedVendorError: no known signature matched
    """
    if not os.path.exists(file_path):
        raise EvidenceFileNotFoundError(f"Evidence file not found: {file_path}")

    try:
        with open(file_path, "rb") as f:
            data = f.read()
    except OSError as e:
        raise MalformedEvidenceError(f"Could not read evidence file: {e}") from e

    for sig in KNOWN_SIGNATURES:
        sig_end = sig.signature_offset + len(sig.signature)
        if len(data) < sig_end:
            continue  # file too short to contain this signature, try next
        if data[sig.signature_offset:sig_end] != sig.signature:
            continue  # signature doesn't match, try next

        serial_end = sig.serial_field_offset + sig.serial_field_len
        if len(data) < serial_end:
            raise MalformedEvidenceError(
                f"Signature matched but file too short for serial field: {file_path}"
            )

        serial = _extract_field(data, sig.serial_field_offset, sig.serial_field_len)
        if not serial:
            raise MalformedEvidenceError(
                f"Signature matched but device serial field is empty: {file_path}"
            )

        return VendorInfo(vendor_name=sig.vendor_name, device_serial=serial)

    raise UnsupportedVendorError(f"No known vendor signature found in file: {file_path}")
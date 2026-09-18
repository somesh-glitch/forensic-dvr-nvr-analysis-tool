import hashlib
import os
from typing import Tuple, Dict, Any
from sqlalchemy.orm import Session
from app.models import models

def calculate_hashes(file_path: str) -> Tuple[str, str]:
    """
    Calculate both MD5 and SHA-256 hashes of a file in 64KB chunks.
    Raises FileNotFoundError if file_path does not exist.
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found for hash calculation: {file_path}")

    md5_hash = hashlib.md5()
    sha_hash = hashlib.sha256()

    with open(file_path, "rb") as f:
        for byte_block in iter(lambda: f.read(65536), b""):
            md5_hash.update(byte_block)
            sha_hash.update(byte_block)

    return md5_hash.hexdigest(), sha_hash.hexdigest()

def verify_evidence_integrity(db: Session, evidence_id: str) -> Dict[str, Any]:
    """
    Retrieves the evidence details, recalculates hashes on disk,
    compares them to stored database values, and registers failures.
    """
    evidence = db.query(models.Evidence).filter(models.Evidence.id == evidence_id).first()
    if not evidence:
        raise ValueError(f"Evidence with ID {evidence_id} not found in database.")

    file_path = evidence.file_path
    if not os.path.exists(file_path):
        # File is missing! That is an immediate integrity failure.
        description = f"Integrity Failure: Evidence file '{evidence.name}' missing from disk at '{file_path}'."
        # Update case status if there was a status column, otherwise write audit log
        audit = models.ChainOfCustody(
            case_id=evidence.case_id,
            evidence_id=evidence.id,
            operator="System Integrity Verifier",
            action="INTEGRITY_FAILURE",
            description=description
        )
        db.add(audit)
        db.commit()
        return {
            "verified": False,
            "status": "INTEGRITY_FAILURE",
            "message": "Evidence file is missing from disk.",
            "stored_sha256": evidence.sha256,
            "calculated_sha256": None,
            "stored_md5": evidence.md5,
            "calculated_md5": None
        }

    # Recalculate
    try:
        calc_md5, calc_sha256 = calculate_hashes(file_path)
    except Exception as e:
        description = f"Integrity Failure: Cryptographic calculation failed for '{evidence.name}': {str(e)}"
        audit = models.ChainOfCustody(
            case_id=evidence.case_id,
            evidence_id=evidence.id,
            operator="System Integrity Verifier",
            action="INTEGRITY_FAILURE",
            description=description
        )
        db.add(audit)
        db.commit()
        return {
            "verified": False,
            "status": "INTEGRITY_FAILURE",
            "message": f"Hash calculation exception: {str(e)}",
            "stored_sha256": evidence.sha256,
            "calculated_sha256": None,
            "stored_md5": evidence.md5,
            "calculated_md5": None
        }

    sha_matches = (calc_sha256.lower() == evidence.sha256.lower())
    md5_matches = (calc_md5.lower() == evidence.md5.lower())

    if sha_matches and md5_matches:
        description = f"Integrity Verification Passed: Evidence file '{evidence.name}' checked. SHA-256 match confirmed ({evidence.sha256})."
        audit = models.ChainOfCustody(
            case_id=evidence.case_id,
            evidence_id=evidence.id,
            operator="System Integrity Verifier",
            action="INTEGRITY_VERIFICATION",
            description=description
        )
        db.add(audit)
        db.commit()
        return {
            "verified": True,
            "status": "VERIFIED",
            "message": "Cryptographic integrity matches database records.",
            "stored_sha256": evidence.sha256,
            "calculated_sha256": calc_sha256,
            "stored_md5": evidence.md5,
            "calculated_md5": calc_md5
        }
    else:
        description = (
            f"INTEGRITY FAILURE: Evidence file '{evidence.name}' modified or corrupted! "
            f"Stored SHA256: {evidence.sha256}, Calculated: {calc_sha256}. "
            f"Stored MD5: {evidence.md5}, Calculated: {calc_md5}."
        )
        audit = models.ChainOfCustody(
            case_id=evidence.case_id,
            evidence_id=evidence.id,
            operator="System Integrity Verifier",
            action="INTEGRITY_FAILURE",
            description=description
        )
        db.add(audit)
        db.commit()
        return {
            "verified": False,
            "status": "INTEGRITY_FAILURE",
            "message": "Cryptographic mismatch detected! Digital chain of custody compromised.",
            "stored_sha256": evidence.sha256,
            "calculated_sha256": calc_sha256,
            "stored_md5": evidence.md5,
            "calculated_md5": calc_md5
        }

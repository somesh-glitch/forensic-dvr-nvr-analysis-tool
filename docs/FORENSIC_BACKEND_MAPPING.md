# FORENSIC ENGINE TO DB SCHEMA MAPPING

This document describes how raw structures of the `ForensicEngine` adapter are mapped to database entities.

## 1. Metadata Schema Conversion

| Forensic Engine Model Class | Database SQLAlchemy Model | Field Mapping Details |
|---|---|---|
| **DeviceMetadata** | `Evidence` | - `vendor` &rarr; `vendor_detected`<br>- `serial` &rarr; `device_serial`<br>- `hash_md5` &rarr; `md5`<br>- `hash_sha256` &rarr; `sha256`<br>- `file_size` &rarr; `file_size` |
| **CameraVideoEntry** | `Camera` | - `channel_number` &rarr; `channel_number`<br>- `camera_name` &rarr; `name`<br>- `evidence_id` &rarr; `evidence_id` Relational UUID |
| **VideoMetadata** | `Video` | - `file_path` &rarr; `file_path`<br>- `duration_seconds` &rarr; `duration_seconds`<br>- `start_time` &rarr; `start_time` (timezone-aware UTC)<br>- `end_time` &rarr; `end_time` (timezone-aware UTC)<br>- `fps` &rarr; `fps`<br>- `resolution` &rarr; `resolution`<br>- `codec` &rarr; `codec` |
| **CarvedVideo** | `RecoveredFile` | - `start_sector` &rarr; `start_sector`<br>- `end_sector` &rarr; `end_sector`<br>- `size_bytes` &rarr; `size_bytes`<br>- `status` &rarr; `status`<br>- `file_extension` &rarr; `file_extension` |

## 2. Ingestion Integrity Checks
Ingestion runs a verification routine to verify that duplicate copies of camera definitions and recovered sector ranges do not clutter the relational ledger. If a matching serial, name, or sector range exists, the SQLite db updates the existing row rather than appending duplicates.

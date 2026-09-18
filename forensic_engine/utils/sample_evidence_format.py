"""
Synthetic DVR/NVR evidence format used for testing.

Layout (byte offsets):
  0    - 15   : SIGNATURE        (16 bytes, ASCII, padded with \x00)
  16   - 47   : VENDOR_NAME      (32 bytes, ASCII, padded with \x00)
  48   - 79   : DEVICE_SERIAL    (32 bytes, ASCII, padded with \x00)
  80          : NUM_CAMERAS      (1 byte, unsigned int)
  81   - ...  : CAMERA_TABLE     (NUM_CAMERAS records, 48 bytes each)
  ...         : VIDEO_PAYLOADS   (NUM_CAMERAS payloads, 64 bytes each)
  1024 - 1261 : DELETED_FRAGMENT (238 bytes: start sig + body + end sig)
  ...  - 4095 : PADDING          (deterministic filler)

Each camera record (48 bytes, big-endian struct ">B15sIQB11s8s"):
  channel_number   : 1 byte  (unsigned int)
  camera_name      : 15 bytes ASCII, padded
  duration_seconds : 4 bytes (unsigned int, seconds)
  start_time_unix  : 8 bytes (unsigned int, unix seconds UTC)
  fps              : 1 byte  (unsigned int)
  resolution       : 11 bytes ASCII, padded (e.g. "1920x1080")
  codec            : 8 bytes ASCII, padded (e.g. "H264")

Each video payload (64 bytes) is SYNTHETIC PLACEHOLDER DATA representing
"video content" for that channel. It is NOT a real decodable video stream.

DELETED_FRAGMENT (238 bytes, at fixed offset 1024) simulates one deleted
video fragment sitting in unallocated space:
  [0:20]   DELETED_FRAGMENT_SIGNATURE     (b"SYNTH-DEL-FRAG-START")
  [20:220] deterministic body bytes       ("recovered video content")
  [220:238] DELETED_FRAGMENT_END_SIGNATURE (b"SYNTH-DEL-FRAG-END")
This is NOT a real deleted-file recovery scenario — it exists so the
Step 8 carver has a real, bounded fragment to locate and validate.

This is NOT a real DVR/NVR format. It is synthetic data created
for this project so extraction/carving logic has something
deterministic to test against.
"""
import struct

SIGNATURE = b"SYNTHDVR-SIG-01"
VENDOR_NAME = b"AcmeSynthDVR"
DEVICE_SERIAL = b"SN-TEST-000123"

SIGNATURE_OFFSET = 0
SIGNATURE_LEN = 16

VENDOR_OFFSET = 16
VENDOR_LEN = 32

SERIAL_OFFSET = 48
SERIAL_LEN = 32

NUM_CAMERAS_OFFSET = 80

CAMERA_RECORD_OFFSET = 81
CAMERA_RECORD_FORMAT = ">B15sIQB11s8s"
CAMERA_RECORD_SIZE = struct.calcsize(CAMERA_RECORD_FORMAT)  # 48 bytes

VIDEO_PAYLOAD_SIZE = 64  # bytes, synthetic placeholder "video content" per camera

# --- Step 8: synthetic deleted-video fragment ---
DELETED_FRAGMENT_SIGNATURE = b"SYNTH-DEL-FRAG-START"      # 20 bytes
DELETED_FRAGMENT_END_SIGNATURE = b"SYNTH-DEL-FRAG-END"    # 18 bytes
DELETED_FRAGMENT_BODY_SIZE = 200
DELETED_FRAGMENT_OFFSET = 1024
DELETED_FRAGMENT_FILE_EXTENSION = ".mp4"
DELETED_FRAGMENT_TOTAL_SIZE = (
    len(DELETED_FRAGMENT_SIGNATURE) + DELETED_FRAGMENT_BODY_SIZE + len(DELETED_FRAGMENT_END_SIGNATURE)
)  # 238 bytes

TOTAL_SIZE = 4096

# Deterministic synthetic camera/video data used to build the sample file.
SAMPLE_CAMERAS = [
    {
        "channel_number": 1,
        "camera_name": "CAM-01",
        "duration_seconds": 120,
        "start_time_unix": 1735725600,  # 2025-01-01T10:00:00Z
        "fps": 25,
        "resolution": "1920x1080",
        "codec": "H264",
    },
    {
        "channel_number": 2,
        "camera_name": "CAM-02",
        "duration_seconds": 90,
        "start_time_unix": 1735725900,  # 2025-01-01T10:05:00Z
        "fps": 15,
        "resolution": "1280x720",
        "codec": "H265",
    },
]


def _pad(data: bytes, length: int) -> bytes:
    if len(data) > length:
        raise ValueError(f"data longer than field length {length}")
    return data + b"\x00" * (length - len(data))


def _encode_camera_record(cam: dict) -> bytes:
    return struct.pack(
        CAMERA_RECORD_FORMAT,
        cam["channel_number"],
        _pad(cam["camera_name"].encode("ascii"), 15),
        cam["duration_seconds"],
        cam["start_time_unix"],
        cam["fps"],
        _pad(cam["resolution"].encode("ascii"), 11),
        _pad(cam["codec"].encode("ascii"), 8),
    )


def decode_camera_record(data: bytes) -> dict:
    """Decodes one 48-byte camera record into a plain dict."""
    channel_number, name_raw, duration, start_unix, fps, res_raw, codec_raw = (
        struct.unpack(CAMERA_RECORD_FORMAT, data)
    )
    return {
        "channel_number": channel_number,
        "camera_name": name_raw.split(b"\x00", 1)[0].decode("ascii"),
        "duration_seconds": duration,
        "start_time_unix": start_unix,
        "fps": fps,
        "resolution": res_raw.split(b"\x00", 1)[0].decode("ascii"),
        "codec": codec_raw.split(b"\x00", 1)[0].decode("ascii"),
    }


def _build_video_payload(channel_number: int) -> bytes:
    """Deterministic synthetic placeholder 'video content' for one channel."""
    label = f"SYNTH-VIDEO-CH{channel_number:02d}-DEMO-ONLY-".encode("ascii")
    if len(label) >= VIDEO_PAYLOAD_SIZE:
        return label[:VIDEO_PAYLOAD_SIZE]
    filler = bytes(((channel_number * 7 + i) % 256) for i in range(VIDEO_PAYLOAD_SIZE - len(label)))
    return label + filler


def video_payload_section_offset(num_cameras: int) -> int:
    """Offset where the video payload section begins, given the camera count."""
    return CAMERA_RECORD_OFFSET + (num_cameras * CAMERA_RECORD_SIZE)


def _build_deleted_fragment_body() -> bytes:
    """Deterministic filler representing 'recovered video content'."""
    return bytes(((i * 3 + 7) % 256) for i in range(DELETED_FRAGMENT_BODY_SIZE))


def generate_sample_evidence_bytes() -> bytes:
    """Builds the full synthetic evidence file content deterministically."""
    header = b""
    header += _pad(SIGNATURE, SIGNATURE_LEN)
    header += _pad(VENDOR_NAME, VENDOR_LEN)
    header += _pad(DEVICE_SERIAL, SERIAL_LEN)

    camera_section = bytes([len(SAMPLE_CAMERAS)])
    for cam in SAMPLE_CAMERAS:
        camera_section += _encode_camera_record(cam)

    payload_section = b""
    for cam in SAMPLE_CAMERAS:
        payload_section += _build_video_payload(cam["channel_number"])

    body = header + camera_section + payload_section
    remaining = TOTAL_SIZE - len(body)
    if remaining < 0:
        raise ValueError("camera table + payloads too large for TOTAL_SIZE")

    # deterministic filler pattern, not random, so file is identical every run
    filler = bytearray((i % 256) for i in range(remaining))

    # Embed the deleted-video fragment at its fixed absolute offset.
    fragment_bytes = (
        DELETED_FRAGMENT_SIGNATURE
        + _build_deleted_fragment_body()
        + DELETED_FRAGMENT_END_SIGNATURE
    )
    frag_offset_in_filler = DELETED_FRAGMENT_OFFSET - len(body)
    if frag_offset_in_filler < 0 or frag_offset_in_filler + len(fragment_bytes) > len(filler):
        raise ValueError("DELETED_FRAGMENT_OFFSET does not fit within padding region")
    filler[frag_offset_in_filler:frag_offset_in_filler + len(fragment_bytes)] = fragment_bytes

    return body + bytes(filler)
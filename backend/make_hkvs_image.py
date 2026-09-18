"""
make_hkvs_image.py
──────────────────
Creates a synthetic Hikvision disc-image file suitable for integration tests.

FORMAT
    Bytes 0-3    : b"HKVS"                     (magic signature)
    Bytes 4-7    : channel_count as uint32 LE   (default 3)
    Bytes 8-15   : reserved zeros
    Bytes 16+    : embedded MP4 payload

The embedded MP4 is produced with OpenCV and contains 50 frames of
solid-colour video at 640×360, 25 fps (≈ 2 s duration).

The original evidence hash is calculated over the COMPLETE file
(header + embedded MP4), meaning a round-trip hash check will pass as
long as the file is not modified after ingestion.
"""

import io
import os
import struct
import tempfile

import cv2
import numpy as np


def make_hkvs_image(
    output_path: str,
    channel_count: int = 3,
    fps: float = 25.0,
    width: int = 640,
    height: int = 360,
    frame_count: int = 50,
) -> str:
    """
    Write a HKVS disc-image to *output_path* and return the path.

    The image consists of:
        [HKVS header 16 B] + [MP4 payload]

    The MP4 payload is a valid, browser-playable MP4 video generated
    with OpenCV using the 'mp4v' codec.
    """
    # 1. Build the MP4 payload in a temporary file
    tmp_mp4 = output_path + ".tmp_payload.mp4"
    try:
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        writer = cv2.VideoWriter(tmp_mp4, fourcc, fps, (width, height))
        for i in range(frame_count):
            # Alternate colours so the video is not a flat single colour
            # (helps decoders that do colour-space optimisation)
            colour = (
                int(40 + (i * 5) % 215),   # B
                int(60 + (i * 3) % 195),   # G
                int(80 + (i * 7) % 175),   # R
            )
            frame = np.full((height, width, 3), colour, dtype=np.uint8)
            writer.write(frame)
        writer.release()

        with open(tmp_mp4, "rb") as f:
            mp4_payload = f.read()
    finally:
        if os.path.exists(tmp_mp4):
            os.remove(tmp_mp4)

    if not mp4_payload:
        raise RuntimeError("OpenCV produced an empty MP4 payload")

    # 2. Build the 16-byte HKVS header
    #    [0:4]  magic
    #    [4:8]  channel_count (uint32 LE)
    #    [8:16] reserved
    header = b"HKVS" + struct.pack("<I", channel_count) + b"\x00" * 8

    # 3. Write the disc image
    with open(output_path, "wb") as f:
        f.write(header)
        f.write(mp4_payload)

    return output_path


if __name__ == "__main__":
    # Quick sanity check when run directly
    import hashlib
    out = "hikvision_test_disc.img"
    make_hkvs_image(out)
    size = os.path.getsize(out)
    with open(out, "rb") as f:
        data = f.read()
    md5 = hashlib.md5(data).hexdigest()
    sha256 = hashlib.sha256(data).hexdigest()
    print(f"Created: {out}  size={size}  MD5={md5}  SHA256={sha256}")
    # Verify the header
    assert data[:4] == b"HKVS", "HKVS magic missing"
    assert struct.unpack_from("<I", data, 4)[0] == 3, "channel_count wrong"
    print("Header OK")
    # Validate embedded MP4
    tmp = out + ".validate.mp4"
    with open(tmp, "wb") as f:
        f.write(data[16:])
    cap = cv2.VideoCapture(tmp)
    ok, _ = cap.read()
    cap.release()
    os.remove(tmp)
    os.remove(out)
    assert ok, "Embedded MP4 payload not decodable by OpenCV"
    print("Embedded MP4 payload: VALID — OpenCV decoded at least one frame")
    print("ALL CHECKS PASSED")

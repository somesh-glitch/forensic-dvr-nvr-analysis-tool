from dataclasses import dataclass
from forensic_engine.models.video_metadata import VideoMetadata


@dataclass
class CameraVideoEntry:
    """One camera channel and its associated video."""
    channel_number: int
    camera_name: str
    video: VideoMetadata

    def __post_init__(self):
        if self.channel_number < 0:
            raise ValueError("channel_number cannot be negative")
        if not self.camera_name:
            raise ValueError("camera_name cannot be empty")
        if not isinstance(self.video, VideoMetadata):
            raise TypeError("video must be a VideoMetadata instance")
from datetime import datetime, timezone, timedelta
from typing import Union, Optional

def normalize_to_utc(dt: Union[datetime, int, float, str]) -> datetime:
    """
    Standardize incoming timestamps or Unix epochs to a timezone-aware UTC datetime.
    """
    if isinstance(dt, (int, float)):
        return datetime.fromtimestamp(dt, tz=timezone.utc)
    
    if isinstance(dt, datetime):
        if dt.tzinfo is None:
            # Assume UTC if naive, as standard for forensic databases
            return dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
        
    if isinstance(dt, str):
        try:
            # Parse ISO formats
            parsed = datetime.fromisoformat(dt.replace("Z", "+00:00"))
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return parsed.astimezone(timezone.utc)
        except ValueError:
            pass
            
    # Fallback default
    return datetime.now(timezone.utc)

def format_local_time(dt: datetime, offset_hours: int = 0) -> str:
    """
    Formats a UTC datetime into local time presentation layout.
    """
    utc_dt = normalize_to_utc(dt)
    local_dt = utc_dt + timedelta(hours=offset_hours)
    return local_dt.strftime("%Y-%m-%d %H:%M:%S")

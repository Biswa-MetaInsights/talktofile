"""Shared rate limiter (slowapi). Keyed by client IP.

For multi-instance / production, back this with Redis via `storage_uri`.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address, default_limits=[])

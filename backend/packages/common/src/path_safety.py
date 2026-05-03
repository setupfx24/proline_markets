"""Resolve paths strictly under a base directory (mitigates path traversal / CodeQL py/path-injection)."""
from __future__ import annotations

from pathlib import Path


class PathTraversalError(ValueError):
    """Raised when a path segment is unsafe or the resolved path escapes ``base``."""


def safe_join_under_base(base: Path, *segments: str) -> Path:
    """
    Join ``base`` with one or more single path components, resolve, and assert the result stays under ``base``.

    Each segment must be a single path name (no ``/``, ``\\``, or ``..``). Intended for UUID folders,
    fixed subdirs like ``deposits``, and generated basenames.
    """
    base_r = base.expanduser().resolve()
    for seg in segments:
        if not seg or seg != Path(seg).name or ".." in seg or "/" in seg or "\\" in seg:
            raise PathTraversalError(f"unsafe path segment: {seg!r}")
    out = base_r.joinpath(*segments).resolve()
    try:
        out.relative_to(base_r)
    except ValueError:
        raise PathTraversalError("resolved path escapes base directory")
    return out

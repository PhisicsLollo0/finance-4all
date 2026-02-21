import os
import sys

# Ensure `backend/` is on sys.path so that `from src.*` imports inside
# backend/main.py resolve to backend/src/, not the frontend src/ directory.
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend"))

from main import app  # noqa: E402

__all__ = ["app"]

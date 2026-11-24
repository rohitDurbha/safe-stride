"""Vercel entry point for the SafeStride Flask backend.

vercel.json sends every /api/... request here. The app itself lives in
backend/, and StripPrefix turns /api/safe_path into the /safe_path route.
"""
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from app import app  # noqa: E402
from prefix import StripPrefix  # noqa: E402

app.wsgi_app = StripPrefix(app.wsgi_app, "/api")

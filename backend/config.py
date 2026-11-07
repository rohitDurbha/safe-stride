"""Runtime settings for the SafeStride backend.

Every credential comes from the environment (or a local, untracked
backend/.env file). See backend/.env.example for the full list.
"""
import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")


SETUP_HINT = "Copy backend/.env.example to backend/.env and fill in the missing values."

# Variables the server cannot run without, with a short note on each.
REQUIRED_SETTINGS = {
    "MONGO_URI": "MongoDB Atlas connection string",
    "SECRET_KEY": "secret used to sign login tokens",
}

# Placeholder secrets that must never sign real tokens.
WEAK_SECRET_KEYS = {"dev_key", "changeme", "secret"}


def missing_settings(environ=None):
    """Return the names of required variables that are unset or blank."""
    environ = os.environ if environ is None else environ
    return [name for name in REQUIRED_SETTINGS if not environ.get(name, "").strip()]


def check_required_settings(environ=None):
    """Raise one error that lists every missing variable at once.

    The server calls this before it downloads the street graph, so a
    misconfigured machine fails in a second instead of after a long wait.
    """
    missing = missing_settings(environ)
    if missing:
        lines = [f"  {name}  ({REQUIRED_SETTINGS[name]})" for name in missing]
        raise RuntimeError(
            "SafeStride backend is missing required settings.\n"
            + "\n".join(lines)
            + "\n"
            + SETUP_HINT
        )
    get_secret_key(environ)


def get_mongo_uri():
    uri = os.getenv("MONGO_URI", "").strip()
    if not uri:
        raise RuntimeError(
            "MONGO_URI is not set. Copy backend/.env.example to backend/.env "
            "and fill in your MongoDB Atlas connection string."
        )
    return uri


def get_secret_key(environ=None):
    environ = os.environ if environ is None else environ
    key = environ.get("SECRET_KEY", "").strip()
    if not key:
        raise RuntimeError("SECRET_KEY is not set. " + SETUP_HINT)
    if key.lower() in WEAK_SECRET_KEYS:
        raise RuntimeError(
            "SECRET_KEY is set to a placeholder value. Generate a real one with "
            'python -c "import secrets; print(secrets.token_urlsafe(48))"'
        )
    return key


def get_jwt_expiration(environ=None):
    environ = os.environ if environ is None else environ
    raw = environ.get("JWT_EXPIRATION", "").strip() or "3600"
    try:
        seconds = int(raw)
    except ValueError:
        raise RuntimeError(f"JWT_EXPIRATION must be a whole number of seconds, got {raw!r}.")
    if seconds <= 0:
        raise RuntimeError("JWT_EXPIRATION must be greater than zero.")
    return seconds


@dataclass(frozen=True)
class SmtpSettings:
    host: str
    port: int
    user: str
    password: str
    sender: str

    @property
    def configured(self):
        return bool(self.user and self.password)


def get_smtp_settings():
    user = os.getenv("SMTP_USER", "").strip()
    return SmtpSettings(
        host=os.getenv("SMTP_HOST", "smtp.gmail.com").strip(),
        port=int(os.getenv("SMTP_PORT", "587")),
        user=user,
        password=os.getenv("SMTP_PASSWORD", ""),
        sender=os.getenv("SMTP_SENDER", "").strip() or user,
    )

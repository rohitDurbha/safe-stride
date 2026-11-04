"""Runtime settings for the SafeStride backend.

Every credential comes from the environment (or a local, untracked
backend/.env file). See backend/.env.example for the full list.
"""
import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")


def get_mongo_uri():
    uri = os.getenv("MONGO_URI", "").strip()
    if not uri:
        raise RuntimeError(
            "MONGO_URI is not set. Copy backend/.env.example to backend/.env "
            "and fill in your MongoDB Atlas connection string."
        )
    return uri


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

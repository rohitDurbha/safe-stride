import pytest

import config
import mailer
from config import SmtpSettings


def test_mongo_uri_is_read_from_environment(monkeypatch):
    monkeypatch.setenv("MONGO_URI", " mongodb+srv://user:pw@example.net/db ")
    assert config.get_mongo_uri() == "mongodb+srv://user:pw@example.net/db"


def test_missing_mongo_uri_raises_a_clear_error(monkeypatch):
    monkeypatch.delenv("MONGO_URI", raising=False)
    with pytest.raises(RuntimeError, match="MONGO_URI"):
        config.get_mongo_uri()


def test_smtp_settings_defaults_and_sender_fallback(monkeypatch):
    for key in ("SMTP_HOST", "SMTP_PORT", "SMTP_SENDER"):
        monkeypatch.delenv(key, raising=False)
    monkeypatch.setenv("SMTP_USER", "alerts@example.com")
    monkeypatch.setenv("SMTP_PASSWORD", "app-password")

    settings = config.get_smtp_settings()

    assert settings.host == "smtp.gmail.com"
    assert settings.port == 587
    assert settings.sender == "alerts@example.com"
    assert settings.configured


def test_smtp_is_unconfigured_without_password(monkeypatch):
    monkeypatch.setenv("SMTP_USER", "alerts@example.com")
    monkeypatch.delenv("SMTP_PASSWORD", raising=False)
    assert not config.get_smtp_settings().configured


class FakeSMTP:
    instances = []

    def __init__(self, host, port, timeout=None):
        self.host, self.port = host, port
        self.calls = []
        self.sent = []
        FakeSMTP.instances.append(self)

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def starttls(self):
        self.calls.append("starttls")

    def login(self, user, password):
        self.calls.append(("login", user, password))

    def send_message(self, msg):
        self.sent.append(msg)


SETTINGS = SmtpSettings("smtp.test", 2525, "bot@example.com", "secret", "SafeStride <bot@example.com>")


@pytest.fixture(autouse=True)
def fake_smtp(monkeypatch):
    FakeSMTP.instances.clear()
    monkeypatch.setattr(mailer.smtplib, "SMTP", FakeSMTP)


def test_send_email_uses_configured_server_and_credentials():
    assert mailer.send_email("contact@example.com", "Hi", "Body", settings=SETTINGS)

    server = FakeSMTP.instances[0]
    assert (server.host, server.port) == ("smtp.test", 2525)
    assert server.calls == ["starttls", ("login", "bot@example.com", "secret")]
    msg = server.sent[0]
    assert msg["To"] == "contact@example.com"
    assert msg["From"] == "SafeStride <bot@example.com>"
    assert msg["Subject"] == "Hi"


def test_send_email_skips_when_not_configured():
    blank = SmtpSettings("smtp.test", 587, "", "", "")
    assert not mailer.send_email("contact@example.com", "Hi", "Body", settings=blank)
    assert FakeSMTP.instances == []


def test_send_email_skips_without_recipient():
    assert not mailer.send_email("", "Hi", "Body", settings=SETTINGS)
    assert FakeSMTP.instances == []


def test_send_email_reports_failure_instead_of_raising(monkeypatch):
    def broken(*args, **kwargs):
        raise OSError("connection refused")

    monkeypatch.setattr(mailer.smtplib, "SMTP", broken)
    assert not mailer.send_email("contact@example.com", "Hi", "Body", settings=SETTINGS)

"""Small helper for the plain text emails the backend sends."""
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from config import get_smtp_settings


def send_email(to_address, subject, body, settings=None):
    """Send a plain text email and return True when it was delivered.

    Mail is skipped (and False returned) when SMTP credentials are not
    configured or there is no recipient, so a missing setup never breaks
    the request that triggered the email.
    """
    settings = settings or get_smtp_settings()
    if not settings.configured:
        print("SMTP_USER or SMTP_PASSWORD is not set, skipping email.")
        return False
    if not to_address:
        print("No recipient address, skipping email.")
        return False

    msg = MIMEMultipart()
    msg["From"] = settings.sender
    msg["To"] = to_address
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "plain"))

    try:
        with smtplib.SMTP(settings.host, settings.port, timeout=15) as server:
            server.starttls()
            server.login(settings.user, settings.password)
            server.send_message(msg)
        return True
    except Exception as exc:
        print("Failed to send email:", exc)
        return False

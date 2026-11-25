"""The spoken incident report route.

Only signed in users can file a report, and the alert goes to the emergency
contact stored on that user's account.
"""
import math
from datetime import datetime, timezone
from threading import Thread

from flask import Blueprint, jsonify

from accounts import current_user, json_body

MAX_TRANSCRIPT_CHARS = 2000


def coordinate(value, limit):
    """Return value as a float inside [-limit, limit], or None."""
    if isinstance(value, bool):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) and -limit <= number <= limit else None


def alert_body(transcript, lat, lon):
    return (
        "Hello,\n\n"
        "This is an email to inform you about an emergency report submitted by someone who has you as an emergency contact. "
        "Please check your application for more information.\n\n"
        f'The transcript of the audio shared is: "{transcript}"\n\n'
        f"The location is: {lat}, {lon}\n\n"
        "Regards,\n"
        "Safe Stride Safety Team"
    )


def create_reports_blueprint(db, signer, classify, rescore, send_email, run_later=None):
    """Build the blueprint.

    rescore(lon, lat, incident_type) updates the street scores, and run_later
    runs it off the request thread (tests pass a function that runs it now).
    """
    if run_later is None:
        def run_later(task):
            Thread(target=task, daemon=True).start()

    bp = Blueprint("reports", __name__)

    @bp.route("/report_audio", methods=["POST"])
    def report_audio():
        user, error = current_user(db.users, signer)
        if error:
            return error

        data = json_body()
        transcript = data.get("transcript")
        transcript = transcript.strip()[:MAX_TRANSCRIPT_CHARS] if isinstance(transcript, str) else ""
        lat = coordinate(data.get("lat"), 90)
        lon = coordinate(data.get("lon"), 180)
        if not transcript or lat is None or lon is None:
            return jsonify({"error": "Missing transcript or location"}), 400

        incident_type = classify(transcript)
        db.incident_reports.insert_one({
            "transcript": transcript,
            "incident_type": incident_type,
            "location": {"lat": lat, "lon": lon},
            "timestamp": datetime.now(timezone.utc),
            "user_id": user["_id"],
        })

        def update_scores():
            try:
                rescore(lon, lat, incident_type)
            except Exception as exc:
                print("Error updating graph in background:", exc)

        run_later(update_scores)

        contact = (user.get("emergency_contact") or {}).get("email")
        emailed = bool(send_email(contact, "Emergency Report", alert_body(transcript, lat, lon)))

        return jsonify({
            "incident_type": incident_type,
            "location": {"lat": lat, "lon": lon},
            "contact_notified": emailed,
            "status": "Report received and processing in background",
        })

    return bp

"""Incident classification for spoken safety reports.

The classifier asks Gemini, through the google-genai SDK, to score a
transcript against the known Oakland crime categories and return JSON that
matches a fixed schema. The model name comes from the GEMINI_MODEL setting.

When no GOOGLE_API_KEY is set, or the Gemini call fails or returns something
that is not valid JSON, the transcript is classified with the offline keyword
rules in keyword_classifier instead.
"""
import json
import os

import config  # noqa: F401  (loads backend/.env before the settings are read)
from keyword_classifier import keyword_category

DEFAULT_GEMINI_MODEL = "gemini-3.1-flash-lite"
UNKNOWN = "UNKNOWN"

CRIME_CATEGORIES = (
    "FELONY ASSAULT", "PETTY THEFT", "BURG - RESIDENTIAL", "MISDEMEANOR ASSAULT", "ARSON",
    "BURG - AUTO", "DUI", "VANDALISM", "GRAND THEFT", "STOLEN VEHICLE", "WEAPONS", "FRAUD",
    "OTHER", "DISORDERLY CONDUCT", "BURG - COMMERCIAL", "FELONY WARRANT", "THREATS",
    "POSSESSION - STOLEN PROPERTY", "ROBBERY", "RECOVERED O/S STOLEN", "DOMESTIC VIOLENCE",
    "NARCOTICS", "KIDNAPPING", "FORGERY & COUNTERFEITING", "FORCIBLE RAPE", "HOMICIDE",
    "STOLEN AND RECOVERED VEHICLE", "CURFEW & LOITERING", "OTHER SEX OFFENSES", "BRANDISHING",
    "CHILD ABUSE", "BURG - OTHER", "MISCELLANEOUS TRAFFIC CRIME", "EMBEZZLEMENT",
    "RECOVERED VEHICLE - OAKLAND STOLEN", "GAMBLING", "PROSTITUTION",
    "ENVIRONMENTAL CRIME", "MISDEMEANOR WARRANT",
)

# JSON schema the model must follow. The enum keeps answers inside the
# category list, so the result can be used without any cleanup.
RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "matches": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "category": {"type": "string", "enum": list(CRIME_CATEGORIES)},
                    "confidence": {"type": "number", "minimum": 0, "maximum": 1},
                },
                "required": ["category", "confidence"],
            },
        },
    },
    "required": ["matches"],
}

PROMPT_TEMPLATE = """You classify spoken safety reports from people walking in Oakland.
Pick every crime category that fits the transcript below and give each one a
confidence between 0 and 1. Return an empty list if none of them fit.

Transcript:
{transcript}
"""

_client = None


def gemini_model():
    return os.getenv("GEMINI_MODEL", "").strip() or DEFAULT_GEMINI_MODEL


def _default_client():
    """Build the Gemini client once, or return None when no key is set."""
    global _client
    if _client is None:
        api_key = os.getenv("GOOGLE_API_KEY", "").strip()
        if not api_key:
            return None
        from google import genai

        _client = genai.Client(api_key=api_key)
    return _client


def parse_matches(payload):
    """Return the best category from the model's JSON reply, or UNKNOWN.

    Anything outside the category list or the 0 to 1 range is ignored, so a
    malformed reply can never put an unexpected label into the database.
    """
    if isinstance(payload, str):
        try:
            payload = json.loads(payload)
        except json.JSONDecodeError:
            return UNKNOWN
    if not isinstance(payload, dict):
        return UNKNOWN

    best, best_score = UNKNOWN, -1.0
    for match in payload.get("matches") or []:
        if not isinstance(match, dict):
            continue
        category = match.get("category")
        score = match.get("confidence")
        if category not in CRIME_CATEGORIES or isinstance(score, bool):
            continue
        if not isinstance(score, (int, float)) or not 0 <= score <= 1:
            continue
        if score > best_score:
            best, best_score = category, float(score)
    return best


def _is_json_reply(text):
    try:
        return isinstance(json.loads(text), dict)
    except (TypeError, ValueError):
        return False


def classify_incident(transcript: str, client=None) -> str:
    """Return the most likely crime category for a transcript.

    Gemini is used when a key is configured. When it is not, or the call
    fails, or the reply is not a JSON object, the keyword rules decide.
    A valid Gemini reply that names no known category stays UNKNOWN, since
    the model has already judged that nothing fits.
    """
    if not transcript or not transcript.strip():
        return UNKNOWN

    client = client or _default_client()
    if client is None:
        print("GOOGLE_API_KEY is not set, so the report was classified with keywords.")
        return keyword_category(transcript)

    from google.genai import types

    try:
        response = client.models.generate_content(
            model=gemini_model(),
            contents=PROMPT_TEMPLATE.format(transcript=transcript.strip()),
            config=types.GenerateContentConfig(
                temperature=0,
                response_mime_type="application/json",
                response_json_schema=RESPONSE_SCHEMA,
            ),
        )
        text = response.text or ""
    except Exception as error:  # network errors, quota limits, bad keys
        print("Gemini classification failed, so keywords were used instead:", error)
        return keyword_category(transcript)

    if not _is_json_reply(text):
        print("Gemini returned a reply that is not JSON, so keywords were used instead.")
        return keyword_category(transcript)

    return parse_matches(text)

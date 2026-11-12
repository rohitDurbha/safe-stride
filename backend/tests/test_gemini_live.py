"""Live smoke test that sends one sample report to the real Gemini API.

It is skipped by default (pytest.ini deselects the live marker) and when
GOOGLE_API_KEY is not set. Run it with

    python -m pytest -m live

CI runs it with the GOOGLE_API_KEY repository secret. It calls the request
helper directly instead of classify_incident, so a bad key, a retired model
name or a quota error fails the test instead of quietly using the keyword
fallback.
"""
import json
import os

import pytest

import report_classifier as rc

pytestmark = pytest.mark.live

SAMPLE_REPORT = (
    "A man pulled out a knife near the bus stop on Telegraph Avenue "
    "and took my phone before running off."
)

# Any of these is a sensible reading of the sample report.
EXPECTED = {"ROBBERY", "WEAPONS", "BRANDISHING", "FELONY ASSAULT", "GRAND THEFT", "PETTY THEFT"}


@pytest.fixture
def live_client():
    api_key = os.getenv("GOOGLE_API_KEY", "").strip()
    if not api_key:
        pytest.skip("GOOGLE_API_KEY is not set, so the live Gemini check was skipped.")
    from google import genai

    return genai.Client(api_key=api_key)


def test_gemini_classifies_a_sample_report(live_client):
    text = rc.request_gemini_reply(SAMPLE_REPORT, live_client)

    payload = json.loads(text)
    assert isinstance(payload.get("matches"), list), text

    category = rc.parse_matches(payload)
    print(f"Gemini model {rc.gemini_model()} classified the sample report as {category}")
    assert category in EXPECTED, text

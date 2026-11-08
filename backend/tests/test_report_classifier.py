import json

import pytest

import report_classifier as rc


class FakeResponse:
    def __init__(self, text):
        self.text = text


class FakeModels:
    def __init__(self, reply=None, error=None):
        self.reply = reply
        self.error = error
        self.calls = []

    def generate_content(self, **kwargs):
        self.calls.append(kwargs)
        if self.error:
            raise self.error
        return FakeResponse(self.reply)


class FakeClient:
    def __init__(self, reply=None, error=None):
        self.models = FakeModels(reply, error)


def reply(*matches):
    return json.dumps({"matches": [{"category": c, "confidence": s} for c, s in matches]})


def test_returns_the_highest_confidence_category():
    client = FakeClient(reply(("PETTY THEFT", 0.4), ("ROBBERY", 0.9), ("THREATS", 0.6)))
    assert rc.classify_incident("someone grabbed my bag and ran", client=client) == "ROBBERY"


def test_requests_json_output_that_follows_the_schema(monkeypatch):
    monkeypatch.setenv("GEMINI_MODEL", "gemini-test-model")
    client = FakeClient(reply(("VANDALISM", 0.8)))

    rc.classify_incident("a car window was smashed", client=client)

    call = client.models.calls[0]
    assert call["model"] == "gemini-test-model"
    assert "a car window was smashed" in call["contents"]
    assert call["config"].response_mime_type == "application/json"
    assert call["config"].response_json_schema == rc.RESPONSE_SCHEMA
    assert call["config"].temperature == 0


def test_model_defaults_to_the_free_tier_flash_model(monkeypatch):
    monkeypatch.delenv("GEMINI_MODEL", raising=False)
    assert rc.gemini_model() == rc.DEFAULT_GEMINI_MODEL


def test_schema_only_allows_known_categories():
    item = rc.RESPONSE_SCHEMA["properties"]["matches"]["items"]
    enum = item["properties"]["category"]["enum"]
    assert enum == list(rc.CRIME_CATEGORIES)
    assert "INCIDENT TYPE" not in enum


def test_api_errors_return_unknown():
    client = FakeClient(error=RuntimeError("quota exceeded"))
    assert rc.classify_incident("someone is following me", client=client) == rc.UNKNOWN


def test_missing_api_key_skips_the_call(monkeypatch):
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)
    monkeypatch.setattr(rc, "_client", None)
    assert rc.classify_incident("someone is following me") == rc.UNKNOWN


def test_blank_transcript_is_not_sent():
    client = FakeClient(reply(("ROBBERY", 0.9)))
    assert rc.classify_incident("   ", client=client) == rc.UNKNOWN
    assert client.models.calls == []


@pytest.mark.parametrize(
    "payload",
    [
        "not json at all",
        "[]",
        json.dumps({"matches": []}),
        json.dumps({"matches": [{"category": "ALIEN ABDUCTION", "confidence": 0.99}]}),
        json.dumps({"matches": [{"category": "ROBBERY", "confidence": 1.7}]}),
        json.dumps({"matches": [{"category": "ROBBERY", "confidence": "high"}]}),
        json.dumps({"matches": [{"category": "ROBBERY", "confidence": True}]}),
        json.dumps({"matches": ["ROBBERY"]}),
    ],
)
def test_malformed_replies_return_unknown(payload):
    assert rc.parse_matches(payload) == rc.UNKNOWN


def test_invalid_entries_are_skipped_but_valid_ones_still_count():
    payload = {
        "matches": [
            {"category": "MADE UP", "confidence": 0.99},
            {"category": "ARSON", "confidence": 0.7},
            {"category": "FRAUD", "confidence": 2},
        ]
    }
    assert rc.parse_matches(payload) == "ARSON"

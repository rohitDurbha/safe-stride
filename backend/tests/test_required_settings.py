import pytest

import config

GOOD = {"MONGO_URI": "mongodb+srv://u:p@example.net/db", "SECRET_KEY": "a-long-random-signing-secret"}


def test_nothing_missing_when_all_required_values_are_set():
    assert config.missing_settings(GOOD) == []
    config.check_required_settings(GOOD)


def test_blank_values_count_as_missing():
    assert config.missing_settings({"MONGO_URI": "  ", "SECRET_KEY": ""}) == ["MONGO_URI", "SECRET_KEY"]


def test_error_lists_every_missing_variable_at_once():
    with pytest.raises(RuntimeError) as err:
        config.check_required_settings({})
    message = str(err.value)
    assert "MONGO_URI" in message
    assert "SECRET_KEY" in message
    assert "backend/.env.example" in message


@pytest.mark.parametrize("weak", ["dev_key", "DEV_KEY", "changeme", " secret "])
def test_placeholder_secret_keys_are_rejected(weak):
    with pytest.raises(RuntimeError, match="placeholder"):
        config.check_required_settings({**GOOD, "SECRET_KEY": weak})


def test_secret_key_is_trimmed():
    assert config.get_secret_key({"SECRET_KEY": "  abc123xyz  "}) == "abc123xyz"


def test_jwt_expiration_defaults_to_one_hour():
    assert config.get_jwt_expiration({}) == 3600
    assert config.get_jwt_expiration({"JWT_EXPIRATION": ""}) == 3600


def test_jwt_expiration_reads_custom_value():
    assert config.get_jwt_expiration({"JWT_EXPIRATION": "900"}) == 900


@pytest.mark.parametrize("bad", ["soon", "-5", "0", "1.5"])
def test_invalid_jwt_expiration_raises(bad):
    with pytest.raises(RuntimeError, match="JWT_EXPIRATION"):
        config.get_jwt_expiration({"JWT_EXPIRATION": bad})


def test_check_reads_process_environment_by_default(monkeypatch):
    monkeypatch.setenv("MONGO_URI", GOOD["MONGO_URI"])
    monkeypatch.delenv("SECRET_KEY", raising=False)
    assert config.missing_settings() == ["SECRET_KEY"]

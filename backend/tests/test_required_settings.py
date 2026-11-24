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


def test_cors_allows_every_origin_when_unset():
    assert config.get_cors_origins({}) == "*"
    assert config.get_cors_origins({"CORS_ORIGINS": " , "}) == "*"


def test_cors_reads_a_comma_separated_list_without_trailing_slashes():
    assert config.get_cors_origins(
        {"CORS_ORIGINS": "https://safe-stride.vercel.app/, http://localhost:8080"}
    ) == ["https://safe-stride.vercel.app", "http://localhost:8080"]


def test_cors_origins_allow_the_frontend_and_its_previews_only():
    from flask import Flask
    from flask_cors import CORS

    origins = config.get_cors_origins(
        {"CORS_ORIGINS": r"https://safe-stride.vercel.app,https://safe-stride-[a-z0-9-]+\.vercel\.app$"}
    )
    app = Flask("cors_check")
    CORS(app, resources={r"/*": {"origins": origins}}, supports_credentials=True)
    app.add_url_rule("/home", "home", lambda: "ok")
    client = app.test_client()

    def allowed(origin):
        return client.get("/home", headers={"Origin": origin}).headers.get("Access-Control-Allow-Origin")

    assert allowed("https://safe-stride.vercel.app") == "https://safe-stride.vercel.app"
    assert allowed("https://safe-stride-git-main-rohit.vercel.app") is not None
    assert allowed("https://safe-stride-x.vercel.app.evil.com") is None
    assert allowed("https://evil.com") is None

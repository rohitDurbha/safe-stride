"""Route tests for sign up, log in, profile and incident reports.

These run the real blueprints against small in-memory collections, so no
MongoDB, SMTP server or street graph is needed.
"""
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import jwt
import pytest
from bson.objectid import ObjectId
from flask import Flask

from accounts import TokenSigner, create_accounts_blueprint
from reports import create_reports_blueprint

SECRET = "test-secret-that-is-long-enough-for-hs256"


class FakeCollection:
    def __init__(self):
        self.docs = []

    @staticmethod
    def _matches(doc, query):
        return all(doc.get(k) == v for k, v in query.items())

    def find_one(self, query):
        return next((dict(d) for d in self.docs if self._matches(d, query)), None)

    def insert_one(self, doc):
        doc = dict(doc)
        doc.setdefault("_id", ObjectId())
        self.docs.append(doc)
        return SimpleNamespace(inserted_id=doc["_id"])

    def update_one(self, query, update):
        for doc in self.docs:
            if self._matches(doc, query):
                doc.update(update["$set"])
                return


@pytest.fixture
def env():
    db = SimpleNamespace(users=FakeCollection(), incident_reports=FakeCollection())
    mail, rescored = [], []
    signer = TokenSigner(SECRET, 3600)

    def send_email(to, subject, body):
        mail.append((to, subject, body))
        return bool(to)

    app = Flask(__name__)
    app.register_blueprint(create_accounts_blueprint(db.users, signer, send_email))
    app.register_blueprint(create_reports_blueprint(
        db, signer,
        classify=lambda text: "ASSAULT",
        rescore=lambda lon, lat, kind: rescored.append((lon, lat, kind)),
        send_email=send_email,
        run_later=lambda task: task(),
    ))
    return SimpleNamespace(client=app.test_client(), db=db, mail=mail, rescored=rescored, signer=signer)


def sign_up(client, email="ana@example.com", password="pw-123456", contact_email="kim@example.com"):
    return client.post("/signup", json={
        "email": email, "password": password, "name": "Ana",
        "emergency_contact": {"name": "Kim", "email": contact_email},
    })


def auth(token):
    return {"Authorization": f"Bearer {token}"}


def test_signup_then_login_and_me(env):
    res = sign_up(env.client)
    assert res.status_code == 200
    assert env.mail[0][0] == "kim@example.com"

    res = env.client.post("/login", json={"email": "ana@example.com", "password": "pw-123456"})
    assert res.status_code == 200
    token = res.get_json()["token"]

    res = env.client.get("/me", headers=auth(token))
    assert res.status_code == 200
    assert res.get_json()["email"] == "ana@example.com"


def test_login_with_unknown_email_is_401_not_a_crash(env):
    res = env.client.post("/login", json={"email": "nobody@example.com", "password": "x"})
    assert res.status_code == 401
    assert res.get_json() == {"error": "Invalid credentials"}


def test_login_with_wrong_password_is_401(env):
    sign_up(env.client)
    res = env.client.post("/login", json={"email": "ana@example.com", "password": "nope"})
    assert res.status_code == 401


@pytest.mark.parametrize("body", [{}, {"email": "a@b.c"}, {"password": "x"}, None, "text"])
def test_login_with_missing_fields_is_400(env, body):
    if body is None:
        res = env.client.post("/login", data="not json", content_type="application/json")
    else:
        res = env.client.post("/login", json=body)
    assert res.status_code == 400


@pytest.mark.parametrize("body", [
    {},
    {"email": "a@b.c", "password": "x"},
    {"email": "a@b.c", "password": "x", "emergency_contact": {"name": "Kim"}},
    {"email": "a@b.c", "emergency_contact": {"name": "Kim", "email": "k@b.c"}},
])
def test_signup_rejects_missing_fields(env, body):
    assert env.client.post("/signup", json=body).status_code == 400
    assert env.db.users.docs == []


def test_signup_twice_is_409(env):
    sign_up(env.client)
    assert sign_up(env.client).status_code == 409


@pytest.mark.parametrize("headers", [
    {},
    {"Authorization": "Token abc"},
    {"Authorization": "Bearer not-a-real-token"},
    {"Authorization": "Bearer " + jwt.encode({"user_id": "x"}, "another-secret-long-enough-for-hs256", algorithm="HS256")},
])
def test_me_rejects_bad_tokens_with_401(env, headers):
    assert env.client.get("/me", headers=headers).status_code == 401


def test_me_rejects_expired_and_unknown_user_tokens(env):
    expired = env.signer.issue(ObjectId(), now=datetime.now(timezone.utc) - timedelta(days=2))
    assert env.client.get("/me", headers=auth(expired)).status_code == 401
    ghost = env.signer.issue(ObjectId())
    assert env.client.get("/me", headers=auth(ghost)).status_code == 401
    not_an_id = env.signer.issue("not-an-object-id")
    assert env.client.get("/me", headers=auth(not_an_id)).status_code == 401


def test_add_user_route_is_gone(env):
    assert env.client.post("/add_user", json={"email": "x"}).status_code == 404


def test_update_profile_needs_a_token_and_blocks_taken_emails(env):
    token = sign_up(env.client).get_json()["token"]
    sign_up(env.client, email="other@example.com")
    contact = {"name": "Lee", "email": "lee@example.com"}

    assert env.client.put("/update_profile", json={"email": "x@y.z", "emergency_contact": contact}).status_code == 401
    res = env.client.put("/update_profile", headers=auth(token),
                         json={"email": "other@example.com", "emergency_contact": contact})
    assert res.status_code == 409

    res = env.client.put("/update_profile", headers=auth(token),
                         json={"email": "ana2@example.com", "emergency_contact": contact})
    assert res.status_code == 200
    stored = env.db.users.find_one({"email": "ana2@example.com"})
    assert stored["emergency_contact"] == contact


def test_report_needs_a_token(env):
    res = env.client.post("/report_audio", json={"transcript": "help", "lat": 37.8, "lon": -122.27})
    assert res.status_code == 401
    assert env.db.incident_reports.docs == []
    assert env.mail == []


def test_report_alerts_the_reporters_own_contact(env):
    token = sign_up(env.client).get_json()["token"]
    sign_up(env.client, email="bo@example.com", contact_email="bo-contact@example.com")
    env.mail.clear()

    res = env.client.post("/report_audio", headers=auth(token),
                          json={"transcript": "someone grabbed my bag", "lat": 37.8, "lon": -122.27,
                                "emergency_contact": "attacker@example.com"})
    assert res.status_code == 200
    body = res.get_json()
    assert body["incident_type"] == "ASSAULT"
    assert body["contact_notified"] is True

    assert [m[0] for m in env.mail] == ["kim@example.com"]
    assert env.rescored == [(-122.27, 37.8, "ASSAULT")]
    report = env.db.incident_reports.docs[0]
    assert report["location"] == {"lat": 37.8, "lon": -122.27}
    assert report["user_id"] == env.db.users.find_one({"email": "ana@example.com"})["_id"]


@pytest.mark.parametrize("body", [
    {},
    {"transcript": "   ", "lat": 37.8, "lon": -122.27},
    {"transcript": "help", "lat": "north", "lon": -122.27},
    {"transcript": "help", "lat": 137.8, "lon": -122.27},
    {"transcript": "help", "lat": 37.8},
    {"transcript": "help", "lat": True, "lon": -122.27},
])
def test_report_rejects_bad_input(env, body):
    token = sign_up(env.client).get_json()["token"]
    res = env.client.post("/report_audio", headers=auth(token), json=body)
    assert res.status_code == 400
    assert env.db.incident_reports.docs == []


def test_report_trims_long_transcripts(env):
    token = sign_up(env.client).get_json()["token"]
    env.client.post("/report_audio", headers=auth(token),
                    json={"transcript": "a" * 5000, "lat": 37.8, "lon": -122.27})
    assert len(env.db.incident_reports.docs[0]["transcript"]) == 2000

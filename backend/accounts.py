"""Sign up, log in and profile routes, plus the login token helpers.

The routes live in a blueprint built from its collaborators, so tests can
pass a fake users collection and mailer instead of MongoDB and SMTP.
"""
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from bson.objectid import ObjectId
from bson.errors import InvalidId
from flask import Blueprint, jsonify, request


class TokenSigner:
    """Issue and check the HS256 login tokens the frontend sends back."""

    def __init__(self, secret_key, expiration_seconds):
        self.secret_key = secret_key
        self.expiration_seconds = expiration_seconds

    def issue(self, user_id, now=None):
        now = now or datetime.now(timezone.utc)
        payload = {"user_id": str(user_id), "exp": now + timedelta(seconds=self.expiration_seconds)}
        return jwt.encode(payload, self.secret_key, algorithm="HS256")

    def user_id(self, token):
        """Return the user id inside a valid token, or None for any bad token."""
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=["HS256"])
        except jwt.InvalidTokenError:
            return None
        return payload.get("user_id")


def hash_password(password):
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())


def check_password(password, hashed):
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed)
    except (TypeError, ValueError):
        return False


def json_body():
    """The request JSON as a dict, or an empty dict for a missing or bad body."""
    data = request.get_json(silent=True)
    return data if isinstance(data, dict) else {}


def text_field(data, name):
    value = data.get(name)
    return value.strip() if isinstance(value, str) else ""


def valid_contact(contact):
    return isinstance(contact, dict) and text_field(contact, "name") and text_field(contact, "email")


def unauthorized(message):
    return jsonify({"error": message}), 401


def current_user(users, signer):
    """Return (user, None) for the token's user, or (None, error response)."""
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return None, unauthorized("Authorization header missing or invalid")
    user_id = signer.user_id(header[len("Bearer "):].strip())
    if not user_id:
        return None, unauthorized("Invalid or expired token")
    try:
        user = users.find_one({"_id": ObjectId(user_id)})
    except InvalidId:
        user = None
    if not user:
        return None, unauthorized("User not found")
    return user, None


def public_profile(user):
    """What the signed in user may read about their own account."""
    contact = user.get("emergency_contact") or {}
    return {
        "id": str(user["_id"]),
        "email": user.get("email", ""),
        "name": user.get("name") or "",
        "emergency_contact": {"name": contact.get("name", ""), "email": contact.get("email", "")},
    }


def create_accounts_blueprint(users, signer, send_email):
    bp = Blueprint("accounts", __name__)

    @bp.route("/signup", methods=["POST"])
    def signup():
        data = json_body()
        email = text_field(data, "email")
        password = data.get("password")
        name = text_field(data, "name")
        contact = data.get("emergency_contact")

        if not email or not isinstance(password, str) or not password:
            return jsonify({"error": "Email and password are required"}), 400
        if not valid_contact(contact):
            return jsonify({"error": "Emergency contact info required"}), 400
        if users.find_one({"email": email}):
            return jsonify({"error": "User already exists"}), 409

        contact = {"name": text_field(contact, "name"), "email": text_field(contact, "email")}
        result = users.insert_one({
            "email": email,
            "password_hash": hash_password(password),
            "created_at": datetime.now(timezone.utc),
            "name": name,
            "emergency_contact": contact,
        })

        body = (
            f"Hello {contact['name']},\n\n"
            f"You have been listed as an emergency contact for a new Safe Stride user ({name or email}).\n"
            "You will be notified if your contact submits an emergency report from our app.\n\n"
            "Regards,\n"
            "Safe Stride Safety Team"
        )
        send_email(contact["email"], "You are an emergency contact for a new Safe Stride user", body)
        return jsonify({"token": signer.issue(result.inserted_id)})

    @bp.route("/login", methods=["POST"])
    def login():
        data = json_body()
        email = text_field(data, "email")
        password = data.get("password")
        if not email or not isinstance(password, str) or not password:
            return jsonify({"error": "Email and password are required"}), 400

        user = users.find_one({"email": email})
        if not user or not check_password(password, user.get("password_hash")):
            return unauthorized("Invalid credentials")
        return jsonify({"token": signer.issue(user["_id"])})

    @bp.route("/me", methods=["GET"])
    def me():
        user, error = current_user(users, signer)
        if error:
            return error
        return jsonify(public_profile(user))

    @bp.route("/update_profile", methods=["PUT"])
    def update_profile():
        user, error = current_user(users, signer)
        if error:
            return error

        data = json_body()
        email = text_field(data, "email")
        contact = data.get("emergency_contact")
        if not email or not valid_contact(contact):
            return jsonify({"error": "Missing required fields"}), 400

        other = users.find_one({"email": email})
        if other and other["_id"] != user["_id"]:
            return jsonify({"error": "Another account already uses that email"}), 409

        users.update_one(
            {"_id": user["_id"]},
            {"$set": {
                "email": email,
                "emergency_contact": {"name": text_field(contact, "name"), "email": text_field(contact, "email")},
            }},
        )
        return jsonify({"message": "Profile updated successfully"})

    return bp

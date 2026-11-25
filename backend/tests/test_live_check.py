import importlib.util
import json
import sys
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[2] / ".github" / "scripts" / "live_check.py"
spec = importlib.util.spec_from_file_location("live_check", SCRIPT)
live_check = importlib.util.module_from_spec(spec)
# Dataclasses look their module up by name, so register it before running it.
sys.modules["live_check"] = live_check
spec.loader.exec_module(live_check)

Response = live_check.Response


def check_named(name):
    return next(c for c in live_check.CHECKS if c.name == name)


def test_wrong_status_fails_with_the_reply():
    check = check_named("login with an unknown email")
    problem = live_check.evaluate(check, Response(500, b"Internal Server Error"))
    assert "answered 500, expected 401" in problem
    assert "Internal Server Error" in problem


def test_expected_status_passes():
    check = check_named("unauthenticated add_user route is gone")
    assert live_check.evaluate(check, Response(404, b"")) is None
    assert live_check.evaluate(check, Response(405, b"")) is None


def test_route_needs_points():
    check = check_named("route")
    good = Response(200, json.dumps({"route": [[1, 2], [3, 4]]}).encode())
    assert live_check.evaluate(check, good) is None
    assert live_check.evaluate(check, Response(200, b'{"route": []}')) == "no route points in the reply"
    assert live_check.evaluate(check, Response(200, b"not json")) == "no route points in the reply"


def test_page_needs_the_app_root():
    check = check_named("home page")
    assert live_check.evaluate(check, Response(200, b'<div id="root"></div>')) is None
    assert live_check.evaluate(check, Response(200, b"<html></html>")) == "page has no app root"


def test_every_check_is_read_only_or_rejected():
    # Writes only go to routes that must refuse them without a token or fields.
    for check in live_check.CHECKS:
        if check.method != "GET":
            assert check.expect and all(400 <= s < 500 for s in check.expect), check.name


def test_run_reports_each_failure(capsys):
    def fetcher(base, check):
        return Response(200, b'<div id="root">') if check.path == "/" else Response(500, b"boom")

    checks = [check_named("home page"), check_named("profile without a token")]
    results = live_check.run("https://example.test", checks, fetcher)
    assert [problem is None for _, problem in results] == [True, False]
    out = capsys.readouterr().out
    assert "ok   GET  /" in out and "FAIL GET  /api/me" in out

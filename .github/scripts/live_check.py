"""Probe the live SafeStride site and report every endpoint that misbehaves.

Run it with the site address, for example

    python .github/scripts/live_check.py https://safe-stride-seven.vercel.app

Every request is read only or is rejected before it can write anything, so
the check is safe to run against the production database at any time. The
script prints one line per check and exits with status 1 when any fails.
"""

from __future__ import annotations

import json
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from typing import Callable

ROUTE_QUERY = "start_lat=37.8044&start_lon=-122.2712&end_lat=37.8100&end_lon=-122.2620&period=day"


@dataclass
class Response:
    status: int
    body: bytes
    seconds: float = 0.0

    def json(self):
        try:
            return json.loads(self.body or b"null")
        except ValueError:
            return None


@dataclass
class Check:
    name: str
    method: str
    path: str
    expect: tuple[int, ...]
    body: object = None
    headers: dict = field(default_factory=dict)
    content: Callable[[Response], str | None] | None = None
    timeout: float = 30


def has_app_shell(resp: Response) -> str | None:
    return None if b'<div id="root">' in resp.body else "page has no app root"


def has_route(resp: Response) -> str | None:
    data = resp.json() or {}
    points = data.get("route") if isinstance(data, dict) else None
    return None if points and len(points) >= 2 else "no route points in the reply"


def is_list(resp: Response) -> str | None:
    return None if isinstance(resp.json(), list) else "reply is not a JSON list"


CHECKS = [
    Check("home page", "GET", "/", (200,), content=has_app_shell),
    Check("login page", "GET", "/login", (200,), content=has_app_shell),
    Check("route", "GET", f"/api/safe_path?{ROUTE_QUERY}", (200,), content=has_route, timeout=300),
    Check("heatmap", "GET", "/api/heatmap_data", (200,), content=is_list, timeout=120),
    Check("login with an unknown email", "POST", "/api/login", (401,),
          body={"email": "nobody-live-check@example.invalid", "password": "wrong"}),
    Check("login with an empty body", "POST", "/api/login", (400, 401), body={}),
    Check("signup with no fields", "POST", "/api/signup", (400,), body={}),
    Check("profile without a token", "GET", "/api/me", (401,)),
    Check("profile with a malformed token", "GET", "/api/me", (401,),
          headers={"Authorization": "Bearer not-a-real-token"}),
    Check("profile update without a token", "PUT", "/api/update_profile", (401,), body={}),
    Check("incident report without a token", "POST", "/api/report_audio", (401,), body={}),
    Check("unauthenticated add_user route is gone", "POST", "/api/add_user", (404, 405), body={}),
]


def fetch(base: str, check: Check) -> Response:
    data = None
    headers = dict(check.headers)
    if check.body is not None:
        data = json.dumps(check.body).encode()
        headers.setdefault("Content-Type", "application/json")
    req = urllib.request.Request(base.rstrip("/") + check.path, data=data,
                                 method=check.method, headers=headers)
    start = time.monotonic()
    try:
        with urllib.request.urlopen(req, timeout=check.timeout) as res:
            return Response(res.status, res.read(), time.monotonic() - start)
    except urllib.error.HTTPError as err:
        return Response(err.code, err.read(), time.monotonic() - start)
    except (urllib.error.URLError, TimeoutError, OSError) as err:
        return Response(0, str(err).encode(), time.monotonic() - start)


def evaluate(check: Check, resp: Response) -> str | None:
    """Return why the check failed, or None when it passed."""
    if resp.status not in check.expect:
        wanted = " or ".join(str(s) for s in check.expect)
        snippet = resp.body[:200].decode("utf-8", "replace").strip()
        return f"answered {resp.status}, expected {wanted}: {snippet}"
    if check.content:
        return check.content(resp)
    return None


def run(base: str, checks=CHECKS, fetcher=fetch) -> list[tuple[Check, str | None]]:
    results = []
    for check in checks:
        resp = fetcher(base, check)
        problem = evaluate(check, resp)
        mark = "ok  " if problem is None else "FAIL"
        print(f"{mark} {check.method:<4} {check.path.split('?')[0]:<22} {resp.status} "
              f"{resp.seconds:5.1f}s  {check.name}" + (f"  ({problem})" if problem else ""))
        results.append((check, problem))
    return results


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print("usage: live_check.py SITE_URL", file=sys.stderr)
        return 2
    results = run(argv[1])
    failed = [c.name for c, problem in results if problem]
    print(f"{len(results) - len(failed)} of {len(results)} checks passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))

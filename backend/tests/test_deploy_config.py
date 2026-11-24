"""Guards on the Vercel setup, so a config edit cannot leak files or
send API calls to the frontend."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def vercel_config():
    return json.loads((ROOT / "vercel.json").read_text(encoding="utf-8"))


def test_api_requests_reach_the_python_function_before_the_spa_fallback():
    rewrites = vercel_config()["rewrites"]
    assert rewrites[0] == {"source": "/api/(.*)", "destination": "/api/index"}
    assert rewrites[-1]["destination"] == "/index.html"


def test_function_ships_the_backend_but_not_its_tests():
    fn = vercel_config()["functions"]["api/index.py"]
    assert fn["includeFiles"] == "backend/**"
    assert "backend/tests" in fn["excludeFiles"]


def test_env_files_are_never_uploaded():
    ignored = (ROOT / ".vercelignore").read_text(encoding="utf-8").splitlines()
    for pattern in (".env", ".env.*", "backend/.env", "backend/.env.*"):
        assert pattern in ignored


def packages(path):
    return [
        line.strip()
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.startswith("#")
    ]


def test_root_requirements_match_the_backend_runtime_packages():
    # Vercel cannot follow "-r" includes, so the root file repeats the list.
    assert packages(ROOT / "requirements.txt") == packages(ROOT / "backend" / "requirements.txt")


def test_runtime_requirements_leave_out_the_heavy_graph_builders():
    runtime = (ROOT / "backend" / "requirements.txt").read_text(encoding="utf-8").lower()
    for heavy in ("osmnx", "geopandas", "pandas", "gunicorn"):
        assert f"\n{heavy}\n" not in f"\n{runtime}\n"

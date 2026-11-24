import importlib.util
import json
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[2] / ".github" / "scripts" / "probe_report.py"
spec = importlib.util.spec_from_file_location("probe_report", SCRIPT)
probe_report = importlib.util.module_from_spec(spec)
spec.loader.exec_module(probe_report)


def test_counts_probes_for_secret_files_and_admin_pages():
    lines = [
        json.dumps({"requestPath": "/.env", "responseStatusCode": 200}),
        json.dumps({"requestPath": "/.env", "responseStatusCode": 200}),
        json.dumps({"path": "/wp-login.php", "statusCode": 200}),
        json.dumps({"requestPath": "/backend/.git/config?x=1", "responseStatusCode": 200}),
        json.dumps({"requestPath": "/api/safe_path", "responseStatusCode": 200}),
        json.dumps({"requestPath": "/login", "responseStatusCode": 200}),
        "not json",
    ]
    total, hits = probe_report.summarise(lines)
    assert total == 6
    assert hits[("/.env", "200")] == 2
    assert hits[("/wp-login.php", "200")] == 1
    assert hits[("/backend/.git/config", "200")] == 1
    assert sum(hits.values()) == 4


def test_ordinary_pages_are_not_probes():
    for path in ("/", "/login", "/heatmap", "/api/me", "/assets/index-abc.js", "/environment"):
        assert not probe_report.PROBE.search(path), path

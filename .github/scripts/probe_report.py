"""Summarise requests for paths that only bots scanning for leaks ask for.

Reads `vercel logs --json` output (JSON Lines) and prints how often each
suspicious path was requested and what status the site answered.
"""
import json
import re
import sys
from collections import Counter

PROBE = re.compile(
    r"(^|/)\.(env|git|aws|ssh|DS_Store|htaccess|vscode)|wp-(admin|login|content)|\.php\b"
    r"|phpmyadmin|/config\.(json|ya?ml|js)$|/backup|\.sql\b|/server-status",
    re.IGNORECASE,
)


def path_of(entry):
    for key in ("requestPath", "path", "url"):
        value = entry.get(key)
        if isinstance(value, str) and value:
            return re.sub(r"^https?://[^/]+", "", value).split("?")[0]
    return ""


def status_of(entry):
    for key in ("responseStatusCode", "statusCode", "status"):
        if entry.get(key) is not None:
            return str(entry[key])
    return "?"


def summarise(lines):
    hits = Counter()
    total = 0
    for line in lines:
        line = line.strip()
        if not line.startswith("{"):
            continue
        try:
            entry = json.loads(line)
        except ValueError:
            continue
        total += 1
        path = path_of(entry)
        if path and PROBE.search(path):
            hits[(path, status_of(entry))] += 1
    return total, hits


def main(argv):
    with open(argv[1], encoding="utf-8", errors="replace") as fh:
        total, hits = summarise(fh)
    print(f"Read {total} request log entries.")
    if not hits:
        print("No requests for secret files or admin pages.")
        return 0
    print(f"{sum(hits.values())} probing requests:")
    for (path, status), count in hits.most_common():
        print(f"  {count:4d}  {status}  {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))

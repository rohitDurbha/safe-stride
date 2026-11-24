"""Push the backend to a Hugging Face Docker Space and wait until it answers.

The GitHub Actions workflow in .github/workflows/deploy-backend.yml runs

    python deploy_space.py deploy     # create the Space, set secrets, upload
    python deploy_space.py wait       # poll until /home answers or the build fails
    python deploy_space.py url        # print the Space URL for the frontend build

It reads HF_TOKEN plus the app settings from the environment, so no key is
ever written to the repository.
"""
import os
import shutil
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent
DEFAULT_SPACE_NAME = "safe-stride"

# Settings copied into the Space as secrets. The server refuses to start
# without the required ones, so the deploy stops early when they are missing.
REQUIRED_SECRETS = ("MONGO_URI", "SECRET_KEY")
OPTIONAL_SECRETS = ("GOOGLE_API_KEY", "SMTP_USER", "SMTP_PASSWORD")
# Plain settings that are safe to show in the Space settings page.
SPACE_VARIABLES = ("CORS_ORIGINS", "GEMINI_MODEL")

# Files the Space does not need.
SKIP_NAMES = {".env", "__pycache__", ".pytest_cache", "cache", "tests", "deploy_space.py"}

SPACE_CARD = """---
title: SafeStride API
emoji: 🚶
colorFrom: green
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
---

Flask backend for [SafeStride](https://github.com/rohitDurbha/safe-stride), a
walking route planner that steers around reported crime in Oakland. This Space
is deployed automatically from the GitHub repository, so edit the code there.
"""


def missing_required(environ):
    return [name for name in ("HF_TOKEN",) + REQUIRED_SECRETS if not environ.get(name, "").strip()]


def space_host(repo_id):
    """Return the hostname Hugging Face serves a Space on.

    ``Some_User/safe.stride`` is served at ``some-user-safe-stride.hf.space``.
    """
    owner, name = repo_id.split("/", 1)
    slug = f"{owner}-{name}".lower()
    return "".join(ch if ch.isalnum() else "-" for ch in slug) + ".hf.space"


def space_url(repo_id):
    return f"https://{space_host(repo_id)}"


def stage_backend(target):
    """Copy the backend into ``target`` with a Space card as README.md."""
    target = Path(target)
    for item in BACKEND_DIR.iterdir():
        is_local_env = item.name.startswith(".env") and item.name != ".env.example"
        if item.name in SKIP_NAMES or is_local_env:
            continue
        dest = target / item.name
        if item.is_dir():
            shutil.copytree(item, dest, ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))
        else:
            shutil.copy2(item, dest)
    (target / "README.md").write_text(SPACE_CARD, encoding="utf-8")
    return target


def write_output(name, value, environ):
    path = environ.get("GITHUB_OUTPUT")
    if path:
        with open(path, "a", encoding="utf-8") as fh:
            fh.write(f"{name}={value}\n")
    print(f"{name}={value}")


def resolve_repo_id(api, environ):
    name = environ.get("HF_SPACE_NAME", "").strip() or DEFAULT_SPACE_NAME
    if "/" in name:
        return name
    return f"{api.whoami()['name']}/{name}"


def deploy(environ=None):
    environ = os.environ if environ is None else environ
    missing = missing_required(environ)
    if missing:
        print("Cannot deploy, these repository secrets are missing: " + ", ".join(missing))
        return 1

    from huggingface_hub import HfApi

    api = HfApi(token=environ["HF_TOKEN"])
    repo_id = resolve_repo_id(api, environ)
    api.create_repo(repo_id, repo_type="space", space_sdk="docker", exist_ok=True)

    for name in REQUIRED_SECRETS + OPTIONAL_SECRETS:
        value = environ.get(name, "").strip()
        if value:
            api.add_space_secret(repo_id, name, value)
    for name in SPACE_VARIABLES:
        value = environ.get(name, "").strip()
        if value:
            api.add_space_variable(repo_id, name, value)

    with tempfile.TemporaryDirectory() as tmp:
        stage_backend(tmp)
        api.upload_folder(
            repo_id=repo_id,
            repo_type="space",
            folder_path=tmp,
            commit_message=f"Deploy {environ.get('GITHUB_SHA', 'local build')[:12]}",
            delete_patterns=["*", "!.gitattributes"],
        )

    write_output("repo_id", repo_id, environ)
    write_output("url", space_url(repo_id), environ)
    return 0


def print_url(environ=None):
    """Write the Space URL to GITHUB_OUTPUT so the frontend build can use it."""
    environ = os.environ if environ is None else environ
    if not environ.get("HF_TOKEN", "").strip():
        print("Cannot work out the backend URL, the HF_TOKEN repository secret is missing.")
        return 1

    from huggingface_hub import HfApi
    repo_id = resolve_repo_id(HfApi(token=environ["HF_TOKEN"]), environ)
    write_output("url", space_url(repo_id), environ)
    return 0


def fetch_status(url, timeout=20):
    try:
        with urllib.request.urlopen(url, timeout=timeout) as resp:
            return resp.status
    except urllib.error.HTTPError as exc:
        return exc.code
    except (urllib.error.URLError, TimeoutError, ConnectionError):
        return None


def wait(environ=None, sleep=time.sleep, clock=time.monotonic, fetch=fetch_status, stage_of=None):
    """Poll the Space until /home answers 200, the build fails, or time runs out."""
    environ = os.environ if environ is None else environ
    repo_id = environ["HF_SPACE_REPO_ID"]
    limit = float(environ.get("HF_WAIT_SECONDS", "1500"))
    url = space_url(repo_id) + "/home"

    if stage_of is None:
        from huggingface_hub import HfApi

        api = HfApi(token=environ.get("HF_TOKEN"))

        def stage_of(rid):
            return api.get_space_runtime(rid).stage

    start = clock()
    while clock() - start < limit:
        stage = stage_of(repo_id)
        if stage in ("BUILD_ERROR", "RUNTIME_ERROR", "CONFIG_ERROR"):
            print(f"Space {repo_id} stopped with {stage}. Open its logs on huggingface.co.")
            return 1
        status = fetch(url)
        print(f"{int(clock() - start)}s  stage={stage}  GET /home -> {status}")
        if stage == "RUNNING" and status == 200:
            print(f"Backend is live at {space_url(repo_id)}")
            return 0
        sleep(20)
    print(f"Gave up after {int(limit)}s waiting for {url}")
    return 1


if __name__ == "__main__":
    command = sys.argv[1] if len(sys.argv) > 1 else ""
    if command == "deploy":
        sys.exit(deploy())
    if command == "wait":
        sys.exit(wait())
    if command == "url":
        sys.exit(print_url())
    print(__doc__)
    sys.exit(2)

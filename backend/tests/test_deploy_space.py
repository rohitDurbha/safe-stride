import deploy_space
from deploy_space import missing_required, space_host, space_url, stage_backend, wait


def test_space_host_matches_hugging_face_naming():
    assert space_host("rohitdurbha/safe-stride") == "rohitdurbha-safe-stride.hf.space"
    assert space_host("Some_User/safe.stride") == "some-user-safe-stride.hf.space"
    assert space_url("a/b") == "https://a-b.hf.space"


def test_missing_required_lists_every_absent_secret():
    assert missing_required({}) == ["HF_TOKEN", "MONGO_URI", "SECRET_KEY"]
    assert missing_required({"HF_TOKEN": "t", "MONGO_URI": "m", "SECRET_KEY": " "}) == ["SECRET_KEY"]


def test_deploy_stops_before_calling_hugging_face_when_secrets_are_missing(capsys):
    assert deploy_space.deploy({"HF_TOKEN": "t"}) == 1
    assert "MONGO_URI, SECRET_KEY" in capsys.readouterr().out


def test_stage_backend_copies_the_app_without_local_files(tmp_path):
    stage_backend(tmp_path)
    names = {p.name for p in tmp_path.iterdir()}
    assert {"app.py", "Dockerfile", "requirements.txt", "street_graph.py", "README.md"} <= names
    assert not names & {"tests", ".env", "cache", "__pycache__", "deploy_space.py"}
    card = (tmp_path / "README.md").read_text(encoding="utf-8")
    assert "sdk: docker" in card
    assert "app_port: 7860" in card


def test_dockerfile_serves_gunicorn_on_the_space_port_and_bakes_the_graph():
    dockerfile = (deploy_space.BACKEND_DIR / "Dockerfile").read_text(encoding="utf-8")
    assert "PORT=7860" in dockerfile
    assert "gunicorn" in dockerfile
    assert "python street_graph.py" in dockerfile


class FakeClock:
    def __init__(self):
        self.now = 0.0

    def __call__(self):
        return self.now

    def sleep(self, seconds):
        self.now += seconds


def test_wait_returns_once_the_space_runs_and_answers():
    clock = FakeClock()
    stages = iter(["BUILDING", "RUNNING_BUILDING", "RUNNING"])
    statuses = iter([None, 503, 200])
    code = wait(
        {"HF_SPACE_REPO_ID": "a/b"},
        sleep=clock.sleep,
        clock=clock,
        fetch=lambda url: next(statuses),
        stage_of=lambda rid: next(stages),
    )
    assert code == 0


def test_wait_fails_fast_on_a_build_error():
    clock = FakeClock()
    code = wait(
        {"HF_SPACE_REPO_ID": "a/b"},
        sleep=clock.sleep,
        clock=clock,
        fetch=lambda url: None,
        stage_of=lambda rid: "BUILD_ERROR",
    )
    assert code == 1
    assert clock.now == 0


def test_wait_gives_up_after_the_time_limit():
    clock = FakeClock()
    code = wait(
        {"HF_SPACE_REPO_ID": "a/b", "HF_WAIT_SECONDS": "60"},
        sleep=clock.sleep,
        clock=clock,
        fetch=lambda url: 503,
        stage_of=lambda rid: "RUNNING",
    )
    assert code == 1
    assert clock.now >= 60


class FakeApi:
    def whoami(self):
        return {"name": "rohitdurbha"}


def test_resolve_repo_id_uses_the_token_owner_and_default_name():
    assert deploy_space.resolve_repo_id(FakeApi(), {}) == "rohitdurbha/safe-stride"
    assert deploy_space.resolve_repo_id(FakeApi(), {"HF_SPACE_NAME": "walk-api"}) == "rohitdurbha/walk-api"
    assert deploy_space.resolve_repo_id(FakeApi(), {"HF_SPACE_NAME": "org/api"}) == "org/api"


def test_write_output_appends_to_the_github_output_file(tmp_path):
    out = tmp_path / "out"
    deploy_space.write_output("url", "https://a-b.hf.space", {"GITHUB_OUTPUT": str(out)})
    assert out.read_text() == "url=https://a-b.hf.space\n"


def test_print_url_needs_a_token(capsys):
    assert deploy_space.print_url({}) == 1
    assert "HF_TOKEN" in capsys.readouterr().out


def test_route_check_passes_when_the_backend_returns_a_route():
    seen = []

    def fetch(url):
        seen.append(url)
        return 200, {"route": [[37.80, -122.27], [37.81, -122.26]], "summary": {}}

    assert deploy_space.check_route({"HF_SPACE_REPO_ID": "a/b"}, fetch=fetch) == 0
    assert seen[0].startswith("https://a-b.hf.space/safe_path?start_lat=")


def test_route_check_fails_on_an_error_or_an_empty_route():
    env = {"HF_SPACE_REPO_ID": "a/b"}
    assert deploy_space.check_route(env, fetch=lambda url: (500, {"error": "boom"})) == 1
    assert deploy_space.check_route(env, fetch=lambda url: (200, {"route": []})) == 1
    assert deploy_space.check_route(env, fetch=lambda url: (None, None)) == 1

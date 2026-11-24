from flask import Flask, request

from prefix import StripPrefix


def make_client():
    app = Flask("prefix_check")

    @app.route("/safe_path")
    def safe_path():
        return {"path": request.path, "args": request.args.to_dict()}

    @app.route("/")
    def root():
        return "root"

    app.wsgi_app = StripPrefix(app.wsgi_app, "/api")
    return app.test_client()


def test_strips_the_prefix_before_routing():
    res = make_client().get("/api/safe_path?start_lat=1")
    assert res.status_code == 200
    assert res.json["path"] == "/safe_path"
    assert res.json["args"] == {"start_lat": "1"}


def test_bare_prefix_reaches_the_root_route():
    assert make_client().get("/api").data == b"root"


def test_unprefixed_paths_still_work_for_local_runs():
    assert make_client().get("/safe_path").status_code == 200


def test_a_path_that_only_starts_with_the_same_letters_is_left_alone():
    assert make_client().get("/apiary").status_code == 404

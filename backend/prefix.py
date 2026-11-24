"""Serve the Flask app under a path prefix such as /api.

On Vercel the frontend owns every path, so the backend lives under /api and
this middleware strips that prefix before Flask matches its routes. Local
runs without the prefix keep working, because paths that do not start with
it pass through unchanged.
"""


class StripPrefix:
    def __init__(self, wsgi_app, prefix):
        self.wsgi_app = wsgi_app
        self.prefix = "/" + prefix.strip("/")

    def __call__(self, environ, start_response):
        path = environ.get("PATH_INFO", "")
        if path == self.prefix or path.startswith(self.prefix + "/"):
            environ = dict(environ)
            environ["PATH_INFO"] = path[len(self.prefix):] or "/"
            environ["SCRIPT_NAME"] = environ.get("SCRIPT_NAME", "") + self.prefix
        return self.wsgi_app(environ, start_response)

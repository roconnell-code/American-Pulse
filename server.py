"""Local server for American Pulse. News keys never leave this process."""

from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import newsfeed

ROOT = Path(__file__).resolve().parent
TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".webp": "image/webp",
}


def static_file(path):
    if path in {"", "/"}:
        path = "/index.html"
    relative = path.lstrip("/")
    if not relative or ".." in relative.split("/"):
        return None
    allowed = relative in {"index.html", "promo.html"} or relative.startswith(("src/", "data/", "assets/"))
    if not allowed:
        return None
    file = (ROOT / relative).resolve()
    if ROOT not in file.parents and file != ROOT / "index.html":
        return None
    return file if file.is_file() else None


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/news":
            self.send_json(self.news(parse_qs(parsed.query)))
            return
        if parsed.path == "/api/health":
            self.send_json({"ok": True, "service": "american-pulse"})
            return
        file = static_file(parsed.path)
        if file is None:
            self.send_error(404, "Not found")
            return
        body = file.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", TYPES.get(file.suffix, "application/octet-stream"))
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(body)

    def news(self, query):
        scope = (query.get("scope") or ["national"])[0]
        try:
            if scope == "national":
                return newsfeed.get_national()
            if scope == "state":
                return newsfeed.get_state((query.get("id") or [""])[0])
            if scope == "search":
                return newsfeed.get_search((query.get("q") or [""])[0])
            if scope == "counts":
                return newsfeed.get_counts()
        except Exception as error:  # noqa: BLE001
            return {"ok": False, "articles": [], "error": newsfeed.UNAVAILABLE, "message": newsfeed.UNAVAILABLE, "detail": error.__class__.__name__}
        return {"ok": False, "articles": [], "error": "Unknown news scope.", "message": "Unknown news scope."}

    def send_json(self, payload, status=200):
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        if len(args) >= 2 and str(args[1]) not in {"200", "304"}:
            super().log_message(fmt, *args)


def main():
    newsfeed.start_indexer()
    server = ThreadingHTTPServer(("127.0.0.1", 4173), Handler)
    print("American Pulse  http://127.0.0.1:4173")
    server.serve_forever()


if __name__ == "__main__":
    main()

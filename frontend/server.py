from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse
import json
import os


ROOT = os.path.dirname(os.path.abspath(__file__))
PUBLIC_DIR = os.path.join(ROOT, "public")


def env(name, default=""):
    return os.environ.get(name, default).strip()


def site_config():
    return {
        "companyName": "AB Exterior Solutions",
        "phoneDisplay": env("PHONE_DISPLAY", "(856) 418-7233"),
        "phoneHref": env("PHONE_HREF", "+18564187233"),
        "email": env("BUSINESS_EMAIL", "austin@abexteriorsolutions.com"),
        "serviceArea": env("SERVICE_AREA", "Cherry Hill • Marlton • Voorhees • South Jersey"),
        "domain": env("SITE_DOMAIN", "https://abexteriorsolutions.com"),
        "apiBaseUrl": env("API_BASE_URL"),
        "adminUrl": env("ADMIN_URL") or (env("API_BASE_URL").rstrip("/") + "/admin.html" if env("API_BASE_URL") else "#"),
        "socialLinks": {
            "facebook": env("FACEBOOK_URL", "#"),
            "instagram": env("INSTAGRAM_URL", "#"),
            "google": env("GOOGLE_BUSINESS_URL", "#"),
            "nextdoor": env("NEXTDOOR_URL", "#"),
        },
    }


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=PUBLIC_DIR, **kwargs)

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/health":
            body = json.dumps({"ok": True}).encode("utf-8")
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        if path == "/site-config.js":
            body = f"window.SITE_CONFIG = {json.dumps(site_config(), indent=2)};\n".encode("utf-8")
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "application/javascript")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        super().do_GET()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8000"))
    host = os.environ.get("HOST", "0.0.0.0")
    server = ThreadingHTTPServer((host, port), Handler)
    print(f"AB Exterior Solutions frontend running at http://{host}:{port}")
    server.serve_forever()

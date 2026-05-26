from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse
import datetime as dt
import base64
import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import time
import urllib.error
import urllib.request


ROOT = os.path.dirname(os.path.abspath(__file__))
PUBLIC_DIR = os.path.join(ROOT, "public")
DATA_DIR = os.environ.get("DATA_DIR", os.path.join(ROOT, "data"))
DB_PATH = os.environ.get("DB_PATH", os.path.join(DATA_DIR, "ab_exterior.db"))


def load_env_file():
    path = os.path.join(ROOT, ".env")
    if not os.path.exists(path):
        return
    with open(path, "r", encoding="utf-8") as file:
        for raw_line in file:
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_env_file()

ADMIN_USER = os.environ.get("ADMIN_USER", "admin")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")
SESSION_SECRET = os.environ.get("SESSION_SECRET", "change-this-before-deployment")
BOOKING_WEBHOOK_URL = os.environ.get("BOOKING_WEBHOOK_URL", "")
BOOKING_WEBHOOK_SECRET = os.environ.get("BOOKING_WEBHOOK_SECRET", "")
BUSINESS_NOTIFICATION_EMAIL = os.environ.get("BUSINESS_NOTIFICATION_EMAIL", "info@abexteriorsolutions.com")
BOOKING_TIMEZONE = os.environ.get("BOOKING_TIMEZONE", "America/New_York")
DEFAULT_EVENT_DURATION_MINUTES = int(os.environ.get("DEFAULT_EVENT_DURATION_MINUTES", "120"))
BOOKING_BLOCK_MINUTES = int(os.environ.get("BOOKING_BLOCK_MINUTES", str(DEFAULT_EVENT_DURATION_MINUTES)))
ALLOWED_BOOKING_TIMES = {"8:00 AM", "10:00 AM", "12:00 PM", "2:00 PM", "4:00 PM"}
FRONTEND_ORIGIN = os.environ.get("FRONTEND_ORIGIN", "").rstrip("/")


def allowed_origin(handler):
    origin = handler.headers.get("Origin", "").rstrip("/")
    if FRONTEND_ORIGIN and origin == FRONTEND_ORIGIN:
        return origin
    if not FRONTEND_ORIGIN:
        return origin or "*"
    return FRONTEND_ORIGIN


def parse_booking_start(value):
    text = clean(value)
    try:
        date_part, time_part = text.split(" ", 1)
        selected_date = dt.datetime.strptime(date_part, "%Y-%m-%d").date()
    except ValueError:
        return None

    if time_part not in ALLOWED_BOOKING_TIMES:
        return None

    try:
        selected_time = dt.datetime.strptime(time_part, "%I:%M %p").time()
    except ValueError:
        return None

    return dt.datetime.combine(selected_date, selected_time)


def booking_time_is_available(preferred_time):
    requested = parse_booking_start(preferred_time)
    if not requested:
        return False, "Please choose one of the available appointment times."

    today = dt.datetime.now().date()
    if requested.date() < today:
        return False, "Please choose a future appointment date."

    if requested.weekday() == 6:
        return False, "Online booking is available Monday through Saturday. Please choose another day."
    if requested.weekday() == 5 and requested.time() == dt.time(16, 0):
        return False, "Saturday online appointments are available from 8:00 AM to 4:00 PM. Please choose an earlier Saturday slot."

    requested_end = requested + dt.timedelta(minutes=BOOKING_BLOCK_MINUTES)
    with db() as con:
        rows = con.execute(
            """
            SELECT preferred_time FROM bookings
            WHERE status IN ('Pending', 'Confirmed')
            """
        ).fetchall()

    for row in rows:
        existing = parse_booking_start(row["preferred_time"])
        if not existing:
            continue
        existing_end = existing + dt.timedelta(minutes=BOOKING_BLOCK_MINUTES)
        if requested < existing_end and requested_end > existing:
            return False, "That appointment time is already booked. Please choose another two-hour slot."

    return True, ""


def db():
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    with db() as con:
        con.execute(
            """
            CREATE TABLE IF NOT EXISTS bookings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                phone TEXT NOT NULL,
                email TEXT NOT NULL,
                address TEXT NOT NULL,
                service TEXT NOT NULL,
                preferred_time TEXT NOT NULL,
                message TEXT,
                status TEXT NOT NULL DEFAULT 'Pending',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        con.execute(
            """
            CREATE TABLE IF NOT EXISTS reviews (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                rating INTEGER NOT NULL,
                review TEXT NOT NULL,
                service TEXT,
                status TEXT NOT NULL DEFAULT 'Pending',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )


def read_json(handler):
    length = int(handler.headers.get("Content-Length", 0))
    raw = handler.rfile.read(length).decode("utf-8") if length else "{}"
    return json.loads(raw or "{}")


def send_json(handler, payload, status=HTTPStatus.OK):
    body = json.dumps(payload).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Access-Control-Allow-Origin", allowed_origin(handler))
    handler.send_header("Access-Control-Allow-Credentials", "true")
    handler.send_header("Vary", "Origin")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def clean(value):
    return str(value or "").strip()


def booking_payload(booking_id, fields):
    return {
        "secret": BOOKING_WEBHOOK_SECRET,
        "booking_id": booking_id,
        "company": "AB Exterior Solutions",
        "business_email": BUSINESS_NOTIFICATION_EMAIL,
        "timezone": BOOKING_TIMEZONE,
        "duration_minutes": DEFAULT_EVENT_DURATION_MINUTES,
        "created_at": dt.datetime.now(dt.UTC).isoformat(),
        **fields,
    }


def notify_booking(booking_id, fields):
    if not BOOKING_WEBHOOK_URL:
        return {"enabled": False, "ok": False}

    body = json.dumps(booking_payload(booking_id, fields)).encode("utf-8")
    request = urllib.request.Request(
        BOOKING_WEBHOOK_URL,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=8) as response:
            raw = response.read().decode("utf-8")
            body = json.loads(raw or "{}")
        return {"enabled": True, "ok": bool(body.get("ok", True)), "response": body}
    except urllib.error.HTTPError as error:
        try:
            body = json.loads(error.read().decode("utf-8") or "{}")
        except Exception:
            body = {"error": str(error)}
        print(f"Booking webhook rejected booking #{booking_id}: {body}")
        return {"enabled": True, "ok": False, "response": body}
    except (urllib.error.URLError, TimeoutError, OSError, json.JSONDecodeError) as error:
        print(f"Booking webhook failed for booking #{booking_id}: {error}")
        return {"enabled": True, "ok": False, "response": {"error": "Calendar sync temporarily failed."}}


def make_token():
    expires = int(time.time()) + 60 * 60 * 8
    nonce = secrets.token_hex(12)
    payload = f"{ADMIN_USER}:{expires}:{nonce}"
    sig = hmac.new(SESSION_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return base64.urlsafe_b64encode(f"{payload}:{sig}".encode()).decode()


def check_token(token):
    try:
        decoded = base64.urlsafe_b64decode(token.encode()).decode()
        user, expires, nonce, sig = decoded.rsplit(":", 3)
        payload = f"{user}:{expires}:{nonce}"
        expected = hmac.new(SESSION_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()
        return user == ADMIN_USER and int(expires) > time.time() and hmac.compare_digest(sig, expected)
    except Exception:
        return False


def cookie_value(header, name):
    for part in (header or "").split(";"):
        if "=" in part:
            key, value = part.strip().split("=", 1)
            if key == name:
                return value
    return ""


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=PUBLIC_DIR, **kwargs)

    def is_admin(self):
        return check_token(cookie_value(self.headers.get("Cookie"), "ab_admin"))

    def require_admin(self):
        if self.is_admin():
            return True
        send_json(self, {"error": "Admin login required."}, HTTPStatus.UNAUTHORIZED)
        return False

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/health":
            send_json(self, {"ok": True})
        elif path == "/api/reviews":
            with db() as con:
                rows = con.execute(
                    "SELECT id, name, rating, review, service, created_at FROM reviews WHERE status = 'Approved' ORDER BY created_at DESC"
                ).fetchall()
            send_json(self, {"reviews": [dict(row) for row in rows]})
        elif path == "/admin-config.js":
            body = f"window.ADMIN_CONFIG = {json.dumps({'frontendUrl': FRONTEND_ORIGIN or '/'}, indent=2)};\n".encode("utf-8")
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "application/javascript")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        elif path == "/api/admin/session":
            send_json(self, {"authenticated": self.is_admin()})
        elif path == "/api/admin/bookings":
            if not self.require_admin():
                return
            with db() as con:
                rows = con.execute("SELECT * FROM bookings ORDER BY created_at DESC").fetchall()
            send_json(self, {"bookings": [dict(row) for row in rows]})
        elif path == "/api/admin/reviews":
            if not self.require_admin():
                return
            with db() as con:
                rows = con.execute("SELECT * FROM reviews ORDER BY created_at DESC").fetchall()
            send_json(self, {"reviews": [dict(row) for row in rows]})
        else:
            super().do_GET()

    def do_OPTIONS(self):
        self.send_response(HTTPStatus.NO_CONTENT)
        self.send_header("Access-Control-Allow-Origin", allowed_origin(self))
        self.send_header("Access-Control-Allow-Credentials", "true")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Vary", "Origin")
        self.end_headers()

    def do_POST(self):
        path = urlparse(self.path).path
        if path == "/api/bookings":
            data = read_json(self)
            fields = {
                "name": clean(data.get("name")),
                "phone": clean(data.get("phone")),
                "email": clean(data.get("email")),
                "address": clean(data.get("address")),
                "service": clean(data.get("service")),
                "preferred_time": clean(data.get("preferred_time")),
                "message": clean(data.get("message")),
            }
            missing = [key for key in ["name", "phone", "email", "address", "service", "preferred_time"] if not fields[key]]
            if missing:
                send_json(self, {"error": "Please complete all required booking fields."}, HTTPStatus.BAD_REQUEST)
                return
            available, error_message = booking_time_is_available(fields["preferred_time"])
            if not available:
                send_json(self, {"error": error_message}, HTTPStatus.CONFLICT)
                return
            with db() as con:
                cur = con.execute(
                    """
                    INSERT INTO bookings (name, phone, email, address, service, preferred_time, message)
                    VALUES (:name, :phone, :email, :address, :service, :preferred_time, :message)
                    """,
                    fields,
                )
                booking_id = cur.lastrowid
            notification = notify_booking(booking_id, fields)
            webhook_response = notification.get("response") or {}
            if notification["enabled"] and not notification["ok"] and webhook_response.get("error") == "Calendar slot unavailable":
                with db() as con:
                    con.execute("DELETE FROM bookings WHERE id = ?", (booking_id,))
                send_json(
                    self,
                    {"error": "That calendar slot was just booked. Please choose another two-hour appointment time."},
                    HTTPStatus.CONFLICT,
                )
                return
            message = "Your request is saved. AB Exterior Solutions will confirm your appointment soon."
            if notification["enabled"] and notification["ok"]:
                message = "Your appointment request is saved and added to the AB Exterior Solutions calendar. We'll confirm the job details soon."
            send_json(
                self,
                {
                    "ok": True,
                    "booking_id": booking_id,
                    "calendar_sync": notification,
                    "message": message,
                },
                HTTPStatus.CREATED,
            )
        elif path == "/api/reviews":
            data = read_json(self)
            rating = int(data.get("rating") or 0)
            fields = {
                "name": clean(data.get("name")),
                "rating": rating,
                "review": clean(data.get("review")),
                "service": clean(data.get("service")),
            }
            if not fields["name"] or not fields["review"] or rating < 1 or rating > 5:
                send_json(self, {"error": "Please add your name, rating, and review."}, HTTPStatus.BAD_REQUEST)
                return
            with db() as con:
                con.execute(
                    "INSERT INTO reviews (name, rating, review, service) VALUES (:name, :rating, :review, :service)",
                    fields,
                )
            send_json(self, {"ok": True, "message": "Thanks. Your review is pending approval."}, HTTPStatus.CREATED)
        elif path == "/api/admin/login":
            data = read_json(self)
            if clean(data.get("username")) == ADMIN_USER and hmac.compare_digest(clean(data.get("password")), ADMIN_PASSWORD):
                token = make_token()
                send_json_with_cookie(self, {"ok": True}, f"ab_admin={token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800")
            else:
                send_json(self, {"error": "Invalid admin login."}, HTTPStatus.UNAUTHORIZED)
        elif path == "/api/admin/logout":
            send_json_with_cookie(self, {"ok": True}, "ab_admin=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0")
        else:
            send_json(self, {"error": "Not found."}, HTTPStatus.NOT_FOUND)

    def do_PATCH(self):
        path = urlparse(self.path).path
        if not self.require_admin():
            return
        data = read_json(self)
        parts = path.strip("/").split("/")
        if parts[:3] == ["api", "admin", "bookings"] and len(parts) == 4:
            status = clean(data.get("status"))
            if status not in ["Pending", "Confirmed", "Completed", "Canceled"]:
                send_json(self, {"error": "Invalid booking status."}, HTTPStatus.BAD_REQUEST)
                return
            with db() as con:
                con.execute("UPDATE bookings SET status = ? WHERE id = ?", (status, parts[3]))
            send_json(self, {"ok": True})
        elif parts[:3] == ["api", "admin", "reviews"] and len(parts) == 4:
            status = clean(data.get("status"))
            if status not in ["Pending", "Approved", "Hidden"]:
                send_json(self, {"error": "Invalid review status."}, HTTPStatus.BAD_REQUEST)
                return
            with db() as con:
                con.execute("UPDATE reviews SET status = ? WHERE id = ?", (status, parts[3]))
            send_json(self, {"ok": True})
        else:
            send_json(self, {"error": "Not found."}, HTTPStatus.NOT_FOUND)

    def do_DELETE(self):
        path = urlparse(self.path).path
        if not self.require_admin():
            return
        parts = path.strip("/").split("/")
        if parts[:3] == ["api", "admin", "reviews"] and len(parts) == 4:
            with db() as con:
                con.execute("DELETE FROM reviews WHERE id = ?", (parts[3],))
            send_json(self, {"ok": True})
        else:
            send_json(self, {"error": "Not found."}, HTTPStatus.NOT_FOUND)


def send_json_with_cookie(handler, payload, cookie):
    body = json.dumps(payload).encode("utf-8")
    handler.send_response(HTTPStatus.OK)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Set-Cookie", cookie)
    handler.send_header("Access-Control-Allow-Origin", allowed_origin(handler))
    handler.send_header("Access-Control-Allow-Credentials", "true")
    handler.send_header("Vary", "Origin")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


if __name__ == "__main__":
    init_db()
    port = int(os.environ.get("PORT", "8000"))
    host = os.environ.get("HOST", "0.0.0.0" if os.environ.get("RENDER") else "127.0.0.1")
    server = ThreadingHTTPServer((host, port), Handler)
    print(f"AB Exterior Solutions running at http://{host}:{port}")
    server.serve_forever()

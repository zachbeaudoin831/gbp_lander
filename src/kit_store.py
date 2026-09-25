"""
Campaign-kit persistence for the no-account funnel.

Three small jobs, each optional so the funnel never depends on them:

1. Lead-row bookkeeping (Postgres via DATABASE_URL, same pooler notes as
   lead_store): stamp a kit token on a lead, record which files landed,
   look a kit up by id + token.
2. File storage (Supabase Storage REST with the service-role key): the
   backend is the only writer to the private `kits` bucket, and it mints
   short-lived signed URLs for the /kit page.
3. The kit email (Resend's HTTP API): one transactional message with the
   /kit link and the booking link.

Environment variables:
    DATABASE_URL               -- lead rows (already required by lead_store)
    SUPABASE_URL               -- e.g. https://api.sendkpi.com
    SUPABASE_SERVICE_ROLE_KEY  -- Supabase -> Settings -> API -> service_role
    RESEND_API_KEY             -- resend.com API key (domain must be verified)
    KIT_FROM_EMAIL             -- e.g. "Zach at SendKPI <zach@sendkpi.com>"
    PUBLIC_SITE_URL            -- https://sendkpi.com (where /kit lives)
    BOOKING_URL                -- calendar link for the implementation meeting

`requests`/`psycopg` are imported lazily, like the sibling modules.
"""
from __future__ import annotations

import json
import os
import re
import secrets
from typing import Optional

from src.lead_store import LeadStoreError, _dsn

KITS_BUCKET = "kits"
SIGNED_URL_TTL = 3600  # seconds; the /kit page re-fetches on every load

# What a kit may contain. Anything else is refused at upload time.
ALLOWED_FILES = {
    ".html": "text/html",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".txt": "text/plain",
    ".zip": "application/zip",
}
FILE_NAME_RE = re.compile(r"^[a-z0-9][a-z0-9._-]{0,99}$")
MAX_FILE_BYTES = 4_400_000  # Vercel caps request bodies at ~4.5 MB


class KitStoreError(RuntimeError):
    """Raised when a kit operation is unconfigured or fails."""


# ── lead rows ───────────────────────────────────────────────────────────────

def new_token() -> str:
    return secrets.token_urlsafe(24)


def set_kit_token(lead_id: str, token: str) -> None:
    import psycopg
    with psycopg.connect(_dsn(), prepare_threshold=None, connect_timeout=10) as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE leads SET kit_token = %s WHERE id = %s", (token, lead_id))
        conn.commit()


def get_kit(lead_id: str, token: str) -> Optional[dict]:
    """The lead row behind a kit link, or None if the id/token don't match."""
    import psycopg
    with psycopg.connect(_dsn(), prepare_threshold=None, connect_timeout=10) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, name, email, phone, business, kit_files, emailed_at
                FROM leads WHERE id = %s AND kit_token = %s
                """,
                (lead_id, token),
            )
            row = cur.fetchone()
    if not row:
        return None
    return {
        "id": str(row[0]), "name": row[1], "email": row[2], "phone": row[3],
        "business": row[4], "files": row[5] or [], "emailed_at": row[6],
    }


def set_kit_files(lead_id: str, files: list[dict]) -> None:
    import psycopg
    with psycopg.connect(_dsn(), prepare_threshold=None, connect_timeout=10) as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE leads SET kit_files = %s::jsonb WHERE id = %s", (json.dumps(files), lead_id))
        conn.commit()


def mark_emailed(lead_id: str) -> None:
    import psycopg
    with psycopg.connect(_dsn(), prepare_threshold=None, connect_timeout=10) as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE leads SET emailed_at = now() WHERE id = %s", (lead_id,))
        conn.commit()


# ── storage ─────────────────────────────────────────────────────────────────

def storage_configured() -> bool:
    return bool(os.environ.get("SUPABASE_URL") and os.environ.get("SUPABASE_SERVICE_ROLE_KEY"))


def _storage() -> tuple[str, dict]:
    url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise KitStoreError("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set")
    return f"{url}/storage/v1", {"Authorization": f"Bearer {key}", "apikey": key}


def content_type_for(name: str) -> Optional[str]:
    """MIME type for an allowed kit file name, or None if it's not allowed."""
    if not FILE_NAME_RE.match(name):
        return None
    dot = name.rfind(".")
    return ALLOWED_FILES.get(name[dot:]) if dot > 0 else None


def upload_file(lead_id: str, name: str, data: bytes, content_type: str) -> None:
    import requests
    base, headers = _storage()
    resp = requests.post(
        f"{base}/object/{KITS_BUCKET}/{lead_id}/{name}",
        data=data,
        headers={**headers, "Content-Type": content_type, "x-upsert": "true"},
        timeout=30,
    )
    if resp.status_code >= 400:
        raise KitStoreError(f"Storage upload rejected (HTTP {resp.status_code})")


def list_files(lead_id: str) -> list[dict]:
    import requests
    base, headers = _storage()
    resp = requests.post(
        f"{base}/object/list/{KITS_BUCKET}",
        json={"prefix": f"{lead_id}/", "limit": 100, "sortBy": {"column": "name", "order": "asc"}},
        headers=headers,
        timeout=15,
    )
    if resp.status_code >= 400:
        raise KitStoreError(f"Storage list rejected (HTTP {resp.status_code})")
    out = []
    for obj in resp.json() or []:
        if not obj.get("id"):
            continue  # folder placeholder
        meta = obj.get("metadata") or {}
        out.append({"name": obj["name"], "size": meta.get("size")})
    return out


def sign_files(lead_id: str, names: list[str]) -> dict[str, str]:
    """Map of file name -> signed download URL (SIGNED_URL_TTL seconds)."""
    if not names:
        return {}
    import requests
    base, headers = _storage()
    resp = requests.post(
        f"{base}/object/sign/{KITS_BUCKET}",
        json={"expiresIn": SIGNED_URL_TTL, "paths": [f"{lead_id}/{n}" for n in names]},
        headers=headers,
        timeout=15,
    )
    if resp.status_code >= 400:
        raise KitStoreError(f"Storage sign rejected (HTTP {resp.status_code})")
    signed = {}
    for item in resp.json() or []:
        path, url = item.get("path"), item.get("signedURL")
        if path and url:
            signed[path.split("/", 1)[1]] = f"{base}{url}"
    return signed


# ── email ───────────────────────────────────────────────────────────────────

def email_configured() -> bool:
    return bool(os.environ.get("RESEND_API_KEY") and os.environ.get("KIT_FROM_EMAIL"))


def kit_url(lead_id: str, token: str) -> str:
    site = os.environ.get("PUBLIC_SITE_URL", "https://sendkpi.com").rstrip("/")
    return f"{site}/kit?id={lead_id}&t={token}"


def send_kit_email(*, to: str, name: Optional[str], business: Optional[str], link: str) -> None:
    """One transactional email with the kit link. Raises KitStoreError if
    Resend isn't configured or rejects the send."""
    api_key = os.environ.get("RESEND_API_KEY")
    sender = os.environ.get("KIT_FROM_EMAIL")
    if not api_key or not sender:
        raise KitStoreError("RESEND_API_KEY / KIT_FROM_EMAIL not set")
    import requests

    first = (name or "").strip().split(" ")[0] or "there"
    biz = (business or "your business").strip()
    booking = os.environ.get("BOOKING_URL", "").strip()
    booking_html = (
        f'<p>Not sure how to put it live? Book a free implementation meeting and I\'ll '
        f'walk through it with you: <a href="{booking}">{booking}</a></p>'
        if booking else ""
    )
    html = f"""
<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#181D24">
  <p>Hi {first},</p>
  <p>Your website and ads for <b>{biz}</b> are ready. Everything is on one page:
  two landing pages, the ad graphics, and your Google Search ad copy.</p>
  <p><a href="{link}" style="display:inline-block;background:#0D57D0;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:10px">Open my website &amp; ads</a></p>
  <p style="font-size:13px;color:#5B6470">Or copy this link: {link}</p>
  {booking_html}
  <p>Zach<br>SendKPI</p>
</div>
"""
    text = (
        f"Hi {first},\n\nYour website and ads for {biz} are ready:\n{link}\n\n"
        + (f"Need help putting it live? Book a free implementation meeting: {booking}\n\n" if booking else "")
        + "Zach\nSendKPI\n"
    )
    resp = requests.post(
        "https://api.resend.com/emails",
        json={
            "from": sender,
            "to": [to],
            "subject": f"Your website and ads for {biz} are ready",
            "html": html,
            "text": text,
        },
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        timeout=15,
    )
    if resp.status_code >= 400:
        raise KitStoreError(f"Resend rejected the email (HTTP {resp.status_code})")

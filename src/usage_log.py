"""
API usage logging + IP blocklist (Supabase / Postgres).

Feeds the admin dashboard's usage/cost view and its bot controls:
- api_usage: one row per /api/* request (endpoint, ip, user agent), written
  by the FastAPI middleware. Powers traffic charts and the top-IPs table.
- ai_usage: one row per Claude call with the exact token counts from the
  response, written by ai_copy.py. Powers the Claude cost estimate.
- blocked_ips: written by the admin dashboard (via Supabase RLS), only read
  here. The middleware rejects blocked IPs before they cost anything.

Design constraints, in order:
1. NEVER break the funnel. Every public function swallows its own errors --
   a logging or blocklist failure must degrade to "no logging", not a 500.
2. Cheap per request. One connection is opened lazily and reused across warm
   serverless invocations; the blocklist is cached in-process for 60s.
psycopg is imported lazily (same reasoning as lead_store).
"""
from __future__ import annotations

import os
import threading
import time
from typing import Optional

BLOCKLIST_TTL_SECONDS = 60.0

_lock = threading.Lock()
_conn = None
_blocklist: set[str] = set()
_blocklist_fetched_at = 0.0


def _get_conn():
    """Reused module-level connection; None if DATABASE_URL isn't set."""
    global _conn
    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        return None
    import psycopg  # lazy

    if _conn is None or _conn.closed:
        _conn = psycopg.connect(
            dsn, prepare_threshold=None, connect_timeout=5, autocommit=True
        )
    return _conn


def _execute(query: str, params: tuple = (), fetch: bool = False):
    """Run one statement, retrying once on a dead pooled connection.
    Returns fetched rows (or True) on success, None on any failure.
    """
    global _conn
    with _lock:
        for attempt in (1, 2):
            try:
                conn = _get_conn()
                if conn is None:
                    return None
                with conn.cursor() as cur:
                    cur.execute(query, params)
                    return cur.fetchall() if fetch else True
            except Exception:
                # Pooled connections get reaped between invocations -- drop
                # ours and retry once with a fresh one.
                try:
                    if _conn is not None:
                        _conn.close()
                except Exception:
                    pass
                _conn = None
                if attempt == 2:
                    return None


def log_request(endpoint: str, ip: Optional[str], user_agent: Optional[str]) -> None:
    """Record one API request. Silent no-op on any failure."""
    _execute(
        "INSERT INTO api_usage (endpoint, ip, user_agent) VALUES (%s, %s, %s)",
        (endpoint[:100], (ip or "")[:100] or None, (user_agent or "")[:300] or None),
    )


def log_ai(endpoint: str, resp) -> None:
    """Record token usage from one Anthropic Messages response.
    Called from ai_copy.py right after each client.messages.create().
    """
    try:
        usage = resp.usage
        _execute(
            """
            INSERT INTO ai_usage
                (endpoint, model, input_tokens, output_tokens,
                 cache_creation_tokens, cache_read_tokens)
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (
                endpoint[:100],
                str(resp.model)[:100],
                getattr(usage, "input_tokens", 0) or 0,
                getattr(usage, "output_tokens", 0) or 0,
                getattr(usage, "cache_creation_input_tokens", 0) or 0,
                getattr(usage, "cache_read_input_tokens", 0) or 0,
            ),
        )
    except Exception:
        pass


def is_blocked(ip: str) -> bool:
    """Check the admin's blocklist, refreshed at most once per minute.
    Fails open: if the table is unreachable, nobody is blocked.
    """
    global _blocklist, _blocklist_fetched_at
    if not ip:
        return False
    now = time.time()
    if now - _blocklist_fetched_at > BLOCKLIST_TTL_SECONDS:
        rows = _execute("SELECT ip FROM blocked_ips", fetch=True)
        if rows is not None:
            _blocklist = {r[0] for r in rows}
        _blocklist_fetched_at = now  # even on failure: don't hammer a dead DB
    return ip in _blocklist

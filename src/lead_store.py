"""
Persistence for captured leads (Supabase / Postgres).

One insert per submitted lead. Kept deliberately thin -- the API endpoint
validates input; this module just writes a row and hands back the new id.

Connection notes (Supabase + serverless):
- Use the *Transaction pooler* connection string (port 6543), not the direct
  5432 one -- serverless functions open many short-lived connections and
  would exhaust a direct Postgres connection limit.
- pgbouncer in transaction mode doesn't support server-side prepared
  statements, so we pass prepare_threshold=None.

`psycopg` is imported lazily inside the functions so importing this module
costs nothing (and doesn't require psycopg to be installed) until an insert
actually happens.
"""
from __future__ import annotations

import os
from typing import Optional


class LeadStoreError(RuntimeError):
    """Raised when the lead store is unavailable or misconfigured."""


def _dsn() -> str:
    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        raise LeadStoreError("DATABASE_URL is not set")
    return dsn


def insert_lead(
    *,
    business: Optional[str],
    name: str,
    phone: str,
    contact_pref: Optional[str],
    source: str,
    page_url: Optional[str],
    fbclid: Optional[str],
    gclid: Optional[str],
) -> str:
    """Insert one lead and return its generated id (as a string).

    Raises LeadStoreError if DATABASE_URL isn't configured. Any driver-level
    error propagates to the caller to translate into an HTTP status.
    """
    dsn = _dsn()  # check config first, so a missing DATABASE_URL is a clean
                  # LeadStoreError (503) rather than an import/driver error.
    import psycopg  # lazy: keeps module import cheap and dependency-optional

    with psycopg.connect(dsn, prepare_threshold=None, connect_timeout=10) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO leads
                    (business, name, phone, contact_pref, source,
                     page_url, fbclid, gclid)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                (business, name, phone, contact_pref, source,
                 page_url, fbclid, gclid),
            )
            row = cur.fetchone()
        conn.commit()
    return str(row[0])

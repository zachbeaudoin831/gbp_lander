"""Meta Conversions API: server-side event reporting for sendkpi.com's own
ad campaigns (business owners signing up), not to be confused with the
downstream leads a client's *own* lander collects for their customers.

Requires META_PIXEL_ID and META_CAPI_ACCESS_TOKEN in the environment.
Both come from Meta Events Manager -> your pixel -> Settings -> Conversions
API -> "Generate access token". Import is lazy-friendly: this module only
touches the network inside send_event(), so importing it costs nothing if
the feature is never used.
"""
from __future__ import annotations

import hashlib
import os
import re
import time
from typing import Optional

import requests

GRAPH_VERSION = "v21.0"
API_TIMEOUT = 6  # seconds -- this must never be allowed to slow down signup


class MetaCapiError(RuntimeError):
    pass


def _configured() -> tuple[str, str]:
    pixel_id = os.environ.get("META_PIXEL_ID")
    token = os.environ.get("META_CAPI_ACCESS_TOKEN")
    if not pixel_id or not token:
        raise MetaCapiError("META_PIXEL_ID / META_CAPI_ACCESS_TOKEN not configured")
    return pixel_id, token


def _hash(value: str) -> str:
    return hashlib.sha256(value.strip().lower().encode("utf-8")).hexdigest()


def hash_email(email: Optional[str]) -> Optional[str]:
    if not email:
        return None
    return _hash(email)


def hash_phone(phone: Optional[str]) -> Optional[str]:
    """E.164-ish normalize (digits only, no leading zeros) then hash. Returns
    None for anything that doesn't look like a real number rather than
    hashing garbage Meta will just fail to match anyway."""
    if not phone:
        return None
    digits = re.sub(r"\D", "", phone).lstrip("0")
    if len(digits) < 8:
        return None
    return _hash(digits)


def send_event(
    *,
    event_name: str,
    event_id: str,
    event_source_url: str,
    client_ip: Optional[str] = None,
    client_user_agent: Optional[str] = None,
    email: Optional[str] = None,
    phone: Optional[str] = None,
    fbc: Optional[str] = None,
    fbp: Optional[str] = None,
    test_event_code: Optional[str] = None,
) -> dict:
    """Send one event to Meta. event_id must match the client-side fbq()
    call for the same conversion so Meta dedupes browser + server events
    instead of double counting.

    Raises MetaCapiError if not configured or the request fails -- callers
    doing this as a side effect of a real user action (signup, etc.) should
    catch and swallow rather than let analytics failures break the product.
    """
    pixel_id, token = _configured()

    user_data = {}
    if client_ip:
        user_data["client_ip_address"] = client_ip
    if client_user_agent:
        user_data["client_user_agent"] = client_user_agent
    if fbc:
        user_data["fbc"] = fbc
    if fbp:
        user_data["fbp"] = fbp
    em = hash_email(email)
    if em:
        user_data["em"] = [em]
    ph = hash_phone(phone)
    if ph:
        user_data["ph"] = [ph]

    payload = {
        "data": [{
            "event_name": event_name,
            "event_time": int(time.time()),
            "event_id": event_id,
            "event_source_url": event_source_url,
            "action_source": "website",
            "user_data": user_data,
        }]
    }
    if test_event_code:
        payload["test_event_code"] = test_event_code

    url = f"https://graph.facebook.com/{GRAPH_VERSION}/{pixel_id}/events"
    try:
        resp = requests.post(url, params={"access_token": token}, json=payload, timeout=API_TIMEOUT)
        resp.raise_for_status()
    except requests.RequestException as e:
        raise MetaCapiError(f"Meta Conversions API request failed: {e}") from e
    return resp.json()

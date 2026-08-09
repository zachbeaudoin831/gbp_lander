"""
GoHighLevel (LeadConnector) contact sync.

One job: when a business owner finishes Google sign-in and saves their
lander, upsert them as a contact in Zach's GHL sub-account so follow-up
happens in the CRM he already uses -- no separate lead list to babysit.

Upsert (not create) is deliberate: GHL dedupes on email/phone, so a
returning signup updates the existing contact instead of spawning a
duplicate.

Environment variables required:
    GHL_API_TOKEN    -- a Private Integration token from the receiving
                        sub-account (Settings -> Private Integrations),
                        with the contacts.write scope.
    GHL_LOCATION_ID  -- that sub-account's Location ID (Settings ->
                        Business Profile).

`requests` is imported lazily so importing this module costs nothing
until a sync actually happens (same pattern as lead_store / meta_capi).
"""
from __future__ import annotations

import os
from typing import Optional

UPSERT_URL = "https://services.leadconnectorhq.com/contacts/upsert"
API_VERSION = "2021-07-28"  # GHL v2 API requires this exact Version header

SIGNUP_TAG = "sendkpi-signup"
SOURCE = "SendKPI funnel"


class GhlError(RuntimeError):
    """Raised when GHL is unconfigured or the API call fails."""


def upsert_contact(
    *,
    name: Optional[str],
    email: Optional[str],
    phone: Optional[str],
    business: Optional[str],
) -> dict:
    """Upsert one contact into the configured GHL sub-account.

    Returns GHL's response JSON. Raises GhlError if the integration isn't
    configured or GHL rejects the request -- callers decide whether that's
    fatal (for the funnel it never is).
    """
    token = os.environ.get("GHL_API_TOKEN")
    location_id = os.environ.get("GHL_LOCATION_ID")
    if not token or not location_id:
        raise GhlError("GHL_API_TOKEN / GHL_LOCATION_ID not set")
    if not email and not phone:
        # GHL's upsert dedupe needs at least one of these to key on.
        raise GhlError("Contact needs an email or phone to upsert")

    import requests  # lazy: keep module import cheap

    payload: dict = {
        "locationId": location_id,
        "source": SOURCE,
        "tags": [SIGNUP_TAG],
    }
    if name:
        payload["name"] = name.strip()
    if email:
        payload["email"] = email.strip()
    if phone:
        payload["phone"] = phone.strip()
    if business:
        payload["companyName"] = business.strip()

    try:
        resp = requests.post(
            UPSERT_URL,
            json=payload,
            headers={
                "Authorization": f"Bearer {token}",
                "Version": API_VERSION,
                "Content-Type": "application/json",
            },
            timeout=10,
        )
    except Exception as e:  # DNS, timeout, TLS -- all the same to the caller
        raise GhlError(f"GHL request failed: {e}")

    if resp.status_code >= 400:
        # Include the status but not the body verbatim -- GHL error bodies
        # can echo the payload, and this string may end up in logs.
        raise GhlError(f"GHL upsert rejected (HTTP {resp.status_code})")

    try:
        return resp.json()
    except ValueError:
        return {}


def is_configured() -> bool:
    return bool(os.environ.get("GHL_API_TOKEN") and os.environ.get("GHL_LOCATION_ID"))

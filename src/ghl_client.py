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
CUSTOM_FIELDS_URL = "https://services.leadconnectorhq.com/locations/{location_id}/customFields"
API_VERSION = "2021-07-28"  # GHL v2 API requires this exact Version header

SIGNUP_TAG = "sendkpi-signup"
SOURCE = "SendKPI funnel"


class GhlError(RuntimeError):
    """Raised when GHL is unconfigured or the API call fails."""


# Custom field key -> GHL field id, per warm serverless instance. None means
# "looked it up, not found / not readable" so we don't re-ask every signup.
_FIELD_IDS: dict[str, Optional[str]] = {}


def _custom_field_id(token: str, location_id: str, field_key: str) -> Optional[str]:
    """Resolve a contact custom field's id from its key ("contact.main_service").
    Ids are the one reference the upsert API is guaranteed to accept. Needs
    the locations/customFields.readonly scope; without it this returns None
    and the caller falls back to sending the key."""
    if field_key in _FIELD_IDS:
        return _FIELD_IDS[field_key]
    import requests

    field_id = None
    try:
        resp = requests.get(
            CUSTOM_FIELDS_URL.format(location_id=location_id),
            headers={"Authorization": f"Bearer {token}", "Version": API_VERSION},
            params={"model": "contact"},
            timeout=6,
        )
        if resp.ok:
            bare = field_key.removeprefix("contact.")
            for f in resp.json().get("customFields") or []:
                if f.get("fieldKey") in (field_key, f"contact.{bare}"):
                    field_id = f.get("id")
                    break
    except Exception:
        field_id = None
    _FIELD_IDS[field_key] = field_id
    return field_id


def upsert_contact(
    *,
    name: Optional[str],
    email: Optional[str],
    phone: Optional[str],
    business: Optional[str],
    tags: Optional[list[str]] = None,
    custom_fields: Optional[dict[str, str]] = None,
    signup_tag: bool = True,
    source: str = SOURCE,
) -> dict:
    """Upsert one contact into the configured GHL sub-account.

    custom_fields maps a GHL custom field key ("contact.main_service") to a
    value. A field that doesn't exist yet must never cost us the contact, so
    if GHL rejects the upsert with custom fields attached, it's retried
    without them.

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
        "source": source,
        # signup_tag=False keeps leads from other offers (e.g. the AI quiz)
        # out of the GBP funnel's sendkpi-signup automations.
        "tags": [*([SIGNUP_TAG] if signup_tag else []), *(tags or [])],
    }
    if name:
        payload["name"] = name.strip()
    if email:
        payload["email"] = email.strip()
    if phone:
        payload["phone"] = phone.strip()
    if business:
        payload["companyName"] = business.strip()

    def post(body: dict):
        try:
            return requests.post(
                UPSERT_URL,
                json=body,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Version": API_VERSION,
                    "Content-Type": "application/json",
                },
                timeout=10,
            )
        except Exception as e:  # DNS, timeout, TLS -- all the same to the caller
            raise GhlError(f"GHL request failed: {e}")

    fields = []
    for key, value in (custom_fields or {}).items():
        if not value or not value.strip():
            continue
        field_id = _custom_field_id(token, location_id, key)
        ref = {"id": field_id} if field_id else {"key": key.removeprefix("contact.")}
        fields.append({**ref, "field_value": value.strip()})

    if fields:
        resp = post({**payload, "customFields": fields})
        if 400 <= resp.status_code < 500:
            resp = post(payload)
    else:
        resp = post(payload)

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


def add_note(contact_id: str, body: str) -> None:
    """Attach a note to an existing contact (e.g. the link to their campaign
    kit). Notes need no custom-field setup in the sub-account, which is why
    the kit link travels this way instead of as a custom field."""
    token = os.environ.get("GHL_API_TOKEN")
    if not token or not contact_id:
        raise GhlError("GHL_API_TOKEN not set or no contact id")
    import requests
    try:
        resp = requests.post(
            f"https://services.leadconnectorhq.com/contacts/{contact_id}/notes",
            json={"body": body},
            headers={
                "Authorization": f"Bearer {token}",
                "Version": API_VERSION,
                "Content-Type": "application/json",
            },
            timeout=10,
        )
    except Exception as e:
        raise GhlError(f"GHL request failed: {e}")
    if resp.status_code >= 400:
        raise GhlError(f"GHL note rejected (HTTP {resp.status_code})")

"""
Google Places API (New) client -- the "Google Business Profile lookup" step.

Docs this is built against (current as of mid-2026):
  Text Search (New):   https://developers.google.com/maps/documentation/places/web-service/text-search
  Place Details (New): https://developers.google.com/maps/documentation/places/web-service/place-details
  Place Photos (New):  https://developers.google.com/maps/documentation/places/web-service/place-photos

Note: this deliberately uses the *New* Places API (places.googleapis.com/v1),
not the legacy maps.googleapis.com/maps/api/place/* endpoints. The new API
uses a required X-Goog-FieldMask header on every request -- if you add fields
to a profile later, add them to the field mask below or Google will silently
omit them from the response.
"""
from __future__ import annotations

import dataclasses
import os
from typing import Optional

import requests

PLACES_BASE = "https://places.googleapis.com/v1"

# Each field here carries its own billing SKU on Google's side, so this list
# is deliberately scoped to what the lander actually uses -- don't switch
# this to "*" in production (Google explicitly discourages that).
DETAILS_FIELD_MASK = ",".join([
    "id",
    "displayName",
    "formattedAddress",
    "nationalPhoneNumber",
    "internationalPhoneNumber",
    "websiteUri",
    "googleMapsUri",
    "regularOpeningHours",
    "currentOpeningHours",
    "rating",
    "userRatingCount",
    "reviews",
    "photos",
    "primaryType",
    "primaryTypeDisplayName",
    "editorialSummary",
    "businessStatus",
    "location",
])

SEARCH_FIELD_MASK = ",".join([
    "places.id",
    "places.displayName",
    "places.formattedAddress",
    "places.location",
    "places.primaryTypeDisplayName",
])


class PlacesApiError(RuntimeError):
    pass


@dataclasses.dataclass
class PlaceCandidate:
    """One result from a text search -- there's usually more than one."""
    place_id: str
    name: str
    address: str
    category: Optional[str]
    lat: Optional[float]
    lng: Optional[float]


@dataclasses.dataclass
class PlaceProfile:
    """Full Place Details response, reshaped into something easy to work with."""
    place_id: str
    name: str
    address: str
    phone_national: Optional[str]
    phone_international: Optional[str]
    website: Optional[str]
    maps_url: Optional[str]
    category: Optional[str]
    rating: Optional[float]
    review_count: Optional[int]
    reviews: list
    photos: list  # raw photo dicts: {"name": "places/X/photos/Y", "widthPx":.., "heightPx":..}
    hours: list  # Google's pre-formatted weekday strings, Monday first
    open_now: Optional[bool]
    editorial_summary: Optional[str]
    raw: dict  # full decoded response, kept around for fields not modeled above


class GooglePlacesClient:
    def __init__(self, api_key: Optional[str] = None, session: Optional[requests.Session] = None):
        self.api_key = api_key or os.environ.get("GOOGLE_PLACES_API_KEY")
        if not self.api_key:
            raise PlacesApiError(
                "No API key provided. Pass api_key=... or set GOOGLE_PLACES_API_KEY."
            )
        self.session = session or requests.Session()

    def _headers(self, field_mask: str) -> dict:
        return {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": self.api_key,
            "X-Goog-FieldMask": field_mask,
        }

    def search(
        self,
        query: str,
        lat: Optional[float] = None,
        lng: Optional[float] = None,
        radius_m: int = 30000,
        max_results: int = 5,
    ) -> list[PlaceCandidate]:
        """Find candidate businesses for a free-text query.

        Returns multiple candidates on purpose. Business names collide often
        enough -- multiple locations of the same brand, similar names in the
        same metro -- that you should confirm the right one with the
        customer before locking in a place_id, rather than assuming
        candidates[0] is correct.
        """
        body: dict = {"textQuery": query, "maxResultCount": max_results}
        if lat is not None and lng is not None:
            body["locationBias"] = {
                "circle": {"center": {"latitude": lat, "longitude": lng}, "radius": radius_m}
            }
        resp = self.session.post(
            f"{PLACES_BASE}/places:searchText",
            headers=self._headers(SEARCH_FIELD_MASK),
            json=body,
            timeout=15,
        )
        if not resp.ok:
            raise PlacesApiError(f"searchText failed ({resp.status_code}): {resp.text}")

        candidates = []
        for p in resp.json().get("places", []):
            loc = p.get("location") or {}
            type_label = p.get("primaryTypeDisplayName") or {}
            candidates.append(
                PlaceCandidate(
                    place_id=p["id"],
                    name=p.get("displayName", {}).get("text", "Unknown"),
                    address=p.get("formattedAddress", ""),
                    category=type_label.get("text"),
                    lat=loc.get("latitude"),
                    lng=loc.get("longitude"),
                )
            )
        return candidates

    def get_details(self, place_id: str) -> PlaceProfile:
        resp = self.session.get(
            f"{PLACES_BASE}/places/{place_id}",
            headers=self._headers(DETAILS_FIELD_MASK),
            timeout=15,
        )
        if not resp.ok:
            raise PlacesApiError(f"Place Details failed ({resp.status_code}): {resp.text}")
        d = resp.json()

        # currentOpeningHours falls back to regularOpeningHours for places
        # that don't have today's actual schedule (e.g. holiday closures).
        hours_block = d.get("currentOpeningHours") or d.get("regularOpeningHours") or {}
        type_label = d.get("primaryTypeDisplayName") or {}

        return PlaceProfile(
            place_id=d["id"],
            name=d.get("displayName", {}).get("text", "Unknown"),
            address=d.get("formattedAddress", ""),
            phone_national=d.get("nationalPhoneNumber"),
            phone_international=d.get("internationalPhoneNumber"),
            website=d.get("websiteUri"),
            maps_url=d.get("googleMapsUri"),
            category=type_label.get("text"),
            rating=d.get("rating"),
            review_count=d.get("userRatingCount"),
            reviews=d.get("reviews", []),
            photos=d.get("photos", []),
            hours=hours_block.get("weekdayDescriptions", []),
            open_now=hours_block.get("openNow"),
            editorial_summary=(d.get("editorialSummary") or {}).get("text"),
            raw=d,
        )

    def photo_media_url(self, photo_name: str, max_width: int = 1200) -> str:
        """Live, key-bearing URL to a photo's bytes.

        `photo_name` is the `name` field from a photo object on Place
        Details/Text Search, e.g. "places/XXXX/photos/YYYY". Don't put this
        URL directly into a customer-facing landing page -- it has your API
        key in the query string. Download the bytes (see download_photo) and
        re-host them instead.
        """
        return f"{PLACES_BASE}/{photo_name}/media?maxWidthPx={max_width}&key={self.api_key}"

    def download_photo(self, photo_name: str, dest_path: str, max_width: int = 1200) -> str:
        url = self.photo_media_url(photo_name, max_width=max_width)
        resp = self.session.get(url, timeout=20, stream=True)
        if not resp.ok:
            raise PlacesApiError(f"Photo download failed ({resp.status_code}) for {photo_name}")
        os.makedirs(os.path.dirname(dest_path), exist_ok=True)
        with open(dest_path, "wb") as f:
            for chunk in resp.iter_content(8192):
                f.write(chunk)
        return dest_path

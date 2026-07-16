"""
FastAPI backend for GBP Lander Builder.

Wraps the existing Places API client + lander_builder heuristics behind
three plain JSON/image endpoints, so the React frontend (running in the
browser) never touches the Google API key directly -- it only ever talks
to this server.

Run locally:
    uvicorn server.main:app --reload --port 8000

Deployed on Render, the start command is:
    uvicorn server.main:app --host 0.0.0.0 --port $PORT

Environment variables required:
    GOOGLE_PLACES_API_KEY  -- same key used by the CLI pipeline
    PUBLIC_BASE_URL        -- the public https URL this service is deployed
                              at (e.g. https://gbp-lander-backend.onrender.com),
                              used to build absolute photo URLs. Not needed
                              for local dev -- photo URLs just fall back to
                              relative paths, which work fine on localhost.
"""
from __future__ import annotations

import io
import os
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from src.ai_copy import generate_ad_copy, generate_extras
from src.brand_color import fetch_brand_color
from src.lander_builder import build_profile
from src.lead_store import LeadStoreError, insert_lead
from src.places_client import GooglePlacesClient, PlacesApiError
from src.website_scraper import (
    ScrapeBlocked,
    scrape_about_page,
    scrape_service_area_page,
    scrape_website,
)

load_dotenv()

app = FastAPI(title="GBP Lander Builder API")

# Wide open on purpose -- this API only ever returns public business-listing
# data (no user accounts, no write operations), so there's nothing sensitive
# to protect with a stricter origin allowlist. Tighten this later if that
# ever changes.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

BASE_URL = os.environ.get("PUBLIC_BASE_URL", "").rstrip("/")


def _client() -> GooglePlacesClient:
    try:
        return GooglePlacesClient()
    except PlacesApiError as e:
        # Missing/bad key on the server -- not the caller's fault, so 500.
        raise HTTPException(status_code=500, detail=str(e))


def _photo_url(photo_name: str) -> str:
    return f"{BASE_URL}/api/photo?photo_name={photo_name}"


@app.get("/api/search")
def search(q: str = Query(..., min_length=2, description="Business name + location")):
    """Cheap lookup for the candidate picker. Deliberately excludes phone,
    rating, and photos -- those live in the pricier Place Details tier and
    are only fetched once, after the user picks one specific business.
    """
    client = _client()
    try:
        candidates = client.search(q)
    except PlacesApiError as e:
        raise HTTPException(status_code=502, detail=str(e))

    return [
        {
            "place_id": c.place_id,
            "name": c.name,
            "address": c.address,
            "category": c.category,
        }
        for c in candidates
    ]


@app.get("/api/profile")
def profile(place_id: str):
    """Full profile for a single chosen business -- the pricier call.
    Returns the exact JSON shape the frontend's buildLanderHTML(d) expects.
    """
    client = _client()
    try:
        place = client.get_details(place_id)
    except PlacesApiError as e:
        raise HTTPException(status_code=502, detail=str(e))

    site = None
    if place.website:
        try:
            site = scrape_website(place.website)
        except ScrapeBlocked:
            site = None
        except Exception:
            site = None

    service_area_site = scrape_service_area_page(place.website) if place.website else None

    brand_color = None
    logo_url = site.logo_url if site else None
    if logo_url:
        brand_color = fetch_brand_color(logo_url)
    if not brand_color and site and site.og_image:
        brand_color = fetch_brand_color(site.og_image)

    photo_refs = [p["name"] for p in place.photos[:8]]
    photo_urls = [_photo_url(ref) for ref in photo_refs]

    # Reuse the existing merge/heuristic logic (tagline, service chips,
    # service-area extraction, review reshaping) -- it already does the
    # hard part. We just remap its output keys to what the frontend expects.
    ctx = build_profile(place, site, photo_urls, service_area_site)

    return {
        "name": ctx["name"],
        "category": ctx["category"],
        "address": ctx["address"],
        "phone_national": place.phone_national,
        "phone_international": place.phone_international,
        "website": place.website,
        "maps_url": ctx["maps_url"],
        "rating": ctx["rating"],
        "review_count": ctx["review_count"],
        "tagline": ctx["tagline"],
        "open_now": ctx["open_now"],
        "hours": ctx["hours"],
        "services": ctx["services"],
        "service_areas": ctx["service_areas"],
        "reviews": ctx["reviews"],
        "photos": photo_urls,
        "brand_color": brand_color,
    }


@app.get("/api/photo")
def photo(photo_name: str, max_width: int = 800):
    """Streams a Google Place photo's bytes. The key never leaves this
    server -- the browser only ever sees this proxied URL.
    """
    client = _client()
    try:
        resp = client.session.get(
            client.photo_media_url(photo_name, max_width=max_width),
            timeout=20,
        )
        resp.raise_for_status()
    except Exception:
        raise HTTPException(status_code=502, detail="Could not fetch photo")

    return StreamingResponse(
        io.BytesIO(resp.content),
        media_type=resp.headers.get("Content-Type", "image/jpeg"),
    )


@app.get("/api/health")
def health():
    """Simple endpoint to confirm the service is up and the key is set."""
    has_places_key = bool(os.environ.get("GOOGLE_PLACES_API_KEY"))
    has_anthropic_key = bool(os.environ.get("ANTHROPIC_API_KEY"))
    return {
        "status": "ok",
        "api_key_configured": has_places_key,
        "anthropic_key_configured": has_anthropic_key,
        "lead_store_configured": bool(os.environ.get("DATABASE_URL")),
    }


class LeadRequest(BaseModel):
    """A lead submitted from the lander's "ask a question" modal.

    Lengths are capped to keep an unauthenticated public endpoint from being
    used to shovel oversized payloads into the database.
    """
    name: str = Field(min_length=1, max_length=200)
    phone: str = Field(min_length=1, max_length=50)
    business: Optional[str] = Field(default=None, max_length=200)
    pref: Optional[str] = None  # 'call' | 'text'
    url: Optional[str] = Field(default=None, max_length=2000)
    fbclid: Optional[str] = Field(default=None, max_length=500)
    gclid: Optional[str] = Field(default=None, max_length=500)


@app.post("/api/lead")
def create_lead(req: LeadRequest):
    """Store a lead captured by the lander's question modal.

    Fire-and-forget from the browser's perspective (the modal shows its
    confirmation regardless), but this persists the row so nothing is lost.
    """
    pref = req.pref if req.pref in ("call", "text") else None
    try:
        lead_id = insert_lead(
            business=req.business,
            name=req.name.strip(),
            phone=req.phone.strip(),
            contact_pref=pref,
            source="form",
            page_url=req.url,
            fbclid=req.fbclid,
            gclid=req.gclid,
        )
    except LeadStoreError:
        # DATABASE_URL not configured -- the store isn't set up yet.
        raise HTTPException(status_code=503, detail="Lead store not configured")
    except Exception:
        # Don't echo driver errors (they can leak connection details).
        raise HTTPException(status_code=502, detail="Could not save lead")

    return {"ok": True, "id": lead_id}


class OfferRequest(BaseModel):
    website: Optional[str] = None
    name: str
    category: str = ""
    tagline: Optional[str] = None
    services: list[str] = []
    service_areas: list[str] = []


@app.post("/api/generate-offer")
def generate_offer(req: OfferRequest):
    """Scrapes the business's own site fresh (cheap, no Google billing --
    the caller already has the Places-derived profile from /api/profile,
    so we don't re-fetch that here) and calls Claude once to pull out real
    benefits/guarantees already on the site and turn them into an
    above-the-fold offer plus short site/about summaries. Fully automatic,
    no owner input required.
    """
    home_text = ""
    about_text = None
    service_area_text = None

    if req.website:
        try:
            home = scrape_website(req.website)
            home_text = " ".join(home.paragraphs + home.headings)
        except (ScrapeBlocked, Exception):
            home_text = ""

        about = scrape_about_page(req.website)
        if about:
            about_text = " ".join(about.paragraphs + about.headings)

        areas_page = scrape_service_area_page(req.website)
        if areas_page:
            service_area_text = " ".join(areas_page.paragraphs + areas_page.headings)

    try:
        extras = generate_extras(
            name=req.name,
            category=req.category,
            tagline=req.tagline,
            services=req.services,
            home_text=home_text,
            about_text=about_text,
            service_areas=req.service_areas,
            service_area_text=service_area_text,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Offer generation failed: {e}")

    return extras


class AdCopyRequest(BaseModel):
    """Everything here comes straight out of a saved lander's profile jsonb,
    so the frontend can build the payload without any new fetches.
    """
    name: str
    category: str = ""
    tagline: Optional[str] = None
    services: list[str] = []
    service_areas: list[str] = []
    rating: Optional[float] = None
    review_count: Optional[int] = None
    offer_headline: Optional[str] = None
    offer_subhead: Optional[str] = None
    offer_guarantee: Optional[str] = None
    summary: Optional[str] = None


@app.post("/api/generate-ad-copy")
def generate_ad_copy_route(req: AdCopyRequest):
    """One Claude call turning a saved lander profile into ad copy (on-image
    headline/subline/CTA + feed primary text). No scraping and no Google
    billing -- the stored profile already has everything the prompt needs.
    """
    try:
        return generate_ad_copy(
            name=req.name,
            category=req.category,
            tagline=req.tagline,
            services=req.services,
            service_areas=req.service_areas,
            rating=req.rating,
            review_count=req.review_count,
            offer_headline=req.offer_headline,
            offer_subhead=req.offer_subhead,
            offer_guarantee=req.offer_guarantee,
            summary=req.summary,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Ad copy generation failed: {e}")
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
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field
from starlette.background import BackgroundTask
from starlette.concurrency import run_in_threadpool

from src.ai_copy import (
    generate_ad_angles,
    generate_ad_copy,
    generate_angle_ad_variations,
    generate_extras,
    generate_google_rsa,
)
from src.brand_color import fetch_brand_color
from src.ghl_client import GhlError, is_configured as ghl_is_configured, upsert_contact
from src.lander_builder import build_profile
from src.lead_store import LeadStoreError, insert_lead
from src.meta_capi import MetaCapiError, send_event
from src.places_client import GooglePlacesClient, PlacesApiError
from src.usage_log import is_blocked, log_request
from src.website_scraper import (
    ScrapeBlocked,
    scrape_about_page,
    scrape_contact_page,
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


@app.middleware("http")
async def usage_and_blocklist(request: Request, call_next):
    """Log every /api/* request and enforce the admin's IP blocklist.

    Both halves power the admin dashboard: the log feeds the traffic/bot
    view, and the blocklist is how a bot gets cut off before it burns
    Places/Claude spend. DB work runs in the threadpool (psycopg is sync)
    and silently no-ops if the usage store isn't configured. /api/health is
    exempt so monitoring never depends on the database.
    """
    path = request.url.path
    if not path.startswith("/api/") or path == "/api/health":
        return await call_next(request)

    # Behind Vercel's proxy the caller is the first x-forwarded-for hop.
    ip = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip() or (
        request.client.host if request.client else ""
    )
    if ip and await run_in_threadpool(is_blocked, ip):
        return JSONResponse(status_code=403, content={"detail": "Access blocked"})

    response = await call_next(request)
    # Log AFTER the response is sent (Starlette background tasks run once the
    # body has gone out, still inside this invocation) -- the caller never
    # waits on the usage INSERT.
    response.background = BackgroundTask(
        log_request, path.removeprefix("/api/"), ip, request.headers.get("user-agent")
    )
    return response


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

    # Places API returns at most 10 photos per listing (Google's featured
    # ranking; there's no recency ordering or paging beyond this).
    photo_refs = [p["name"] for p in place.photos[:10]]
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
        "meta_capi_configured": bool(os.environ.get("META_PIXEL_ID") and os.environ.get("META_CAPI_ACCESS_TOKEN")),
        "ghl_configured": ghl_is_configured(),
    }


class MetaEventRequest(BaseModel):
    """One conversion event for sendkpi.com's own Meta ad tracking (a
    business owner signing up), sent alongside the matching browser-side
    fbq() call. event_id must match that call exactly so Meta dedupes the
    browser and server copies of the same event instead of double counting.
    """
    event_name: str = Field(min_length=1, max_length=100)
    event_id: str = Field(min_length=1, max_length=200)
    event_source_url: str = Field(min_length=1, max_length=2000)
    email: Optional[str] = Field(default=None, max_length=320)
    phone: Optional[str] = Field(default=None, max_length=50)
    fbc: Optional[str] = Field(default=None, max_length=500)
    fbp: Optional[str] = Field(default=None, max_length=500)


@app.post("/api/meta-event")
def meta_event(req: MetaEventRequest, request: Request):
    """Server-side half of Meta Conversions API tracking for sendkpi.com's
    own ad campaigns. Never allowed to fail the caller's actual action (e.g.
    account signup) -- if Meta isn't configured yet or the request to Meta
    fails, this just reports ok:false rather than raising.
    """
    try:
        send_event(
            event_name=req.event_name,
            event_id=req.event_id,
            event_source_url=req.event_source_url,
            client_ip=request.client.host if request.client else None,
            client_user_agent=request.headers.get("user-agent"),
            email=req.email,
            phone=req.phone,
            fbc=req.fbc,
            fbp=req.fbp,
            test_event_code=os.environ.get("META_TEST_EVENT_CODE") or None,
        )
        return {"ok": True}
    except MetaCapiError:
        return {"ok": False}


class GhlContactRequest(BaseModel):
    """One funnel signup to sync into GoHighLevel as a contact. Sent by the
    frontend right after the lander save lands (i.e. post Google OAuth).
    """
    name: Optional[str] = Field(default=None, max_length=200)
    email: Optional[str] = Field(default=None, max_length=320)
    phone: Optional[str] = Field(default=None, max_length=50)
    business: Optional[str] = Field(default=None, max_length=200)


@app.post("/api/ghl-contact")
def ghl_contact(req: GhlContactRequest):
    """Upsert a signup into the GHL sub-account. Same contract as
    /api/meta-event: never allowed to fail the caller's actual action --
    if GHL isn't configured yet or its API errors, report ok:false and
    move on. The signup itself already succeeded in Supabase.
    """
    try:
        upsert_contact(
            name=req.name,
            email=req.email,
            phone=req.phone,
            business=req.business,
        )
        return {"ok": True}
    except GhlError:
        return {"ok": False}


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
    nav_labels: list[str] = []

    if req.website:
        try:
            home = scrape_website(req.website)
            home_text = " ".join(home.paragraphs + home.headings)
            nav_labels = home.nav_labels
        except (ScrapeBlocked, Exception):
            home_text = ""

        about = scrape_about_page(req.website)
        if about:
            about_text = " ".join(about.paragraphs + about.headings)

        # Locations pages often name their cities only in places plain text
        # extraction misses: the meta description ("Three Locations in San
        # Jose, San Rafael, and Santa Cruz"), the title, or link-card labels.
        # Include all of them alongside the body text.
        def _area_text(page):
            return " ".join(
                [page.title or "", page.meta_description or ""]
                + page.paragraphs + page.headings + page.link_labels
            ).strip()

        areas_page = scrape_service_area_page(req.website)
        if areas_page:
            service_area_text = _area_text(areas_page)
        else:
            # No locations/service-areas page -- the Contact page usually at
            # least names the cities/counties the business works in.
            contact_page = scrape_contact_page(req.website)
            if contact_page:
                service_area_text = _area_text(contact_page)

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
            nav_labels=nav_labels,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Offer generation failed: {e}")

    return extras


class ReviewExcerpt(BaseModel):
    author: Optional[str] = None
    rating: Optional[float] = None
    text: str = Field(default="", max_length=600)


class AnglesRequest(BaseModel):
    """Profile data the frontend already holds after /api/profile +
    /api/generate-offer, plus the one thing only the owner knows: the main
    service they want more calls for.
    """
    name: str
    category: str = ""
    services: list[str] = []
    service_areas: list[str] = []
    rating: Optional[float] = None
    review_count: Optional[int] = None
    address: str = ""
    reviews: list[ReviewExcerpt] = []
    summary: Optional[str] = None
    main_service: str = Field(min_length=1, max_length=200)


@app.post("/api/generate-angles")
def generate_angles_route(req: AnglesRequest):
    """One Claude call returning 5-7 winning ad angles customized to this
    business (its reviews, location, services) and the owner's stated main
    service. Shown as a picker before the lander is built -- the chosen angle
    drives both the lander's above-the-fold copy and the ad variations.
    """
    try:
        return generate_ad_angles(
            name=req.name,
            category=req.category,
            services=req.services,
            service_areas=req.service_areas,
            rating=req.rating,
            review_count=req.review_count,
            address=req.address,
            reviews=[r.model_dump() for r in req.reviews],
            summary=req.summary,
            main_service=req.main_service,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Angle research failed: {e}")


class ChosenAngle(BaseModel):
    id: str = ""
    label: str = ""
    hook: str = ""
    why: str = ""
    lander_headline: str = ""
    lander_subhead: str = ""
    cta_label: str = ""


class AngleAdsRequest(BaseModel):
    name: str
    category: str = ""
    services: list[str] = []
    service_areas: list[str] = []
    rating: Optional[float] = None
    review_count: Optional[int] = None
    summary: Optional[str] = None
    main_service: str = ""
    angle: ChosenAngle


@app.post("/api/generate-angle-ads")
def generate_angle_ads_route(req: AngleAdsRequest):
    """One Claude call turning the chosen angle into 4 distinct ad copy
    variations -- one per auto-selected photo in the Ads step.
    """
    try:
        return generate_angle_ad_variations(
            name=req.name,
            category=req.category,
            services=req.services,
            service_areas=req.service_areas,
            rating=req.rating,
            review_count=req.review_count,
            summary=req.summary,
            main_service=req.main_service,
            angle=req.angle.model_dump(),
        )
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Ad variation generation failed: {e}")


class GoogleAdsRequest(BaseModel):
    """Same profile-derived payload as AngleAdsRequest -- the frontend already
    holds everything, no new fetches needed."""
    name: str
    category: str = ""
    services: list[str] = []
    service_areas: list[str] = []
    rating: Optional[float] = None
    review_count: Optional[int] = None
    summary: Optional[str] = None
    main_service: str = ""
    angle: ChosenAngle


@app.post("/api/generate-google-ads")
def generate_google_ads_route(req: GoogleAdsRequest):
    """One Claude call turning the chosen angle into Responsive Search Ad
    assets (15 headlines / 4 descriptions), delivered to the user as a text
    file alongside the lander and Meta ad images.
    """
    try:
        return generate_google_rsa(
            name=req.name,
            category=req.category,
            services=req.services,
            service_areas=req.service_areas,
            rating=req.rating,
            review_count=req.review_count,
            summary=req.summary,
            main_service=req.main_service,
            angle=req.angle.model_dump(),
        )
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Google ads generation failed: {e}")


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
    angle: str = "offer"  # 'offer' | 'dont_delay'


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
            angle=req.angle if req.angle in ("offer", "dont_delay") else "offer",
        )
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Ad copy generation failed: {e}")
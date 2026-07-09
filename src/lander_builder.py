"""
Merges a PlaceProfile (Google Business Profile) and optional WebsiteContent
(scraped from the business's own site) into the flat dict the Jinja2
template renders, then writes the landing page to disk.

This step is deliberately "dumb" -- it picks the longest headings as
candidate service chips and concatenates real scraped copy, no AI involved.
That's the seam where the copywriting/extraction model from the rest of the
pipeline plugs in later: same inputs (PlaceProfile + WebsiteContent), better
output (extracted services, a written tagline, ranked photos) in place of
build_profile()'s current heuristics.
"""
from __future__ import annotations

import datetime
import os
import re
from typing import Optional

from jinja2 import Environment, FileSystemLoader, select_autoescape

from .places_client import PlaceProfile
from .website_scraper import WebsiteContent

TEMPLATE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "templates")

# Matches the Monday-first ordering Google's weekdayDescriptions come back in.
WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def _today_name() -> str:
    return WEEKDAY_NAMES[datetime.datetime.now().weekday()]


def _phone_href(phone_international: Optional[str]) -> Optional[str]:
    if not phone_international:
        return None
    digits = re.sub(r"[^\d+]", "", phone_international)
    return f"tel:{digits}"


def _build_reviews(raw_reviews: list, max_reviews: int = 5, max_chars: int = 240) -> list[dict]:
    """Reshapes raw Place Details `reviews[]` entries for the template.

    Schema reference (Places API New): each entry has rating, text.text,
    authorAttribution.displayName, relativePublishTimeDescription,
    publishTime (RFC3339, used here to sort newest-first -- Google's own
    ordering is relevance, not recency). Google caps Place Details at 5
    reviews per request regardless of what you ask for, so max_reviews here
    is a ceiling, not a real limiter.
    """
    raw_reviews = sorted(raw_reviews, key=lambda r: r.get("publishTime") or "", reverse=True)
    out = []
    for r in raw_reviews[:max_reviews]:
        text = ((r.get("text") or {}).get("text") or "").strip()
        if not text:
            continue
        if len(text) > max_chars:
            text = text[:max_chars].rsplit(" ", 1)[0] + "…"
        out.append({
            "author": (r.get("authorAttribution") or {}).get("displayName", "Google user"),
            "rating": r.get("rating"),
            "text": text,
            "relative_time": r.get("relativePublishTimeDescription"),
        })
    return out


# Matches a sentence introducing a service area, e.g. "Proudly serving
# Austin, Round Rock, and Cedar Park." Loose by design -- this is a stopgap
# until service-area data comes from somewhere structured (the Business
# Profile API exposes a real serviceArea field, but that requires the
# business owner's OAuth consent, not just an API key).
_SERVICE_AREA_RE = re.compile(
    r"(?:proudly serving|serving|service areas?|areas? we serve)\s*[:\-]?\s*(.+)",
    re.IGNORECASE,
)


def _extract_service_areas(site: Optional[WebsiteContent], address: str, max_areas: int = 10) -> list[str]:
    candidates: list[str] = []
    if site:
        for block in site.paragraphs + site.headings:
            m = _SERVICE_AREA_RE.search(block)
            if not m:
                continue
            tail = re.split(r"[.!?]", m.group(1))[0]
            for part in re.split(r",|\band\b|&", tail):
                part = part.strip(" .")
                if 2 <= len(part) <= 30 and part[:1].isupper():
                    candidates.append(part)
            if candidates:
                break

    if not candidates and address:
        # Fall back to the business's own city rather than showing nothing.
        parts = [p.strip() for p in address.split(",")]
        if len(parts) >= 2 and parts[1]:
            candidates = [parts[1]]

    seen = set()
    deduped = []
    for c in candidates:
        key = c.lower()
        if key not in seen:
            seen.add(key)
            deduped.append(c)
    return deduped[:max_areas]


# Matches headings that show up on service-business homepages but aren't
# themselves a service -- nav items, FAQ/legal boilerplate, service-area
# callouts, etc. Loose by design, same spirit as _SERVICE_AREA_RE above.
_NON_SERVICE_HEADING_RE = re.compile(
    r"\b(faq|frequently asked|about( us)?|contact( us)?|testimonials?|"
    r"reviews?|blog|gallery|areas?( we serv[a-z]*)?|service areas?|"
    r"proudly serving|serving\b|surrounding|location|hours|our team|"
    r"meet the team|careers|privacy|terms( of service)?|why choose|"
    r"welcome to|home)\b",
    re.IGNORECASE,
)


def build_profile(
    place: PlaceProfile,
    site: Optional[WebsiteContent],
    local_photo_paths: list[str],
) -> dict:
    """Build the flat context dict the template consumes.

    `local_photo_paths` should be paths *relative to the output HTML file*,
    pointing at already-downloaded copies of the GBP photos (see
    GooglePlacesClient.download_photo). Don't pass Google's live photo URLs
    in here -- those carry your API key in the query string and shouldn't
    end up in a customer-facing page.
    """
    tagline = place.editorial_summary or (site.meta_description if site else None)

    # Candidate "service" chips, pulled straight from the site's own
    # headings. Simple on purpose -- see module docstring. Excludes
    # headings that are obviously navigation/boilerplate rather than an
    # actual service (FAQ, service-area callouts, About/Contact, etc.).
    services: list[str] = []
    if site:
        seen_lower = set()
        for h in site.headings:
            key = h.lower()
            if key in seen_lower or not (3 <= len(h) <= 40):
                continue
            if _NON_SERVICE_HEADING_RE.search(h):
                continue
            services.append(h)
            seen_lower.add(key)
    services = services[:8]

    gallery = list(local_photo_paths)
    if site:
        remaining = max(0, 10 - len(gallery))
        gallery += site.images[:remaining]

    return {
        "name": place.name,
        "category": place.category or "",
        "address": place.address,
        "phone_display": place.phone_national or place.phone_international or "",
        "phone_href": _phone_href(place.phone_international),
        "maps_url": place.maps_url,
        "rating": place.rating,
        "review_count": place.review_count,
        "reviews": _build_reviews(place.reviews),
        "open_now": place.open_now,
        "hours": place.hours,
        "today": _today_name(),
        "tagline": tagline,
        "services": services,
        "service_areas": _extract_service_areas(site, place.address),
        "gallery": gallery,
        "hero_image": gallery[0] if gallery else None,
        "source_website": site.url if site else None,
    }


def render_lander(context: dict, output_path: str) -> str:
    env = Environment(
        loader=FileSystemLoader(TEMPLATE_DIR),
        autoescape=select_autoescape(["html"]),
    )
    template = env.get_template("lander.html")
    html = template.render(**context)
    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html)
    return output_path

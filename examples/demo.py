"""
Renders a landing page from mock data -- no Google API key needed.

This exercises the exact same build_profile()/render_lander() path the real
pipeline uses; only the data source is faked (a hand-written PlaceProfile and
WebsiteContent instead of live API/scrape calls). Useful as a quick way to
see the template, and as a smoke test when you change the design.

    python examples/demo.py
"""
from __future__ import annotations

import os
import sys

from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.lander_builder import build_profile, render_lander  # noqa: E402
from src.places_client import PlaceProfile  # noqa: E402
from src.website_scraper import WebsiteContent  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
PHOTO_DIR = os.path.join(HERE, "demo_photos")
OUT_PATH = os.path.join(HERE, "demo_lander.html")

# A few warm/cool tones so the placeholder gallery doesn't look monochrome.
PALETTE = ["#3A4750", "#5B6B79", "#8E5A3C", "#4A5A4D", "#6B4A52"]
LABELS = ["Job site", "Crew at work", "Before / after", "Service van", "Finished install"]


def make_placeholder_photos() -> list[str]:
    """Generates simple labeled rectangles standing in for real downloaded
    GBP/website photos, so the demo is fully self-contained (no network
    calls when this file is opened in a browser)."""
    os.makedirs(PHOTO_DIR, exist_ok=True)
    rel_paths = []
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 28)
    except Exception:
        font = ImageFont.load_default()

    for i, (color, label) in enumerate(zip(PALETTE, LABELS)):
        img = Image.new("RGB", (900, 650), color)
        draw = ImageDraw.Draw(img)
        draw.text((36, 36), label, fill="#F2F1ED", font=font)
        path = os.path.join(PHOTO_DIR, f"photo_{i}.jpg")
        img.save(path, "JPEG", quality=85)
        rel_paths.append(os.path.relpath(path, start=HERE))
    return rel_paths


def main():
    photos = make_placeholder_photos()

    place = PlaceProfile(
        place_id="demo_place_id",
        name="Hargrove Plumbing & Drain",
        address="4108 Burnet Rd, Austin, TX 78756",
        phone_national="(512) 555-0134",
        phone_international="+15125550134",
        website="https://example.com",
        maps_url="https://maps.google.com/?cid=demo",
        category="Plumber",
        rating=4.8,
        review_count=212,
        reviews=[
            {
                "rating": 5,
                "text": {"text": "Called at 9pm with a burst pipe and they had someone out within the hour. Fair price, no upsell games. Would call again in a heartbeat."},
                "authorAttribution": {"displayName": "Maria T."},
                "relativePublishTimeDescription": "3 weeks ago",
            },
            {
                "rating": 5,
                "text": {"text": "Replaced our water heater same day. Cleaned up after themselves and explained everything before doing the work."},
                "authorAttribution": {"displayName": "Devon K."},
                "relativePublishTimeDescription": "a month ago",
            },
            {
                "rating": 4,
                "text": {"text": "Good work, a little pricier than I expected, but they were upfront about cost before starting."},
                "authorAttribution": {"displayName": "Sam R."},
                "relativePublishTimeDescription": "2 months ago",
            },
        ],
        photos=[],
        hours=[
            "Monday: 7:00 AM – 6:00 PM",
            "Tuesday: 7:00 AM – 6:00 PM",
            "Wednesday: 7:00 AM – 6:00 PM",
            "Thursday: 7:00 AM – 6:00 PM",
            "Friday: 7:00 AM – 6:00 PM",
            "Saturday: 8:00 AM – 2:00 PM",
            "Sunday: Closed",
        ],
        open_now=True,
        editorial_summary="Family-owned plumbing crew serving North Austin since 1998 — same-day emergency calls.",
        raw={},
    )

    site = WebsiteContent(
        url="https://example.com",
        title="Hargrove Plumbing & Drain",
        meta_description="Licensed Austin plumbers for drain cleaning, water heaters, leak repair, and re-pipes.",
        og_image=None,
        headings=[
            "Drain Cleaning",
            "Water Heater Repair & Install",
            "Leak Detection",
            "Re-Pipes",
            "Emergency Plumbing",
            "Slab Leak Repair",
        ],
        paragraphs=[
            "Hargrove Plumbing has been fixing North Austin's pipes since 1998. "
            "We show up on time, quote the job up front, and stand behind every repair.",
            "Proudly serving Austin, Round Rock, Cedar Park, Pflugerville, and Georgetown.",
        ],
        images=[],
    )

    context = build_profile(place, site, photos)
    render_lander(context, OUT_PATH)
    print(f"Demo lander written to: {OUT_PATH}")


if __name__ == "__main__":
    main()

"""
CLI entry point.

    export GOOGLE_PLACES_API_KEY=your_key_here
    python main.py "Joe's Plumbing, Austin TX"

Pipeline: search -> confirm match -> place details -> download photos ->
scrape attached website -> render landing page to
./output/<place_id>/lander.html
"""
from __future__ import annotations

import argparse
import os
import sys

from dotenv import load_dotenv

from src.brand_color import contrast_ink, fetch_brand_color
from src.lander_builder import build_profile, render_lander
from src.places_client import GooglePlacesClient, PlacesApiError
from src.website_scraper import ScrapeBlocked, scrape_website

load_dotenv()


def main():
    parser = argparse.ArgumentParser(
        description="Build a call-conversion lander from a Google Business Profile."
    )
    parser.add_argument("query", help='Business name + location, e.g. "Joe\'s Plumbing, Austin TX"')
    parser.add_argument("--api-key", default=None, help="Defaults to GOOGLE_PLACES_API_KEY env var")
    parser.add_argument("--yes", action="store_true", help="Auto-pick the top search result instead of prompting")
    parser.add_argument("--max-photos", type=int, default=8)
    parser.add_argument("--out", default="output")
    args = parser.parse_args()

    try:
        client = GooglePlacesClient(api_key=args.api_key)
    except PlacesApiError as e:
        print(f"Error: {e}")
        sys.exit(1)

    print(f"Searching for: {args.query}")
    candidates = client.search(args.query)
    if not candidates:
        print("No matching Google Business Profiles found.")
        sys.exit(1)

    if args.yes or len(candidates) == 1:
        chosen = candidates[0]
    else:
        for i, c in enumerate(candidates):
            print(f"  [{i}] {c.name} -- {c.address}")
        idx = int(input("Which one? "))
        chosen = candidates[idx]

    print(f"Using: {chosen.name} ({chosen.place_id})")
    place = client.get_details(chosen.place_id)

    place_dir = os.path.join(args.out, place.place_id)
    photo_dir = os.path.join(place_dir, "photos")

    # local_photos_rel holds paths relative to lander.html (what the template
    # gets); local_photos_abs is only used for the download call itself.
    local_photos_rel: list[str] = []
    for i, photo in enumerate(place.photos[: args.max_photos]):
        rel = os.path.join("photos", f"photo_{i}.jpg")
        abs_dest = os.path.join(place_dir, rel)
        try:
            client.download_photo(photo["name"], abs_dest)
            local_photos_rel.append(rel)
            print(f"  downloaded {rel}")
        except PlacesApiError as e:
            print(f"  skipped photo {i}: {e}")

    site = None
    if place.website:
        print(f"Scraping website: {place.website}")
        try:
            site = scrape_website(place.website)
        except ScrapeBlocked as e:
            print(f"  skipped (robots.txt): {e}")
        except Exception as e:
            print(f"  scrape failed, continuing without it: {e}")

    brand_color = None
    logo_url = site.logo_url if site else None
    if logo_url:
        brand_color = fetch_brand_color(logo_url)
    if not brand_color and site and site.og_image:
        brand_color = fetch_brand_color(site.og_image)

    context = build_profile(place, site, local_photos_rel)
    context["brand_color"] = brand_color
    context["signal_ink"] = contrast_ink(brand_color)
    out_path = os.path.join(place_dir, "lander.html")
    render_lander(context, out_path)
    print(f"\nLanding page written to: {out_path}")


if __name__ == "__main__":
    main()

# GBP Lander

Step one of the pipeline: look up a business's Google Business Profile, pull
its photos and attached website, and assemble a call-conversion landing page
from the real data. No AI in this pass — that's the next layer, plugged in
on top of this once the raw data collection is solid.

## What's here

```
main.py                  CLI entry point — wires everything together
src/places_client.py     Google Places API (New) — search, details, photos
src/website_scraper.py   pulls copy/images off the business's own site
src/lander_builder.py    merges both sources into the template context
templates/lander.html    the landing page itself (see Design below)
examples/demo.py         renders a real lander from mock data, no API key needed
```

## Quick start (no API key required)

```
pip install -r requirements.txt
python examples/demo.py
```

Open `examples/demo_lander.html` in a browser. This is the actual template
rendering real markup/CSS, just fed mock business data instead of a live
profile — good for iterating on the design without burning API quota.

## Running it for real

1. Get a key at console.cloud.google.com → enable **Places API (New)** on
   the project → create an API key → restrict it to that API and to your
   server (not a browser-key restriction — this calls the API server-side).
2. `cp .env.example .env` and fill in `GOOGLE_PLACES_API_KEY`, or just
   `export GOOGLE_PLACES_API_KEY=...`
3. `python main.py "Joe's Plumbing, Austin TX"`

It'll search, show you candidates if there's more than one match, pull the
full profile, download up to 8 photos, scrape the attached website, and
write `output/<place_id>/lander.html`.

## Things worth knowing before this goes near production

**Don't expose your Places API key in customer-facing pages.** The live
photo URL (`photo_media_url()` in `places_client.py`) has your key in the
query string. `download_photo()` pulls the bytes down server-side instead —
always use that path for anything a customer's visitor will load, and
re-host on your own storage/CDN rather than linking Google's URL directly.

**Google bills Place Details by field, not per-call.** `DETAILS_FIELD_MASK`
in `places_client.py` is scoped to exactly what the template uses. If you
add a field later (e.g. `parkingOptions`), add it to the mask or it'll
silently come back empty — but also know that adding it adds cost.

**The website scraper is one page, not a crawler.** It's pointed at
whatever URL the Business Profile lists (almost always the homepage) and
pulls headings/paragraphs/images from that single page. That's enough raw
material for a v1 lander; if you want services pulled from a dedicated
`/services` page too, that's a small extension to `website_scraper.py`, not
a redesign.

**Service chips and the tagline are heuristics, not AI yet.** `lander_builder.py`
picks short headings off the site as candidate "services" and uses the
Business Profile's editorial summary (or the site's meta description) as
the tagline. This is intentionally the seam where the extraction/copywriting
model from the rest of the build plugs in — same inputs, smarter output, no
change needed elsewhere in the pipeline.

## Design

The template isn't a generic template-engine default — it's built around
one idea: a visitor here is usually mid-emergency (a leak, a broken AC) and
on their phone, so the entire page is built to get them to a tap-to-call
button as fast as possible, repeated at every scroll depth.

- **Color**: charcoal (`#181D24`) and a cool stone background (`#EFF2EE`),
  with a single safety-orange CTA color (`#FF5A1F`) — hi-vis-inspired, since
  that's the actual color vocabulary of the trades this is built for.
- **Type**: Space Grotesk for the business name/headlines, Inter for body
  copy, IBM Plex Mono for the phone number and anything ticket/data-like —
  the mono numerals are deliberate, not decorative.
- **Signature element**: the phone number sits inside a dashed-border "call
  ticket," echoing the paper work-order/estimate stub every trade business
  already hands customers. It reappears, condensed, as the sticky bottom
  call bar on mobile.

Edit the CSS custom properties at the top of `templates/lander.html` to
reskin per-customer (e.g. swap `--signal` for a brand color) without
touching layout.

"""
AI copywriting layer: turns raw scraped site text into ready-to-use
landing page copy. One Claude call per business, returning strict JSON.
Fully automatic -- no owner questionnaire, just what's genuinely on their
own site already (benefits, guarantees, credibility markers).

Requires ANTHROPIC_API_KEY in the environment. Import is lazy-friendly:
this module only touches the network inside generate_extras(), so importing
it costs nothing if the feature is never used.
"""
from __future__ import annotations

import json
import os
from typing import Optional

import anthropic

MODEL = "claude-sonnet-5"

_SYSTEM_PROMPT = """You write landing page copy for local service businesses.

You'll get: the business's basic profile, raw scraped text from their \
website's homepage, and raw scraped text from their About page (if one \
was found). Your job is to find the strongest real benefits, guarantees, \
promises, or credibility markers already present in that text, and turn \
them into a tight, above-the-fold offer -- no interview, no owner input,
just what's genuinely there in their own copy.

You'll also get the business's raw Google category, which is often too \
generic (e.g. "Services", "Store") to use as a page label. Look at the \
services list and site text and, if it clearly supports something more \
specific, propose a tighter replacement category.

You'll also get a heuristically-extracted "services" list, pulled straight \
from the site's headings -- it can include junk that isn't actually a \
service (nav labels, an FAQ heading, a service-area callout that slipped \
through). If you can identify the real list of services/offerings from the \
site text, return a cleaned-up version.

You'll also get a heuristically-extracted "service areas" list (cities/\
regions the business says it serves) plus raw text from a dedicated \
service-areas page if one was found. The heuristic often only catches one \
city, even when the site lists many (e.g. a bullet list, or a sentence like \
"serving Austin, Round Rock, Cedar Park, and Pflugerville"). If the site \
text clearly names more service areas than the heuristic found, return the \
fuller list.

Return ONLY raw JSON, no markdown, no prose, matching exactly this shape:
{
  "offer_headline": "one punchy sentence, under 12 words, the core promise",
  "offer_subhead": "one supporting sentence, under 24 words, adds credibility or specificity",
  "offer_guarantee": "one short risk-reversal line ONLY if the site text actually states a guarantee/warranty/promise -- else null, never invented",
  "site_summary": "2-3 sentences in third person summarizing what the business actually does, drawn from their real site copy -- no fluff, no invented claims",
  "about_summary": "2-3 sentences in third person summarizing who they are / their story, drawn from their real About page -- null if no About page content was provided",
  "category": "a short (1-4 word), specific business category label (e.g. 'Dog Trainer', 'HVAC Repair', 'Family Dentistry') clearly supported by the services/site text -- else null if the given category is already specific enough or the text doesn't clearly support a more specific one, never invented or guessed beyond what the text supports",
  "services": "an array of 3-8 short (2-6 word) real service/offering names, cleaned up from the heuristic list and/or site text -- drop anything that isn't actually a service (FAQ, service areas, nav items, About/Contact) -- else null if the given list is already clean or the site text doesn't clearly support changes, never invented",
  "service_areas": "an array of real city/region names the site text says the business serves -- else null if the heuristic list already looks complete or the site text doesn't clearly name more areas, never invented or guessed beyond what the text supports"
}

Rules:
- Never invent facts, credentials, numbers, or claims not present in the \
provided profile or site text. If the site text is thin, keep the offer \
more general rather than fabricating specifics.
- Write like a sharp human copywriter, not a corporate brochure. Short \
sentences. No superlatives that aren't backed by something specific found \
in the text.
- offer_headline and offer_subhead must be usable directly on the page \
above the fold -- no placeholders, no brackets.
- offer_guarantee must only be filled in if the source text actually \
contains something guarantee-like (money-back, warranty, satisfaction \
promise, etc.) -- do not manufacture one.
- category must be a real-world category name a person would recognize, \
not a marketing phrase -- if unsure, return null and the original Google \
category will be kept.
- services must only contain things the business actually offers per the \
site text -- if unsure, return null and the heuristic list will be kept \
as-is.
- service_areas must only contain place names the site text actually \
states -- if unsure, return null and the heuristic list will be kept \
as-is."""


_AD_SYSTEM_PROMPT = """You write paid social ad copy (Facebook/Instagram/Google) \
for local service businesses.

You'll get a business's structured profile: name, category, tagline, services, \
service areas, Google rating and review count, and the offer copy already \
written for their landing page (if any). Write one tight ad that sends people \
to that landing page. The ad is a photo with text overlaid on it, plus a \
"primary text" paragraph shown next to the image in the feed.

Return ONLY raw JSON, no markdown, no prose, matching exactly this shape:
{
  "headline": "the big text overlaid on the ad photo -- under 7 words, punchy, benefit-led, no trailing period",
  "subline": "one supporting line under the headline -- under 12 words, adds specificity or credibility",
  "cta": "a short button label, 2-4 words (e.g. 'Get a Free Quote', 'Call Today')",
  "primary_text": "1-3 short sentences for the ad's primary text field -- plain and direct, no hashtags, no emojis, ends by telling the reader what to do"
}

Rules:
- Never invent facts, numbers, discounts, or claims not present in the \
provided profile. If the profile is thin, keep the copy general rather than \
fabricating specifics.
- Only cite the rating/review count if it's genuinely strong (4.5+ with a \
meaningful number of reviews) -- social proof is often the best subline.
- Write like a sharp human copywriter: short sentences, concrete words, no \
corporate filler, no superlatives that aren't backed by something specific.
- headline and subline must read well as large text on a photo -- no \
placeholders, no brackets.
- If landing-page offer copy is provided, echo it (same promise, tighter \
wording) so the ad and the landing page feel like one campaign."""


_AD_DONT_DELAY_SYSTEM = """You write paid social ads (Facebook/Instagram) for local service \
businesses using the "don't delay" angle: name a problem people ignore, show \
what it turns into when they wait, and position this business as the fast fix.

You'll get the business's structured profile plus a list of known delay-prone \
problem arcs for their trade, each shaped "ignored symptom -> what it becomes". \
Pick the ONE arc that best matches this business's actual services and build \
the ad around it. If no arcs are provided, derive one plausible arc strictly \
from their stated category and services -- same shape, nothing exotic.

Return ONLY raw JSON, no markdown, no prose, matching exactly this shape:
{
  "headline": "names the ignored symptom as a warning, second person -- under 8 words, no trailing period (e.g. 'That Slow Drain Isn't Fixing Itself')",
  "subline": "what it becomes if they keep waiting -- under 12 words, concrete, not hysterical",
  "cta": "an urgency button label, 2-4 words (e.g. 'Fix It Today', 'Call Before It Spreads')",
  "primary_text": "2-4 short sentences: the symptom people ignore -> what it turns into if they wait -> this business fixes it fast (cite the real rating and review count if strong) -> end by telling them to call now. No hashtags, no emojis."
}

Rules:
- Never invent statistics, dollar amounts, timeframes, guarantees, or claims \
not present in the provided profile. Consequences must be qualitative and \
truthful for the trade (e.g. 'a backed-up sewer line', 'a flooded hallway') -- \
no made-up numbers, no fabricated averages.
- Only reference problems this business can actually fix per its category and \
services list.
- Urgent but honest: the real consequence is scary enough. No fake scarcity, \
no countdown pressure, no shaming.
- Only cite the rating/review count if genuinely strong (4.5+ with a \
meaningful number of reviews).
- headline and subline must read well as large text on a photo -- no \
placeholders, no brackets."""

# Known "ignored symptom -> what it becomes" arcs per trade. Matched against
# the business's category + services text; the model picks the best fit.
_DELAY_ARCS: list[tuple[tuple[str, ...], list[str]]] = [
    (("plumb", "drain", "sewer", "rooter", "water heater"), [
        "slow drain -> a full blockage, then sewage backing up into the house",
        "running toilet -> wasted water on every single bill until it's fixed",
        "dripping faucet -> a worn valve and water wasted around the clock",
        "rumbling or rusty water from an aging water heater -> it fails and floods the space it lives in",
        "gurgling drains or sewer smell -> roots in the line, then a collapsed line and a dug-up yard",
        "small leak under the sink -> rotted cabinets and mold behind them",
        "brown water stain on the ceiling -> a hidden pipe leak eating the drywall",
    ]),
    (("hvac", "heating", "cooling", "air condition", "furnace"), [
        "weak airflow or rattling from the unit -> a dead compressor in the hottest week of the year",
        "unit short-cycling and power bills creeping up -> a full breakdown when every company is booked out",
        "skipped seasonal tune-up -> a mid-season failure at peak-demand prices",
    ]),
    (("electric", "wiring", "panel"), [
        "flickering lights -> loose or overloaded wiring behind the walls",
        "warm outlets or a faint burning smell -> a genuine fire risk",
        "breakers tripping every week -> an overloaded or failing panel",
        "a decades-old panel -> a fire hazard that also blocks insurance and home sales",
    ]),
    (("roof", "shingle", "gutter"), [
        "shingle granules collecting in the gutters -> a roof at the end of its life letting water into the decking",
        "one lifted or missing shingle -> a leak that rots the deck beneath it",
        "a small ceiling stain -> interior water damage and mold",
        "clogged gutters -> water backing under the roofline and down the walls",
    ]),
    (("pest", "termite", "exterminat", "rodent"), [
        "one discarded termite wing or a pile of sawdust -> an active colony eating the structure",
        "droppings in the pantry -> a growing nest inside the walls",
        "a few carpenter ants -> hollowed-out framing where they've settled in",
    ]),
    (("tree", "arborist", "stump"), [
        "dead limbs hanging over the roof -> the next storm drops them on the house or car",
        "a leaning tree or mushrooms at the base -> root failure and an uncontrolled fall",
        "limbs growing into the power lines -> an outage or worse in the next wind",
    ]),
    (("garage door",), [
        "a grinding, uneven garage door -> a snapped spring with the car stuck inside",
        "frayed cables -> a sudden failure of a very heavy door",
    ]),
    (("auto", "mechanic", "brake", "transmission", "tire", "oil change"), [
        "squealing brakes -> worn pads scoring the rotors, a bigger repair every week it waits",
        "an ignored check-engine light -> a small fix growing into engine damage",
        "bald tires -> a blowout at highway speed",
        "an overdue oil change -> engine wear that never reverses",
    ]),
]


def _delay_arcs_for(category: str, services: list[str]) -> list[str]:
    hay = " ".join([category or "", *(services or [])]).lower()
    arcs: list[str] = []
    for keywords, entries in _DELAY_ARCS:
        if any(k in hay for k in keywords):
            arcs.extend(entries)
    return arcs


def _client() -> anthropic.Anthropic:
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        raise RuntimeError("No API key provided. Set ANTHROPIC_API_KEY.")
    return anthropic.Anthropic(api_key=key)


def _reply_json(resp) -> dict:
    raw = "".join(b.text for b in resp.content if b.type == "text").strip()
    raw = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    return json.loads(raw)


def generate_extras(
    *,
    name: str,
    category: str,
    tagline: Optional[str],
    services: list[str],
    home_text: str,
    about_text: Optional[str],
    service_areas: Optional[list[str]] = None,
    service_area_text: Optional[str] = None,
) -> dict:
    user_content = f"""BUSINESS PROFILE
Name: {name}
Category: {category}
Existing tagline: {tagline or "(none)"}
Services: {", ".join(services) if services else "(none listed)"}
Service areas (heuristically extracted): {", ".join(service_areas) if service_areas else "(none found)"}

HOMEPAGE TEXT (raw, may include noise)
{home_text[:3000] or "(no website text available)"}

ABOUT PAGE TEXT (raw, may include noise)
{about_text[:3000] if about_text else "(no About page found)"}

SERVICE AREAS PAGE TEXT (raw, may include noise)
{service_area_text[:3000] if service_area_text else "(no dedicated service-areas page found)"}"""

    client = _client()
    resp = client.messages.create(
        model=MODEL,
        max_tokens=600,
        system=_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_content}],
    )
    return _reply_json(resp)


def generate_ad_copy(
    *,
    name: str,
    category: str,
    tagline: Optional[str],
    services: list[str],
    service_areas: Optional[list[str]] = None,
    rating: Optional[float] = None,
    review_count: Optional[int] = None,
    offer_headline: Optional[str] = None,
    offer_subhead: Optional[str] = None,
    offer_guarantee: Optional[str] = None,
    summary: Optional[str] = None,
    angle: str = "offer",
) -> dict:
    """One Claude call turning a saved lander profile into ad copy: an
    on-image headline/subline/CTA plus feed primary text. No scraping --
    everything it needs is already in the stored profile jsonb.

    angle='offer' sells the landing page's offer; angle='dont_delay' runs the
    ignored-symptom -> consequence -> fast-fix arc for the business's trade.
    """
    user_content = f"""BUSINESS PROFILE
Name: {name}
Category: {category or "(unknown)"}
Tagline: {tagline or "(none)"}
Services: {", ".join(services) if services else "(none listed)"}
Service areas: {", ".join(service_areas) if service_areas else "(none listed)"}
Google rating: {f"{rating} stars ({review_count or 0} reviews)" if rating else "(none)"}

LANDING PAGE OFFER COPY (already live on the page this ad points to)
Headline: {offer_headline or "(none)"}
Subhead: {offer_subhead or "(none)"}
Guarantee: {offer_guarantee or "(none)"}

WHAT THE BUSINESS DOES
{summary or "(no summary available)"}"""

    system = _AD_SYSTEM_PROMPT
    if angle == "dont_delay":
        system = _AD_DONT_DELAY_SYSTEM
        arcs = _delay_arcs_for(category, services)
        user_content += "\n\nKNOWN DELAY-PRONE PROBLEM ARCS FOR THIS TRADE\n" + (
            "\n".join(f"- {a}" for a in arcs)
            if arcs
            else "(none on file -- derive one strictly from the category and services above)"
        )

    client = _client()
    resp = client.messages.create(
        model=MODEL,
        # 400 was enough for offer-style copy but the don't-delay primary_text
        # runs longer -- a truncated reply fails JSON parsing outright.
        max_tokens=800,
        system=system,
        messages=[{"role": "user", "content": user_content}],
    )
    return _reply_json(resp)
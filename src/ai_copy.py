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

_ANGLES_SYSTEM = """You are an ad strategist for local service businesses. You \
know the ad angles that consistently win for local trades on Meta/Facebook, and \
your job is to customize them to one specific business.

You'll get the business's profile (name, category, services, service areas, \
city, Google rating and review count, real review excerpts, a summary of their \
website) and the MAIN SERVICE the owner says they want more phone calls for.

Draw from these proven local-service angle archetypes -- keep only the ones \
that genuinely fit this business and trade, and customize every word to their \
actual data:

1. URGENT TRIGGER -- a time-bound external event creates the need now (storm \
damage, heat wave, cold snap, inspection season). Only for trades with real \
event triggers.
2. DON'T DELAY -- name a symptom people ignore, show what it becomes if they \
wait, position this business as the fast fix.
3. FREE DIAGNOSTIC -- a zero-risk first step (free inspection, free estimate, \
free second opinion) framed around the main service.
4. OBJECTION FIRST -- lead with the thing that makes people hesitate (price \
uncertainty, mess, pushy sales) and defuse it. Never invent financing, \
discounts, or dollar amounts -- if the profile doesn't state them, use \
"straight answers / upfront pricing / no-pressure" framing instead.
5. REVIEW-LED SOCIAL PROOF -- lead with the rating, review count, or a short \
quote from a real provided review. Only quote text actually present in the \
provided reviews.
6. PROOF OF WORK -- before/after or completed-job framing built around their \
real photos and services.
7. LOCAL AUTHORITY -- neighborhood trust: years serving the area, local \
ownership -- only if the profile/summary actually supports it.
8. SPEED -- same-day / fast-response framing, only if plausible for the trade.

Return 5 to 7 angles, best fits first. Return ONLY raw JSON, no markdown, \
matching exactly:
{
  "angles": [
    {
      "id": "short-kebab-slug",
      "label": "2-4 word angle name, plain (e.g. 'Storm Response', 'Don't Delay')",
      "hook": "the ad hook headline for this angle -- under 10 words, second person where natural, no trailing period",
      "why": "one sentence selling the owner on why this angle fits THEIR business -- cite their real rating, review text, service area, or trade dynamics",
      "lander_headline": "above-the-fold landing page headline for this angle -- under 12 words, main service front and center",
      "lander_subhead": "supporting line under 24 words -- concrete, uses real profile facts (rating, area, guarantee) where they exist",
      "cta_label": "2-4 word call button label"
    }
  ]
}

Rules:
- Every angle must be about the MAIN SERVICE the owner named (or its closest \
match among their real services).
- Never invent statistics, dollar amounts, discounts, financing, credentials, \
years in business, or guarantees not present in the provided data.
- Review quotes (full or partial) must come verbatim from the provided review \
excerpts.
- Only cite the rating/review count if genuinely strong (4.5+ with a \
meaningful number of reviews). Cite it only as reviews or a rating -- never \
recast the review count as a number of homes, jobs, or customers.
- Write like a sharp direct-response copywriter: short, concrete, zero \
corporate filler.
- The 5-7 angles must be genuinely distinct from each other -- no rewordings \
of the same idea."""


_ANGLE_ADS_SYSTEM = """You write paid social ad copy (Facebook/Instagram) for \
local service businesses. You'll get one business profile plus ONE chosen ad \
angle (its label, hook, and the landing page copy it produced). Write 4 \
distinct executions of that SAME angle -- same promise and positioning, four \
different ways in: e.g. a question, a warning, a proof line, a straight offer.

Each execution is a photo ad: big overlaid headline, supporting subline, a \
button label, and feed primary text.

Return ONLY raw JSON, no markdown, matching exactly:
{
  "variations": [
    {
      "headline": "big text on the photo -- under 7 words, no trailing period",
      "subline": "supporting line -- under 12 words, concrete",
      "cta": "button label, 2-4 words",
      "primary_text": "1-3 short sentences for the feed -- plain, direct, no hashtags or emojis, ends telling the reader what to do"
    }
  ]
}

Rules:
- Exactly 4 variations, all faithful to the chosen angle -- do not drift into \
a different angle.
- Never invent facts, numbers, discounts, or claims not present in the \
provided profile or angle.
- Only cite the rating/review count if genuinely strong (4.5+ with a \
meaningful number of reviews) -- and not in all four variations.
- The review count is the number of Google reviews. Cite it only as reviews \
or a rating (e.g. "4.8 stars from 512 reviews") -- never recast it as a \
number of homes, jobs, customers, or years.
- Each headline must be clearly different from the others -- different first \
words, different structure.
- Write like a sharp human copywriter: short sentences, concrete words."""


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
    # strict=False: the model occasionally puts literal newlines inside string
    # values (multi-paragraph primary_text); default parsing rejects those as
    # invalid control characters.
    return json.loads(raw, strict=False)


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


def _profile_block(
    *,
    name: str,
    category: str,
    services: list[str],
    service_areas: Optional[list[str]],
    rating: Optional[float],
    review_count: Optional[int],
    address: str = "",
    summary: Optional[str] = None,
) -> str:
    return f"""BUSINESS PROFILE
Name: {name}
Category: {category or "(unknown)"}
Address: {address or "(unknown)"}
Services: {", ".join(services) if services else "(none listed)"}
Service areas: {", ".join(service_areas) if service_areas else "(none listed)"}
Google rating: {f"{rating} stars ({review_count or 0} reviews)" if rating else "(none)"}

WHAT THE BUSINESS DOES (from their website)
{summary or "(no website summary available)"}"""


def generate_ad_angles(
    *,
    name: str,
    category: str,
    services: list[str],
    service_areas: Optional[list[str]],
    rating: Optional[float],
    review_count: Optional[int],
    address: str,
    reviews: list[dict],
    summary: Optional[str],
    main_service: str,
) -> dict:
    """One Claude call producing 5-7 winning ad angles customized to this
    business and the main service the owner wants more calls for. The angle
    archetype library lives in the system prompt; the business data (including
    real review excerpts, so social-proof angles can quote them) goes in the
    user turn.
    """
    review_lines = "\n".join(
        f'- {r.get("author") or "Customer"} ({r.get("rating") or "?"}★): "{(r.get("text") or "").strip()}"'
        for r in reviews[:5]
        if (r.get("text") or "").strip()
    )
    user_content = _profile_block(
        name=name, category=category, services=services,
        service_areas=service_areas, rating=rating, review_count=review_count,
        address=address, summary=summary,
    )
    user_content += f"""

REAL REVIEW EXCERPTS (quote only from these)
{review_lines or "(none available)"}

MAIN SERVICE THE OWNER WANTS MORE CALLS FOR
{main_service}"""

    arcs = _delay_arcs_for(category, services)
    if arcs:
        user_content += "\n\nKNOWN DELAY-PRONE PROBLEM ARCS FOR THIS TRADE (for the don't-delay angle)\n" + "\n".join(
            f"- {a}" for a in arcs
        )

    client = _client()
    resp = client.messages.create(
        model=MODEL,
        # 7 angles x ~7 short fields runs long -- a truncated reply fails JSON
        # parsing outright, so leave real headroom.
        max_tokens=2500,
        system=_ANGLES_SYSTEM,
        messages=[{"role": "user", "content": user_content}],
    )
    return _reply_json(resp)


def generate_angle_ad_variations(
    *,
    name: str,
    category: str,
    services: list[str],
    service_areas: Optional[list[str]],
    rating: Optional[float],
    review_count: Optional[int],
    summary: Optional[str],
    main_service: str,
    angle: dict,
) -> dict:
    """One Claude call turning the chosen angle into 4 distinct ad executions
    (one per auto-selected photo)."""
    user_content = _profile_block(
        name=name, category=category, services=services,
        service_areas=service_areas, rating=rating, review_count=review_count,
        summary=summary,
    )
    user_content += f"""

MAIN SERVICE THE ADS ARE FOR
{main_service or "(not specified)"}

CHOSEN ANGLE
Label: {angle.get("label") or "(unnamed)"}
Hook: {angle.get("hook") or "(none)"}
Why it fits: {angle.get("why") or "(none)"}
Landing page headline it produced: {angle.get("lander_headline") or "(none)"}
Landing page subhead: {angle.get("lander_subhead") or "(none)"}
Call button: {angle.get("cta_label") or "(none)"}"""

    client = _client()
    resp = client.messages.create(
        model=MODEL,
        # 4 variations x 4 fields, primary_text runs longest.
        max_tokens=1600,
        system=_ANGLE_ADS_SYSTEM,
        messages=[{"role": "user", "content": user_content}],
    )
    return _reply_json(resp)
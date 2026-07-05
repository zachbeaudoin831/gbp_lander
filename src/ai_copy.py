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

Return ONLY raw JSON, no markdown, no prose, matching exactly this shape:
{
  "offer_headline": "one punchy sentence, under 12 words, the core promise",
  "offer_subhead": "one supporting sentence, under 24 words, adds credibility or specificity",
  "offer_guarantee": "one short risk-reversal line ONLY if the site text actually states a guarantee/warranty/promise -- else null, never invented",
  "site_summary": "2-3 sentences in third person summarizing what the business actually does, drawn from their real site copy -- no fluff, no invented claims",
  "about_summary": "2-3 sentences in third person summarizing who they are / their story, drawn from their real About page -- null if no About page content was provided"
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
promise, etc.) -- do not manufacture one."""


def _client() -> anthropic.Anthropic:
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        raise RuntimeError("No API key provided. Set ANTHROPIC_API_KEY.")
    return anthropic.Anthropic(api_key=key)


def generate_extras(
    *,
    name: str,
    category: str,
    tagline: Optional[str],
    services: list[str],
    home_text: str,
    about_text: Optional[str],
) -> dict:
    user_content = f"""BUSINESS PROFILE
Name: {name}
Category: {category}
Existing tagline: {tagline or "(none)"}
Services: {", ".join(services) if services else "(none listed)"}

HOMEPAGE TEXT (raw, may include noise)
{home_text[:3000] or "(no website text available)"}

ABOUT PAGE TEXT (raw, may include noise)
{about_text[:3000] if about_text else "(no About page found)"}"""

    client = _client()
    resp = client.messages.create(
        model=MODEL,
        max_tokens=600,
        system=_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_content}],
    )
    raw = "".join(b.text for b in resp.content if b.type == "text").strip()
    raw = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    return json.loads(raw)
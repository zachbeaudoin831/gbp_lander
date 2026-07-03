"""
AI copywriting layer: turns raw scraped site text + the business owner's
answers to four offer-equation questions into ready-to-use landing page
copy. One Claude call per business, returning strict JSON.

The four questions are Alex Hormozi's value equation (from $100M Offers):
dream outcome, perceived likelihood of achieving it, time delay, and
effort/sacrifice required. We ask the owner to answer these in their own
words, then have Claude turn the answers into a tight, above-the-fold offer.

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
website's homepage, raw scraped text from their About page (if one was \
found), and the owner's own answers to four questions about their offer \
(based on Alex Hormozi's value equation: dream outcome, perceived \
likelihood of success, time delay, and effort/sacrifice).

Return ONLY raw JSON, no markdown, no prose, matching exactly this shape:
{
  "offer_headline": "one punchy sentence, under 12 words, the core promise",
  "offer_subhead": "one supporting sentence, under 24 words, adds credibility or specificity",
  "offer_guarantee": "one short risk-reversal line if the owner's answers support one, else null",
  "site_summary": "2-3 sentences in third person summarizing what the business actually does, drawn from their real site copy -- no fluff, no invented claims",
  "about_summary": "2-3 sentences in third person summarizing who they are / their story, drawn from their real About page -- null if no About page content was provided"
}

Rules:
- Never invent facts, credentials, numbers, or claims not present in the \
provided profile, site text, or owner answers.
- Write like a sharp human copywriter, not a corporate brochure. Short \
sentences. No superlatives that aren't backed by something specific.
- offer_headline and offer_subhead must be usable directly on the page \
above the fold -- no placeholders, no brackets.
- If the owner's answers are thin or missing, still produce a reasonable \
offer from the business profile alone, just keep it more general."""


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
    answers: dict,
) -> dict:
    """answers is a dict with keys: dream_outcome, likelihood, time_delay,
    effort -- any may be empty strings if the owner skipped a question.
    """
    user_content = f"""BUSINESS PROFILE
Name: {name}
Category: {category}
Existing tagline: {tagline or "(none)"}
Services: {", ".join(services) if services else "(none listed)"}

OWNER'S OFFER-EQUATION ANSWERS
Dream outcome for their customer: {answers.get("dream_outcome") or "(skipped)"}
Why customers should believe they'll achieve it: {answers.get("likelihood") or "(skipped)"}
How fast results happen: {answers.get("time_delay") or "(skipped)"}
How easy/low-effort it is for the customer: {answers.get("effort") or "(skipped)"}

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
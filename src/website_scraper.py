"""
Lightweight scraper for the website attached to a Google Business Profile.

This grabs visible text and obvious content images from a single page (the
homepage, or whatever URL you point it at) -- it's not a full-site crawler.
For a v1 lander, the homepage almost always has what you need: a tagline,
a few service-shaped headings, and some real photos.

Respects robots.txt by default. It's the business's own site and the data
is going back into their own marketing page, but there's no reason to skip
the one check that costs nothing.
"""
from __future__ import annotations

import dataclasses
import urllib.robotparser
from typing import Optional
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

USER_AGENT = "GBPLanderBot/0.1 (+https://example.com/bot-info)"

# Tags whose text would pollute extracted copy (menus, scripts, embedded
# widgets) rather than describe the business.
NOISE_TAGS = ["script", "style", "nav", "footer", "noscript", "svg", "form", "iframe"]

# Below this pixel size in either dimension, an <img> is almost always a
# logo, icon, or tracking pixel rather than gallery-worthy content -- only
# applied when the tag actually declares width/height attributes.
MIN_IMAGE_DIM = 300


@dataclasses.dataclass
class WebsiteContent:
    url: str
    title: Optional[str]
    meta_description: Optional[str]
    og_image: Optional[str]
    headings: list  # short phrases -- candidate "service" labels
    paragraphs: list  # cleaned body text blocks, longest first
    images: list  # absolute URLs to likely-content images


class ScrapeBlocked(RuntimeError):
    pass


def _allowed_by_robots(url: str) -> bool:
    parsed = urlparse(url)
    robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
    rp = urllib.robotparser.RobotFileParser()
    rp.set_url(robots_url)
    try:
        rp.read()
    except Exception:
        # robots.txt unreachable/missing -- default to allowed rather than
        # blocking a legitimate fetch of a business's own public homepage.
        return True
    return rp.can_fetch(USER_AGENT, url)


def scrape_website(
    url: str,
    timeout: int = 12,
    max_paragraphs: int = 8,
    max_images: int = 12,
    respect_robots: bool = True,
) -> WebsiteContent:
    if respect_robots and not _allowed_by_robots(url):
        raise ScrapeBlocked(f"robots.txt disallows fetching {url}")

    resp = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=timeout)
    resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "lxml")
    for tag in soup.find_all(NOISE_TAGS):
        tag.decompose()

    title = soup.title.get_text(strip=True) if soup.title else None

    meta_desc = None
    meta_tag = soup.find("meta", attrs={"name": "description"})
    if meta_tag and meta_tag.get("content"):
        meta_desc = meta_tag["content"].strip()

    og_image = None
    og_tag = soup.find("meta", attrs={"property": "og:image"})
    if og_tag and og_tag.get("content"):
        og_image = urljoin(url, og_tag["content"])

    headings: list[str] = []
    for tag_name in ("h1", "h2", "h3"):
        for h in soup.find_all(tag_name):
            text = h.get_text(strip=True)
            if text and 2 <= len(text) <= 80:
                headings.append(text)

    paragraphs: list[str] = []
    for p in soup.find_all(["p", "li"]):
        text = p.get_text(" ", strip=True)
        if len(text) >= 40:
            paragraphs.append(text)
    paragraphs.sort(key=len, reverse=True)
    paragraphs = paragraphs[:max_paragraphs]

    images: list[str] = []
    for img in soup.find_all("img"):
        src = img.get("src") or img.get("data-src")
        if not src:
            continue
        width, height = img.get("width"), img.get("height")
        try:
            if width and height and (int(width) < MIN_IMAGE_DIM or int(height) < MIN_IMAGE_DIM):
                continue
        except ValueError:
            pass
        abs_url = urljoin(url, src)
        if abs_url not in images:
            images.append(abs_url)
    images = images[:max_images]

    return WebsiteContent(
        url=url,
        title=title,
        meta_description=meta_desc,
        og_image=og_image,
        headings=headings[:20],
        paragraphs=paragraphs,
        images=images,
    )

_ABOUT_HINTS = ("about", "our-story", "who-we-are", "meet-the-team", "our-team")


def find_about_url(home_url: str, timeout: int = 12) -> Optional[str]:
    """Looks for an About-ish link on the homepage and returns its absolute
    URL, or None if nothing obvious is found. Doesn't fetch the About page
    itself -- call scrape_website() on the result if you want its content.
    """
    try:
        resp = requests.get(home_url, headers={"User-Agent": USER_AGENT}, timeout=timeout)
        resp.raise_for_status()
    except Exception:
        return None

    soup = BeautifulSoup(resp.text, "lxml")
    home_netloc = urlparse(home_url).netloc

    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        text = a.get_text(strip=True).lower()
        haystack = f"{href.lower()} {text}"
        if any(hint in haystack for hint in _ABOUT_HINTS):
            candidate = urljoin(home_url, href)
            if urlparse(candidate).netloc == home_netloc:
                return candidate
    return None


def scrape_about_page(home_url: str, respect_robots: bool = True) -> Optional[WebsiteContent]:
    """Convenience wrapper: find the About page (if any) and scrape it.
    Returns None if there's no obvious About link, the page is blocked by
    robots.txt, or the fetch fails for any reason.
    """
    about_url = find_about_url(home_url)
    if not about_url:
        return None
    try:
        return scrape_website(about_url, respect_robots=respect_robots)
    except Exception:
        return None
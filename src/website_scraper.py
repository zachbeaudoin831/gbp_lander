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
import re
import urllib.robotparser
from typing import Optional
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

from .url_guard import assert_public_url, safe_get

# Browser-like UA with an honest bot suffix: WAFs (WP Engine, Cloudflare)
# serve bot-shaped UAs an empty shell or a block page, which is how we were
# missing logos entirely on some sites. The owner initiated this scrape of
# their own site, so presenting as a browser is fair; robots.txt is still
# honored below.
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 SendKPIBot/1.0"
)

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
    logo_url: Optional[str]
    headings: list  # short phrases -- candidate "service" labels
    paragraphs: list  # cleaned body text blocks, longest first
    images: list  # absolute URLs to likely-content images
    nav_labels: list = dataclasses.field(default_factory=list)  # top-nav link texts -- the site's own taxonomy
    link_labels: list = dataclasses.field(default_factory=list)  # body link texts -- on a locations page these ARE the city list


class ScrapeBlocked(RuntimeError):
    pass


# Matches an <img> that's plausibly the site's own logo, so callers can pull
# a brand color from it. Loose by design -- most sites don't mark this up
# semantically, so we're matching common conventions (class/id/alt/filename
# containing "logo"), not a spec.
_LOGO_HINT_RE = re.compile(r"logo", re.IGNORECASE)

# Lazy-loading plugins (NitroPack, WP Rocket, generic data-src) park the real
# image URL in one of these and leave a data: placeholder in src -- checked
# in priority order, most-specific first.
_IMG_SRC_ATTRS = ("nitro-lazy-src", "data-lazy-src", "data-src", "data-original", "content", "src")
_IMG_SRCSET_ATTRS = ("nitro-lazy-srcset", "data-srcset", "srcset")


def _img_real_src(img) -> Optional[str]:
    """The image's actual URL, seeing through lazy-load placeholders."""
    for attr in _IMG_SRC_ATTRS:
        v = img.get(attr)
        if v and not str(v).startswith("data:"):
            return str(v)
    for attr in _IMG_SRCSET_ATTRS:
        v = img.get(attr)
        if v:
            first = str(v).split(",")[0].strip().split(" ")[0]
            if first and not first.startswith("data:"):
                return first
    return None


def _find_logo_url(soup: BeautifulSoup, base_url: str) -> Optional[str]:
    for img in soup.find_all("img"):
        haystack = " ".join(
            str(img.get(attr, ""))
            for attr in ("class", "id", "alt", "title", "src", "data-src", "nitro-lazy-src")
        )
        if _LOGO_HINT_RE.search(haystack):
            src = _img_real_src(img)
            if src:
                return urljoin(base_url, src)

    # No logo-hinted <img>: the apple-touch-icon is usually the brand mark
    # (and conveniently square, which suits the lander's logo tile).
    for rel in ("apple-touch-icon", "icon", "shortcut icon"):
        link = soup.find("link", attrs={"rel": rel})
        if link and link.get("href") and not str(link["href"]).startswith("data:"):
            return urljoin(base_url, link["href"])

    return None


def _allowed_by_robots(url: str) -> bool:
    parsed = urlparse(url)
    robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
    rp = urllib.robotparser.RobotFileParser()
    try:
        # Fetch robots.txt ourselves: RobotFileParser.read() uses the
        # Python-urllib user agent, which WAFs commonly 403 -- and the parser
        # treats 401/403 as "disallow everything", silently blocking whole
        # sites (no logo, no offer copy) whose robots.txt actually says
        # Allow: /. Missing/erroring robots defaults to allowed, matching
        # the prior intent.
        resp = safe_get(robots_url, timeout=8, headers={"User-Agent": USER_AGENT})
        if resp.status_code >= 400:
            return True
        rp.parse(resp.text.splitlines())
    except Exception:
        return True
    return rp.can_fetch(USER_AGENT, url)


def scrape_website(
    url: str,
    timeout: int = 12,
    max_paragraphs: int = 8,
    max_images: int = 12,
    respect_robots: bool = True,
) -> WebsiteContent:
    # SSRF guard first -- validate before any network call (including the
    # robots.txt fetch below, which hits the same host).
    assert_public_url(url)

    if respect_robots and not _allowed_by_robots(url):
        raise ScrapeBlocked(f"robots.txt disallows fetching {url}")

    resp = safe_get(url, timeout=timeout, headers={"User-Agent": USER_AGENT})
    resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "lxml")

    # The nav menu is the business's own taxonomy of what they do ("Heating
    # & Cooling", "Plumbing & Drains", "Locations") -- capture its link
    # labels before the noise pass strips <nav> from the tree entirely.
    nav_labels: list[str] = []
    seen_nav = set()
    for container in soup.find_all(["nav", "header"]):
        for a in container.find_all("a"):
            label = a.get_text(" ", strip=True)
            key = label.lower()
            if label and 2 <= len(label) <= 40 and key not in seen_nav:
                seen_nav.add(key)
                nav_labels.append(label)
    nav_labels = nav_labels[:24]

    for tag in soup.find_all(NOISE_TAGS):
        tag.decompose()

    # Body links, after the noise pass (so header/footer nav is excluded).
    # Locations pages typically present their cities/regions as link cards
    # whose text never lands in a heading or paragraph.
    link_labels: list[str] = []
    seen_links = set()
    for a in soup.find_all("a"):
        label = a.get_text(" ", strip=True)
        key = label.lower()
        if label and 2 <= len(label) <= 40 and key not in seen_links:
            seen_links.add(key)
            link_labels.append(label)
    link_labels = link_labels[:30]

    title = soup.title.get_text(strip=True) if soup.title else None

    meta_desc = None
    meta_tag = soup.find("meta", attrs={"name": "description"})
    if meta_tag and meta_tag.get("content"):
        meta_desc = meta_tag["content"].strip()

    og_image = None
    og_tag = soup.find("meta", attrs={"property": "og:image"})
    if og_tag and og_tag.get("content"):
        og_image = urljoin(url, og_tag["content"])

    logo_url = _find_logo_url(soup, url)

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
        logo_url=logo_url,
        headings=headings[:20],
        paragraphs=paragraphs,
        images=images,
        nav_labels=nav_labels,
        link_labels=link_labels,
    )

_ABOUT_HINTS = ("about", "our-story", "who-we-are", "meet-the-team", "our-team")

# Local service businesses almost universally use one of these phrasings
# for their "here's everywhere we work" page. A bare "Locations" tab (e.g.
# multi-branch companies) counts too -- it lists the cities they operate in.
_SERVICE_AREA_HINTS = (
    "service-area", "service areas", "areas-we-serve", "areas we serve",
    "where-we-serve", "where we serve", "locations-we-serve",
    "locations we serve", "our-locations", "our locations", "coverage-area",
    "/locations", "locations", "cities-we-serve", "cities we serve",
)

# Fallback when there's no locations page at all: the Contact page usually
# names at least the cities/counties the business works in.
_CONTACT_HINTS = ("contact", "get-in-touch", "get in touch")


def _find_page_url(home_url: str, hints: tuple[str, ...], timeout: int = 12) -> Optional[str]:
    """Looks for a link on the homepage whose href or text matches one of
    `hints`, and returns its absolute URL -- or None if nothing obvious is
    found. Doesn't fetch the target page itself -- call scrape_website() on
    the result if you want its content.
    """
    try:
        resp = safe_get(home_url, timeout=timeout, headers={"User-Agent": USER_AGENT})
        resp.raise_for_status()
    except Exception:
        return None

    soup = BeautifulSoup(resp.text, "lxml")
    home_netloc = urlparse(home_url).netloc

    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        text = a.get_text(strip=True).lower()
        haystack = f"{href.lower()} {text}"
        if any(hint in haystack for hint in hints):
            candidate = urljoin(home_url, href)
            if urlparse(candidate).netloc == home_netloc:
                return candidate
    return None


def find_about_url(home_url: str, timeout: int = 12) -> Optional[str]:
    """Looks for an About-ish link on the homepage and returns its absolute
    URL, or None if nothing obvious is found. Doesn't fetch the About page
    itself -- call scrape_website() on the result if you want its content.
    """
    return _find_page_url(home_url, _ABOUT_HINTS, timeout=timeout)


def find_service_area_url(home_url: str, timeout: int = 12) -> Optional[str]:
    """Looks for a "service areas" / "where we serve" link on the homepage.
    Many local service businesses list their full coverage area on a
    dedicated page rather than the homepage, which is why the homepage
    alone often only turns up the one city mentioned in the footer.
    """
    return _find_page_url(home_url, _SERVICE_AREA_HINTS, timeout=timeout)


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


def scrape_service_area_page(home_url: str, respect_robots: bool = True) -> Optional[WebsiteContent]:
    """Convenience wrapper: find the service-areas page (if any) and scrape
    it. Returns None if there's no obvious link, the page is blocked by
    robots.txt, or the fetch fails for any reason.
    """
    areas_url = find_service_area_url(home_url)
    if not areas_url:
        return None
    try:
        return scrape_website(areas_url, respect_robots=respect_robots)
    except Exception:
        return None


def scrape_contact_page(home_url: str, respect_robots: bool = True) -> Optional[WebsiteContent]:
    """Convenience wrapper: find the Contact page (if any) and scrape it.
    Useful as a service-area fallback -- contact pages usually name the
    cities/counties the business works in.
    """
    contact_url = _find_page_url(home_url, _CONTACT_HINTS)
    if not contact_url:
        return None
    try:
        return scrape_website(contact_url, respect_robots=respect_robots)
    except Exception:
        return None
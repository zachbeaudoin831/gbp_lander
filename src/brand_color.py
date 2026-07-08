"""
Pulls a single representative "brand color" out of a business's logo image,
so the lander's call-to-action button can use their own color instead of
the default orange.

Deliberately simple: no ML, no palette libraries -- just downsample the
image, drop pixels that are near-white/near-black/near-gray (background,
not brand), and return the most common color left over as a hex string.
"""
from __future__ import annotations

import io
from typing import Optional

import requests
from PIL import Image

USER_AGENT = "GBPLanderBot/0.1 (+https://example.com/bot-info)"

MAX_IMAGE_BYTES = 5 * 1024 * 1024  # refuse to download absurdly large "logos"

# Pixels this close to white, black, or gray are treated as background/line
# art rather than brand color.
_NEAR_WHITE = 235
_NEAR_BLACK = 20
_MIN_SATURATION = 0.15


def _is_background_ish(r: int, g: int, b: int) -> bool:
    if r > _NEAR_WHITE and g > _NEAR_WHITE and b > _NEAR_WHITE:
        return True
    if r < _NEAR_BLACK and g < _NEAR_BLACK and b < _NEAR_BLACK:
        return True
    hi, lo = max(r, g, b), min(r, g, b)
    saturation = 0 if hi == 0 else (hi - lo) / hi
    return saturation < _MIN_SATURATION


def extract_dominant_color(image_bytes: bytes) -> Optional[str]:
    """Returns a "#rrggbb" hex string, or None if no plausible brand color
    could be found (e.g. the image is entirely white/black/gray, or isn't a
    valid image at all).
    """
    try:
        img = Image.open(io.BytesIO(image_bytes))
        img = img.convert("RGBA").convert("RGB")
        img.thumbnail((100, 100))
    except Exception:
        return None

    counts: dict[tuple[int, int, int], int] = {}
    for count, (r, g, b) in img.getcolors(maxcolors=10_000) or []:
        if _is_background_ish(r, g, b):
            continue
        counts[(r, g, b)] = counts.get((r, g, b), 0) + count

    if not counts:
        return None

    r, g, b = max(counts, key=counts.get)
    return f"#{r:02x}{g:02x}{b:02x}"


def contrast_ink(hex_color: Optional[str]) -> str:
    """Picks near-black or white text for readability against `hex_color`.
    Needed because the CTA button's background is now the client's own
    brand color, which isn't always dark enough for white text.
    """
    if not hex_color:
        return "#fff"
    h = hex_color.lstrip("#")
    try:
        r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    except (ValueError, IndexError):
        return "#fff"
    luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return "#181D24" if luminance > 0.6 else "#fff"


def fetch_brand_color(image_url: str, timeout: int = 10) -> Optional[str]:
    """Downloads `image_url` and extracts its dominant brand color. Returns
    None on any failure (network error, oversized file, unreadable image) --
    the caller should fall back to a default color rather than block on this.
    """
    try:
        resp = requests.get(
            image_url,
            headers={"User-Agent": USER_AGENT},
            timeout=timeout,
            stream=True,
        )
        resp.raise_for_status()
        content_length = resp.headers.get("Content-Length")
        if content_length and int(content_length) > MAX_IMAGE_BYTES:
            return None

        chunks = []
        total = 0
        for chunk in resp.iter_content(chunk_size=65536):
            total += len(chunk)
            if total > MAX_IMAGE_BYTES:
                return None
            chunks.append(chunk)
        return extract_dominant_color(b"".join(chunks))
    except Exception:
        return None

"""Organic Facebook/Instagram post #4: the whole product in one picture --
Google listing in, a research step in the middle, four Meta ads out.

Run from the repo root (needs Pillow and the brand TTFs):
    SENDKPI_FONT_DIR=/path/to/fonts python3 scripts/build_social_post_04.py
"""
from __future__ import annotations

import math
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from build_sendkpi_campaign_ads import (  # noqa: E402
    BIZ, BLUE, BLUE_SOFT, CARD, DARK, DARK_INK, DARK_MUTED, GREEN, INK,
    INK2, INK3, LINE, M, PAPER, S, instrument, jakarta, logo, mono, spaced,
    stars, wrap,
)
from PIL import Image, ImageDraw, ImageFilter  # noqa: E402

REPO = pathlib.Path(__file__).resolve().parent.parent
OUT_DIR = REPO / "marketing" / "social"


def soft_shadow(im: Image.Image, box: tuple[int, int, int, int], radius: int = 18, blur: int = 16, dy: int = 14, opacity: int = 95) -> None:
    """Homepage cards all sit on a soft drop shadow (--shadow-lg); fake the
    same thing here with a blurred rounded-rect layer pasted behind the card
    before it's drawn."""
    x0, y0, x1, y1 = box
    pad = blur * 3
    layer = Image.new("RGBA", (x1 - x0 + pad * 2, y1 - y0 + pad * 2), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    ld.rounded_rectangle([pad, pad, pad + (x1 - x0), pad + (y1 - y0)], radius=radius, fill=(20, 24, 30, opacity))
    layer = layer.filter(ImageFilter.GaussianBlur(blur))
    im.paste(layer, (x0 - pad, y0 - pad + dy), layer)


def radial_glow(im: Image.Image, center: tuple[int, int], r: int, color: tuple[int, int, int], peak_alpha: int = 70) -> None:
    """The homepage's cta-card and hero both sit on a soft radial blue glow.
    Approximate one with concentric rings faded out, then blur."""
    layer = Image.new("RGBA", im.size, (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    steps = 40
    for i in range(steps, 0, -1):
        t = i / steps
        rr = int(r * t)
        a = int(peak_alpha * (1 - t) ** 1.6)
        ld.ellipse([center[0] - rr, center[1] - rr, center[0] + rr, center[1] + rr], fill=(*color, a))
    layer = layer.filter(ImageFilter.GaussianBlur(30))
    im.paste(layer, (0, 0), layer)


def wavy_underline(d: ImageDraw.ImageDraw, x: int, y: int, w: int, color: str = BLUE, amp: float = 3.5, width: int = 5) -> None:
    """The homepage's signature hand-drawn underline under the highlighted
    hero phrase, redrawn as a sampled sine curve."""
    pts = []
    n = max(16, int(w) // 8)
    for i in range(n + 1):
        t = i / n
        px = x + w * t
        py = y + amp * math.sin(t * math.pi * 1.6) - amp * 0.4
        pts.append((px, py))
    d.line(pts, fill=color, width=width, joint="curve")


def flow_dot(d: ImageDraw.ImageDraw, cx: int, cy: int, color: str = BLUE, ring: str = BLUE_SOFT) -> None:
    """The soft pulsing dot riding the hero's dashed route line, as a static
    two-layer glow + core dot."""
    d.ellipse([cx - 9, cy - 9, cx + 9, cy + 9], fill=ring)
    d.ellipse([cx - 4, cy - 4, cx + 4, cy + 4], fill=color)


def dashed_arrow(d: ImageDraw.ImageDraw, x0: int, x1: int, y: int, color: str = BLUE, dash: int = 8, gap: int = 7, width: int = 4) -> None:
    xx = x0
    while xx < x1 - 12:
        d.line([xx, y, min(xx + dash, x1 - 12), y], fill=color, width=width)
        xx += dash + gap
    d.polygon([(x1 - 12, y - 9), (x1, y), (x1 - 12, y + 9)], fill=color)
    flow_dot(d, (x0 + x1) // 2, y, color=color)


def stage_label(d: ImageDraw.ImageDraw, cx: int, y: int, text: str, color: str) -> None:
    f = mono(16)
    tracking = 2
    w = sum(d.textlength(ch, font=f) for ch in text) + tracking * (len(text) - 1)
    spaced(d, (int(cx - w / 2), y), text, f, color, tracking=tracking)


def compose() -> Image.Image:
    im = Image.new("RGB", (S, S), PAPER)

    # Ambient warmth behind the sign-off, echoing the hero/cta-card's soft
    # radial blue glow rather than a flat empty corner.
    radial_glow(im, (S - 220, S - 90), 460, (13, 87, 208), peak_alpha=40)

    d = ImageDraw.Draw(im)

    # No logo/tag row up top on this version -- headline starts straight
    # from the top margin so it (and everything below it) can run bigger.
    headline = "Turn Your Google Business Profile Into Custom Meta Ads"
    accent_phrase = "Custom Meta Ads"
    h_size = 72
    while h_size > 44:
        h_font = jakarta(h_size, 800)
        h_lines = wrap(d, headline, h_font, S - 2 * M)
        if len(h_lines) <= 2:
            break
        h_size -= 2
    y = 88
    h_lh = round(h_size * 1.1)
    accent_box = None
    for ln in h_lines:
        d.text((M, y), ln, font=h_font, fill=INK)
        if ln.endswith(accent_phrase):
            prefix = ln[: -len(accent_phrase)]
            ax = M + d.textlength(prefix, font=h_font)
            aw = d.textlength(accent_phrase, font=h_font)
            _, _, _, line_bottom = d.textbbox((M, y), ln, font=h_font)
            accent_box = (ax, line_bottom + 8, aw)
        y += h_lh
    if accent_box:
        ax, ay, aw = accent_box
        wavy_underline(d, ax, ay, aw)
    y += 22
    s_font = instrument(31)
    for ln in wrap(d, "Search for your Google Listing, we'll automatically research winning angles and pull your reviews to create custom Meta ads. First batch of ads are free.", s_font, S - 2 * M):
        d.text((M, y), ln, font=s_font, fill=INK2)
        y += 40
    y += 40

    biz = BIZ["roofing"]
    top = y
    card_h = 360
    gap = 44
    cw = (S - 2 * M - 2 * gap) // 3

    x1 = M
    x2 = x1 + cw + gap
    x3 = x2 + cw + gap

    for bx in (x1, x2, x3):
        soft_shadow(im, (bx, top, bx + cw, top + card_h))
    d = ImageDraw.Draw(im)  # redraw handle -- soft_shadow pastes onto im directly

    # ---- stage 1: the listing ----
    d.rounded_rectangle([x1, top, x1 + cw, top + card_h], radius=18, fill=CARD, outline=LINE, width=2)
    d.rounded_rectangle([x1 + 20, top + 22, x1 + 66, top + 68], radius=11, fill=biz["tile"])
    af = jakarta(24, 700)
    aw = d.textlength(biz["initial"], font=af)
    d.text((x1 + 43 - aw / 2, top + 31), biz["initial"], font=af, fill="#fff")
    d.text((x1 + 78, top + 24), biz["name"], font=jakarta(19, 700), fill=INK)
    d.text((x1 + 78, top + 50), biz["cat"].split(" · ")[0], font=instrument(14.5, 500), fill=INK2)
    sx = stars(d, x1 + 20, top + 90, size=13)
    d.text((sx + 7, top + 88), biz["rating"], font=instrument(15, 500), fill=INK2)
    py = top + 128
    for i, g in enumerate(["#7D97AC", "#C0A184", "#9DBFB4"]):
        pw = (cw - 40 - 2 * 10) // 3
        px = x1 + 20 + i * (pw + 10)
        d.rounded_rectangle([px, py, px + pw, py + pw], radius=9, fill=g)
    d.text((x1 + 20, top + card_h - 42), "Open", font=mono(15), fill=GREEN)
    ow = d.textlength("Open", font=mono(15))
    d.text((x1 + 20 + ow + 8, top + card_h - 42), "· Closes 6 PM", font=mono(15), fill=INK3)
    stage_label(d, x1 + cw // 2, top + card_h + 22, "YOUR LISTING", BLUE)

    # ---- arrow 1 ----
    dashed_arrow(d, x1 + cw + 14, x2 - 14, top + card_h // 2)

    # ---- stage 2: the research (dark, mid-thought) ----
    d.rounded_rectangle([x2, top, x2 + cw, top + card_h], radius=18, fill=DARK)
    spaced(d, (x2 + 20, top + 22), "RESEARCHING", mono(15), DARK_MUTED, tracking=2)
    rows = [("Storm response", False), ("Don't delay", False), ("Review-led", True)]
    ry = top + 62
    for label, chosen in rows:
        rh = 52
        if chosen:
            d.rounded_rectangle([x2 + 16, ry, x2 + cw - 16, ry + rh], radius=11, fill="#232B36")
        lf = jakarta(15.5, 700 if chosen else 600)
        col = DARK_INK if chosen else DARK_MUTED
        d.text((x2 + 30, ry + rh / 2 - 10), label, font=lf, fill=col)
        if chosen:
            cx, cy = x2 + cw - 40, ry + rh / 2
            d.ellipse([cx - 11, cy - 11, cx + 11, cy + 11], fill=GREEN)
            d.line([cx - 5, cy, cx - 1, cy + 4], fill="#fff", width=3)
            d.line([cx - 1, cy + 4, cx + 6, cy - 5], fill="#fff", width=3)
        ry += rh + 9
    d.text((x2 + 20, top + card_h - 42), "matched to your reviews", font=instrument(13.5, 500), fill=DARK_MUTED)
    stage_label(d, x2 + cw // 2, top + card_h + 22, "WE RESEARCH", BLUE)

    # ---- arrow 2 ----
    dashed_arrow(d, x2 + cw + 14, x3 - 14, top + card_h // 2)

    # ---- stage 3: the ads ----
    d.rounded_rectangle([x3, top, x3 + cw, top + card_h], radius=18, fill=CARD, outline=BLUE, width=3)
    spaced(d, (x3 + 20, top + 22), "4 ADS READY", mono(15), BLUE, tracking=2)
    grid_top = top + 56
    gs = (cw - 40 - 14) // 2
    grads = [("#3D5468", "#7D97AC"), ("#7A5A3D", "#C0A184"), ("#527568", "#9DBFB4"), ("#4A4E63", "#8B8FA3")]
    for i, (c1, c2) in enumerate(grads):
        gx = x3 + 20 + (i % 2) * (gs + 14)
        gy = grid_top + (i // 2) * (gs + 14)
        for row in range(gs):
            t = row / gs
            col = tuple(int(int(c1[j:j+2], 16) * (1 - t) + int(c2[j:j+2], 16) * t) for j in (1, 3, 5))
            d.line([gx, gy + row, gx + gs, gy + row], fill=col)
        bar_w = int(gs * 0.55)
        d.rounded_rectangle([gx + 8, gy + gs - 16, gx + 8 + bar_w, gy + gs - 10], radius=3, fill="#ffffffE0")
    stage_label(d, x3 + cw // 2, top + card_h + 22, "YOUR ADS", BLUE)

    # A thin top-border rule, same treatment as the homepage's own footer,
    # gives the sign-off real structure instead of leaving a blank gap.
    rule_y = top + card_h + 22 + 50
    d.line([M, rule_y, S - M, rule_y], fill=LINE, width=2)
    logo(d, M, rule_y + 38, ring=PAPER)
    return im


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    im = compose()
    out = OUT_DIR / "post-04-listing-to-ads.png"
    im.save(out)
    print("wrote", out.relative_to(REPO))


if __name__ == "__main__":
    main()

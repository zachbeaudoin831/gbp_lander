"""Organic Facebook/Instagram post #4: modern flat SaaS-social treatment --
a color-blocked panel, crisp solid "sticker" shadows, numbered steps. No
blur anywhere (the previous Gaussian-blurred shadow/glow read as grainy at
PNG export) -- every edge here is hard and flat by design.

Run from the repo root (needs Pillow and the brand TTFs):
    SENDKPI_FONT_DIR=/path/to/fonts python3 scripts/build_social_post_04.py
"""
from __future__ import annotations

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from build_sendkpi_campaign_ads import (  # noqa: E402
    BIZ, BLUE, GREEN, INK, INK2, INK3, M, PAPER, S, instrument, jakarta,
    logo, mono, spaced, stars, wrap,
)
from PIL import Image, ImageDraw  # noqa: E402

REPO = pathlib.Path(__file__).resolve().parent.parent
OUT_DIR = REPO / "marketing" / "social"

WHITE = "#FFFFFF"
BLUE_DEEP = "#0A2D6B"  # flat sticker-shadow offset colour (deeper than brand blue, no blur)


def flat_shadow(d: ImageDraw.ImageDraw, box: tuple[int, int, int, int], radius: int = 16, offset: tuple[int, int] = (7, 7), color: str = BLUE_DEEP) -> None:
    """A crisp, un-blurred offset rectangle behind a card -- the flat
    'sticker shadow' look common to current SaaS marketing sites."""
    x0, y0, x1, y1 = box
    d.rounded_rectangle([x0 + offset[0], y0 + offset[1], x1 + offset[0], y1 + offset[1]], radius=radius, fill=color)


def step_badge(d: ImageDraw.ImageDraw, cx: int, cy: int, n: int, bg: str = BLUE, fg: str = WHITE) -> None:
    r = 20
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=bg, outline=WHITE, width=3)
    f = jakarta(19, 800)
    tw = d.textlength(str(n), font=f)
    d.text((cx - tw / 2, cy - 12), str(n), font=f, fill=fg)


def solid_arrow(d: ImageDraw.ImageDraw, x0: int, x1: int, y: int, color: str = WHITE) -> None:
    d.line([x0, y, x1 - 14, y], fill=color, width=3)
    d.polygon([(x1 - 14, y - 7), (x1, y), (x1 - 14, y + 7)], fill=color)


def compose() -> Image.Image:
    im = Image.new("RGB", (S, S), PAPER)
    d = ImageDraw.Draw(im)

    # ---- header (cream) ----
    logo(d, M, 54, ring=PAPER)

    headline = "Turn Your Google Business Profile Into Custom Meta Ads"
    accent = "Custom Meta Ads"
    h_size = 64
    while h_size > 42:
        h_font = jakarta(h_size, 800)
        h_lines = wrap(d, headline, h_font, S - 2 * M)
        if len(h_lines) <= 2:
            break
        h_size -= 2
    y = 160
    h_lh = round(h_size * 1.14)
    for ln in h_lines:
        if ln.endswith(accent):
            prefix = ln[: -len(accent)]
            d.text((M, y), prefix, font=h_font, fill=INK)
            px = M + d.textlength(prefix, font=h_font)
            d.text((px, y), accent, font=h_font, fill=BLUE)
        else:
            d.text((M, y), ln, font=h_font, fill=INK)
        y += h_lh
    y += 22
    s_font = instrument(28)
    for ln in wrap(d, "Search for your Google Listing, we'll automatically research winning angles and pull your reviews to create custom Meta ads. First batch of ads are free.", s_font, S - 2 * M):
        d.text((M, y), ln, font=s_font, fill=INK2)
        y += 37

    # ---- panel: full-bleed flat blue section, square-cut top edge dropped
    # straight down from the copy above (a hallmark of current SaaS social
    # posts -- one hard color block, no gradient, no blur) ----
    panel_top = 508
    d.rectangle([0, panel_top, S, S], fill=BLUE)

    biz = BIZ["roofing"]
    gap = 40
    cw = (S - 2 * M - 2 * gap) // 3
    top = panel_top + 76
    card_h = 320

    x1 = M
    x2 = x1 + cw + gap
    x3 = x2 + cw + gap

    # ---- card 1: the listing ----
    flat_shadow(d, (x1, top, x1 + cw, top + card_h))
    d.rounded_rectangle([x1, top, x1 + cw, top + card_h], radius=16, fill=WHITE)
    d.rounded_rectangle([x1 + 18, top + 20, x1 + 60, top + 62], radius=10, fill=biz["tile"])
    af = jakarta(21, 700)
    aw = d.textlength(biz["initial"], font=af)
    d.text((x1 + 39 - aw / 2, top + 27), biz["initial"], font=af, fill=WHITE)
    d.text((x1 + 70, top + 21), biz["name"], font=jakarta(17, 700), fill=INK)
    d.text((x1 + 70, top + 44), biz["cat"].split(" · ")[0], font=instrument(13.5, 500), fill=INK2)
    sx = stars(d, x1 + 18, top + 78, size=12)
    d.text((sx + 6, top + 76), biz["rating"], font=instrument(13.5, 500), fill=INK2)
    py = top + 112
    pw = (cw - 36 - 2 * 8) // 3
    for i, g in enumerate(["#7D97AC", "#C0A184", "#9DBFB4"]):
        px = x1 + 18 + i * (pw + 8)
        d.rounded_rectangle([px, py, px + pw, py + pw], radius=8, fill=g)
    d.text((x1 + 18, top + card_h - 36), "Open", font=mono(13.5), fill=GREEN)
    ow = d.textlength("Open", font=mono(13.5))
    d.text((x1 + 18 + ow + 7, top + card_h - 36), "· Closes 6 PM", font=mono(13.5), fill=INK3)
    step_badge(d, x1 + 30, top, 1)

    solid_arrow(d, x1 + cw + 12, x2 - 12, top + card_h // 2)

    # ---- card 2: the research (angle candidates, flat white) ----
    flat_shadow(d, (x2, top, x2 + cw, top + card_h))
    d.rounded_rectangle([x2, top, x2 + cw, top + card_h], radius=16, fill=WHITE)
    spaced(d, (x2 + 18, top + 20), "RESEARCHING", mono(13), INK3, tracking=2)
    rows = [("Storm response", False), ("Don't delay", False), ("Review-led", True)]
    ry = top + 54
    for label, chosen in rows:
        rh = 48
        if chosen:
            d.rounded_rectangle([x2 + 14, ry, x2 + cw - 14, ry + rh], radius=10, fill=BLUE)
        lf = jakarta(14.5, 700 if chosen else 600)
        col = WHITE if chosen else INK2
        d.text((x2 + 27, ry + rh / 2 - 9), label, font=lf, fill=col)
        if chosen:
            cx, cy = x2 + cw - 36, ry + rh / 2
            d.ellipse([cx - 10, cy - 10, cx + 10, cy + 10], fill=WHITE)
            d.line([cx - 4, cy, cx - 1, cy + 3], fill=BLUE, width=3)
            d.line([cx - 1, cy + 3, cx + 5, cy - 4], fill=BLUE, width=3)
        ry += rh + 8
    d.text((x2 + 18, top + card_h - 36), "matched to your reviews", font=instrument(12.5, 500), fill=INK3)
    step_badge(d, x2 + 30, top, 2)

    solid_arrow(d, x2 + cw + 12, x3 - 12, top + card_h // 2)

    # ---- card 3: the ads ----
    flat_shadow(d, (x3, top, x3 + cw, top + card_h))
    d.rounded_rectangle([x3, top, x3 + cw, top + card_h], radius=16, fill=WHITE)
    spaced(d, (x3 + 18, top + 20), "4 ADS READY", mono(13), BLUE, tracking=2)
    grid_top = top + 52
    gs = (cw - 36 - 12) // 2
    grads = [("#3D5468", "#7D97AC"), ("#7A5A3D", "#C0A184"), ("#527568", "#9DBFB4"), ("#4A4E63", "#8B8FA3")]
    for i, (c1, c2) in enumerate(grads):
        gx = x3 + 18 + (i % 2) * (gs + 12)
        gy = grid_top + (i // 2) * (gs + 12)
        for row in range(gs):
            t = row / gs
            col = tuple(int(int(c1[j:j+2], 16) * (1 - t) + int(c2[j:j+2], 16) * t) for j in (1, 3, 5))
            d.line([gx, gy + row, gx + gs, gy + row], fill=col)
        bar_w = int(gs * 0.55)
        d.rounded_rectangle([gx + 7, gy + gs - 14, gx + 7 + bar_w, gy + gs - 9], radius=3, fill="#ffffffE0")
    step_badge(d, x3 + 30, top, 3)

    # ---- sign-off, centered under the row, flat and quiet -- the logo tile
    # is brand-blue so it disappears on this panel; the wordmark alone in
    # white reads cleanly instead ----
    foot_y = top + card_h + 50
    wm_f = jakarta(22, 700)
    wm = "SendKPI"
    wm_w = d.textlength(wm, font=wm_f)
    d.text(((S - wm_w) / 2, foot_y), wm, font=wm_f, fill=WHITE)

    return im


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    im = compose()
    out = OUT_DIR / "post-04-listing-to-ads.png"
    im.save(out)
    print("wrote", out.relative_to(REPO))


if __name__ == "__main__":
    main()

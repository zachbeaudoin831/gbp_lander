"""Organic Facebook/Instagram post #4: the whole product in one picture --
Google listing in, a research step in the middle, four Meta ads out.

Run from the repo root (needs Pillow and the brand TTFs):
    SENDKPI_FONT_DIR=/path/to/fonts python3 scripts/build_social_post_04.py
"""
from __future__ import annotations

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from build_sendkpi_campaign_ads import (  # noqa: E402
    BIZ, BLUE, CARD, DARK, DARK_INK, DARK_MUTED, GREEN, INK, INK2, INK3,
    LINE, M, PAPER, S, cta_row, head_block, instrument, jakarta, mono,
    spaced, stars,
)
from PIL import Image, ImageDraw  # noqa: E402

REPO = pathlib.Path(__file__).resolve().parent.parent
OUT_DIR = REPO / "marketing" / "social"


def dashed_arrow(d: ImageDraw.ImageDraw, x0: int, x1: int, y: int, color: str = BLUE, dash: int = 9, gap: int = 7, width: int = 4) -> None:
    xx = x0
    while xx < x1 - 12:
        d.line([xx, y, min(xx + dash, x1 - 12), y], fill=color, width=width)
        xx += dash + gap
    d.polygon([(x1 - 12, y - 9), (x1, y), (x1 - 12, y + 9)], fill=color)


def stage_label(d: ImageDraw.ImageDraw, cx: int, y: int, text: str, color: str) -> None:
    f = mono(16)
    tracking = 2
    w = sum(d.textlength(ch, font=f) for ch in text) + tracking * (len(text) - 1)
    spaced(d, (int(cx - w / 2), y), text, f, color, tracking=tracking)


def compose() -> Image.Image:
    im = Image.new("RGB", (S, S), PAPER)
    d = ImageDraw.Draw(im)
    y = head_block(
        d, "HOW IT WORKS",
        "Your Google listing becomes Meta ads",
        "We research the winning angle first, so every ad matches your real reviews.",
    )

    biz = BIZ["roofing"]
    top = y + 14
    card_h = 336
    gap = 44
    cw = (S - 2 * M - 2 * gap) // 3

    x1 = M
    x2 = x1 + cw + gap
    x3 = x2 + cw + gap

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
        rh = 54
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
        ry += rh + 10
    d.text((x2 + 20, top + card_h - 42), "matched to your reviews", font=instrument(13.5, 500), fill=DARK_MUTED)
    stage_label(d, x2 + cw // 2, top + card_h + 22, "WE RESEARCH", BLUE)

    # ---- arrow 2 ----
    dashed_arrow(d, x2 + cw + 14, x3 - 14, top + card_h // 2)

    # ---- stage 3: the ads ----
    d.rounded_rectangle([x3, top, x3 + cw, top + card_h], radius=18, fill=CARD, outline=BLUE, width=3)
    spaced(d, (x3 + 20, top + 22), "4 ADS READY", mono(15), BLUE, tracking=2)
    grid_top = top + 58
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

    cta_row(d)
    return im


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    im = compose()
    out = OUT_DIR / "post-04-listing-to-ads.png"
    im.save(out)
    print("wrote", out.relative_to(REPO))


if __name__ == "__main__":
    main()

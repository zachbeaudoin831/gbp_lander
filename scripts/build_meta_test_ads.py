"""Compose the 8-niche Meta demand-test creatives for SendKPI itself.

One fixed template -- same layout, palette, and structure for every trade, so
CTR differences measure niche demand rather than creative variance. Each
graphic embeds a mini example of the don't-delay ad the product would write
for that trade (pulled from the same NICHES data as the /for-* pages), and
each links to its matching page.

Run from the repo root (needs Pillow and the brand TTFs -- see FONT_DIR):
    python3 scripts/build_meta_test_ads.py
"""
from __future__ import annotations

import os
import pathlib
import sys

from PIL import Image, ImageDraw, ImageFont

REPO = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO / "scripts"))
from build_niche_pages import NICHES  # noqa: E402  (single source of truth)

FONT_DIR = pathlib.Path(os.environ.get("SENDKPI_FONT_DIR", REPO / "marketing" / "fonts"))
OUT_DIR = REPO / "marketing" / "meta-test"

S, M = 1080, 84
BG = "#171310"
CARD = "#282218"
CARD_LINE = "#3A332B"
INK = "#F4EFE9"
MUTED = "#B3A99D"
FAINT = "#8C8375"
SIGNAL = "#FF5A1F"
AMBER = "#E8843C"
GO = "#5CB57E"
GO_INK = "#0E2418"
GOLD = "#E9B949"


def font(name: str, size: int, wght: int | None = None) -> ImageFont.FreeTypeFont:
    f = ImageFont.truetype(str(FONT_DIR / name), size)
    if wght is not None:
        try:
            axes = f.get_variation_axes()  # list of dicts: {"axis": b"wght", "default": ...}
        except Exception:
            axes = []
        if axes:
            vals = []
            for a in axes:
                name = a.get("name", b"")
                name = name.decode() if isinstance(name, bytes) else str(name)
                vals.append(wght if "weight" in name.lower() else a["default"])
            f.set_variation_by_axes(vals)
    return f


def star(d: ImageDraw.ImageDraw, cx: int, cy: int, r: int, fill: str) -> None:
    """Plex Mono has no ★ glyph -- draw a 5-point star geometrically."""
    import math
    pts = []
    for i in range(10):
        rad = r if i % 2 == 0 else r * 0.42
        ang = math.pi / 2 + i * math.pi / 5
        pts.append((cx + rad * math.cos(ang), cy - rad * math.sin(ang)))
    d.polygon(pts, fill=fill)


def wrap(draw: ImageDraw.ImageDraw, text: str, fnt: ImageFont.FreeTypeFont, max_w: int) -> list[str]:
    words, lines, line = text.split(), [], ""
    for w in words:
        test = f"{line} {w}".strip()
        if line and draw.textlength(test, font=fnt) > max_w:
            lines.append(line)
            line = w
        else:
            line = test
    if line:
        lines.append(line)
    return lines


def spaced(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str, fnt: ImageFont.FreeTypeFont, fill: str, tracking: int = 3, anchor_right: int | None = None) -> int:
    """Draw text with letter-spacing; returns total width. anchor_right draws right-aligned at that x."""
    widths = [draw.textlength(ch, font=fnt) for ch in text]
    total = int(sum(widths) + tracking * (len(text) - 1))
    x = (anchor_right - total) if anchor_right else xy[0]
    y = xy[1]
    for ch, w in zip(text, widths):
        draw.text((x, y), ch, font=fnt, fill=fill)
        x += w + tracking
    return total


def compose(niche: dict) -> Image.Image:
    im = Image.new("RGB", (S, S), BG)
    d = ImageDraw.Draw(im)
    maxw = S - 2 * M

    grotesk = lambda size, w=700: font("SpaceGrotesk.ttf", size, w)
    inter = lambda size, w=450: font("Inter.ttf", size, w)
    mono = lambda size: font("PlexMono-SemiBold.ttf", size)

    # top row: logo + trade tag
    d.rounded_rectangle([M, M, M + 44, M + 44], radius=10, fill=SIGNAL)
    d.polygon([(M + 22, M + 12), (M + 34, M + 33), (M + 10, M + 33)], fill="#fff")
    d.text((M + 60, M + 2), "SendKPI", font=grotesk(38), fill=INK)
    spaced(d, (0, M + 8), f"FOR {niche['trade'].upper()}", mono(26), AMBER, anchor_right=S - M)

    # headline + sub
    y = 214
    h_font = grotesk(72)
    for ln in wrap(d, "Ads + a landing page from your Google listing", h_font, maxw):
        d.text((M, y), ln, font=h_font, fill=INK)
        y += 80
    y += 14
    s_font = inter(33)
    for ln in wrap(d, f"Don't-delay ads written for {niche['trade'].lower()}, built in about two minutes.", s_font, maxw):
        d.text((M, y), ln, font=s_font, fill=MUTED)
        y += 46

    # embedded example ad card
    biz, ad = niche["biz"], niche["ads"][0]
    cy = y + 34
    pad = 36
    card_font = grotesk(46)
    card_lines = wrap(d, ad["h"], card_font, maxw - 2 * pad)
    card_h = pad + 30 + 20 + len(card_lines) * 52 + 24 + 64 + pad
    d.rounded_rectangle([M, cy, S - M, cy + card_h], radius=24, fill=CARD, outline=CARD_LINE, width=2)
    ty = cy + pad
    d.rectangle([M + pad, ty + 5, M + pad + 16, ty + 21], fill=SIGNAL)
    d.text((M + pad + 28, ty), biz["name"].upper(), font=mono(23), fill=FAINT)
    rating_w = d.textlength(biz["rating"], font=mono(23))
    star(d, int(S - M - pad - rating_w - 22), ty + 14, 13, GOLD)
    d.text((S - M - pad - rating_w, ty), biz["rating"], font=mono(23), fill=GOLD)
    ty += 30 + 20
    for ln in card_lines:
        d.text((M + pad, ty), ln, font=card_font, fill=INK)
        ty += 52
    ty += 24
    pill_font = mono(24)
    pill_text = ad["c"].upper()
    pw = int(d.textlength(pill_text, font=pill_font)) + 56
    d.rounded_rectangle([M + pad, ty, M + pad + pw, ty + 64], radius=12, fill=GO)
    d.text((M + pad + 28, ty + 17), pill_text, font=pill_font, fill=GO_INK)

    # bottom row: CTA + url
    by = 946
    cta_font = grotesk(34)
    cta_text = "Build mine free →"
    cw = int(d.textlength(cta_text, font=cta_font)) + 72
    d.rounded_rectangle([M, by, M + cw, by + 84], radius=16, fill=SIGNAL)
    d.text((M + 36, by + 21), cta_text, font=cta_font, fill="#fff")
    url = f"sendkpi.com/{niche['slug']}"
    d.text((S - M - d.textlength(url, font=mono(25)), by + 30), url, font=mono(25), fill=FAINT)

    return im


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    copy_md = ["# SendKPI Meta demand test — ad copy\n"]
    for n in NICHES:
        im = compose(n)
        out = OUT_DIR / f"sendkpi-{n['slug']}.png"
        im.save(out, optimize=True)
        print(f"wrote {out.relative_to(REPO)}")
        trade_lc = n["trade"].lower()
        copy_md.append(f"""## {n['trade']} — sendkpi.com/{n['slug']}

**Primary text:**
You already have the reviews and the photos — they're sitting in your Google Business Profile. SendKPI turns them into a call-focused landing page plus "don't-delay" Meta ads written for {trade_lc}, in about two minutes. Free to build. See yours before you spend a dollar on ads.

**Headline:** Your Google listing, turned into ads

**Description:** Landing page + ad graphics, free to build

**CTA button:** Learn More
**Destination:** https://sendkpi.com/{n['slug']}
""")
    (OUT_DIR / "ad-copy.md").write_text("\n".join(copy_md))
    print(f"wrote {(OUT_DIR / 'ad-copy.md').relative_to(REPO)}")


if __name__ == "__main__":
    main()

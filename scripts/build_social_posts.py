"""Compose 1080x1080 organic social creatives promoting SendKPI itself.

Three-post drip: the promise (formula), how it works (3 steps in ~2 min),
proof (an ad the tool wrote). Shares the palette/font/drawing helpers with
build_meta_test_ads.py so everything stays on-brand.

Run from the repo root (needs Pillow + the brand TTFs):
    SENDKPI_FONT_DIR=... python3 scripts/build_social_posts.py
"""
from __future__ import annotations

import pathlib
import sys

from PIL import Image, ImageDraw

REPO = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO / "scripts"))
from build_meta_test_ads import (  # noqa: E402
    AMBER, BG, CARD, CARD_LINE, FAINT, GO, GO_INK, GOLD, INK, M, MUTED, S, SIGNAL,
    font, spaced, star, wrap,
)

OUT_DIR = REPO / "marketing" / "social"

grotesk = lambda size, w=700: font("SpaceGrotesk.ttf", size, w)
inter = lambda size, w=450: font("Inter.ttf", size, w)
mono = lambda size: font("PlexMono-SemiBold.ttf", size)


def base() -> tuple[Image.Image, ImageDraw.ImageDraw]:
    im = Image.new("RGB", (S, S), BG)
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([M, M, M + 44, M + 44], radius=10, fill=SIGNAL)
    d.polygon([(M + 22, M + 12), (M + 34, M + 33), (M + 10, M + 33)], fill="#fff")
    d.text((M + 60, M + 2), "SendKPI", font=grotesk(38), fill=INK)
    return im, d


def bottom_row(d: ImageDraw.ImageDraw, cta: str = "Build yours free →") -> None:
    by = 946
    cta_font = grotesk(34)
    cw = int(d.textlength(cta, font=cta_font)) + 72
    d.rounded_rectangle([M, by, M + cw, by + 84], radius=16, fill=SIGNAL)
    d.text((M + 36, by + 21), cta, font=cta_font, fill="#fff")
    url = "sendkpi.com"
    d.text((S - M - d.textlength(url, font=mono(26)), by + 30), url, font=mono(26), fill=FAINT)


def post_formula() -> Image.Image:
    im, d = base()
    spaced(d, (M, 300), "YOUR GOOGLE BUSINESS PROFILE", mono(30), AMBER)
    d.text((M, 356), "= Landing page", font=grotesk(104), fill=INK)
    d.text((M, 478), "+ Ads", font=grotesk(104), fill=SIGNAL)
    y = 650
    s_font = inter(36)
    for ln in wrap(d, "Built from your real reviews, photos, and hours — in about two minutes.", s_font, S - 2 * M):
        d.text((M, y), ln, font=s_font, fill=MUTED)
        y += 50
    bottom_row(d)
    return im


def post_steps() -> Image.Image:
    im, d = base()
    y = 208
    h_font = grotesk(64)
    for ln in wrap(d, "From listing to live ads in about 2 minutes", h_font, S - 2 * M):
        d.text((M, y), ln, font=h_font, fill=INK)
        y += 72
    y += 30
    steps = [
        ("01", "Find your listing", "Type your business name and city — that's the whole setup."),
        ("02", "We build it", "A call-focused lander plus don't-delay ads, written from your reviews."),
        ("03", "Download & launch", "Sign in with Google, grab the files, run them on Meta."),
    ]
    for n, title, sub in steps:
        d.text((M, y + 6), n, font=mono(28), fill=AMBER)
        d.text((M + 76, y), title, font=grotesk(42), fill=INK)
        sy = y + 54
        for ln in wrap(d, sub, inter(28), S - 2 * M - 76):
            d.text((M + 76, sy), ln, font=inter(28), fill=MUTED)
            sy += 40
        y = sy + 26
    bottom_row(d)
    return im


def post_proof() -> Image.Image:
    im, d = base()
    d.text((M, 200), "This ad wrote itself", font=grotesk(72), fill=INK)
    y = 296
    s_font = inter(34)
    for ln in wrap(d, "SendKPI reads a plumber's Google listing — reviews, services, rating — and writes the ads for them:", s_font, S - 2 * M):
        d.text((M, y), ln, font=s_font, fill=MUTED)
        y += 48
    # example creative, same card language as the real composed ads
    cy = y + 40
    pad = 36
    card_font = grotesk(52)
    lines = wrap(d, "That Slow Drain Isn't Fixing Itself", card_font, S - 2 * M - 2 * pad)
    card_h = pad + 30 + 22 + len(lines) * 58 + 26 + 64 + pad
    d.rounded_rectangle([M, cy, S - M, cy + card_h], radius=24, fill=CARD, outline=CARD_LINE, width=2)
    ty = cy + pad
    d.rectangle([M + pad, ty + 5, M + pad + 16, ty + 21], fill=SIGNAL)
    d.text((M + pad + 28, ty), "HARBOR PLUMBING", font=mono(23), fill=FAINT)
    rating_w = d.textlength("4.9", font=mono(23))
    star(d, int(S - M - pad - rating_w - 22), ty + 14, 13, GOLD)
    d.text((S - M - pad - rating_w, ty), "4.9", font=mono(23), fill=GOLD)
    ty += 30 + 22
    for ln in lines:
        d.text((M + pad, ty), ln, font=card_font, fill=INK)
        ty += 58
    ty += 26
    pill_text = "FIX IT TODAY"
    pw = int(d.textlength(pill_text, font=mono(24))) + 56
    d.rounded_rectangle([M + pad, ty, M + pad + pw, ty + 64], radius=12, fill=GO)
    d.text((M + pad + 28, ty + 17), pill_text, font=mono(24), fill=GO_INK)
    bottom_row(d, "See yours free →")
    return im


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    posts = [
        ("post-01-formula.png", post_formula),
        ("post-02-steps.png", post_steps),
        ("post-03-proof.png", post_proof),
    ]
    for name, fn in posts:
        out = OUT_DIR / name
        fn().save(out, optimize=True)
        print(f"wrote {out.relative_to(REPO)}")


if __name__ == "__main__":
    main()

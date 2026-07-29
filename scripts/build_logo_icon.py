"""Render the SendKPI # tile mark as high-res square PNGs for profile
photos (Facebook page, socials). Reproduces frontend/public/favicon.svg
exactly: gradient rx9 tile, the true Inter SemiBold # glyph path, and the
green badge with a punched-out ring so it works on any background.

Sized so the whole mark (badge included) survives a circular profile
crop. Run from the repo root:
    python3 scripts/build_logo_icon.py
"""
from __future__ import annotations

import pathlib

from PIL import Image, ImageDraw

REPO = pathlib.Path(__file__).resolve().parent.parent
OUT_DIR = REPO / "marketing" / "brand"

SIZE = 1024
SS = 4  # supersample factor for clean edges

BLUE = (13, 87, 208)       # #0D57D0
BLUE_DEEP = (10, 70, 168)  # #0A46A8
GREEN = (14, 138, 95)      # #0E8A5F
CREAM = (251, 250, 247)    # #FBFAF7

# favicon.svg geometry (64-unit viewBox)
TILE = (6, 8, 54, 56)  # x0 y0 x1 y1
TILE_RX = 9
BADGE_C = (53, 12)
BADGE_R = 9.5
BADGE_RING = 3

# glyph: transform translate(17.09 47.00) scale(0.02013 -0.02013), then the
# path below (straight segments only)
GLYPH_T = (17.09, 47.00, 0.02013)
GLYPH_POLYS = [
    [(674.6, 0), (919.7, 1490), (1131.1, 1490), (886.2, 0)],
    [(4.8, 380.3), (40.6, 591.7), (1191.8, 591.7), (1156.0, 380.3)],
    [(151.7, 0), (395.7, 1490), (607.1, 1490), (363.1, 0)],
    [(91.0, 897.2), (126.8, 1109.7), (1276.9, 1109.7), (1242.2, 897.2)],
]


def lerp(a: tuple, b: tuple, t: float) -> tuple:
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def render(scale: float, canvas: int) -> Image.Image:
    """Draw the mark at `scale` px per viewBox unit, centered on a
    transparent canvas of `canvas` px (both already supersampled)."""
    im = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    # center the tile (its center is the visual anchor)
    tile_cx = (TILE[0] + TILE[2]) / 2
    tile_cy = (TILE[1] + TILE[3]) / 2
    ox = canvas / 2 - tile_cx * scale
    oy = canvas / 2 - tile_cy * scale

    def P(x: float, y: float) -> tuple[float, float]:
        return (ox + x * scale, oy + y * scale)

    # gradient tile: mask a diagonal gradient with the rounded rect
    x0, y0 = P(TILE[0], TILE[1])
    x1, y1 = P(TILE[2], TILE[3])
    tile_w, tile_h = int(x1 - x0), int(y1 - y0)
    grad = Image.new("RGBA", (tile_w, tile_h))
    gd = ImageDraw.Draw(grad)
    for i in range(tile_w + tile_h):
        t = i / (tile_w + tile_h - 1)
        gd.line([(0, i), (i, 0)], fill=lerp(BLUE, BLUE_DEEP, t) + (255,), width=1)
    mask = Image.new("L", (tile_w, tile_h), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, tile_w - 1, tile_h - 1], radius=int(TILE_RX * scale), fill=255)
    im.paste(grad, (int(x0), int(y0)), mask)

    # glyph
    tx, ty, s = GLYPH_T
    for poly in GLYPH_POLYS:
        pts = [P(tx + s * gx, ty - s * gy) for gx, gy in poly]
        d.polygon(pts, fill=(255, 255, 255, 255))

    # badge: punch the ring out (transparent), then the green dot
    bc = P(*BADGE_C)
    outer = (BADGE_R + BADGE_RING) * scale
    inner = BADGE_R * scale
    hole = Image.new("L", (canvas, canvas), 0)
    ImageDraw.Draw(hole).ellipse([bc[0] - outer, bc[1] - outer, bc[0] + outer, bc[1] + outer], fill=255)
    im.putalpha(Image.composite(Image.new("L", (canvas, canvas), 0), im.getchannel("A"), hole))
    d = ImageDraw.Draw(im)
    d.ellipse([bc[0] - inner, bc[1] - inner, bc[0] + inner, bc[1] + inner], fill=GREEN + (255,))

    return im


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    big = SIZE * SS

    # circle-safe: the badge's outer edge must stay inside the inscribed
    # circle (radius 0.48 * canvas for a little safety margin).
    tile_c = ((TILE[0] + TILE[2]) / 2, (TILE[1] + TILE[3]) / 2)
    badge_dist = ((BADGE_C[0] - tile_c[0]) ** 2 + (BADGE_C[1] - tile_c[1]) ** 2) ** 0.5
    scale = (0.48 * big) / (badge_dist + BADGE_R + BADGE_RING)

    mark = render(scale, big)

    transparent = mark.resize((SIZE, SIZE), Image.LANCZOS)
    transparent.save(OUT_DIR / "sendkpi-icon-1024.png")
    print("wrote", (OUT_DIR / "sendkpi-icon-1024.png").relative_to(REPO))

    cream = Image.new("RGBA", (big, big), CREAM + (255,))
    cream.alpha_composite(mark)
    cream = cream.convert("RGB").resize((SIZE, SIZE), Image.LANCZOS)
    cream.save(OUT_DIR / "sendkpi-icon-1024-cream.png")
    print("wrote", (OUT_DIR / "sendkpi-icon-1024-cream.png").relative_to(REPO))


if __name__ == "__main__":
    main()

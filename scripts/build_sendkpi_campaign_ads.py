"""Compose the three SendKPI self-promo test creatives (Concepts A/B/C in
marketing/sendkpi-campaign/campaign-playbook.md), in the current brand:
cream paper, ink, CTA blue, the # tile logo, Plus Jakarta Sans headers.

Run from the repo root (needs Pillow and the brand TTFs):
    SENDKPI_FONT_DIR=/path/to/fonts python3 scripts/build_sendkpi_campaign_ads.py
Fonts needed in FONT_DIR: PlusJakartaSans.ttf, InstrumentSans.ttf,
PlexMono-SemiBold.ttf (variable TTFs from Google Fonts).
"""
from __future__ import annotations

import os
import pathlib

from PIL import Image, ImageDraw, ImageFont

REPO = pathlib.Path(__file__).resolve().parent.parent
FONT_DIR = pathlib.Path(os.environ.get("SENDKPI_FONT_DIR", REPO / "marketing" / "fonts"))
OUT_DIR = REPO / "marketing" / "sendkpi-campaign"

S, M = 1080, 84
PAPER = "#FBFAF7"
PAPER2 = "#F3F0E9"
CARD = "#FFFFFF"
LINE = "#E4DFD5"
INK = "#181310"
INK2 = "#5C544C"
INK3 = "#8A8178"
BLUE = "#0D57D0"
BLUE_DEEP = "#0A46A8"
BLUE_SOFT = "#E7EEFB"
GREEN = "#0E8A5F"
DARK = "#181D24"
DARK_INK = "#F2F4F6"
DARK_MUTED = "#9AA3AE"
STAR = "#EDA83C"
RED = "#B3402F"


def font(name: str, size: int, wght: int | None = None) -> ImageFont.FreeTypeFont:
    f = ImageFont.truetype(str(FONT_DIR / name), size)
    if wght is not None:
        try:
            axes = f.get_variation_axes()
        except Exception:
            axes = []
        if axes:
            vals = []
            for a in axes:
                axis_name = a.get("name", b"")
                axis_name = axis_name.decode() if isinstance(axis_name, bytes) else str(axis_name)
                vals.append(wght if "weight" in axis_name.lower() else a["default"])
            f.set_variation_by_axes(vals)
    return f


def jakarta(size: int, w: int = 800) -> ImageFont.FreeTypeFont:
    return font("PlusJakartaSans.ttf", size, w)


def instrument(size: int, w: int = 450) -> ImageFont.FreeTypeFont:
    return font("InstrumentSans.ttf", size, w)


def mono(size: int) -> ImageFont.FreeTypeFont:
    return font("PlexMono-SemiBold.ttf", size)


def wrap(d: ImageDraw.ImageDraw, text: str, fnt: ImageFont.FreeTypeFont, max_w: int) -> list[str]:
    words, lines, line = text.split(), [], ""
    for w in words:
        test = f"{line} {w}".strip()
        if line and d.textlength(test, font=fnt) > max_w:
            lines.append(line)
            line = w
        else:
            line = test
    if line:
        lines.append(line)
    return lines


def spaced(d: ImageDraw.ImageDraw, xy: tuple[int, int], text: str, fnt: ImageFont.FreeTypeFont, fill: str, tracking: int = 3, anchor_right: int | None = None) -> int:
    widths = [d.textlength(ch, font=fnt) for ch in text]
    total = int(sum(widths) + tracking * (len(text) - 1))
    x = (anchor_right - total) if anchor_right else xy[0]
    y = xy[1]
    for ch, w in zip(text, widths):
        d.text((x, y), ch, font=fnt, fill=fill)
        x += w + tracking
    return total


def logo(d: ImageDraw.ImageDraw, x: int, y: int, ring: str = PAPER) -> None:
    """# tile + green badge + wordmark, ~44px tall starting at (x, y)."""
    d.rounded_rectangle([x, y, x + 44, y + 44], radius=10, fill=BLUE)
    hash_f = jakarta(34, 600)
    hw = d.textlength("#", font=hash_f)
    d.text((x + 22 - hw / 2, y + 3), "#", font=hash_f, fill="#fff")
    d.ellipse([x + 34, y - 6, x + 52, y + 12], fill=GREEN, outline=ring, width=3)
    d.text((x + 60, y + 1), "SendKPI", font=jakarta(36, 700), fill=INK)


def head_block(d: ImageDraw.ImageDraw, tag: str, headline: str, sub: str) -> int:
    """Top row + headline + sub. Returns the y where content can start."""
    logo(d, M, M)
    spaced(d, (0, M + 10), tag, mono(24), BLUE, anchor_right=S - M)
    y = 208
    h_font = jakarta(76, 800)
    for ln in wrap(d, headline, h_font, S - 2 * M):
        d.text((M, y), ln, font=h_font, fill=INK)
        y += 88
    y += 10
    s_font = instrument(34)
    for ln in wrap(d, sub, s_font, S - 2 * M):
        d.text((M, y), ln, font=s_font, fill=INK2)
        y += 46
    return y + 30


def cta_row(d: ImageDraw.ImageDraw) -> None:
    label = "Build yours free"
    f = instrument(30, 600)
    tw = d.textlength(label, font=f)
    y0, y1 = S - M - 78, S - M
    d.rounded_rectangle([M, y0, M + tw + 72, y1], radius=14, fill=BLUE)
    d.text((M + 36, y0 + 20), label, font=f, fill="#fff")
    spaced(d, (0, y0 + 26), "SENDKPI.COM", mono(26), INK3, anchor_right=S - M)


def stars(d: ImageDraw.ImageDraw, x: int, y: int, size: int = 16, n: int = 5, gap: int = 5) -> int:
    import math
    for i in range(n):
        cx = x + i * (size + gap) + size // 2
        cy = y + size // 2
        pts = []
        for j in range(10):
            r = size / 2 if j % 2 == 0 else size / 2 * 0.42
            ang = math.pi / 2 + j * math.pi / 5
            pts.append((cx + r * math.cos(ang), cy - r * math.sin(ang)))
        d.polygon(pts, fill=STAR)
    return x + n * (size + gap)


def concept_a() -> Image.Image:
    im = Image.new("RGB", (S, S), PAPER)
    d = ImageDraw.Draw(im)
    y = head_block(d, "FOR LOCAL BUSINESS OWNERS",
                   "Your ads deserve better than your homepage",
                   "One page. One goal. The phone rings.")

    card_h = 430
    gap = 28
    cw = (S - 2 * M - gap) // 2
    top = y + 6

    # left: the homepage (grey, busy, X)
    lx = M
    d.rounded_rectangle([lx, top, lx + cw, top + card_h], radius=18, fill=PAPER2, outline=LINE, width=2)
    spaced(d, (lx + 26, top + 24), "YOUR HOMEPAGE", mono(22), INK3)
    nav_y = top + 70
    d.rounded_rectangle([lx + 26, nav_y, lx + cw - 26, nav_y + 30], radius=8, fill="#E2DDD2")
    for i in range(4):
        seg_w = (cw - 52 - 30) // 4
        sx = lx + 26 + 10 + i * (seg_w + 6)
        d.rounded_rectangle([sx, nav_y + 10, sx + seg_w - 12, nav_y + 20], radius=5, fill="#CFC8BA")
    by = nav_y + 52
    for row in range(4):
        for col in range(2):
            bx = lx + 26 + col * ((cw - 52) // 2 + 6)
            bw = (cw - 52) // 2 - 6
            d.rounded_rectangle([bx, by, bx + bw, by + 54], radius=8, fill="#EAE5DA")
        by += 68
    d.text((lx + 26, top + card_h - 60), "20 doors. No calls.", font=instrument(26, 500), fill=INK3)

    # right: the call page
    rx = M + cw + gap
    d.rounded_rectangle([rx, top, rx + cw, top + card_h], radius=18, fill=CARD, outline=BLUE, width=3)
    spaced(d, (rx + 26, top + 24), "YOUR CALL PAGE", mono(22), BLUE)
    ey = top + 66
    d.rounded_rectangle([rx + 26, ey, rx + 26 + 150, ey + 22], radius=11, fill=BLUE_SOFT)
    spaced(d, (rx + 38, ey + 4), "ROOF REPAIR", mono(16), BLUE, tracking=2)
    hy = ey + 40
    d.rounded_rectangle([rx + 26, hy, rx + cw - 60, hy + 22], radius=8, fill=INK)
    d.rounded_rectangle([rx + 26, hy + 32, rx + int(cw * 0.62), hy + 54], radius=8, fill=INK)
    sy = hy + 72
    sx_end = stars(d, rx + 26, sy)
    d.text((sx_end + 10, sy - 4), "4.9 · 212 reviews", font=instrument(22, 500), fill=INK2)
    cy0 = sy + 44
    d.rounded_rectangle([rx + 26, cy0, rx + cw - 26, cy0 + 64], radius=12, fill=GREEN)
    call_f = instrument(26, 600)
    call_t = "Call Now (615) 555-0119"
    ctw = d.textlength(call_t, font=call_f)
    d.text((rx + (cw - ctw) / 2, cy0 + 17), call_t, font=call_f, fill="#fff")
    d.text((rx + 26, top + card_h - 60), "One door. It rings.", font=instrument(26, 500), fill=GREEN)

    cta_row(d)
    return im


def concept_b() -> Image.Image:
    im = Image.new("RGB", (S, S), PAPER)
    d = ImageDraw.Draw(im)
    y = head_block(d, "FREE BUILD",
                   "Your Google listing already is a landing page",
                   "Page + 4 matching ads, built in 30 seconds. Free.")

    top = y + 6
    card_h = 430
    # dark build-log card
    d.rounded_rectangle([M, top, S - M, top + card_h], radius=18, fill=DARK)
    for i in range(3):
        d.ellipse([M + 24 + i * 20, top + 22, M + 36 + i * 20, top + 34], fill="#3A4250")
    spaced(d, (M + 96, top + 20), "SENDKPI · BUILDING YOUR CAMPAIGN", mono(20), "#8A93A0", tracking=2)

    lines = [
        ("> pulling reviews & photos from your listing", DARK_MUTED),
        ("  fetch(listing.reviews) → 4.9 · 212 reviews", "#5C6675"),
        ("✓ proof attached above the fold", "#7FD4AC"),
        ("> researching winning angles", DARK_MUTED),
        ("  angle(\"storm response\") selected", "#5C6675"),
        ("✓ call now page built", "#7FD4AC"),
        ("✓ 4 matching ads exported", "#7FD4AC"),
    ]
    ly = top + 76
    for txt, col in lines:
        d.text((M + 30, ly), txt, font=mono(25), fill=col)
        ly += 46

    # mini page mock bottom right of card
    pw, ph = 300, 180
    px, py = S - M - pw - 30, top + card_h - ph - 26
    d.rounded_rectangle([px, py, px + pw, py + ph], radius=12, fill=CARD)
    d.rounded_rectangle([px + 20, py + 18, px + 130, py + 32], radius=7, fill=BLUE_SOFT)
    d.rounded_rectangle([px + 20, py + 44, px + pw - 40, py + 62], radius=7, fill=INK)
    d.rounded_rectangle([px + 20, py + 70, px + int(pw * 0.55), py + 86], radius=7, fill=INK)
    d.rounded_rectangle([px + 20, py + 104, px + pw - 20, py + 150], radius=10, fill=GREEN)
    ct = "Call Now"
    cf = instrument(22, 600)
    d.text((px + (pw - d.textlength(ct, font=cf)) / 2, py + 116), ct, font=cf, fill="#fff")

    cta_row(d)
    return im


def concept_c() -> Image.Image:
    im = Image.new("RGB", (S, S), PAPER)
    d = ImageDraw.Draw(im)
    y = head_block(d, "CALLS, TRACKED WEEKLY",
                   "This is what your ad spend should sound like",
                   "Calls tracked, counted, and emailed to you weekly.")

    top = y + 6
    card_h = 430
    gap = 28
    cw = (S - 2 * M - gap) // 2

    # left: incoming call (dark phone card)
    lx = M
    d.rounded_rectangle([lx, top, lx + cw, top + card_h], radius=18, fill=DARK)
    label = "INCOMING CALL"
    lf = mono(22)
    lw = sum(d.textlength(ch, font=lf) for ch in label) + 3 * (len(label) - 1)
    spaced(d, (int(lx + (cw - lw) / 2), top + 44), label, lf, DARK_MUTED, tracking=3)
    num = "(615) 555-0119"
    nf = jakarta(46, 800)
    nw = d.textlength(num, font=nf)
    d.text((lx + (cw - nw) / 2, top + 90), num, font=nf, fill=DARK_INK)
    src = "via your storm inspection page"
    sf = mono(20)
    sw = d.textlength(src, font=sf)
    d.text((lx + (cw - sw) / 2, top + 156), src, font=sf, fill=DARK_MUTED)
    # decline / accept buttons with geometric icons (font glyphs are tofu)
    byc = top + 260
    dc_x, ac_x = lx + cw // 2 - 70, lx + cw // 2 + 70
    cyc = byc + 40
    d.ellipse([dc_x - 40, byc, dc_x + 40, byc + 80], fill=RED)
    d.ellipse([ac_x - 40, byc, ac_x + 40, byc + 80], fill=GREEN)
    # decline: X
    for dx, dy in [(1, 1), (1, -1)]:
        d.line([dc_x - 14 * dx, cyc - 14 * dy, dc_x + 14 * dx, cyc + 14 * dy], fill="#fff", width=7)
    # accept: handset as dumbbell at 45 degrees
    d.line([ac_x - 11, cyc + 11, ac_x + 11, cyc - 11], fill="#fff", width=9)
    d.ellipse([ac_x - 20, cyc + 2, ac_x - 2, cyc + 20], fill="#fff")
    d.ellipse([ac_x + 2, cyc - 20, ac_x + 20, cyc - 2], fill="#fff")

    # right: weekly report card
    rx = M + cw + gap
    d.rounded_rectangle([rx, top, rx + cw, top + card_h], radius=18, fill=CARD, outline=LINE, width=2)
    spaced(d, (rx + 26, top + 26), "YOUR WEEKLY REPORT", mono(22), BLUE)
    days = [("MON", 0.45), ("TUE", 0.7), ("WED", 0.55), ("THU", 0.9), ("FRI", 1.0)]
    chart_bottom = top + 300
    bar_w = 52
    bx0 = rx + 40
    for i, (label, h) in enumerate(days):
        bh = int(150 * h)
        bx = bx0 + i * (bar_w + 22)
        d.rounded_rectangle([bx, chart_bottom - bh, bx + bar_w, chart_bottom], radius=9,
                            fill=BLUE if h == 1.0 else BLUE_SOFT)
        lf = mono(17)
        lw = d.textlength(label, font=lf)
        d.text((bx + (bar_w - lw) / 2, chart_bottom + 12), label, font=lf, fill=INK3)
    d.text((rx + 26, top + card_h - 70), "calls this week ↑", font=instrument(28, 600), fill=INK)

    cta_row(d)
    return im


def gbp_mini(d: ImageDraw.ImageDraw, x: int, y: int, w: int) -> int:
    """Mini Google-listing card (the fictional Mike's Roofing example used
    across the site). Returns the card's bottom y."""
    h = 250
    d.rounded_rectangle([x, y, x + w, y + h], radius=16, fill=CARD, outline=LINE, width=2)
    # avatar + name
    d.rounded_rectangle([x + 22, y + 22, x + 74, y + 74], radius=12, fill="#3D5468")
    af = jakarta(30, 700)
    aw = d.textlength("M", font=af)
    d.text((x + 48 - aw / 2, y + 33), "M", font=af, fill="#fff")
    d.text((x + 90, y + 24), "Mike's Roofing", font=jakarta(28, 700), fill=INK)
    d.text((x + 90, y + 60), "Roofing contractor · Nashville", font=instrument(20, 500), fill=INK2)
    # stars + reviews
    sx = stars(d, x + 22, y + 100, size=18)
    d.text((sx + 10, y + 98), "4.9 · 212 reviews", font=instrument(22, 500), fill=INK2)
    # open line
    d.text((x + 22, y + 134), "Open", font=mono(20), fill=GREEN)
    ow = d.textlength("Open", font=mono(20))
    d.text((x + 22 + ow + 10, y + 134), "· Closes 6 PM", font=mono(20), fill=INK3)
    # photo squares
    py = y + 172
    ps = 56
    grads = ["#7D97AC", "#C0A184", "#9DBFB4"]
    for i, g in enumerate(grads):
        px = x + 22 + i * (ps + 10)
        d.rounded_rectangle([px, py, px + ps, py + ps], radius=8, fill=g)
    px = x + 22 + 3 * (ps + 10)
    d.rounded_rectangle([px, py, px + ps, py + ps], radius=8, fill=PAPER2)
    pf = instrument(18, 600)
    pw = d.textlength("+38", font=pf)
    d.text((px + (ps - pw) / 2, py + 18), "+38", font=pf, fill=INK3)
    return y + h


def handset_icon(d: ImageDraw.ImageDraw, cx: int, cy: int, scale: float = 1.0, fill: str = "#fff") -> None:
    r = int(9 * scale)
    off = int(11 * scale)
    d.line([cx - off, cy + off, cx + off, cy - off], fill=fill, width=int(9 * scale))
    d.ellipse([cx - off - r, cy + off - r, cx - off + r, cy + off + r], fill=fill)
    d.ellipse([cx + off - r, cy - off - r, cx + off + r, cy - off + r], fill=fill)


def call_toast(d: ImageDraw.ImageDraw, x: int, y: int, w: int, label: str = "Incoming call") -> None:
    h = 84
    d.rounded_rectangle([x, y, x + w, y + h], radius=16, fill=DARK)
    d.ellipse([x + 16, y + 16, x + 68, y + 68], fill=GREEN)
    handset_icon(d, x + 42, y + 42, scale=0.75)
    d.text((x + 84, y + 16), label, font=jakarta(24, 700), fill=DARK_INK)
    d.text((x + 84, y + 48), "(615) 555-0119", font=mono(19), fill=DARK_MUTED)


# Fictional example businesses for the transformation stacks (555 numbers,
# same convention as the homepage and niche-page mocks).
BIZ = {
    "roofing": {
        "name": "Mike's Roofing", "cat": "Roofing contractor · Nashville",
        "initial": "M", "tile": "#3D5468", "rating": "4.9 · 212 reviews",
        "service": "ROOF REPAIR", "phone": "(615) 555-0119",
        "headline": "Storm damage? Fixed this week",
        "sub": "Free inspections, insurance-ready reports",
    },
    "tree": {
        "name": "Canopy Tree Service", "cat": "Tree service · Portland",
        "initial": "C", "tile": "#527568", "rating": "4.9 · 164 reviews",
        "service": "TREE REMOVAL", "phone": "(503) 555-0138",
        "headline": "That leaning tree won't wait",
        "sub": "Same-week removals across Portland",
    },
    "auto": {
        "name": "Summit Auto Repair", "cat": "Auto repair · Boise",
        "initial": "S", "tile": "#7A5A3D", "rating": "4.8 · 187 reviews",
        "service": "BRAKE SERVICE", "phone": "(208) 555-0154",
        "headline": "Squealing brakes? Stop safely",
        "sub": "Same-day brake service in Boise",
    },
    "plumbing": {
        "name": "Harbor Plumbing", "cat": "Plumber · Santa Cruz",
        "initial": "H", "tile": "#3E5E70", "rating": "4.9 · 312 reviews",
        "service": "WATER HEATERS", "phone": "(831) 555-0142",
        "headline": "No hot water? Fixed today",
        "sub": "Water heater replacement, same day",
    },
    "hvac": {
        "name": "Comfort Air", "cat": "HVAC · Sacramento",
        "initial": "C", "tile": "#8A5A3C", "rating": "4.8 · 204 reviews",
        "service": "AC REPAIR", "phone": "(916) 555-0177",
        "headline": "AC out? Cool again today",
        "sub": "Emergency repairs across Sacramento",
    },
    "electric": {
        "name": "Bright Line Electric", "cat": "Electrician · San Jose",
        "initial": "B", "tile": "#4A4E63", "rating": "4.9 · 187 reviews",
        "service": "PANEL UPGRADES", "phone": "(408) 555-0193",
        "headline": "Breakers tripping every week?",
        "sub": "Panel inspections booked this week",
    },
    "pest": {
        "name": "Sentinel Pest Control", "cat": "Pest control · Phoenix",
        "initial": "S", "tile": "#7A6A4A", "rating": "4.8 · 256 reviews",
        "service": "TERMITE CONTROL", "phone": "(602) 555-0164",
        "headline": "Termite wings by the window?",
        "sub": "Free inspections across Phoenix",
    },
    "garage": {
        "name": "Liftright Garage Door", "cat": "Garage doors · Denver",
        "initial": "L", "tile": "#5A5E71", "rating": "4.9 · 143 reviews",
        "service": "SPRING REPAIR", "phone": "(720) 555-0186",
        "headline": "Door stuck halfway down?",
        "sub": "Same-day spring replacement",
    },
}

D_COMBOS = [
    ("1", ["roofing", "tree", "auto"]),
    ("2", ["plumbing", "hvac", "electric"]),
    ("3", ["roofing", "plumbing", "pest"]),
    ("4", ["electric", "auto", "garage"]),
]


def concept_d(trades: list[str]) -> Image.Image:
    """The transformation, three trades deep: listing -> matching call page
    with real example copy, reviews, and open-now on the page side."""
    im = Image.new("RGB", (S, S), PAPER)
    d = ImageDraw.Draw(im)

    # compact head (smaller than the shared head_block so three taller rows fit)
    logo(d, M, M)
    spaced(d, (0, M + 10), "OPTIMIZE FOR CALLS", mono(24), BLUE, anchor_right=S - M)
    y = 190
    h_font = jakarta(68, 800)
    for ln in wrap(d, "Turn your Google listing into inbound calls", h_font, S - 2 * M):
        d.text((M, y), ln, font=h_font, fill=INK)
        y += 78
    y += 8
    d.text((M, y), "We build the page and the ads. Your phone does the rest.", font=instrument(30), fill=INK2)
    y += 40

    row_h = 176
    row_gap = 22
    top = y + 24
    lw_card = 384
    rw_card = 448
    rx = S - M - rw_card

    for i, key in enumerate(trades):
        biz = BIZ[key]
        ry = top + i * (row_h + row_gap)

        # left: mini listing card
        d.rounded_rectangle([M, ry, M + lw_card, ry + row_h], radius=14, fill=CARD, outline=LINE, width=2)
        d.rounded_rectangle([M + 18, ry + 20, M + 62, ry + 64], radius=10, fill=biz["tile"])
        af = jakarta(26, 700)
        aw = d.textlength(biz["initial"], font=af)
        d.text((M + 40 - aw / 2, ry + 29), biz["initial"], font=af, fill="#fff")
        d.text((M + 76, ry + 20), biz["name"], font=jakarta(23, 700), fill=INK)
        d.text((M + 76, ry + 52), biz["cat"], font=instrument(17, 500), fill=INK2)
        sx = stars(d, M + 18, ry + 92, size=15)
        d.text((sx + 8, ry + 89), biz["rating"], font=instrument(18, 500), fill=INK2)
        d.text((M + 18, ry + 126), "Open", font=mono(17), fill=GREEN)
        ow = d.textlength("Open", font=mono(17))
        d.text((M + 18 + ow + 8, ry + 126), "· Closes 6 PM", font=mono(17), fill=INK3)

        # arrow
        ax0, ax1 = M + lw_card + 14, rx - 14
        ay = ry + row_h // 2
        xx = ax0
        while xx < ax1 - 12:
            d.line([xx, ay, min(xx + 9, ax1 - 12), ay], fill=BLUE, width=4)
            xx += 16
        d.polygon([(ax1 - 12, ay - 9), (ax1, ay), (ax1 - 12, ay + 9)], fill=BLUE)

        # right: matching call page mini with real copy
        d.rounded_rectangle([rx, ry, rx + rw_card, ry + row_h], radius=14, fill=CARD, outline=BLUE, width=3)
        pill_f = mono(13)
        pill_w = sum(d.textlength(ch, font=pill_f) for ch in biz["service"]) + 2 * (len(biz["service"]) - 1)
        d.rounded_rectangle([rx + 20, ry + 14, rx + 20 + pill_w + 24, ry + 37], radius=11, fill=BLUE_SOFT)
        spaced(d, (rx + 32, ry + 19), biz["service"], pill_f, BLUE, tracking=2)
        d.text((rx + 20, ry + 46), biz["headline"], font=jakarta(22, 800), fill=INK)
        d.text((rx + 20, ry + 76), biz["sub"], font=instrument(16.5, 500), fill=INK2)
        sx2 = stars(d, rx + 20, ry + 103, size=13)
        d.text((sx2 + 7, ry + 100), biz["rating"], font=instrument(15, 500), fill=INK2)
        onf = mono(13)
        on_w = sum(d.textlength(ch, font=onf) for ch in "OPEN NOW") + 2 * 7
        d.ellipse([rx + rw_card - 20 - on_w - 16, ry + 104, rx + rw_card - 20 - on_w - 6, ry + 114], fill=GREEN)
        spaced(d, (rx + rw_card - 20 - on_w, ry + 101), "OPEN NOW", onf, GREEN, tracking=2)
        d.rounded_rectangle([rx + 20, ry + 126, rx + rw_card - 20, ry + row_h - 12], radius=10, fill=GREEN)
        ct = f"Call Now {biz['phone']}"
        cf = instrument(19, 600)
        ctw = d.textlength(ct, font=cf)
        btn_mid = ry + 126 + (row_h - 12 - 126) / 2
        d.text((rx + (rw_card - ctw) / 2, btn_mid - 11), ct, font=cf, fill="#fff")

    return im


def concept_e() -> Image.Image:
    """The call log: what the listing could be doing all day."""
    im = Image.new("RGB", (S, S), PAPER)
    d = ImageDraw.Draw(im)
    y = head_block(d, "MORE INBOUND CALLS",
                   "What your listing could be doing all day",
                   "Your reviews and photos, rebuilt into a page that rings.")

    top = y + 6
    card_h = 430
    d.rounded_rectangle([M, top, S - M, top + card_h], radius=18, fill=CARD, outline=LINE, width=2)
    spaced(d, (M + 30, top + 26), "TODAY · VIA YOUR CALL PAGE", mono(22), BLUE)

    rows = [
        ("Roof inspection request", "8:41 AM", "answered"),
        ("Storm damage, insurance quote", "10:07 AM", "answered"),
        ("Leak repair, Davidson County", "1:52 PM", "answered"),
    ]
    ry = top + 74
    for title, time_s, tag in rows:
        d.ellipse([M + 30, ry + 6, M + 74, ry + 50], fill=GREEN)
        handset_icon(d, M + 52, ry + 28, scale=0.62)
        d.text((M + 92, ry + 2), title, font=jakarta(26, 700), fill=INK)
        d.text((M + 92, ry + 36), time_s, font=mono(19), fill=INK3)
        tf = mono(19)
        tw = d.textlength(tag, font=tf)
        d.text((S - M - 30 - tw, ry + 18), tag, font=tf, fill=GREEN)
        ry += 78
    # highlighted incoming row
    d.rounded_rectangle([M + 18, ry, S - M - 18, ry + 88], radius=14, fill=BLUE_SOFT)
    d.ellipse([M + 34, ry + 20, M + 82, ry + 68], fill=BLUE)
    handset_icon(d, M + 58, ry + 44, scale=0.68)
    d.text((M + 100, ry + 16), "Incoming call…", font=jakarta(28, 800), fill=BLUE_DEEP)
    d.text((M + 100, ry + 52), "(615) 555-0119 · via your storm inspection page", font=mono(18), fill=INK2)

    cta_row(d)
    return im


def concept_f() -> Image.Image:
    """Reviews earned the trust; the page cashes it in."""
    im = Image.new("RGB", (S, S), PAPER)
    d = ImageDraw.Draw(im)
    y = head_block(d, "PROOF → PHONE",
                   "Your reviews earned the trust. Cash it in.",
                   "Your 5-star proof, on a page with one job: the call.")

    top = y + 6
    card_h = 430
    gap = 28
    cw = (S - 2 * M - gap) // 2

    # left: review stack
    lx = M
    d.rounded_rectangle([lx, top, lx + cw, top + card_h], radius=18, fill=CARD, outline=LINE, width=2)
    spaced(d, (lx + 26, top + 24), "WHAT YOU'VE EARNED", mono(22), INK3)
    ry = top + 66
    for i in range(3):
        d.rounded_rectangle([lx + 26, ry, lx + cw - 26, ry + 96], radius=12, fill=PAPER2)
        stars(d, lx + 44, ry + 16, size=15)
        d.rounded_rectangle([lx + 44, ry + 46, lx + cw - 60, ry + 58], radius=6, fill="#D9D3C7")
        d.rounded_rectangle([lx + 44, ry + 66, lx + int(cw * 0.62), ry + 78], radius=6, fill="#E2DDD2")
        ry += 112
    d.text((lx + 26, top + card_h - 26 - 12), "", font=instrument(20), fill=INK3)

    # right: dark call card
    rx = M + cw + gap
    d.rounded_rectangle([rx, top, rx + cw, top + card_h], radius=18, fill=DARK)
    spaced(d, (rx + 26, top + 24), "WHAT IT EARNS YOU", mono(22), "#7FD4AC")
    # ring pulses
    ccx, ccy = rx + cw // 2, top + 190
    for rr, wd in [(120, 3), (90, 4)]:
        d.ellipse([ccx - rr, ccy - rr, ccx + rr, ccy + rr], outline="#2A3340", width=wd)
    d.ellipse([ccx - 56, ccy - 56, ccx + 56, ccy + 56], fill=GREEN)
    handset_icon(d, ccx, ccy, scale=1.5)
    label = "Incoming call"
    lf2 = jakarta(30, 800)
    lw2 = d.textlength(label, font=lf2)
    d.text((rx + (cw - lw2) / 2, top + 316), label, font=lf2, fill=DARK_INK)
    src = "via your call page"
    sf2 = mono(20)
    sw2 = d.textlength(src, font=sf2)
    d.text((rx + (cw - sw2) / 2, top + 360), src, font=sf2, fill=DARK_MUTED)

    cta_row(d)
    return im


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for name, fn in [
        ("concept-a-homepage-vs-callpage.png", concept_a),
        ("concept-b-built-in-30-seconds.png", concept_b),
        ("concept-c-the-phone-rings.png", concept_c),
        ("concept-e-call-log.png", concept_e),
        ("concept-f-reviews-to-rings.png", concept_f),
    ]:
        im = fn()
        im.save(OUT_DIR / name)
        print("wrote", (OUT_DIR / name).relative_to(REPO))
    for suffix, trades in D_COMBOS:
        im = concept_d(trades)
        name = f"concept-d{suffix}-listing-to-calls.png"
        im.save(OUT_DIR / name)
        print("wrote", (OUT_DIR / name).relative_to(REPO))


if __name__ == "__main__":
    main()

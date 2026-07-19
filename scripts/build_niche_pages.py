"""Generate the per-trade marketing pages (sendkpi.com/for-plumbers etc.).

Each page sells one niche on don't-delay Meta ads + a matching call-focused
lander, both built from their Google Business Profile in about two minutes.
Static HTML into frontend/public/ so they ship with the frontend deploy and
need no router changes.

Run from the repo root:  python3 scripts/build_niche_pages.py
"""
from __future__ import annotations

import html
import pathlib

OUT_DIR = pathlib.Path(__file__).resolve().parent.parent / "frontend" / "public"

esc = html.escape

# Fictional example businesses (555 numbers, same convention as the homepage
# mock) -- clearly illustrative, never real listings.
NICHES = [
    {
        "slug": "for-plumbers",
        "trade": "Plumbers",
        "trade_singular": "plumber",
        "problem_word": "Plumbing problems",
        "biz": {"name": "Harbor Plumbing", "city": "Santa Cruz", "state": "CA", "phone": "(831) 555-0142", "rating": "4.9", "reviews": "312", "domain": "plumbing.harborplumbingsc.com", "eyebrow": "Santa Cruz's Highest-Rated Plumbers"},
        "symptoms": [
            "A slow drain — it's a clog in progress, then sewage backs up into the house",
            "Gurgling drains or a sewer smell — roots in the line, then a dug-up yard",
            "A rumbling 10-year-old water heater — it fails and floods the space it lives in",
            "A small leak under the sink — rotted cabinets and mold behind them",
        ],
        "ads": [
            {"h": "That Slow Drain Isn't Fixing Itself", "s": "It's a clog in progress — sewage backup comes next", "c": "Fix It Today"},
            {"h": "Gurgling Drains Are Not Normal", "s": "Roots in the line come next, then a dug-up yard", "c": "Call Before It Spreads"},
            {"h": "Your Water Heater Is Telling You", "s": "Rumbling and rusty water end in a flooded closet", "c": "Replace It First"},
        ],
    },
    {
        "slug": "for-hvac",
        "trade": "HVAC companies",
        "trade_singular": "HVAC company",
        "problem_word": "AC and furnace trouble",
        "biz": {"name": "Comfort Air Heating & Cooling", "city": "Sacramento", "state": "CA", "phone": "(916) 555-0177", "rating": "4.8", "reviews": "204", "domain": "ac.comfortairsac.com", "eyebrow": "Sacramento's Highest-Rated HVAC Team"},
        "symptoms": [
            "Weak airflow or a rattle from the unit — a dead compressor in the hottest week of the year",
            "Short-cycling and a creeping power bill — a breakdown scheduled for peak season",
            "A skipped tune-up — a mid-season failure when every company is booked out",
        ],
        "ads": [
            {"h": "Your AC Has Been Warning You All Spring", "s": "Weak airflow now is a dead compressor in July", "c": "Book A Tune-Up"},
            {"h": "Short-Cycling Isn't A Quirk", "s": "It's a breakdown scheduled for the hottest week", "c": "Fix It Early"},
            {"h": "That Rattle Costs You Every Month", "s": "Failing units run longer and bill higher", "c": "Call Today"},
        ],
    },
    {
        "slug": "for-electricians",
        "trade": "Electricians",
        "trade_singular": "electrician",
        "problem_word": "Electrical problems",
        "biz": {"name": "Bright Line Electric", "city": "San Jose", "state": "CA", "phone": "(408) 555-0193", "rating": "4.9", "reviews": "187", "domain": "service.brightlineelectric.com", "eyebrow": "San Jose's Highest-Rated Electricians"},
        "symptoms": [
            "Warm outlets or a faint burning smell — a genuine fire risk behind the wall",
            "Flickering lights — loose or overloaded wiring asking for attention",
            "Breakers tripping every week — an overloaded or failing panel",
            "A decades-old panel — a fire hazard that also blocks insurance and home sales",
        ],
        "ads": [
            {"h": "Warm Outlets Are A Warning", "s": "Loose wiring behind the wall is a fire risk", "c": "Get It Checked"},
            {"h": "Flickering Lights Aren't Charming", "s": "They're loose connections asking for attention", "c": "Call An Electrician"},
            {"h": "Breaker Trips Every Week?", "s": "Your panel is telling you it's overloaded", "c": "Book An Inspection"},
        ],
    },
    {
        "slug": "for-roofers",
        "trade": "Roofers",
        "trade_singular": "roofer",
        "problem_word": "Roof problems",
        "biz": {"name": "Ridgeline Roofing", "city": "Nashville", "state": "TN", "phone": "(615) 555-0119", "rating": "4.9", "reviews": "212", "domain": "roofing.ridgelinetn.com", "eyebrow": "Nashville's Highest-Rated Roofers"},
        "symptoms": [
            "Shingle granules collecting in the gutters — a roof letting water into the decking",
            "One lifted or missing shingle — a leak that rots the deck beneath it",
            "A small ceiling stain — interior water damage and mold already underway",
            "Clogged gutters — water backing under the roofline and down the walls",
        ],
        "ads": [
            {"h": "Granules In The Gutter?", "s": "Your shingles are wearing out — leaks come next", "c": "Get A Roof Check"},
            {"h": "One Lifted Shingle Lets Water In", "s": "A small repair now beats a rotted deck later", "c": "Fix It This Week"},
            {"h": "That Ceiling Stain Is Growing", "s": "Water is already inside — it won't stop on its own", "c": "Call Now"},
        ],
    },
    {
        "slug": "for-pest-control",
        "trade": "Pest control companies",
        "trade_singular": "pest control company",
        "problem_word": "Pest problems",
        "biz": {"name": "Sentinel Pest Control", "city": "Phoenix", "state": "AZ", "phone": "(602) 555-0164", "rating": "4.8", "reviews": "256", "domain": "pest.sentinelaz.com", "eyebrow": "Phoenix's Highest-Rated Pest Control"},
        "symptoms": [
            "One discarded termite wing or a pile of sawdust — an active colony eating the structure",
            "Droppings in the pantry — a growing nest inside the walls",
            "A few carpenter ants — hollowed-out framing where they've settled in",
        ],
        "ads": [
            {"h": "Saw One? There Are Never Just One", "s": "Droppings in the pantry mean a nest in the walls", "c": "Get An Inspection"},
            {"h": "A Termite Wing Is All The Warning You Get", "s": "The colony keeps eating while you wait", "c": "Call Before It Spreads"},
            {"h": "Sawdust You Didn't Make?", "s": "Carpenter ants are hollowing the framing", "c": "Book Pest Control"},
        ],
    },
    {
        "slug": "for-tree-service",
        "trade": "Tree services",
        "trade_singular": "tree service",
        "problem_word": "Tree problems",
        "biz": {"name": "Canopy Tree Service", "city": "Portland", "state": "OR", "phone": "(503) 555-0138", "rating": "4.9", "reviews": "164", "domain": "trees.canopypdx.com", "eyebrow": "Portland's Highest-Rated Tree Service"},
        "symptoms": [
            "Dead limbs over the roof — the next storm drops them on the house or car",
            "A leaning tree or mushrooms at the base — root failure and an uncontrolled fall",
            "Limbs growing into the power lines — an outage or worse in the next wind",
        ],
        "ads": [
            {"h": "Dead Limbs Don't Wait", "s": "The next storm drops them on the roof", "c": "Trim Before The Storm"},
            {"h": "A Leaning Tree Is A Falling Tree", "s": "Mushrooms at the base mean root failure", "c": "Get It Assessed"},
            {"h": "Limbs In The Lines?", "s": "One windy night away from an outage", "c": "Call A Crew"},
        ],
    },
    {
        "slug": "for-garage-door",
        "trade": "Garage door companies",
        "trade_singular": "garage door company",
        "problem_word": "Garage door trouble",
        "biz": {"name": "Overhead Door Co.", "city": "Denver", "state": "CO", "phone": "(303) 555-0186", "rating": "4.9", "reviews": "301", "domain": "repair.overheaddenver.com", "eyebrow": "Denver's Highest-Rated Garage Door Repair"},
        "symptoms": [
            "A grinding, uneven door — a snapped spring with the car stuck inside",
            "Frayed cables — a sudden failure of a very heavy door",
        ],
        "ads": [
            {"h": "A Grinding Garage Door Is A Countdown", "s": "Snapped springs strand the car inside", "c": "Fix It Today"},
            {"h": "It's 300 Pounds Over Your Head", "s": "Frayed cables fail all at once", "c": "Book A Repair"},
            {"h": "Uneven Lift? That's The Spring", "s": "Catch it before it snaps", "c": "Call Now"},
        ],
    },
    {
        "slug": "for-auto-repair",
        "trade": "Auto repair shops",
        "trade_singular": "auto repair shop",
        "problem_word": "Car trouble",
        "biz": {"name": "Main Street Auto Repair", "city": "Boise", "state": "ID", "phone": "(208) 555-0151", "rating": "4.8", "reviews": "423", "domain": "service.mainstreetautoboise.com", "eyebrow": "Boise's Highest-Rated Auto Shop"},
        "symptoms": [
            "Squealing brakes — worn pads scoring the rotors, a bigger repair every week it waits",
            "An ignored check-engine light — a small fix growing into engine damage",
            "Bald tires — a blowout at highway speed",
            "An overdue oil change — engine wear that never reverses",
        ],
        "ads": [
            {"h": "That Squeal Is Charging You Interest", "s": "Worn pads score rotors — the bill grows weekly", "c": "Book Brake Service"},
            {"h": "Tape Over The Check-Engine Light?", "s": "Small fixes grow into engine damage", "c": "Get It Read"},
            {"h": "Bald Tires Don't Warn You Twice", "s": "A blowout picks its own timing", "c": "Replace Them Now"},
        ],
    },
]

CSS = """
:root{--bg:#171310;--bg2:#211C17;--card:#282218;--line:rgba(255,255,255,.09);
--ink:#F4EFE9;--muted:#B3A99D;--faint:#8C8375;--signal:#FF5A1F;--amber:#E8843C;
--go:#5CB57E;--go-ink:#0E2418;--gold:#E9B949;
--display:'Space Grotesk',system-ui,sans-serif;--body:'Inter',system-ui,sans-serif;--mono:'IBM Plex Mono',ui-monospace,monospace}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
body{margin:0;font-family:var(--body);background:var(--bg);color:var(--ink);line-height:1.55}
a{color:inherit}img{max-width:100%}
.wrap{max-width:980px;margin:0 auto;padding:0 24px}
.topbar{position:sticky;top:0;z-index:30;background:rgba(23,19,16,.92);backdrop-filter:blur(8px);border-bottom:1px solid var(--line)}
.topbar-inner{max-width:980px;margin:0 auto;padding:14px 24px;display:flex;align-items:center;justify-content:space-between;gap:12px}
.logo{display:flex;align-items:center;gap:10px;font-family:var(--display);font-weight:700;font-size:17px;text-decoration:none;letter-spacing:-.01em}
.logo-mark{width:28px;height:28px;background:var(--signal);border-radius:7px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:13px}
.top-cta{background:var(--signal);color:#fff;font-family:var(--mono);font-weight:600;font-size:13px;padding:10px 18px;border-radius:999px;text-decoration:none;white-space:nowrap}
.hero{padding:72px 0 56px}
.eyebrow{font-family:var(--mono);font-weight:600;font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:var(--amber);margin:0 0 18px}
h1{font-family:var(--display);font-weight:700;font-size:clamp(32px,6vw,52px);line-height:1.07;letter-spacing:-.015em;margin:0 0 20px;max-width:21ch}
.sub{font-size:18px;color:var(--muted);margin:0 0 32px;max-width:56ch}
.sub b{color:var(--ink)}
.cta{display:inline-flex;align-items:center;gap:10px;background:var(--signal);color:#fff;font-family:var(--display);font-weight:700;font-size:18px;padding:16px 28px;border-radius:12px;text-decoration:none;box-shadow:0 8px 30px rgba(255,90,31,.25)}
.cta-note{display:block;margin-top:14px;font-family:var(--mono);font-size:12px;color:var(--faint)}
section{padding:56px 0;border-top:1px solid var(--line)}
.sec-eyebrow{font-family:var(--mono);font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--faint);margin:0 0 10px}
h2{font-family:var(--display);font-weight:700;font-size:clamp(24px,4vw,34px);letter-spacing:-.01em;margin:0 0 14px;max-width:26ch}
.lead{font-size:16px;color:var(--muted);margin:0 0 30px;max-width:60ch}
.lead b{color:var(--ink)}
.ads-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px}
.ad-card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:22px;display:flex;flex-direction:column;gap:12px}
.ad-tag{display:flex;align-items:center;justify-content:space-between;font-family:var(--mono);font-size:11px;letter-spacing:.06em;color:var(--faint);text-transform:uppercase}
.ad-tag .stars{color:var(--gold);letter-spacing:1px}
.ad-h{font-family:var(--display);font-weight:700;font-size:22px;line-height:1.15;letter-spacing:-.01em}
.ad-s{font-size:14px;color:var(--muted);line-height:1.5}
.ad-cta{align-self:flex-start;background:var(--go);color:var(--go-ink);font-family:var(--mono);font-weight:600;font-size:12px;letter-spacing:.04em;text-transform:uppercase;padding:10px 16px;border-radius:8px}
.symptoms{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:12px;max-width:640px}
.symptoms li{background:var(--bg2);border:1px solid var(--line);border-radius:12px;padding:14px 18px;font-size:15px;color:var(--muted)}
.symptoms li::before{content:"⚠";margin-right:10px;color:var(--amber)}
.mock{background:var(--bg2);border:1px solid var(--line);border-radius:20px;padding:26px;max-width:560px}
.mock-url{background:var(--card);border:1px solid var(--line);border-radius:999px;font-family:var(--mono);font-size:12px;color:var(--faint);padding:8px 16px;margin-bottom:22px;display:inline-block}
.mock-eyebrow{font-family:var(--mono);font-weight:600;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--amber);margin:0 0 12px}
.mock-h{font-family:var(--display);font-weight:700;font-size:clamp(22px,4vw,30px);line-height:1.12;letter-spacing:-.01em;margin:0 0 10px}
.mock-proof{font-size:14px;color:var(--muted);margin:0 0 20px}
.mock-call{display:flex;align-items:center;justify-content:center;gap:10px;background:var(--go);color:var(--go-ink);font-family:var(--display);font-weight:700;font-size:18px;padding:15px;border-radius:12px;text-decoration:none}
.mock-meta{display:flex;align-items:center;justify-content:space-between;margin-top:18px;padding-top:16px;border-top:2px dashed var(--line);font-size:13px}
.mock-stars{color:var(--gold);letter-spacing:2px}.mock-n{color:var(--muted)}
.mock-open{font-family:var(--mono);font-weight:600;font-size:12px;color:var(--go)}.mock-open::before{content:"● "}
.pull-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px;margin-top:8px}
.pull{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px;font-size:14px;color:var(--muted)}
.pull b{display:block;color:var(--ink);font-size:14px;margin-bottom:3px}
.steps{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:16px;counter-reset:step}
.step{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:22px}
.step-n{font-family:var(--mono);font-weight:600;font-size:12px;color:var(--amber);letter-spacing:.1em;margin-bottom:10px}
.step b{display:block;font-family:var(--display);font-size:17px;margin-bottom:8px}
.step p{margin:0;font-size:14px;color:var(--muted)}
.band{background:var(--bg2);border-top:1px solid var(--line);padding:64px 0;text-align:center}
.band h2{margin:0 auto 22px}
footer{padding:32px 0 44px;border-top:1px solid var(--line)}
.foot-links{font-size:13px;color:var(--faint);line-height:2}
.foot-links a{color:var(--muted);text-decoration:none}.foot-links a:hover{color:var(--ink)}
.fine{font-size:12px;color:var(--faint);margin-top:14px}
"""


def ad_card(biz: dict, ad: dict) -> str:
    return f"""<div class="ad-card">
      <div class="ad-tag"><span>■ {esc(biz["name"])}</span><span class="stars">★ {esc(biz["rating"])}</span></div>
      <div class="ad-h">{esc(ad["h"])}</div>
      <div class="ad-s">{esc(ad["s"])}</div>
      <div class="ad-cta">{esc(ad["c"])}</div>
    </div>"""


def page(n: dict) -> str:
    biz = n["biz"]
    trade_lc = n["trade"].lower()
    ads_html = "".join(ad_card(biz, ad) for ad in n["ads"])
    symptoms_html = "".join(f"<li>{esc(s)}</li>" for s in n["symptoms"])
    others = " · ".join(
        f'<a href="/{o["slug"]}">{esc(o["trade"])}</a>' for o in NICHES if o["slug"] != n["slug"]
    )
    return f"""<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>SendKPI for {esc(n["trade"])} — don't-delay ads + a landing page from your Google listing</title>
<meta name="description" content="SendKPI turns a {esc(n["trade_singular"])}'s Google Business Profile into a call-focused landing page and matching don't-delay Meta ads — in about two minutes.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap" rel="stylesheet">
<style>{CSS}</style></head><body>

<div class="topbar"><div class="topbar-inner">
  <a class="logo" href="/"><span class="logo-mark">▲</span>SendKPI</a>
  <a class="top-cta" href="/">Build mine free</a>
</div></div>

<header class="hero"><div class="wrap">
  <p class="eyebrow">SendKPI for {esc(n["trade"])}</p>
  <h1>Ads that stop the scroll. A page that makes the phone ring.</h1>
  <p class="sub">Google catches emergencies. Meta reaches the homeowner who's been <b>ignoring the warning signs</b>. SendKPI reads your Google Business Profile — your reviews, photos, hours, phone — and builds a call-focused landing page plus matching "don't-delay" ads for it. <b>About two minutes</b>, start to download.</p>
  <a class="cta" href="/">Find my listing →</a>
  <span class="cta-note">Free to build · No card · Your real reviews and photos, not a template</span>
</div></header>

<section><div class="wrap">
  <p class="sec-eyebrow">The angle</p>
  <h2>{esc(n["problem_word"])} people ignore — your best ad inventory</h2>
  <p class="lead">Every {esc(n["trade_singular"])} knows the calls that came six months too late. The don't-delay angle names the symptom, shows what it turns into, and hands them your number — with your real rating doing the trust work. SendKPI writes these for your business automatically:</p>
  <div class="ads-grid">{ads_html}</div>
</div></section>

<section><div class="wrap">
  <p class="sec-eyebrow">Why it converts</p>
  <h2>What your customers are ignoring right now</h2>
  <ul class="symptoms">{symptoms_html}</ul>
</div></section>

<section><div class="wrap">
  <p class="sec-eyebrow">The matching lander</p>
  <h2>The click lands on proof, not a template</h2>
  <p class="lead">The ad says "don't wait" — the page instantly answers "why you." Your Google rating, review count, real customer reviews, photos, hours, and a tap-to-call button, assembled into a page built to convert the click into a call:</p>
  <div class="mock">
    <span class="mock-url">{esc(biz["domain"])}</span>
    <p class="mock-eyebrow">{esc(biz["eyebrow"])}</p>
    <p class="mock-h">{esc(n["problem_word"])} in {esc(biz["city"])} — fixed fast, done right</p>
    <p class="mock-proof">Open now · Serving {esc(biz["city"])}, {esc(biz["state"])}</p>
    <a class="mock-call" href="/">&#128222; Call {esc(biz["phone"])}</a>
    <div class="mock-meta">
      <span><span class="mock-stars">★★★★★</span> <span class="mock-n"><b>{esc(biz["rating"])}</b> · {esc(biz["reviews"])} reviews</span></span>
      <span class="mock-open">OPEN NOW</span>
    </div>
  </div>
  <div class="pull-list">
    <div class="pull"><b>★ Rating &amp; reviews</b>Your real Google rating, count, and customer quotes</div>
    <div class="pull"><b>Your photos</b>Trucks, crews, and finished jobs from your listing</div>
    <div class="pull"><b>Tap to call</b>Your real number, one thumb-tap away</div>
    <div class="pull"><b>Hours &amp; open-now</b>Live open/closed status pulled from Google</div>
    <div class="pull"><b>Map &amp; service area</b>Embedded map with your pin and directions</div>
    <div class="pull"><b>AI offer copy</b>A headline built from what your own site promises</div>
  </div>
</div></section>

<section><div class="wrap">
  <p class="sec-eyebrow">How it works</p>
  <h2>About two minutes, start to finish</h2>
  <div class="steps">
    <div class="step"><div class="step-n">STEP 1</div><b>Find your listing</b><p>Type your business name and city. SendKPI pulls your Google Business Profile — nothing to upload, nothing to write.</p></div>
    <div class="step"><div class="step-n">STEP 2</div><b>Build the ads</b><p>Your lander is assembled instantly. Pick up to 3 photos, choose the "don't delay" angle, and the ad copy writes itself from your real services and reviews.</p></div>
    <div class="step"><div class="step-n">STEP 3</div><b>Download &amp; launch</b><p>Sign in with Google and your landing page plus ad graphics download on the spot — ready for Meta and ready to make the phone ring.</p></div>
  </div>
</div></section>

<div class="band"><div class="wrap">
  <h2>See yours in the next two minutes</h2>
  <a class="cta" href="/">Find my listing →</a>
</div></div>

<footer><div class="wrap">
  <p class="foot-links">SendKPI also builds for: {others}</p>
  <p class="fine">© 2026 SendKPI. Not affiliated with Google or Meta. Example business shown is illustrative.</p>
</div></footer>

</body></html>"""


def main() -> None:
    OUT_DIR.mkdir(exist_ok=True)
    for n in NICHES:
        out = OUT_DIR / f"{n['slug']}.html"
        out.write_text(page(n))
        print(f"wrote {out.relative_to(OUT_DIR.parent.parent)}")


if __name__ == "__main__":
    main()

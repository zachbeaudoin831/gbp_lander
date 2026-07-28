import { useEffect, useRef, useState } from "react";
import "./home.css";

/* The hero "build log": phases the tool runs, rendered as code rolling by. */
const BUILD_LOG = [
  { head: "creating page", lines: [
    '<section class="hero"> <h1>{business.name}</h1>',
    'render(call_button, phone="tap-to-call")',
    "✓ page scaffold ready",
  ]},
  { head: "pulling photos & reviews from your listing", lines: [
    "fetch(listing.photos)  → 8 photos",
    "fetch(listing.reviews) → ★ 4.9 · 212 reviews",
    "✓ proof attached above the fold",
  ]},
  { head: "scanning logo for color palette", lines: [
    "palette.extract(logo.png)",
    'brand_color: "#1F5FBF" · cta: high-contrast',
    "✓ palette applied to buttons",
  ]},
  { head: "researching winning angles", lines: [
    'angle("don\'t delay"): symptom → consequence → call',
    "match(services, symptom_library) → 7 hits",
    "✓ strongest angle selected",
  ]},
  { head: "creating ads", lines: [
    'compose(1080×1080, headline, cta="Call Today")',
    "write(primary_text, cite_rating=true)",
    "✓ 3 ads exported",
  ]},
];

// Keep in sync with scripts/build_niche_pages.py (the /for-* pages).
const INDUSTRIES = [
  { label: "Plumbers", href: "/for-plumbers" },
  { label: "HVAC", href: "/for-hvac" },
  { label: "Electricians", href: "/for-electricians" },
  { label: "Roofers", href: "/for-roofers" },
  { label: "Pest control", href: "/for-pest-control" },
  { label: "Tree services", href: "/for-tree-service" },
  { label: "Garage door", href: "/for-garage-door" },
  { label: "Auto repair", href: "/for-auto-repair" },
];

/* SendKPI mark: dialpad key (#) with a "new report" badge. The # is the
   true typographic glyph (Inter SemiBold outline, baked in as a path so it
   renders identically everywhere). ring = the background color behind the
   badge's cutout ring. */
export const LogoMark = ({ size = 30, ring = "#FBFAF7" }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" style={{ display: "block", flex: "none" }}>
    <defs><linearGradient id="skpiG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#0D57D0" /><stop offset="1" stopColor="#0A46A8" /></linearGradient></defs>
    <rect x="6" y="8" width="48" height="48" rx="9" fill="url(#skpiG)" />
    <g transform="translate(17.09 47.00) scale(0.02013 -0.02013)">
      <path d="M674.6 0 919.7 1490H1131.1L886.2 0ZM4.8 380.3 40.6 591.7H1191.8L1156.0 380.3ZM151.7 0 395.7 1490H607.1L363.1 0ZM91.0 897.2 126.8 1109.7H1276.9L1242.2 897.2Z" fill="#fff" />
    </g>
    <circle cx="53" cy="12" r="9.5" fill="#0E8A5F" stroke={ring} strokeWidth="3" />
  </svg>
);

/* Marketing homepage for the builder tool itself (distinct from the pages
   it generates). Scoped under .lb-home in home.css so its own color system
   doesn't leak into the candidates/preview/dashboard screens, which still
   use the app-shell theme in index.css. */
export default function Home({ query, setQuery, error, onSearch, onSignIn }) {
  const rootRef = useRef(null);
  const dropRef = useRef(null);
  const mobileRef = useRef(null);
  const [industriesOpen, setIndustriesOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!industriesOpen && !mobileNavOpen) return;
    const onDown = e => {
      if (industriesOpen && dropRef.current && !dropRef.current.contains(e.target)) setIndustriesOpen(false);
      if (mobileNavOpen && mobileRef.current && !mobileRef.current.contains(e.target)) setMobileNavOpen(false);
    };
    const onKey = e => { if (e.key === "Escape") { setIndustriesOpen(false); setMobileNavOpen(false); } };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [industriesOpen, mobileNavOpen]);

  useEffect(() => {
    const els = rootRef.current?.querySelectorAll(".reveal") || [];
    if (!("IntersectionObserver" in window)) {
      els.forEach(e => e.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(
      entries => {
        entries.forEach(en => {
          if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    els.forEach(e => io.observe(e));
    return () => io.disconnect();
  }, []);

  return (
    <div className="lb-home" ref={rootRef}>
      <header className="site-header">
        <div className="wrap">
          <a className="logo" href="#top">
            <LogoMark />
            SendKPI
          </a>
          <nav className="nav-links" aria-label="Main">
            <a href="#how">How it works</a>
            <a href="#pulls">What we pull in</a>
            <div className={`nav-drop${industriesOpen ? " open" : ""}`} ref={dropRef}>
              <button type="button" className="nav-drop-btn" aria-expanded={industriesOpen} aria-haspopup="true" onClick={() => setIndustriesOpen(o => !o)}>
                Top Industries
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true"><path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
              <div className="nav-drop-panel" role="menu">
                {INDUSTRIES.map(i => <a key={i.href} href={i.href} role="menuitem">{i.label}</a>)}
              </div>
            </div>
            <a href="#examples">Examples</a>
            <a href="#faq">FAQ</a>
          </nav>
          <div className={`mobile-nav${mobileNavOpen ? " open" : ""}`} ref={mobileRef}>
            <button className="mobile-nav-btn" type="button" aria-label="Menu" aria-expanded={mobileNavOpen} onClick={() => setMobileNavOpen(o => !o)}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="17" x2="20" y2="17" />
              </svg>
            </button>
            <div className="mobile-nav-panel" role="menu">
              <a href="#how" onClick={() => setMobileNavOpen(false)}>How it works</a>
              <a href="#pulls" onClick={() => setMobileNavOpen(false)}>What we pull in</a>
              <a href="#examples" onClick={() => setMobileNavOpen(false)}>Examples</a>
              <a href="#faq" onClick={() => setMobileNavOpen(false)}>FAQ</a>
              <div className="mobile-nav-sep">Top Industries</div>
              {INDUSTRIES.map(i => <a key={i.href} href={i.href}>{i.label}</a>)}
            </div>
          </div>
          <button className="btn btn-primary header-cta" type="button" onClick={onSignIn}>Login</button>
        </div>
      </header>

      <main>
        {/* HERO */}
        <section className="hero" id="top">
          <div className="wrap">
            <div className="hero-copy">
              <h1>Turn Your Google Listing<br />Into More <span className="ring" style={{whiteSpace:'nowrap'}}>Inbound Calls<svg viewBox="0 0 200 24" preserveAspectRatio="none" aria-hidden="true"><path d="M4 18 C 50 8, 150 8, 196 14" /></svg></span></h1>
              <p className="hero-sub">We build landing pages and ads around the main needle mover for local businesses: <strong>inbound calls</strong>. Start with your Google Business Listing below.</p>

              <form className="finder" onSubmit={e => { e.preventDefault(); onSearch(e); }}>
                <div className="finder-box">
                  <svg className="pin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
                  <input
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Business name and city"
                    aria-label="Business name and city"
                  />
                  <button className="btn btn-primary" type="submit">Find my listing →</button>
                </div>
                {error && <p className="finder-hint" style={{ color: "var(--orange-deep)" }}>{error}</p>}
              </form>

              <div className="build-log" aria-hidden="true">
                <div className="build-log-roll">
                  {[0, 1].map(copy => (
                    <div key={copy}>
                      {BUILD_LOG.map(phase => (
                        <div key={phase.head} className="build-log-phase">
                          <p className="build-log-head"><span className="caret">▸</span> {phase.head}</p>
                          {phase.lines.map(ln => (
                            <p key={ln} className={`build-log-line${ln.startsWith("✓") ? " ok" : ""}`}>{ln}</p>
                          ))}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* listing → lander transformation */}
            <div className="transform" aria-label="Illustration: a Google Business Profile becoming a landing page">
              <div className="gbp-card">
                <span className="gbp-tag">Your Google listing</span>
                <div className="gbp-top">
                  <div className="gbp-avatar" aria-hidden="true">M</div>
                  <div>
                    <div className="gbp-name">Mike's Roofing</div>
                    <div className="gbp-cat">Roofing contractor · Nashville, TN</div>
                  </div>
                </div>
                <div className="gbp-rating">
                  <b>4.9</b><span className="stars" aria-hidden="true">★★★★★</span><span className="count">212 reviews</span>
                </div>
                <div className="gbp-open"><span className="o">Open</span> <span className="c">· Closes 6 PM</span></div>
                <div className="gbp-photos" aria-hidden="true">
                  <span></span><span></span><span></span><span>+38</span>
                </div>
              </div>

              <div className="route" aria-hidden="true">
                <svg viewBox="0 0 400 74" preserveAspectRatio="none"><path d="M80 4 C 80 46, 320 28, 320 70" /></svg>
                <span className="route-label"><span className="dot"></span>Building your page</span>
              </div>

              <div className="lander-mock">
                <div className="mock-chrome" aria-hidden="true">
                  <span className="mock-dots"><i></i><i></i><i></i></span>
                  <span className="mock-url">roofing.mikesroofingtn.com</span>
                </div>
                <div className="mock-body">
                  <p className="mock-eyebrow">Nashville's highest-rated roofers</p>
                  <p className="mock-h1">Did last night's storm hit your roof?</p>
                  <p className="mock-sub">Free storm inspections this week. Photos and a written report before you call your insurance.</p>
                  <button className="mock-call" type="button" aria-label="Example call button">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.13.96.36 1.9.7 2.8a2 2 0 0 1-.45 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.45c.9.34 1.84.57 2.8.7a2 2 0 0 1 1.7 2.05Z" /></svg>
                    Call Now (615) 555-0119
                  </button>
                  <div className="mock-meta">
                    <span><span className="stars" aria-hidden="true">★★★★★</span> 4.9 · 212 reviews</span>
                    <span className="open">● OPEN NOW</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* STRIP */}
        <div className="strip">
          <div className="wrap">
            <div className="strip-item"><b>One search</b><span>builds your page from your listing</span></div>
            <div className="strip-item"><b>5 to 7 angles</b><span>researched and written for your trade</span></div>
            <div className="strip-item"><b>4 matching ads</b><span>same message from feed to phone</span></div>
            <div className="strip-item"><b>One HTML file</b><span>host it wherever your ads point</span></div>
          </div>
        </div>

        {/* HOW IT WORKS */}
        <section className="section" id="how">
          <div className="wrap">
            <div className="section-head reveal">
              <p className="eyebrow">How it works</p>
              <h2>From listing to a call-ready campaign in five steps</h2>
              <p>No page builder, no blank page, no writing. Your Google Business Profile already holds the proof; we add the research and the message, then build everything around one goal: the phone call.</p>
            </div>
            <div className="flow">
              <div className="flow-item reveal">
                <span className="flow-num" aria-hidden="true">1</span>
                <div>
                  <h3>Find your listing</h3>
                  <p>Type your business name and city. We pull your live Google Business Profile: reviews, photos, hours, services, and your phone number.</p>
                </div>
              </div>
              <div className="flow-item reveal">
                <span className="flow-num" aria-hidden="true">2</span>
                <div>
                  <h3>Tell us the service you want more calls for</h3>
                  <p>One question while we scan your website in the background. That service becomes the job of the whole campaign.</p>
                </div>
              </div>
              <div className="flow-item reveal">
                <span className="flow-num" aria-hidden="true">3</span>
                <div>
                  <h3>Pick your winning angle</h3>
                  <p>We research 5 to 7 ad angles that already work in your trade (storm response, don't delay, review-led proof) and customize each with your reviews, your city, and your services. You pick the message.</p>
                </div>
              </div>
              <div className="flow-item reveal">
                <span className="flow-num" aria-hidden="true">4</span>
                <div>
                  <h3>Your Call Now page is built around it</h3>
                  <p>The angle becomes your headline. Your best reviews sit above the fold, open-now status is live, and every scroll position is one tap from a call.</p>
                </div>
              </div>
              <div className="flow-item reveal">
                <span className="flow-num" aria-hidden="true">5</span>
                <div>
                  <h3>Four matching ads, ready for Meta</h3>
                  <p>Four executions of your angle on your real photos: 1080×1080 graphics with the primary text already written. Download everything and launch.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ANGLE RESEARCH */}
        <section className="section angle-sec" id="angles">
          <div className="wrap">
            <div>
              <div className="section-head reveal">
                <p className="eyebrow">The message</p>
                <h2>Researched, not guessed</h2>
                <p>Most local ads fail before design ever matters: they say "quality service since 1998" to someone scrolling past. Winning ads name the moment: the storm that just hit, the stain that's growing, the 4.9 stars your neighbors already left.</p>
              </div>
              <div className="ads-points reveal">
                <div className="ads-point">
                  <span className="ads-check" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg></span>
                  <span><b>Angles proven by your trade.</b> Built from what already converts for plumbers, roofers, HVAC, and the other emergency trades.</span>
                </div>
                <div className="ads-point">
                  <span className="ads-check" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg></span>
                  <span><b>Customized with your proof.</b> Your real rating, your review quotes, your service area. Never invented claims.</span>
                </div>
                <div className="ads-point">
                  <span className="ads-check" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg></span>
                  <span><b>You stay in charge.</b> We shortlist and write; you pick the angle that sounds like your business. One click, no writing.</span>
                </div>
              </div>
            </div>
            <div className="angle-mock reveal" aria-label="Example of the angle picker">
              <p className="angle-mock-head">6 winning angles found · Mike's Roofing</p>
              <div className="angle-row selected">
                <div className="angle-row-top">
                  <span className="angle-pill">Storm response</span>
                  <span className="angle-sel"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg> Selected</span>
                </div>
                <p className="angle-hook">"Did last night's storm hit your roof?"</p>
                <p className="angle-why">Nashville gets hail. Free inspection before the insurance call.</p>
              </div>
              <div className="angle-row">
                <div className="angle-row-top">
                  <span className="angle-pill">Don't delay</span>
                </div>
                <p className="angle-hook">"That ceiling stain is growing"</p>
                <p className="angle-why">Names the symptom people ignore, shows what it becomes.</p>
              </div>
              <div className="angle-row">
                <div className="angle-row-top">
                  <span className="angle-pill">Review-led</span>
                </div>
                <p className="angle-hook">"4.9 stars across 212 Nashville roofs"</p>
                <p className="angle-why">Your real rating doing the trust work.</p>
              </div>
              <p className="angle-mock-note">→ your pick drives the page and all 4 ads</p>
            </div>
          </div>
        </section>

        {/* WHAT WE PULL IN */}
        <section className="section pulls" id="pulls">
          <div className="wrap">
            <div className="section-head reveal">
              <p className="eyebrow">Built from your profile</p>
              <h2>Everything Google already knows about your business, working for you</h2>
              <p>Your profile is full of proof you've spent years earning. SendKPI pulls it onto one page designed to turn a click into a call.</p>
            </div>
            <div className="pull-grid">
              <div className="pull reveal">
                <span className="pull-icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" /></svg></span>
                <h3>Your real photos</h3>
                <p>The job-site and storefront photos already on your profile, not stock images that look like everyone else's ads.</p>
              </div>
              <div className="pull reveal">
                <span className="pull-icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1L12 2z" /></svg></span>
                <h3>Reviews that sell</h3>
                <p>Your rating, review count, and best quotes placed where a visitor decides whether to call: above the fold.</p>
              </div>
              <div className="pull reveal">
                <span className="pull-icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg></span>
                <h3>Live hours &amp; open-now</h3>
                <p>Your real hours, with an open/closed indicator, so after-hours clicks route to a callback form instead of a missed call.</p>
              </div>
              <div className="pull reveal">
                <span className="pull-icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></svg></span>
                <h3>Your services, listed</h3>
                <p>The services on your profile become scannable sections, so visitors instantly confirm you do the job they searched for.</p>
              </div>
              <div className="pull reveal">
                <span className="pull-icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.13.96.36 1.9.7 2.8a2 2 0 0 1-.45 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.45c.9.34 1.84.57 2.8.7a2 2 0 0 1 1.7 2.05Z" /></svg></span>
                <h3>Click-to-call everywhere</h3>
                <p>Your tracked number in the header, the hero, and a sticky mobile bar. Every scroll position is one tap from a call.</p>
              </div>
              <div className="pull reveal">
                <span className="pull-icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg></span>
                <h3>Name, address, phone: matched</h3>
                <p>Your NAP details mirror your listing exactly, keeping quality score happy and local SEO signals consistent.</p>
              </div>
            </div>
          </div>
        </section>

        {/* FROM SCROLL TO CALL */}
        <section className="section path-sec" id="path">
          <div className="wrap">
            <div className="section-head reveal">
              <p className="eyebrow">From scroll to call</p>
              <h2>The same promise at every step</h2>
              <p>The hook in the ad is the headline on the page, and the only button on the page is your phone number. No form maze, no "learn more." Each step exists to move a stranger one step closer to calling.</p>
            </div>
            <div className="path-grid">
              <div className="path-panel reveal">
                <div className="path-ad">
                  <div className="path-ad-head"><span className="path-ad-avatar" aria-hidden="true">M</span><span><b>Mike's Roofing</b><em>Sponsored</em></span></div>
                  <div className="path-ad-img">
                    <p>Did last night's storm hit your roof?</p>
                  </div>
                  <div className="path-ad-cta">Get Your Free Inspection</div>
                </div>
                <p className="path-cap"><b>1 · The ad stops the scroll.</b> Your angle on your real photo, in the feeds of homeowners nearby.</p>
              </div>
              <span className="path-arrow" aria-hidden="true">→</span>
              <div className="path-panel reveal">
                <div className="path-lander">
                  <p className="path-eyebrow">Nashville's highest-rated roofers</p>
                  <p className="path-h1">Did last night's storm hit your roof?</p>
                  <p className="path-stars"><span className="stars" aria-hidden="true">★★★★★</span> 4.9 · 212 reviews</p>
                  <div className="path-call">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.13.96.36 1.9.7 2.8a2 2 0 0 1-.45 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.45c.9.34 1.84.57 2.8.7a2 2 0 0 1 1.7 2.05Z" /></svg>
                    Call Now (615) 555-0119
                  </div>
                </div>
                <p className="path-cap"><b>2 · The page keeps the promise.</b> Same headline, your reviews above the fold, one thing to do.</p>
              </div>
              <span className="path-arrow" aria-hidden="true">→</span>
              <div className="path-panel reveal">
                <div className="path-phone">
                  <p className="path-phone-label">Incoming call</p>
                  <p className="path-phone-num">(615) 555-0119</p>
                  <p className="path-phone-src">via storm inspection page</p>
                  <div className="path-phone-btns">
                    <span className="decline" aria-hidden="true"></span>
                    <span className="accept" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.13.96.36 1.9.7 2.8a2 2 0 0 1-.45 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.45c.9.34 1.84.57 2.8.7a2 2 0 0 1 1.7 2.05Z" /></svg></span>
                  </div>
                </div>
                <p className="path-cap"><b>3 · The phone rings.</b> Inbound calls, the one metric that pays for everything else.</p>
              </div>
            </div>
          </div>
        </section>

        {/* EXAMPLES */}
        <section className="section examples" id="examples">
          <div className="wrap">
            <div className="section-head reveal">
              <p className="eyebrow">Examples</p>
              <h2>Pages that look like the business, not the builder</h2>
              <p>Because every campaign starts from a real profile and a chosen angle, no two come out alike. Here's the angle three very different trades would run.</p>
            </div>
            <div className="ex-grid">
              <article className="ex-card reveal">
                <div className="ex-thumb roof">
                  <span className="ex-name">Mike's Roofing</span>
                  <span className="ex-loc">Nashville, TN</span>
                </div>
                <div className="ex-body">
                  <div className="ex-stats"><span><span className="stars" aria-hidden="true">★</span> 4.9 · 212 reviews</span><span>42 photos</span></div>
                  <p>Angle: storm response. Free-inspection offer up top, insurance-ready photo report, before/after strip from the profile gallery.</p>
                  <button className="ex-link" type="button" onClick={() => setQuery("Mike's Roofing, Nashville TN")}>Build one like this →</button>
                </div>
              </article>
              <article className="ex-card reveal">
                <div className="ex-thumb dental">
                  <span className="ex-name">Sunrise Dental</span>
                  <span className="ex-loc">Phoenix, AZ</span>
                </div>
                <div className="ex-body">
                  <div className="ex-stats"><span><span className="stars" aria-hidden="true">★</span> 4.8 · 347 reviews</span><span>28 photos</span></div>
                  <p>Angle: review-led trust. New-patient offer up top, 347 reviews doing the convincing, same-day appointment CTA.</p>
                  <button className="ex-link" type="button" onClick={() => setQuery("Sunrise Dental, Phoenix AZ")}>Build one like this →</button>
                </div>
              </article>
              <article className="ex-card reveal">
                <div className="ex-thumb hvac">
                  <span className="ex-name">Pacific HVAC</span>
                  <span className="ex-loc">Seattle, WA</span>
                </div>
                <div className="ex-body">
                  <div className="ex-stats"><span><span className="stars" aria-hidden="true">★</span> 5.0 · 129 reviews</span><span>35 photos</span></div>
                  <p>Angle: don't delay. Short-cycling warning up top, emergency banner tied to open-now status, service-area map.</p>
                  <button className="ex-link" type="button" onClick={() => setQuery("Pacific HVAC, Seattle WA")}>Build one like this →</button>
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* AD TRAFFIC */}
        <section className="section ads" id="ads">
          <div className="wrap">
            <div>
              <div className="section-head reveal">
                <p className="eyebrow">Why it converts</p>
                <h2>Built to make the phone ring, not to win design awards</h2>
                <p>Sending paid traffic to your homepage burns budget: visitors wander, bounce, and never call. Every choice on a SendKPI page exists to turn the click into a call.</p>
              </div>
              <div className="ads-points reveal">
                <div className="ads-point">
                  <span className="ads-check" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg></span>
                  <span><b>One page, one goal.</b> No nav menu leaking visitors to your blog. Every element points at the call button.</span>
                </div>
                <div className="ads-point">
                  <span className="ads-check" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg></span>
                  <span><b>Message match, ad to page.</b> The promise in your ad is the headline the click lands on, so the visitor knows they're in the right place.</span>
                </div>
                <div className="ads-point">
                  <span className="ads-check" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg></span>
                  <span><b>Proof where the decision happens.</b> Your rating, review count, and a real customer quote sit above the fold, right where a stranger decides you're safe to call.</span>
                </div>
                <div className="ads-point">
                  <span className="ads-check" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg></span>
                  <span><b>Call-first, and fast.</b> Tap-to-call in the header, the hero, and a sticky mobile bar, in one lightweight HTML file that loads instantly on the phones your customers hold.</span>
                </div>
              </div>
            </div>
            <div className="code-card reveal" aria-label="Example of the HTML output">
              <div className="code-head">
                <span className="mock-dots"><i></i><i></i><i></i></span>
                mikes-roofing-nashville.html · 1 file · zero dependencies
              </div>
              <div className="code-body">
                <span className="cm">&lt;!-- Generated from Mike's Roofing, Nashville TN --&gt;</span><br />
                <span className="tag">&lt;section</span> <span className="attr">class</span>=<span className="val">"hero"</span><span className="tag">&gt;</span><br />
                &nbsp;&nbsp;<span className="tag">&lt;h1&gt;</span>Roof repair in Nashville<span className="tag">&lt;/h1&gt;</span><br />
                &nbsp;&nbsp;<span className="tag">&lt;a</span> <span className="attr">href</span>=<span className="val">"tel:+16155550119"</span> <span className="attr">class</span>=<span className="val">"call"</span><span className="tag">&gt;</span><br />
                &nbsp;&nbsp;&nbsp;&nbsp;Call (615) 555-0119<br />
                &nbsp;&nbsp;<span className="tag">&lt;/a&gt;</span><br />
                &nbsp;&nbsp;<span className="tag">&lt;div</span> <span className="attr">class</span>=<span className="val">"rating"</span><span className="tag">&gt;</span>★ 4.9 · 212 reviews<span className="tag">&lt;/div&gt;</span><br />
                <span className="tag">&lt;/section&gt;</span><br />
                <span className="cm">&lt;!-- hours, services &amp; photos from your profile… --&gt;</span>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="section" id="faq">
          <div className="wrap">
            <div className="section-head reveal">
              <p className="eyebrow">FAQ</p>
              <h2>Questions, answered</h2>
            </div>
            <div className="faq-list reveal">
              <details className="faq-item">
                <summary>What's an ad angle, and why do I pick one?</summary>
                <p>The angle is the message your whole campaign runs on: the hook in the ad and the headline on the page. We research the angles that already win in your trade, customize them with your reviews, city, and services, and you pick the one that sounds like your business. One voice from feed to phone call.</p>
              </details>
              <details className="faq-item">
                <summary>Do I have to write the ads?</summary>
                <p>No. You get four 1080×1080 ad graphics built on your real photos, each a different take on your chosen angle, with the feed's primary text already written. Download them and load them into Meta Ads Manager.</p>
              </details>
              <details className="faq-item">
                <summary>Where does the data come from?</summary>
                <p>Directly from your public Google Business Profile: the same name, phone, hours, photos, reviews, and services a customer sees when they find you on Google Maps or Search. If it's right on your listing, it's right on your page.</p>
              </details>
              <details className="faq-item">
                <summary>Do I need my own hosting or domain?</summary>
                <p>You download a single, self-contained HTML file, so it works anywhere: a subdomain like <em>offers.yourbusiness.com</em>, your existing host, or a free static host. If you can upload one file, you can deploy your lander.</p>
              </details>
              <details className="faq-item">
                <summary>Can I edit the page after it's built?</summary>
                <p>Yes. The output is clean, readable HTML. Swap a headline, change the tracking number, or add your analytics snippet with any text editor. There's no proprietary builder locking you in.</p>
              </details>
              <details className="faq-item">
                <summary>I run an agency. Can I build pages for clients?</summary>
                <p>That's one of the most common ways SendKPI is used. Search any client's listing, generate their lander, and deploy it on a subdomain you manage: one per client, campaign, or service area.</p>
              </details>
              <details className="faq-item">
                <summary>What if my profile is thin or out of date?</summary>
                <p>The page is only as good as the profile behind it, and that's a feature: fixing your listing improves your Google presence <em>and</em> your lander at the same time. We flag missing pieces (photos, services, hours) before you download.</p>
              </details>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="cta">
          <div className="wrap">
            <div className="cta-card reveal">
              <p className="eyebrow" style={{ color: "var(--orange)" }}>Ready when you are</p>
              <h2>Your next customer is searching right now</h2>
              <p>Find your listing, pick your winning angle, and walk away with a Call Now page and four matching ads before your coffee goes cold.</p>
              <a className="btn btn-primary" href="#top">Find my listing →</a>
              <p className="cta-note">No signup required to search · your data stays yours</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="wrap">
          <a className="logo" href="#top" style={{ fontSize: 16 }}>
            <LogoMark size={24} />
            SendKPI
          </a>
          <nav className="foot-links" aria-label="Footer">
            <a href="#how">How it works</a>
            <a href="#examples">Examples</a>
            <a href="#faq">FAQ</a>
            <a href="#">Contact</a>
          </nav>
          <p className="foot-note">© 2026 SendKPI. Not affiliated with Google.</p>
        </div>
      </footer>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import "./home.css";

const EXAMPLE_QUERIES = [
  "Mike's Roofing, Nashville TN",
  "Sunrise Dental, Phoenix AZ",
  "Pacific HVAC, Seattle WA",
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

/* Marketing homepage for the builder tool itself (distinct from the pages
   it generates). Scoped under .lb-home in home.css so its own color system
   doesn't leak into the candidates/preview/dashboard screens, which still
   use the app-shell theme in index.css. */
export default function Home({ query, setQuery, error, onSearch, onSignIn }) {
  const rootRef = useRef(null);
  const dropRef = useRef(null);
  const [industriesOpen, setIndustriesOpen] = useState(false);

  useEffect(() => {
    if (!industriesOpen) return;
    const onDown = e => { if (dropRef.current && !dropRef.current.contains(e.target)) setIndustriesOpen(false); };
    const onKey = e => { if (e.key === "Escape") setIndustriesOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [industriesOpen]);

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
            <span className="logo-mark" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 3 21 20H3L12 3Z" fill="#fff" /></svg>
            </span>
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
          <button className="btn btn-primary header-cta" type="button" onClick={onSignIn}>Sign In</button>
        </div>
      </header>

      <main>
        {/* HERO */}
        <section className="hero" id="top">
          <div className="wrap">
            <div className="hero-copy">
              <p className="eyebrow">Google Business Profile = Landing page + Ads</p>
              <h1>Your Google listing, rebuilt to make the <span className="ring">phone ring<svg viewBox="0 0 200 24" preserveAspectRatio="none" aria-hidden="true"><path d="M4 18 C 50 8, 150 8, 196 14" /></svg></span></h1>
              <p className="hero-sub">Search your Google Business Profile and SendKPI assembles a ready-to-deploy, call-conversion landing page from <strong>your real photos, hours, reviews, and services</strong> — no templates, no lorem ipsum.</p>

              <form className="finder" onSubmit={e => { e.preventDefault(); onSearch(e); }}>
                <div className="finder-box">
                  <svg className="pin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
                  <input
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Business name and city — e.g. Joe's Plumbing, Austin TX"
                    aria-label="Business name and city"
                  />
                  <button className="btn btn-primary" type="submit">Find my listing →</button>
                </div>
                <p className="finder-hint">One box — type the business name and city/state together, then hit Find.</p>
                <div className="chips" role="group" aria-label="Example searches">
                  {EXAMPLE_QUERIES.map(ex => (
                    <button key={ex} className="chip" type="button" onClick={() => setQuery(ex)}>{ex}</button>
                  ))}
                </div>
                {error && <p className="finder-hint" style={{ color: "var(--orange-deep)" }}>{error}</p>}
              </form>

              <p className="hero-proof"><span className="stars" aria-hidden="true">★★★★★</span> Built from the reviews and photos your customers already trust on Google.</p>
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
                  <p className="mock-h1">Roof repair in Nashville — fixed right, the first time</p>
                  <p className="mock-sub">Licensed &amp; insured · Free inspections · Serving Davidson County since 2009</p>
                  <button className="mock-call" type="button" aria-label="Example call button">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.13.96.36 1.9.7 2.8a2 2 0 0 1-.45 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.45c.9.34 1.84.57 2.8.7a2 2 0 0 1 1.7 2.05Z" /></svg>
                    Call (615) 555-0119
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
            <div className="strip-item"><b>One search</b><span>is all it takes to build your page</span></div>
            <div className="strip-item"><b>100% your data</b><span>real photos, hours, reviews, services</span></div>
            <div className="strip-item"><b>Single HTML file</b><span>clean output, no dependencies</span></div>
            <div className="strip-item"><b>Any subdomain</b><span>host it wherever your ads point</span></div>
          </div>
        </div>

        {/* HOW IT WORKS */}
        <section className="section" id="how">
          <div className="wrap">
            <div className="section-head reveal">
              <p className="eyebrow">How it works</p>
              <h2>From listing to live page in three steps</h2>
              <p>No page builder to learn, no blocks to drag. Your Google Business Profile already has everything a landing page needs — we just put it to work.</p>
            </div>
            <div className="steps">
              <div className="step reveal">
                <span className="step-art" aria-hidden="true"></span>
                <span className="step-num" aria-hidden="true"></span>
                <h3>Find your listing</h3>
                <p>Type your business name and city. We look up your real GBP data — name, phone, hours, photos, reviews, and services — straight from Google.</p>
              </div>
              <div className="step reveal">
                <span className="step-art" aria-hidden="true"></span>
                <span className="step-num" aria-hidden="true"></span>
                <h3>Your page is built for you</h3>
                <p>A call-conversion lander assembled from your actual profile: your best reviews up front, click-to-call everywhere, open-now status live on the page.</p>
              </div>
              <div className="step reveal">
                <span className="step-art" aria-hidden="true"></span>
                <span className="step-num" aria-hidden="true"></span>
                <h3>Download and deploy</h3>
                <p>Get clean, self-contained HTML you can host on any subdomain — ready to receive ad traffic the moment it's live.</p>
              </div>
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
                <p>The job-site and storefront photos already on your profile — not stock images that look like everyone else's ads.</p>
              </div>
              <div className="pull reveal">
                <span className="pull-icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1L12 2z" /></svg></span>
                <h3>Reviews that sell</h3>
                <p>Your rating, review count, and best quotes placed where a visitor decides whether to call — above the fold.</p>
              </div>
              <div className="pull reveal">
                <span className="pull-icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg></span>
                <h3>Live hours &amp; open-now</h3>
                <p>Your real hours, with an open/closed indicator — so after-hours clicks route to a callback form instead of a missed call.</p>
              </div>
              <div className="pull reveal">
                <span className="pull-icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></svg></span>
                <h3>Your services, listed</h3>
                <p>The services on your profile become scannable sections, so visitors instantly confirm you do the job they searched for.</p>
              </div>
              <div className="pull reveal">
                <span className="pull-icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.13.96.36 1.9.7 2.8a2 2 0 0 1-.45 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.45c.9.34 1.84.57 2.8.7a2 2 0 0 1 1.7 2.05Z" /></svg></span>
                <h3>Click-to-call everywhere</h3>
                <p>Your tracked number in the header, the hero, and a sticky mobile bar — every scroll position is one tap from a call.</p>
              </div>
              <div className="pull reveal">
                <span className="pull-icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg></span>
                <h3>Name, address, phone — matched</h3>
                <p>Your NAP details mirror your listing exactly, keeping quality score happy and local SEO signals consistent.</p>
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
              <p>Because every page is assembled from a real profile, no two landers look alike. Here's what comes out for three very different trades.</p>
            </div>
            <div className="ex-grid">
              <article className="ex-card reveal">
                <div className="ex-thumb roof">
                  <span className="ex-name">Mike's Roofing</span>
                  <span className="ex-loc">Nashville, TN</span>
                </div>
                <div className="ex-body">
                  <div className="ex-stats"><span><span className="stars" aria-hidden="true">★</span> 4.9 · 212 reviews</span><span>42 photos</span></div>
                  <p>Storm-damage focus, insurance-claim FAQ pulled from services, before/after photo strip from the profile gallery.</p>
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
                  <p>New-patient offer up top, same-day appointment CTA, patient reviews grouped by treatment type.</p>
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
                  <p>Emergency-service banner tied to open-now status, service-area map, financing details from the profile.</p>
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
                <p className="eyebrow">Made for ad traffic</p>
                <h2>The page your ad spend deserves</h2>
                <p>Sending Google Ads or Local Services traffic to a slow homepage burns budget. SendKPI pages are built to do one job: convert the click into a call.</p>
              </div>
              <div className="ads-points reveal">
                <div className="ads-point">
                  <span className="ads-check" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg></span>
                  <span><b>One page, one goal.</b> No nav menu leaking visitors to your blog — every element points at the call button.</span>
                </div>
                <div className="ads-point">
                  <span className="ads-check" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg></span>
                  <span><b>Fast by construction.</b> A single self-contained HTML file with no builder bloat — quick to load on the phones your customers search from.</span>
                </div>
                <div className="ads-point">
                  <span className="ads-check" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg></span>
                  <span><b>Yours to host.</b> Drop it on any subdomain you control — keep your tracking, your domain authority, your data.</span>
                </div>
                <div className="ads-point">
                  <span className="ads-check" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg></span>
                  <span><b>Agency-friendly.</b> Build a lander per client, per campaign, per city — in the time it used to take to open the page builder.</span>
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
                <summary>Where does the data come from?</summary>
                <p>Directly from your public Google Business Profile — the same name, phone, hours, photos, reviews, and services a customer sees when they find you on Google Maps or Search. If it's right on your listing, it's right on your page.</p>
              </details>
              <details className="faq-item">
                <summary>Do I need my own hosting or domain?</summary>
                <p>You download a single, self-contained HTML file, so it works anywhere — a subdomain like <em>offers.yourbusiness.com</em>, your existing host, or a free static host. If you can upload one file, you can deploy your lander.</p>
              </details>
              <details className="faq-item">
                <summary>Can I edit the page after it's built?</summary>
                <p>Yes. The output is clean, readable HTML — swap a headline, change the tracking number, or add your analytics snippet with any text editor. There's no proprietary builder locking you in.</p>
              </details>
              <details className="faq-item">
                <summary>I run an agency — can I build pages for clients?</summary>
                <p>That's one of the most common ways SendKPI is used. Search any client's listing, generate their lander, and deploy it on a subdomain you manage — one per client, campaign, or service area.</p>
              </details>
              <details className="faq-item">
                <summary>What if my profile is thin or out of date?</summary>
                <p>The page is only as good as the profile behind it — which is a feature: fixing your listing improves your Google presence <em>and</em> your lander at the same time. We flag missing pieces (photos, services, hours) before you download.</p>
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
              <p>Find your listing, and have a call-conversion page ready to deploy before your coffee goes cold.</p>
              <a className="btn btn-primary" href="#top">Find my listing →</a>
              <p className="cta-note">No signup required to search · your data stays yours</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="wrap">
          <a className="logo" href="#top" style={{ fontSize: 16 }}>
            <span className="logo-mark" style={{ width: 24, height: 24, borderRadius: 7 }} aria-hidden="true">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M12 3 21 20H3L12 3Z" fill="#fff" /></svg>
            </span>
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

import { useRef } from "react";
import "./home.css";
import { LogoMark } from "./Home";

/* /calls -- the landing page for the "Best Awareness" Meta ad (the account's
   proven lead-getter). Message match on purpose: same headline, same subhead,
   same "Google listing -> call page" visual as the ad, so the click lands on
   exactly what it promised. The search card IS the first listing card; it
   feeds the same funnel as the homepage (App.jsx renders this in place of
   Home when the path is /calls). Example businesses are the same fictional
   ones the ad shows. */

const EXAMPLES = [
  { initial: "H", tone: "#3D5468", name: "Harbor Plumbing", kind: "Plumber · Santa Cruz", rating: "4.9", reviews: 312,
    chip: "Water heaters", hook: "No hot water? Fixed today", sub: "Water heater replacement, same day", phone: "(831) 555-0142" },
  { initial: "C", tone: "#7E5A3C", name: "Comfort Air", kind: "HVAC · Sacramento", rating: "4.8", reviews: 204,
    chip: "AC repair", hook: "AC out? Cool again today", sub: "Emergency repairs across Sacramento", phone: "(916) 555-0177" },
  { initial: "B", tone: "#4A4E5C", name: "Bright Line Electric", kind: "Electrician · San Jose", rating: "4.9", reviews: 187,
    chip: "Panel upgrades", hook: "Breakers tripping every week?", sub: "Panel inspections booked this week", phone: "(408) 555-0193" },
];

const STEPS = [
  ["Find your Google Business listing", "Type your business name and city. We pull your reviews, photos and services."],
  ["Name the service you want more calls for", "Water heaters, AC repair, panel upgrades. One job, so the whole page sells it."],
  ["Get a page built to make your phone ring", "Plus matching Google and Meta ads that carry the same message. Free to download."],
];

const Arrow = () => (
  <span className="lc-arrow" aria-hidden="true">
    <svg viewBox="0 0 64 16"><path d="M2 8h52" strokeDasharray="7 6" /><path d="M50 2l8 6-8 6" /></svg>
  </span>
);

const Listing = ({ ex }) => (
  <div className="lc-listing">
    <div className="lc-biz">
      <span className="lc-ini" style={{ background: ex.tone }}>{ex.initial}</span>
      <div><b>{ex.name}</b><span>{ex.kind}</span></div>
    </div>
    <div className="lc-stars"><span>★★★★★</span> {ex.rating} · {ex.reviews} reviews</div>
    <div className="lc-open"><b>Open</b> · Closes 6 PM</div>
  </div>
);

const CallCard = ({ ex }) => (
  <div className="lc-call">
    <span className="lc-chip">{ex.chip}</span>
    <b className="lc-hook">{ex.hook}</b>
    <span className="lc-sub">{ex.sub}</span>
    <div className="lc-meta"><span><i>★★★★★</i> {ex.rating} · {ex.reviews} reviews</span><em>Open now</em></div>
    <span className="lc-btn">Call Now {ex.phone}</span>
  </div>
);

export default function CallsLanding({ query, setQuery, error, onSearch, onSignIn }) {
  const inputRef = useRef(null);
  const toSearch = e => {
    e.preventDefault();
    document.getElementById("top")?.scrollIntoView({ behavior: "smooth" });
    setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 450);
  };

  return (
    <div className="lb-home">
      <header className="site-header">
        <div className="wrap">
          <a className="logo" href="/calls"><LogoMark />SendKPI</a>
          <span className="lc-kick m-hide" style={{ marginLeft: "auto" }}>Optimize for calls</span>
          <button className="btn btn-primary header-cta" type="button" onClick={onSignIn}>Login</button>
        </div>
      </header>

      <main>
        <section className="hero lc-hero" id="top">
          <div className="wrap">
            <div className="lc-copy">
              <h1>Turn your Google listing into inbound calls</h1>
              <p className="lc-lede">We build the page and the ads. Your phone does the rest.</p>
            </div>

            {/* the ad's visual, live: your listing on the left, your call page on the right */}
            <div className="lc-row lc-row-hero">
              <form className="lc-listing lc-find" onSubmit={e => { e.preventDefault(); onSearch(e); }}>
                <div className="lc-biz">
                  <span className="lc-ini lc-ini-you"><i className="ti ti-map-pin" aria-hidden="true"></i></span>
                  <div><b>Your Google listing</b><span>Business name and city</span></div>
                </div>
                <div className="lc-input">
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="e.g. Harbor Plumbing Santa Cruz"
                    aria-label="Business name and city"
                  />
                </div>
                <button className="btn btn-primary lc-go" type="submit">Find my listing →</button>
                {error && <p className="lc-err">{error}</p>}
              </form>
              <Arrow />
              <div className="lc-call lc-call-you" aria-label="What we build">
                <span className="lc-chip">Your main service</span>
                <b className="lc-hook">Your hook, written from your reviews</b>
                <span className="lc-sub">Your city, your service area</span>
                <div className="lc-meta"><span><i>★★★★★</i> Your rating · your reviews</span><em>Open now</em></div>
                <span className="lc-btn">Call Now · your number</span>
              </div>
            </div>
            <p className="lc-free"><span><i className="ti ti-circle-check"></i>Free</span><span><i className="ti ti-circle-check"></i>About 60 seconds</span><span><i className="ti ti-circle-check"></i>No credit card</span></p>
          </div>
        </section>

        <section className="x-sec alt">
          <div className="wrap">
            <div className="x-head">
              <p className="eyebrow">Optimize for calls</p>
              <h2>Same listing. A page that rings your phone.</h2>
              <p>One service, one hook, one big call button. Here's what that looks like for three local businesses.</p>
            </div>
            <div className="lc-examples">
              {EXAMPLES.map(ex => (
                <div className="lc-row" key={ex.name}><Listing ex={ex} /><Arrow /><CallCard ex={ex} /></div>
              ))}
            </div>
            <p className="x-note">Example businesses for illustration.</p>
          </div>
        </section>

        <section className="x-sec">
          <div className="wrap">
            <div className="x-head">
              <p className="eyebrow">All in about 60 seconds</p>
              <h2>Three steps. Then your phone does the rest.</h2>
            </div>
            <ol className="lc-steps">
              {STEPS.map(([t, p], i) => (
                <li key={t}><span className="stepnum">{i + 1}</span><h3>{t}</h3><p>{p}</p></li>
              ))}
            </ol>
            <div className="lc-final">
              <a className="btn btn-primary" href="#top" onClick={toSearch}>Find my listing →</a>
              <span>All you need is a Google Business Profile to start.</span>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="wrap">
          <a className="logo" href="/calls" style={{ fontSize: 16 }}><LogoMark size={24} />SendKPI</a>
          <nav className="foot-links" aria-label="Footer">
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
            <a href="mailto:zkbmarketing@gmail.com">Contact</a>
          </nav>
          <p className="foot-note">© 2026 SendKPI. Not affiliated with Google.</p>
        </div>
      </footer>
    </div>
  );
}

import { useRef } from "react";
import "./home.css";

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

/* Generic kit creatives for the "What you get" section -- placeholder
   business + gradient "photos", so no real listing is ever shown. */
const LanderA = ({ className = "" }) => (
  <div className={`x-phone ${className}`}><span className="x-tag">Lander A</span><div className="notch"></div><div className="scr la">
    <div className="top"><span className="lg"></span><span className="nm">Your Business</span><span className="cl">Call now</span></div>
    <div className="bd">
      <div className="eb">Your city · Licensed &amp; insured</div>
      <h4>Same-day service from people who pick up.</h4>
      <p className="sb">Written from your reviews, your service area and the hook you picked.</p>
      <div className="cta"><i className="ti ti-phone"></i> Tap to call</div>
      <div className="st"><b>★★★★★</b> 4.9 · your Google reviews</div>
      <div className="x-photo"><i className="ti ti-tool"></i></div>
      <div className="tr"><span>Upfront pricing</span><span>7 days a week</span><span>Local crew</span></div>
    </div>
  </div></div>
);

const LanderB = ({ className = "" }) => (
  <div className={`x-phone ${className}`}><span className="x-tag b">Lander B</span><div className="notch"></div><div className="scr lb">
    <div className="x-photo p3"><i className="ti ti-truck"></i></div>
    <div className="card">
      <div className="lg">YB</div>
      <div className="nm">Your Business</div>
      <div className="rt"><b>★★★★★</b> 4.9 · Open now</div>
      <div className="acts"><span><i className="ti ti-phone"></i>Call</span><span><i className="ti ti-navigation"></i>Directions</span><span><i className="ti ti-message"></i>Message</span></div>
      <h4>Booked out? Not us. Call for same-day service.</h4>
      <p className="sb">Same offer as Lander A, different layout. Run both and keep the winner.</p>
      <div className="proof"><span>Your reviews</span><span>Your photos</span><span>Your hours</span></div>
    </div>
  </div></div>
);

const GAD1 = { hl: "Same-Day Service in Your City | Call Now", ds: "Real reviews from your neighbors. Upfront pricing, no surprises. Tap to call and talk to a real person." };
const GAD2 = { hl: "Booked Out Elsewhere? We Answer Today", ds: "Local, licensed and insured. Open 7 days. Call now for a same-day visit." };
const GoogleAd = ({ hl, ds, className = "" }) => (
  <div className={`x-gad ${className}`}>
    <div className="sp">Sponsored</div>
    <div className="who"><span className="fav">YB</span><div><b>Your Business</b><span>yourbusiness.com</span></div></div>
    <div className="hl">{hl}</div>
    <div className="ds">{ds}</div>
    <span className="call"><i className="ti ti-phone"></i> Call (555) 010-0100</span>
  </div>
);

const META_ADS = [
  { hook: "Booked out elsewhere? We answer today.", photo: "", icon: "ti-tool" },
  { hook: "Local crew. Upfront price.", photo: "p2", icon: "ti-home" },
  { hook: "Call now. Fixed today.", photo: "p3", icon: "ti-truck" },
  { hook: "5 stars from your neighbors.", photo: "p4", icon: "ti-users" },
];
const MetaAd = ({ hook, photo, icon }) => (
  <div className="x-mad"><div className={`x-photo ${photo}`}><i className={`ti ${icon}`}></i></div><div className="ov"><span className="hk">{hook}</span><span className="lm">Learn more</span></div></div>
);

/* Marketing homepage for the builder tool itself (distinct from the pages
   it generates). Scoped under .lb-home in home.css so its own color system
   doesn't leak into the candidates/preview/dashboard screens, which still
   use the app-shell theme in index.css.

   Layout: headline + sub, then Step 1 (the listing search) boxed as a card,
   then Steps 2-5 hanging below on a dotted rail, then "what you get" and
   the free launch-call pitch. Every CTA leads back to the search. */
export default function Home({ query, setQuery, error, onSearch, onSignIn }) {
  const inputRef = useRef(null);
  // "Build my kit" CTA lower on the page: back up to the search and focus it.
  const toSearch = e => {
    e.preventDefault();
    document.getElementById("top")?.scrollIntoView({ behavior: "smooth" });
    setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 450);
  };
  return (
    <div className="lb-home">
      <header className="site-header">
        <div className="wrap">
          <a className="logo" href="#top">
            <LogoMark />
            SendKPI
          </a>
          <button className="btn btn-primary header-cta" type="button" onClick={onSignIn} style={{ marginLeft: "auto" }}>Login</button>
        </div>
      </header>

      <main>
        <section className="hero" id="top">
          <div className="wrap">
            <div className="hero-copy">
              <h1>Turn Your Google Listing<br />Into More <span className="ring" style={{whiteSpace:'nowrap'}}>Inbound Calls<svg viewBox="0 0 200 24" preserveAspectRatio="none" aria-hidden="true"><path d="M4 18 C 50 8, 150 8, 196 14" /></svg></span></h1>
              <p className="hero-sub">In about a minute, we build <strong>two split-test landing pages plus Google &amp; Meta ads</strong> around the one service you want more calls for.<span className="m-hide"> Free to download.</span></p>

              {/* STEP 1: the search */}
              <form className="finder step1-card" onSubmit={e => { e.preventDefault(); onSearch(e); }}>
                <div className="step1-head">
                  <span className="stepnum" aria-hidden="true">1</span>
                  <h2>Find your Google Business listing<small>Type your business name and city. We pull your reviews, photos, hours and services.</small></h2>
                </div>
                <div className="finder-box">
                  <svg className="pin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
                  <input
                    ref={inputRef}
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

              {/* STEPS 2-5 -- mirrors the funnel: service, photos, hook, kit */}
              <p className="then-label" aria-hidden="true">then</p>
              <ol className="rail" aria-label="What happens after you search">
                <li className="rail-row">
                  <span className="stepnum ghost" aria-hidden="true">2</span>
                  <div><h3>Choose the service you want more calls for</h3><p>Pick one job, like roof repair, drain cleaning or AC install. Everything gets built around it.</p></div>
                  <div className="mv" aria-hidden="true"><div className="mv-q"><span className="chip">Main service</span><div className="field"></div></div></div>
                </li>
                <li className="rail-row">
                  <span className="stepnum ghost" aria-hidden="true">3</span>
                  <div><h3>Pick four photos from your listing</h3><p>Your real work and your real crew. They go on your pages and your ad graphics.</p></div>
                  <div className="mv" aria-hidden="true"><div className="mv-photos"><i></i><i></i><i></i><i></i></div></div>
                </li>
                <li className="rail-row">
                  <span className="stepnum ghost" aria-hidden="true">4</span>
                  <div><h3>Pick the hook that sounds like you</h3><p>AI reads your reviews and your local market, then pitches a few angles. You choose one.</p></div>
                  <div className="mv" aria-hidden="true"><div className="mv-angles"><i></i><i className="sel"></i><i></i></div></div>
                </li>
                <li className="rail-row last">
                  <span className="stepnum ghost" aria-hidden="true">5</span>
                  <div><h3>Download your campaign kit</h3><p>Two split-test landing pages, Google Search ads and Meta ad graphics with copy, all in one zip.</p></div>
                  <div className="mv" aria-hidden="true"><div className="mv-kit"><span className="ph"></span><span className="ph b"></span><span className="g"></span><span className="ads"><i></i><i></i><i></i><i></i></span></div></div>
                </li>
              </ol>
            </div>
          </div>
        </section>

        {/* WHAT YOU GET -- generic creatives, never a real business */}
        <section className="x-sec alt" id="kit">
          <div className="wrap">
            <div className="x-head">
              <p className="eyebrow">What you get</p>
              <h2>Everything you need to start getting calls</h2>
              <p>Built from your Google listing in about a minute. Yours to keep, free.</p>
            </div>
            <div className="xb-cards">
              <article className="xb-card">
                <div className="xb-vis" aria-hidden="true"><LanderA className="l" /><LanderB className="r" /></div>
                <div className="xb-body"><div className="xb-count">2</div><h3>Split-test landing pages</h3><p>Two layouts, one offer. Every scroll is a tap away from a call, so you can see which page turns clicks into rings.</p></div>
              </article>
              <article className="xb-card">
                <div className="xb-vis" aria-hidden="true"><GoogleAd {...GAD2} className="back" /><GoogleAd {...GAD1} className="front" /></div>
                <div className="xb-body"><div className="xb-count">2</div><h3>Google Search ad sets</h3><p>15 headlines and 4 descriptions per set, sized to Google's limits and ready to paste into Google Ads.</p></div>
              </article>
              <article className="xb-card">
                <div className="xb-vis" aria-hidden="true"><div className="mads">{META_ADS.map(a => <MetaAd key={a.hook} {...a} />)}</div></div>
                <div className="xb-body"><div className="xb-count">8</div><h3>Meta ad graphics + copy</h3><p>Square graphics made from your own photos, plus primary text and headlines for Facebook and Instagram.</p></div>
              </article>
            </div>
            <div className="xb-hook"><i className="ti ti-link" aria-hidden="true"></i><span><b>One hook, start to finish.</b> The angle you pick shows up in every ad and on both pages, so people land on exactly what they clicked.</span></div>
          </div>
        </section>

        {/* LAUNCH CALL -- the free implementation meeting booked from the thank-you page */}
        <section className="x-sec dark" id="launch">
          <div className="wrap xb-band">
            <div>
              <div className="x-head left" style={{ marginBottom: 0 }}>
                <p className="eyebrow">Then, launch it with a pro</p>
                <h2>Find the page and ad combo that makes your phone ring most</h2>
                <p>Book a free call with a professional marketer. Together we launch your landing page split test and your paid ads, then keep the combination that brings in the most calls.</p>
              </div>
              <ol className="xb-weeks">
                <li><span className="wk">Week 1</span><h3>Go live</h3><p>Both pages on your domain. Google &amp; Meta ads on. Call tracking in place.</p></li>
                <li><span className="wk">Weeks 2–4</span><h3>Let it run</h3><p>Traffic splits between Lander A and B on both channels. Every call is counted.</p></li>
                <li><span className="wk">Month 2</span><h3>Back the winner</h3><p>Budget moves to the page + ad combo that gets the most calls.</p></li>
              </ol>
              <a className="btn btn-primary" href="#top" onClick={toSearch}>Build my kit, then book →</a>
              <p className="sub">The booking calendar appears right after you download your kit.</p>
            </div>
            <aside className="xb-pro" aria-label="Your launch call">
              <div className="who"><span className="av">ZB</span><div><b>Zach, your marketer</b><span>12 years running ads for local businesses</span></div></div>
              <ul>
                <li><i className="ti ti-circle-check" aria-hidden="true"></i><span>Put both landing pages live on your site</span></li>
                <li><i className="ti ti-circle-check" aria-hidden="true"></i><span>Set up Google Search &amp; Meta ads from your kit</span></li>
                <li><i className="ti ti-circle-check" aria-hidden="true"></i><span>Track calls by page and by ad channel</span></li>
                <li><i className="ti ti-circle-check" aria-hidden="true"></i><span>Pick a budget that fits the jobs you want</span></li>
              </ul>
              <div className="slots" aria-hidden="true"><em>Free 20-minute launch call</em><span>Tue 10:00</span><span className="on">Tue 1:30</span><span>Wed 9:00</span><span>Thu 3:00</span></div>
            </aside>
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

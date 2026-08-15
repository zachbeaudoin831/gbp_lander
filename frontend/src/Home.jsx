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

/* Marketing homepage for the builder tool itself (distinct from the pages
   it generates). Scoped under .lb-home in home.css so its own color system
   doesn't leak into the candidates/preview/dashboard screens, which still
   use the app-shell theme in index.css.

   Layout: headline + sub, then Step 1 (the listing search) boxed as a card,
   then Steps 2-4 hanging below on a dotted rail. Nothing else -- the only
   thing to do on the page is search. */
export default function Home({ query, setQuery, error, onSearch, onSignIn }) {
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
              <p className="hero-sub">We build landing pages and ads around the main needle mover for local businesses: <strong>inbound calls</strong>.<span className="m-hide"> Start with your Google Business Listing below.</span></p>

              {/* STEP 1: the search */}
              <form className="finder step1-card" onSubmit={e => { e.preventDefault(); onSearch(e); }}>
                <div className="step1-head">
                  <span className="stepnum" aria-hidden="true">1</span>
                  <h2>Find your Google Business listing<small>Type your business name and city — we pull reviews, photos, hours and services.</small></h2>
                </div>
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

              {/* STEPS 2-4 */}
              <p className="then-label" aria-hidden="true">then</p>
              <ol className="rail" aria-label="What happens after you search">
                <li className="rail-row">
                  <span className="stepnum ghost" aria-hidden="true">2</span>
                  <div><h3>Choose the service you want more calls for</h3><p>Pick one job from your listing — roof repair, drain cleaning, AC install. We build everything around that one service.</p></div>
                  <div className="mv" aria-hidden="true"><div className="mv-angles"><i></i><i className="sel"></i><i></i></div></div>
                </li>
                <li className="rail-row">
                  <span className="stepnum ghost" aria-hidden="true">3</span>
                  <div><h3>Review your new website</h3><p>A one-page, call-first site written from your reviews and city. Every scroll is one tap from a call.</p></div>
                  <div className="mv" aria-hidden="true"><div className="mv-page"><div className="eb"></div><div className="h"></div><div className="h2"></div><div className="call"></div></div></div>
                </li>
                <li className="rail-row">
                  <span className="stepnum ghost" aria-hidden="true">4</span>
                  <div><h3>Review your new Meta &amp; Google Ads</h3><p>Search ads ready to paste, ad graphics ready to upload — all carrying the same message as the page.</p></div>
                  <div className="mv" aria-hidden="true"><div className="mv-ads"><i className="g"></i><i className="g"></i><i className="m"></i><i className="m"></i></div></div>
                </li>
              </ol>
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

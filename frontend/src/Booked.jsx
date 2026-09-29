import { useEffect } from "react";
import "./home.css";
import { LogoMark } from "./Home";
import { initPixel, trackSchedule } from "./metaPixel";

/* /booked -- where the GHL booking calendar redirects after someone books
   the free launch call. Confirms the booking, lists what to have ready so
   the call can actually launch things, and fires Meta's Schedule event.
   GHL can append contact fields to the redirect URL; if a first name comes
   through (?first_name= or ?name=) we greet them by it. */

const PREP = [
  ["ti-folder-down", "Your campaign kit", "The landing pages and ads you downloaded. Lost it? The link is in your kit email."],
  ["ti-world", "Where your website lives", "Your domain or website login (GoDaddy, Wix, Squarespace…) so we can put both pages live."],
  ["ti-brand-meta", "Your Facebook business page", "Admin access to your page, or your Meta Ads account if you have one."],
  ["ti-brand-google", "Your Google Ads login", "If you have one. No account yet? We'll set it up together."],
  ["ti-coin", "A test budget in mind", "What you'd be comfortable spending on ads for the first month. We'll help you size it."],
];

const AGENDA = [
  "Put both landing pages live on your site",
  "Set up Google Search & Meta ads from your kit",
  "Track calls by page and by ad channel",
  "Pick a budget that fits the jobs you want",
];

export default function Booked() {
  const qs = new URLSearchParams(window.location.search);
  const raw = (qs.get("first_name") || qs.get("name") || "").trim().split(/\s+/)[0];
  const first = raw && raw.length <= 30 ? raw.charAt(0).toUpperCase() + raw.slice(1) : "";

  useEffect(() => {
    document.title = "You're booked · SendKPI";
    initPixel();
    trackSchedule();
  }, []);

  return (
    <div className="lb-home">
      <header className="site-header">
        <div className="wrap">
          <a className="logo" href="/"><LogoMark />SendKPI</a>
        </div>
      </header>

      <main>
        <section className="hero bk-hero">
          <div className="wrap">
            <div className="hero-copy">
              <span className="bk-check" aria-hidden="true"><i className="ti ti-check"></i></span>
              <h1>{first ? `You're booked, ${first}!` : "You're booked!"}</h1>
              <p className="hero-sub">A calendar invite and confirmation are on the way to your email. On the call we'll launch your landing pages and ads together, so the phone can start telling us what works.</p>
            </div>
          </div>
        </section>

        <section className="x-sec alt">
          <div className="wrap bk-grid">
            <div>
              <div className="x-head left" style={{ marginBottom: 24 }}>
                <p className="eyebrow">Before the call</p>
                <h2>Have these handy and we can launch on the call</h2>
                <p>Nothing here is required. The more you have, the more we get live in 20 minutes.</p>
              </div>
              <ol className="bk-prep">
                {PREP.map(([icon, title, body]) => (
                  <li key={title}>
                    <span className="ic" aria-hidden="true"><i className={`ti ${icon}`}></i></span>
                    <div><h3>{title}</h3><p>{body}</p></div>
                  </li>
                ))}
              </ol>
            </div>

            <aside className="xb-pro bk-pro" aria-label="Your launch call">
              <div className="who"><span className="av">ZB</span><div><b>Zach, your marketer</b><span>12 years running ads for local businesses</span></div></div>
              <p className="bk-lbl">What we'll do together</p>
              <ul>
                {AGENDA.map(t => <li key={t}><i className="ti ti-circle-check" aria-hidden="true"></i><span>{t}</span></li>)}
              </ul>
              <p className="bk-note"><i className="ti ti-calendar-event" aria-hidden="true"></i> Need a different time? Use the reschedule link in your confirmation email.</p>
            </aside>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="wrap">
          <a className="logo" href="/" style={{ fontSize: 16 }}><LogoMark size={24} />SendKPI</a>
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

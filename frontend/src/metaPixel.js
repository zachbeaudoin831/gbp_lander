/* Meta Pixel + Conversions API wiring for sendkpi.com's own ad campaigns
   (tracking business owners who sign up), not the downstream leads a
   client's *own* published lander collects for their customers -- that's
   a separate, unrelated flow (the "ask a question" modal -> /api/lead).

   PIXEL_ID: paste the Pixel ID from Meta Events Manager once it exists.
   Until then initPixel()/trackSignup() are no-ops, same pattern as
   VSL_EMBED_URL/BOOKING_URL in App.jsx. */
const PIXEL_ID = "";

// Same backend the rest of the app talks to (API_BASE in App.jsx).
const API_BASE = "https://gbp-lander.vercel.app";

function cookie(name) {
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

// Meta's own base pixel snippet, injected only when a Pixel ID is set.
export function initPixel() {
  if (!PIXEL_ID || window.fbq) return;
  const f = window;
  f.fbq = function () { (f.fbq.callMethod ? f.fbq.callMethod.apply(f.fbq, arguments) : f.fbq.queue.push(arguments)); };
  f.fbq.queue = [];
  f.fbq.loaded = true;
  f.fbq.version = '2.0';
  f._fbq = f.fbq;
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://connect.facebook.net/en_US/fbevents.js';
  document.head.appendChild(s);
  window.fbq('init', PIXEL_ID);
  window.fbq('track', 'PageView');
}

// Fired once, right when a new business owner finishes Google sign-in and
// their first lander is saved -- the real "this ad worked" moment. Fires
// the browser pixel and the server-side Conversions API call with the same
// event_id so Meta dedupes them instead of double counting. Best-effort:
// swallows all errors, since analytics must never block or break signup.
export function trackSignup({ email, phone } = {}) {
  if (!PIXEL_ID) return;
  const eventId = (crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`);
  try {
    window.fbq?.('track', 'Lead', {}, { eventID: eventId });
  } catch { /* pixel not loaded -- server-side call below still fires */ }

  fetch(`${API_BASE}/api/meta-event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event_name: 'Lead',
      event_id: eventId,
      event_source_url: window.location.href,
      email: email || null,
      phone: phone || null,
      fbc: cookie('_fbc'),
      fbp: cookie('_fbp'),
    }),
  }).catch(() => { /* best-effort */ });
}

import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabaseClient";
import Home from "./Home";

/* ─── html helpers ─────────────────────────────────────────────────── */
const esc = s => s == null ? '' : String(s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  .replace(/"/g,'&quot;').replace(/'/g,'&#39;');

const starsStr = n => { const f=Math.max(0,Math.min(5,Math.round(n||0))); return '★'.repeat(f)+'☆'.repeat(5-f); };
const todayName = () => ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()];

// supabase-js throws AuthRetryableFetchError for 5xx responses without
// parsing the server's real message -- its .message ends up as the literal
// string "{}", which is useless to show a user. Fall back to a generic
// message for those (and any other non-useful message) instead.
const friendlyAuthError = (err, fallback) => {
  const msg = err?.message;
  if (!msg || msg === '{}' || err?.status >= 500) {
    return 'Something went wrong on our end sending that. Please try again in a moment.';
  }
  return msg || fallback;
};

// Picks readable text (near-black or white) against a given background hex --
// needed because the button's background color is now the client's own
// brand color, which isn't always dark enough for white text.
const contrastInk = hex => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex||'');
  if (!m) return '#fff';
  const n = parseInt(m[1], 16);
  const r = (n>>16)&255, g = (n>>8)&255, b = n&255;
  const luminance = (0.299*r + 0.587*g + 0.114*b) / 255;
  return luminance > 0.6 ? '#181D24' : '#fff';
};

/* ─── lander HTML generator (mirrors lander.html template exactly) ─── */
function buildLanderHTML(d) {
  const phone = d.phone_national || d.phone_international || '';
  const href  = d.phone_international
    ? `tel:${d.phone_international.replace(/[^\d+]/g,'')}`
    : phone ? `tel:${phone.replace(/[^0-9+]/g,'')}` : null;
  const city  = (d.address||'').split(',')[1]?.trim()||'';
  const first = (d.name||'Us').split(' ')[0];
  const today = todayName();

  const ticket = () => href ? `
<div class="ticket">
  <div class="ticket-row"><span class="ticket-label">Tap to call</span>${d.open_now!=null?`<span class="status-line"><span class="status-dot${d.open_now?'':' closed'}"></span>${d.open_now?'Open now':'Closed now'}</span>`:''}</div>
  <a class="ticket-cta" href="${href}">${esc(phone)}</a>
  <div class="ticket-row ticket-row-ask"><span class="ticket-label">Tap to ask question</span></div>
  <button type="button" class="ticket-cta ticket-cta-secondary js-ask-open">Send question</button>
</div>` : '';

  // Multi-step "ask a question" modal, embedded as self-contained markup +
  // vanilla JS so it works in the standalone downloaded lander too. On
  // submit it POSTs the lead to the backend; the endpoint is a stub for now
  // (fails silently and still confirms), so this is forward-compatible with
  // the CRM lead store once that lands.
  const askModal = `
<div class="askm" id="askm" hidden>
  <div class="askm-backdrop" data-askm-close></div>
  <div class="askm-card" role="dialog" aria-modal="true" aria-labelledby="askm-title">
    <button class="askm-x" type="button" data-askm-close aria-label="Close">&times;</button>
    <div class="askm-step" data-step="1">
      <h3 class="askm-title" id="askm-title">Ask ${esc(first)} a question</h3>
      <p class="askm-sub">Tell us how to reach you and we'll get right back to you.</p>
      <button class="askm-btn askm-btn-primary" type="button" data-askm-next>Continue</button>
    </div>
    <div class="askm-step" data-step="2" hidden>
      <h3 class="askm-title">Call or text back?</h3>
      <p class="askm-sub">During business hours.</p>
      <div class="askm-choices">
        <button class="askm-btn askm-choice" type="button" data-pref="call">Call back</button>
        <button class="askm-btn askm-choice" type="button" data-pref="text">Text back</button>
      </div>
    </div>
    <div class="askm-step" data-step="3" hidden>
      <h3 class="askm-title">Where should we reach you?</h3>
      <form class="askm-form" data-askm-form novalidate>
        <input class="askm-input" name="name" placeholder="Your name" autocomplete="name" required>
        <input class="askm-input" name="phone" type="tel" placeholder="Phone number" autocomplete="tel" required>
        <p class="askm-consent">By submitting, you agree to be contacted by ${esc(d.name||'this business')} about your inquiry. Message/data rates may apply.</p>
        <button class="askm-btn askm-btn-primary" type="submit">Send</button>
      </form>
    </div>
    <div class="askm-step" data-step="4" hidden>
      <h3 class="askm-title">Got it!</h3>
      <p class="askm-sub">${esc(first)} will reach out to you shortly.</p>
      <button class="askm-btn askm-btn-primary" type="button" data-askm-close>Done</button>
    </div>
  </div>
</div>
<script>
(function(){
  var modal=document.getElementById('askm'); if(!modal) return;
  var LEAD_ENDPOINT=${JSON.stringify('https://gbp-lander.vercel.app/api/lead')};
  var lead={business:${JSON.stringify(d.name||'')},pref:null};
  function show(n){var s=modal.querySelectorAll('.askm-step');for(var i=0;i<s.length;i++){s[i].hidden=s[i].getAttribute('data-step')!==String(n);}}
  function openM(){modal.hidden=false;document.body.style.overflow='hidden';show(1);}
  function closeM(){modal.hidden=true;document.body.style.overflow='';}
  var t=document.querySelectorAll('.js-ask-open');for(var i=0;i<t.length;i++){t[i].addEventListener('click',function(e){e.preventDefault();openM();});}
  var c=modal.querySelectorAll('[data-askm-close]');for(var j=0;j<c.length;j++){c[j].addEventListener('click',closeM);}
  var nx=modal.querySelectorAll('[data-askm-next]');for(var k=0;k<nx.length;k++){nx[k].addEventListener('click',function(){show(2);});}
  var pf=modal.querySelectorAll('[data-pref]');for(var m=0;m<pf.length;m++){pf[m].addEventListener('click',function(){lead.pref=this.getAttribute('data-pref');show(3);});}
  var form=modal.querySelector('[data-askm-form]');
  form.addEventListener('submit',function(e){e.preventDefault();
    var nm=form.querySelector('input[name="name"]').value.trim();
    var ph=form.querySelector('input[name="phone"]').value.trim();
    if(!nm||!ph){return;}
    lead.name=nm;lead.phone=ph;
    var qs=new URLSearchParams(location.search);
    var payload=Object.assign({},lead,{url:location.href,ts:new Date().toISOString(),fbclid:qs.get('fbclid'),gclid:qs.get('gclid')});
    try{if(LEAD_ENDPOINT){fetch(LEAD_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}).catch(function(){});}}catch(err){}
    show(4);
  });
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!modal.hidden){closeM();}});
})();
</script>`;

  const CSS = `:root{--ink:#181D24;--paper:#EFF2EE;--signal:${d.brand_color||'#FF5A1F'};--signal-ink:${contrastInk(d.brand_color)};--slate:#5B6B79;--success:#1F8A5F;--line:#D8DCD9;--card:#fff;--radius:14px;--display:'Space Grotesk',system-ui,sans-serif;--body:'Inter',system-ui,sans-serif;--mono:'IBM Plex Mono',ui-monospace,monospace}*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}body{margin:0;font-family:var(--body);color:var(--ink);background:var(--paper);line-height:1.5}a{color:inherit}img{max-width:100%;display:block}.wrap{max-width:720px;margin:0 auto;padding:0 20px}.topbar{position:sticky;top:0;z-index:30;background:var(--ink);color:#fff;border-bottom:1px solid rgba(255,255,255,.08)}.topbar-inner{max-width:720px;margin:0 auto;padding:10px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px}.topbar-name{font-family:var(--display);font-weight:700;font-size:15px;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.topbar-rating{font-family:var(--mono);font-size:12px;color:#C7CDD2;white-space:nowrap}.topbar-call{flex-shrink:0;background:var(--signal);color:var(--signal-ink);font-family:var(--mono);font-weight:600;font-size:12px;padding:8px 14px;border-radius:999px;text-decoration:none;white-space:nowrap}.hero{position:relative;min-height:420px;display:flex;align-items:flex-end;color:#fff;background:var(--ink)}.hero-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.45}.hero-scrim{position:absolute;inset:0;background:linear-gradient(180deg,rgba(24,29,36,.35) 0%,rgba(24,29,36,.65) 55%,rgba(24,29,36,.95) 100%)}.hero-content{position:relative;width:100%;padding:48px 20px;max-width:720px;margin:0 auto}.hero-eyebrow{font-family:var(--mono);font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#C7CDD2;margin:0 0 10px}.hero-name{font-family:var(--display);font-weight:700;font-size:clamp(28px,7vw,42px);line-height:1.05;letter-spacing:-.01em;margin:0 0 6px}.hero-tagline{font-size:15px;color:#DCE0E2;max-width:46ch;margin:0 0 22px}.offer-block{margin:4px 0 22px}.offer-headline{font-family:var(--display);font-weight:700;font-size:clamp(20px,4.5vw,26px);color:#fff;margin:0 0 6px;line-height:1.2}.offer-subhead{font-size:14px;color:#DCE0E2;margin:0 0 8px;max-width:46ch}.offer-guarantee{font-family:var(--mono);font-size:12px;color:#8FE3B8;margin:0}.about-text{font-size:15px;line-height:1.65;color:var(--ink);margin:0}.ticket{background:var(--card);color:var(--ink);border:2px dashed rgba(24,29,36,.35);border-radius:var(--radius);padding:18px 20px;margin-top:48px}.ticket-row{display:flex;align-items:center;justify-content:space-between;gap:10px}.ticket-label{font-family:var(--mono);font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--slate)}.ticket-cta{display:inline-flex;align-items:center;gap:8px;margin-top:10px;width:100%;justify-content:center;background:var(--signal);color:var(--signal-ink);font-family:var(--mono);font-weight:700;font-size:clamp(20px,5.5vw,26px);letter-spacing:-.01em;padding:14px 16px;border-radius:8px;text-decoration:none}.ticket-row-ask{margin-top:16px}.ticket-cta.ticket-cta-secondary{background:transparent;color:var(--ink);border:2px solid var(--signal);font-size:15px;font-weight:600;letter-spacing:.03em;text-transform:uppercase;margin-top:8px}.status-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--success);margin-right:6px}.status-dot.closed{background:#9AA3A8}.status-line{font-family:var(--mono);font-size:12px;color:var(--slate);white-space:nowrap}section{padding:32px 0;border-bottom:1px solid var(--line)}.wrap>section:last-of-type{border-bottom:none}.eyebrow{font-family:var(--mono);font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--slate);margin:0 0 14px}.chips{display:flex;flex-wrap:wrap;gap:8px}.chip{font-family:var(--body);font-weight:500;font-size:13px;background:var(--card);border:1px solid var(--line);border-radius:999px;padding:8px 14px}.filmstrip{display:flex;gap:10px;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:4px;margin:0 -20px;padding-left:20px;padding-right:20px}.filmstrip img{flex:0 0 auto;width:62vw;max-width:260px;height:180px;object-fit:cover;border-radius:10px;scroll-snap-align:start;background:var(--card)}.review-summary{font-family:var(--mono);font-size:14px;margin:0 0 16px}.review-summary b{font-size:16px}.review-summary .muted{color:var(--slate);font-weight:400}.review-list{display:flex;flex-direction:column;gap:12px;margin-bottom:14px}.review-card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px 16px}.review-card-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px}.review-author{font-weight:600;font-size:13px}.review-stars{font-family:var(--mono);font-size:12px;color:var(--signal);letter-spacing:1px}.review-text{font-size:14px;color:var(--ink);margin:0 0 6px;line-height:1.5}.review-time{font-family:var(--mono);font-size:11px;color:var(--slate);margin:0}.review-google-link{display:inline-block;font-family:var(--mono);font-size:12px;color:var(--slate);text-decoration:underline;text-decoration-color:var(--line)}.hours-table{width:100%;border-collapse:collapse;font-size:14px}.hours-table td{padding:8px 0;border-bottom:1px solid var(--line)}.hours-table td:last-child{text-align:right;font-family:var(--mono);font-size:13px;color:var(--slate)}.hours-table tr.today td{color:var(--ink);font-weight:600}.hours-table tr.today td:first-child::after{content:" · today";font-weight:400;font-family:var(--mono);font-size:11px;color:var(--signal)}.addr{font-size:14px;color:var(--slate)}.addr a{color:var(--ink);text-decoration:underline;text-decoration-color:var(--line)}footer{padding:24px 0 32px}footer .fine{font-size:12px;color:var(--slate)}.cta-band{background:var(--ink);color:#fff;padding:40px 0 44px;text-align:center}.cta-band-heading{font-family:var(--display);font-weight:700;font-size:clamp(22px,5.5vw,30px);letter-spacing:-.01em;margin:0 0 20px}.cta-band .ticket{margin:0 auto;text-align:left}.callbar{position:fixed;left:0;right:0;bottom:0;z-index:40;background:var(--ink);border-top:2px dashed rgba(255,255,255,.25);padding:12px 16px calc(12px + env(safe-area-inset-bottom))}.callbar a{display:flex;align-items:center;justify-content:center;gap:10px;background:var(--signal);color:var(--signal-ink);font-family:var(--mono);font-weight:600;font-size:15px;padding:14px;border-radius:10px;text-decoration:none}@media(min-width:760px){.hero{min-height:480px}.offer-headline{max-width:20ch}}.askm{position:fixed;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;padding:20px}.askm[hidden]{display:none}.askm-backdrop{position:absolute;inset:0;background:rgba(24,29,36,.6)}.askm-card{position:relative;background:var(--card);color:var(--ink);border-radius:var(--radius);max-width:380px;width:100%;padding:28px 24px;box-shadow:0 20px 60px rgba(0,0,0,.35)}.askm-x{position:absolute;top:10px;right:14px;background:none;border:0;font-size:26px;line-height:1;color:var(--slate);cursor:pointer}.askm-title{font-family:var(--display);font-weight:700;font-size:20px;letter-spacing:-.01em;margin:0 0 8px}.askm-sub{font-size:14px;color:var(--slate);margin:0 0 20px}.askm-btn{display:inline-flex;align-items:center;justify-content:center;width:100%;font-family:var(--mono);font-weight:600;font-size:15px;letter-spacing:.03em;text-transform:uppercase;padding:14px 16px;border-radius:8px;border:0;cursor:pointer}.askm-btn-primary{background:var(--signal);color:var(--signal-ink)}.askm-choices{display:flex;flex-direction:column;gap:10px}.askm-choice{background:transparent;color:var(--ink);border:2px solid var(--signal)}.askm-form{display:flex;flex-direction:column;gap:12px}.askm-input{width:100%;font-family:var(--body);font-size:16px;padding:12px 14px;border:1px solid var(--line);border-radius:8px;background:#fff;color:var(--ink)}.askm-input:focus{outline:2px solid var(--signal);outline-offset:1px;border-color:var(--signal)}.askm-consent{font-size:11px;color:var(--slate);line-height:1.4;margin:0}`;

  const hoursRows = (d.hours||[]).map(line => {
    const ci = line.indexOf(':');
    const day  = ci > -1 ? line.slice(0,ci).trim() : line;
    const time = ci > -1 ? line.slice(ci+1).trim() : '';
    return `<tr class="${day===today?'today':''}"><td>${esc(day)}</td><td>${esc(time)}</td></tr>`;
  }).join('');

  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${esc(d.name)}${d.category?` — ${esc(d.category)}`:''}</title>
${d.tagline?`<meta name="description" content="${esc(d.tagline)}">`:``}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap" rel="stylesheet">
<style>${CSS}</style></head><body>

<div class="topbar"><div class="topbar-inner">
  <span class="topbar-name">${esc(d.name)}</span>
  ${d.rating?`<span class="topbar-rating">★ ${Number(d.rating).toFixed(1)} (${d.review_count||0})</span>`:''}
  ${href?`<a class="topbar-call" href="${href}">Call now</a>`:''}
</div></div>

<header class="hero">
  ${(d.photos||[])[0]?`<img class="hero-img" src="${esc(d.photos[0])}" alt="${esc(d.name)}" onerror="this.style.display='none'">`:''}
  <div class="hero-scrim"></div>
  <div class="hero-content">
    ${d.category?`<p class="hero-eyebrow">${esc(d.category)}${city?` · ${esc(city)}`:''}</p>`:''}
    <h1 class="hero-name">${esc(d.name)}</h1>
    ${d.tagline?`<p class="hero-tagline">${esc(d.tagline)}</p>`:''}
    ${d.offer_headline?`<div class="offer-block"><p class="offer-headline">${esc(d.offer_headline)}</p>${d.offer_subhead?`<p class="offer-subhead">${esc(d.offer_subhead)}</p>`:''}${d.offer_guarantee?`<p class="offer-guarantee">✓ ${esc(d.offer_guarantee)}</p>`:''}</div>`:''}
    ${phone?ticket():''}
  </div>
</header>

<div class="wrap">

${(d.photos||[]).length>1?`<section><p class="eyebrow">Photos</p><div class="filmstrip">${(d.photos||[]).map((p,i)=>`<img src="${esc(p)}" alt="${esc(d.name)} photo ${i+1}" loading="lazy" onerror="this.style.display='none'">`).join('')}</div></section>`:''}

${((d.reviews||[]).length||d.rating)?`<section><p class="eyebrow">Reviews</p>${d.rating?`<p class="review-summary"><b>★ ${Number(d.rating).toFixed(1)}</b> <span class="muted">(${d.review_count||0} reviews on Google)</span></p>`:''}<div class="review-list">${(d.reviews||[]).map(r=>`<div class="review-card"><div class="review-card-head"><span class="review-author">${esc(r.author)}</span>${r.rating!=null?`<span class="review-stars">${starsStr(r.rating)}</span>`:''}</div><p class="review-text">"${esc(r.text)}"</p>${r.relative_time?`<p class="review-time">${esc(r.relative_time)}</p>`:''}</div>`).join('')}</div>${d.maps_url?`<a class="review-google-link" href="${esc(d.maps_url)}" target="_blank" rel="noopener">See all reviews on Google →</a>`:''}</section>`:'' }

${(d.about_summary||d.site_summary)?`<section><p class="eyebrow">About ${esc(first)}</p><p class="about-text">${esc(d.about_summary||d.site_summary)}</p></section>`:''}

${(d.services||[]).length?`<section><p class="eyebrow">Services</p><div class="chips">${(d.services||[]).map(s=>`<span class="chip">${esc(s)}</span>`).join('')}</div></section>`:''}

${hoursRows?`<section><p class="eyebrow">Hours</p><table class="hours-table">${hoursRows}</table></section>`:''}

${(d.service_areas||[]).length?`<section><p class="eyebrow">Areas we service</p><div class="chips">${(d.service_areas||[]).map(a=>`<span class="chip">${esc(a)}</span>`).join('')}</div></section>`:''}

</div>

${phone?`<section class="cta-band"><div class="wrap"><h2 class="cta-band-heading">${esc(d.name)} is ready to help</h2>${ticket()}</div></section>`:''}

<div class="wrap">
  ${d.address?`<section><p class="eyebrow">Location</p><p class="addr">${esc(d.address)}${d.maps_url?` · <a href="${esc(d.maps_url)}" target="_blank" rel="noopener">Get directions</a>`:''}</p></section>`:''}
  <footer><p class="fine">Information sourced from this business's Google Business Profile${d.website?` and <a href="${esc(d.website)}" target="_blank" rel="noopener">website</a>`:''}</p></footer>
</div>

${phone?askModal:''}

</body></html>`;
}

/* ─── backend API ───────────────────────────────────────────────────
   Talks to the FastAPI service in /server, which holds the Google
   Places API key server-side. Replace this with your actual Render
   URL once deployed -- it will look like:
   https://gbp-lander-backend.onrender.com
   Render's free tier spins down after 15 min idle, so the first
   request after a quiet period can take 30-60s to wake back up --
   that's expected, not a bug. */
const API_BASE = "https://gbp-lander.vercel.app";

async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed (${res.status})`);
  }
  return res.json();
}

async function apiPost(path, payload) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed (${res.status})`);
  }
  return res.json();
}

async function findCandidates(query) {
  return apiGet(`/api/search?q=${encodeURIComponent(query)}`);
}

async function getProfile(placeId) {
  return apiGet(`/api/profile?place_id=${encodeURIComponent(placeId)}`);
}

async function generateOffer(payload) {
  return apiPost('/api/generate-offer', payload);
}

async function generateAdCopy(payload) {
  return apiPost('/api/generate-ad-copy', payload);
}

/* ─── app styles (injected once) ────────────────────────────────────── */
const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap');
*{box-sizing:border-box}
body{margin:0;padding:0;font-family:'Inter',system-ui,sans-serif}
.lb-input{width:100%;height:48px;border:1.5px solid rgba(255,90,31,.45);border-radius:8px;padding:0 14px;font-size:15px;font-family:inherit;background:var(--surface-2);color:var(--text-primary);outline:none;transition:border-color .15s,box-shadow .15s;box-shadow:0 0 0 3px rgba(255,90,31,.10)}
.lb-input:focus{border-color:#FF5A1F;box-shadow:0 0 0 3px rgba(255,90,31,.22)}
.lb-input::placeholder{color:var(--text-muted)}
.lb-btn-signal{background:#FF5A1F;color:#fff;border:none;border-radius:8px;padding:0 20px;height:48px;font-size:14px;font-weight:600;font-family:'IBM Plex Mono',monospace;letter-spacing:.02em;cursor:pointer;white-space:nowrap;transition:opacity .15s;flex-shrink:0}
.lb-btn-signal:hover{opacity:.88}
.lb-btn-signal:disabled{opacity:.5;cursor:not-allowed}
.lb-btn-ghost{background:transparent;border:1px solid var(--border);border-radius:7px;padding:7px 14px;font-size:12px;color:var(--text-secondary);font-family:'IBM Plex Mono',monospace;letter-spacing:.02em;cursor:pointer;white-space:nowrap;transition:all .15s}
.lb-btn-ghost:hover{background:var(--surface-1);color:var(--text-primary)}
.lb-btn-ghost.active{background:#FF5A1F;color:#fff;border-color:#FF5A1F}
.lb-btn-dark{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.12);border-radius:7px;padding:7px 14px;font-size:12px;color:#C7CDD2;font-family:'IBM Plex Mono',monospace;letter-spacing:.02em;cursor:pointer;white-space:nowrap;transition:all .15s}
.lb-btn-dark:hover{background:rgba(255,255,255,.18);color:#fff}
.lb-pill{cursor:pointer;background:var(--surface-2);border:1px solid var(--border);border-radius:999px;padding:6px 14px;font-size:13px;color:var(--text-secondary);transition:all .15s;font-family:inherit}
.lb-pill:hover{border-color:#FF5A1F;color:#FF5A1F;background:#FFF8F5}
.lb-card{background:var(--surface-2);border:0.5px solid var(--border);border-radius:12px;padding:16px 18px;display:flex;align-items:center;justify-content:space-between;gap:16px;cursor:pointer;transition:box-shadow .15s,border-color .15s}
.lb-card:hover{box-shadow:0 4px 20px rgba(0,0,0,.08);border-color:var(--border-strong)}
.lb-back{background:none;border:none;color:var(--text-secondary);font-size:14px;cursor:pointer;display:flex;align-items:center;gap:6px;padding:0;font-family:inherit;transition:color .15s}
.lb-back:hover{color:var(--text-primary)}
.lb-error{background:#FFF2EE;border:1.5px solid #FF5A1F;border-radius:8px;padding:14px 16px;color:#C0391A;font-size:14px;font-weight:500}
@keyframes lb-bounce{0%,80%,100%{transform:scale(0)}40%{transform:scale(1)}}
.lb-dot{width:10px;height:10px;border-radius:50%;background:#FF5A1F;animation:lb-bounce 1.2s ease-in-out infinite both}
`;

/* ─── Ads tab: lander photo + AI copy → downloadable ad graphic ─────── */
const AD_SIZE = 1080; // square, works on Facebook/Instagram feed and Google display

const slugify = s => (String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')) || 'lander';

// The stored photo URLs default to 800px wide (fine for thumbnails); ask the
// proxy for more pixels when the photo is the full-bleed ad background.
const hiResPhoto = url => `${url}${url.includes('?') ? '&' : '?'}max_width=1600`;

// Fonts the canvas needs ready before drawing -- canvas text doesn't trigger
// webfont loading the way DOM text does, so we load them explicitly.
const AD_FONTS = [
  "700 84px 'Space Grotesk'",
  "700 64px 'Space Grotesk'",
  "400 36px 'Inter'",
  "600 32px 'IBM Plex Mono'",
  "600 30px 'IBM Plex Mono'",
];

function wrapLines(ctx, text, maxWidth) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (line && ctx.measureText(test).width > maxWidth) { lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function drawAd(canvas, img, copy, biz) {
  const S = AD_SIZE, M = 84, maxW = S - M * 2;
  const ctx = canvas.getContext('2d');
  const signal = biz.brand_color || '#FF5A1F';

  // photo, cover-fit
  ctx.fillStyle = '#181D24';
  ctx.fillRect(0, 0, S, S);
  const scale = Math.max(S / img.naturalWidth, S / img.naturalHeight);
  const iw = img.naturalWidth * scale, ih = img.naturalHeight * scale;
  ctx.drawImage(img, (S - iw) / 2, (S - ih) / 2, iw, ih);

  // scrim: photo stays visible up top, text zone goes near-solid below
  const g = ctx.createLinearGradient(0, 0, 0, S);
  g.addColorStop(0, 'rgba(24,29,36,.32)');
  g.addColorStop(0.45, 'rgba(24,29,36,.38)');
  g.addColorStop(1, 'rgba(24,29,36,.95)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);

  // top-left eyebrow: brand square + business name
  ctx.textBaseline = 'middle';
  ctx.fillStyle = signal;
  ctx.fillRect(M, M, 28, 28);
  ctx.font = "600 30px 'IBM Plex Mono', monospace";
  const rating = biz.rating
    ? `★ ${Number(biz.rating).toFixed(1)} (${biz.review_count || 0})` : '';
  const ratingW = rating ? ctx.measureText(rating).width : 0;
  let label = (biz.name || '').toUpperCase();
  const labelMax = maxW - 46 - (ratingW ? ratingW + 40 : 0);
  if (ctx.measureText(label).width > labelMax) {
    while (label.length > 1 && ctx.measureText(label + '…').width > labelMax) {
      label = label.slice(0, -1).trimEnd();
    }
    label += '…';
  }
  ctx.fillStyle = '#fff';
  ctx.fillText(label, M + 46, M + 16);
  if (rating) ctx.fillText(rating, S - M - ratingW, M + 16);

  // bottom stack: headline / subline / CTA pill, measured then laid out upward
  const headline = (copy.headline || '').trim();
  const subline = (copy.subline || '').trim();
  const cta = (copy.cta || '').trim();

  let headSize = 84;
  ctx.font = `700 ${headSize}px 'Space Grotesk', sans-serif`;
  let headLines = wrapLines(ctx, headline, maxW);
  if (headLines.length > 3) {
    headSize = 64;
    ctx.font = `700 ${headSize}px 'Space Grotesk', sans-serif`;
    headLines = wrapLines(ctx, headline, maxW);
  }
  const headLH = Math.round(headSize * 1.12);

  ctx.font = "400 36px 'Inter', sans-serif";
  const subLines = wrapLines(ctx, subline, maxW);
  const subLH = 50;

  const pillH = cta ? 96 : 0;
  const total = headLines.length * headLH
    + (subLines.length ? 20 + subLines.length * subLH : 0)
    + (pillH ? 48 + pillH : 0);

  ctx.textBaseline = 'top';
  let y = S - M - total;

  ctx.fillStyle = '#fff';
  ctx.font = `700 ${headSize}px 'Space Grotesk', sans-serif`;
  for (const ln of headLines) { ctx.fillText(ln, M, y); y += headLH; }

  if (subLines.length) {
    y += 20;
    ctx.fillStyle = '#DCE0E2';
    ctx.font = "400 36px 'Inter', sans-serif";
    for (const ln of subLines) { ctx.fillText(ln, M, y); y += subLH; }
  }

  if (cta) {
    y += 48;
    ctx.font = "600 32px 'IBM Plex Mono', monospace";
    const t = cta.toUpperCase();
    const tw = ctx.measureText(t).width;
    const pillW = Math.min(tw + 96, maxW);
    ctx.fillStyle = signal;
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(M, y, pillW, pillH, 14);
      ctx.fill();
    } else {
      ctx.fillRect(M, y, pillW, pillH);
    }
    ctx.fillStyle = contrastInk(signal);
    ctx.textBaseline = 'middle';
    ctx.fillText(t, M + (pillW - tw) / 2, y + pillH / 2 + 2);
  }
}

const MAX_ADS = 3;

function AdsTab({ landers, canvasesRef }) {
  const [lander, setLander] = useState(null);
  const [photoUrls, setPhotoUrls] = useState([]); // up to MAX_ADS, in click order
  const [imgs, setImgs] = useState({});           // url -> loaded HTMLImageElement
  const [copy, setCopy] = useState({ headline: '', subline: '', cta: '', primary_text: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const profile = lander?.profile || null;
  const photos = profile?.photos || [];

  const eyebrow = { fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: '0 0 10px' };

  // Coming from "Step 2: Create Ads" there's exactly one lander -- skip the
  // redundant click and drop the user straight into photo picking.
  useEffect(() => {
    if (landers.length === 1 && !lander) pickLander(landers[0]);
  }, [landers]); // eslint-disable-line react-hooks/exhaustive-deps

  function pickLander(l) {
    setLander(l); setPhotoUrls([]); setError('');
    // Prefill from the lander's own offer so there's a usable ad before the
    // AI call -- generation then just tightens what's already here.
    const p = l.profile || {};
    setCopy({
      headline: p.offer_headline || p.tagline || l.name || '',
      subline: p.offer_subhead || (p.rating ? `Rated ${Number(p.rating).toFixed(1)}★ by ${p.review_count || 0} customers on Google` : ''),
      cta: 'Call Today',
      primary_text: '',
    });
  }

  function togglePhoto(url) {
    setError('');
    setPhotoUrls(prev => prev.includes(url)
      ? prev.filter(u => u !== url)
      : prev.length >= MAX_ADS ? prev : [...prev, url]);
  }

  useEffect(() => {
    let cancelled = false;
    photoUrls.forEach(url => {
      if (imgs[url]) return;
      const im = new Image();
      im.crossOrigin = 'anonymous'; // backend proxy allows *, keeps the canvas exportable
      im.onload = () => { if (!cancelled) setImgs(prev => ({ ...prev, [url]: im })); };
      im.onerror = () => { if (!cancelled) setError('Could not load one of the photos. Try another one.'); };
      im.src = hiResPhoto(url);
    });
    return () => { cancelled = true; };
  }, [photoUrls]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    canvasesRef.current.length = photoUrls.length; // drop stale canvases from deselected ads
    (async () => {
      try { await Promise.all(AD_FONTS.map(f => document.fonts.load(f))); } catch { /* fall back to system fonts */ }
      if (cancelled) return;
      photoUrls.forEach((url, i) => {
        const canvas = canvasesRef.current[i];
        const img = imgs[url];
        if (canvas && img) drawAd(canvas, img, copy, profile);
      });
    })();
    return () => { cancelled = true; };
  }, [photoUrls, imgs, copy, profile, canvasesRef]);

  async function handleGenerate() {
    if (!profile) return;
    setBusy(true); setError('');
    try {
      const res = await generateAdCopy({
        name: profile.name || lander.name,
        category: profile.category || '',
        tagline: profile.tagline,
        services: profile.services || [],
        service_areas: profile.service_areas || [],
        rating: profile.rating,
        review_count: profile.review_count,
        offer_headline: profile.offer_headline,
        offer_subhead: profile.offer_subhead,
        offer_guarantee: profile.offer_guarantee,
        summary: profile.site_summary || profile.about_summary,
      });
      setCopy(c => ({
        headline: res.headline || c.headline,
        subline: res.subline ?? c.subline,
        cta: res.cta || c.cta,
        primary_text: res.primary_text || '',
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function copyPrimaryText() {
    try {
      await navigator.clipboard.writeText(copy.primary_text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* clipboard unavailable -- the text is visible to copy by hand */ }
  }

  if (!landers.length) return (
    <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Save a lander first — ads are built from a lander's photos and offer.</p>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div>
        <p style={eyebrow}>1 · Lander</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {landers.map(l => (
            <button key={l.id} className={`lb-btn-ghost${lander?.id === l.id ? ' active' : ''}`} onClick={() => pickLander(l)}>{l.name}</button>
          ))}
        </div>
      </div>

      {lander && (
        <div>
          <p style={eyebrow}>2 · Photos — pick up to {MAX_ADS}</p>
          {photos.length === 0
            ? <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0 }}>This lander has no photos to build ads from.</p>
            : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(110px,1fr))', gap: 8 }}>
                {photos.map((p, i) => {
                  const idx = photoUrls.indexOf(p);
                  return (
                    <button key={p} onClick={() => togglePhoto(p)} style={{
                      position: 'relative', padding: 0, border: idx > -1 ? '3px solid #FF5A1F' : '3px solid transparent',
                      borderRadius: 10, overflow: 'hidden', cursor: 'pointer', background: 'var(--surface-1)',
                      aspectRatio: '1', opacity: photoUrls.length && idx === -1 ? 0.6 : 1, transition: 'opacity .15s',
                    }}>
                      <img src={p} alt={`Photo ${i + 1}`} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      {idx > -1 && (
                        <span style={{
                          position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: '50%',
                          background: '#FF5A1F', color: '#fff', fontSize: 12, fontWeight: 700,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>{idx + 1}</span>
                      )}
                    </button>
                  );
                })}
              </div>}
        </div>
      )}

      {lander && photoUrls.length > 0 && (
        <div>
          <p style={eyebrow}>3 · Copy</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button className="lb-btn-signal" onClick={handleGenerate} disabled={busy} style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 8 }}>
              {busy ? 'Writing your ad…' : <>Generate ad copy <i className="ti ti-sparkles" aria-hidden="true" /></>}
            </button>
            <input className="lb-input" placeholder="Headline (big text on the image)" value={copy.headline} onChange={e => setCopy({ ...copy, headline: e.target.value })} />
            <input className="lb-input" placeholder="Supporting line" value={copy.subline} onChange={e => setCopy({ ...copy, subline: e.target.value })} />
            <input className="lb-input" placeholder="Button label (e.g. Get a Free Quote)" value={copy.cta} onChange={e => setCopy({ ...copy, cta: e.target.value })} />
            <textarea className="lb-input" placeholder="Primary text (shown next to the image in the feed)" value={copy.primary_text} onChange={e => setCopy({ ...copy, primary_text: e.target.value })} style={{ height: 96, padding: '12px 14px', resize: 'vertical', lineHeight: 1.5 }} />
          </div>
        </div>
      )}

      {error && <div className="lb-error">{error}</div>}

      {lander && photoUrls.length > 0 && (
        <div>
          <p style={eyebrow}>Your ads ({photoUrls.length})</p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {photoUrls.map((url, i) => (
              <div key={url} style={{ flex: '1 1 220px', maxWidth: 340 }}>
                {!imgs[url] && <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: '0 0 6px' }}>Loading photo…</p>}
                <canvas ref={el => { canvasesRef.current[i] = el; }} width={AD_SIZE} height={AD_SIZE}
                  style={{ width: '100%', borderRadius: 12, border: '0.5px solid var(--border)', display: imgs[url] ? 'block' : 'none' }} />
              </div>
            ))}
          </div>
          {copy.primary_text.trim() && (
            <div style={{ marginTop: 12 }}>
              <button className="lb-btn-ghost" onClick={copyPrimaryText}>{copied ? 'Copied!' : 'Copy primary text'}</button>
            </div>
          )}
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 14 }}>
            Happy with them? Hit <b>Step 3: Download Lander &amp; Ads</b> up top to get the files.
          </p>
        </div>
      )}
    </div>
  );
}

/* ─── main app ──────────────────────────────────────────────────────── */
export default function App() {
  const [step,       setStep]       = useState('search');
  const [query,      setQuery]      = useState('');
  const [loadMsg,    setLoadMsg]    = useState('');
  const [candidates, setCandidates] = useState([]);
  const [html,       setHtml]       = useState('');
  const [business,   setBusiness]   = useState(null);
  const [error,      setError]      = useState('');
  const [accountModal, setAccountModal] = useState('closed'); // 'closed' | 'form' | 'otp'
  const [accountForm,  setAccountForm]  = useState({ name:'', email:'', phone:'' });
  const [otpCode,       setOtpCode]      = useState('');
  const [accountError,  setAccountError] = useState('');
  const [accountBusy,   setAccountBusy]  = useState(false);
  const [landers,       setLanders]      = useState([]);
  const [dashboardTab,  setDashboardTab] = useState('landers');
  const iframeRef = useRef(null);
  const blobRef   = useRef(null);
  const timerRef  = useRef(null);
  const adCanvasesRef = useRef([]); // canvases drawn by AdsTab, exported at Step 3

  useEffect(() => {
    let s = document.getElementById('lb-global-css');
    if (!s) {
      s = document.createElement('style');
      s.id = 'lb-global-css';
      s.textContent = GLOBAL_CSS;
      document.head.appendChild(s);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  useEffect(() => {
    if (step !== 'preview' || !html || !iframeRef.current) return;
    if (blobRef.current) URL.revokeObjectURL(blobRef.current);
    const blob = new Blob([html], { type: 'text/html' });
    blobRef.current = URL.createObjectURL(blob);
    iframeRef.current.src = blobRef.current;
    return () => { if (blobRef.current) URL.revokeObjectURL(blobRef.current); };
  }, [step, html]);

  function cycleMsgs(msgs, interval=2800) {
    if (timerRef.current) clearInterval(timerRef.current);
    let i = 0; setLoadMsg(msgs[0]);
    timerRef.current = setInterval(() => { i=(i+1)%msgs.length; setLoadMsg(msgs[i]); }, interval);
    return () => { clearInterval(timerRef.current); timerRef.current = null; };
  }

  async function handleSearch(e) {
    if (e?.preventDefault) e.preventDefault();
    if (!query.trim()) { setError('Type a business name first — e.g. "Joe\'s Plumbing, Austin TX".'); return; }
    setError('');
    setStep('loading');
    const stop = cycleMsgs(['Searching Google Business listings…', 'Looking up matching businesses…', 'Finding the right profile…']);
    try {
      const results = await findCandidates(query.trim());
      stop();
      const valid = (Array.isArray(results) ? results : []).filter(r=>r&&r.name);
      if (!valid.length) { setError('No businesses found. Try adding a city or state.'); setStep('search'); return; }
      setCandidates(valid); setStep('candidates');
    } catch(err) { stop(); setError(err.message); setStep('search'); }
  }

  async function runBuild(candidate) {
    setError('');
    setStep('loading');
    const stop = cycleMsgs([
      'Pulling business details…',
      'Extracting services and hours…',
      'Gathering reviews…',
      'Finding photos…',
      'Reading their website for the offer…',
    ], 3200);
    try {
      const profile = await getProfile(candidate.place_id);
      let extras = {};
      try {
        extras = await generateOffer({
          website: profile.website,
          name: profile.name,
          category: profile.category,
          tagline: profile.tagline,
          services: profile.services || [],
          service_areas: profile.service_areas || [],
        });
      } catch {
        // Offer generation is a nice-to-have -- if the site can't be
        // scraped or the AI call fails, just build the page without it
        // rather than blocking the whole flow.
      }
      // The AI only returns fields it's confident about (e.g. a refined
      // category or services list); drop nulls and empty arrays so they
      // don't blank out real profile data.
      const cleanExtras = Object.fromEntries(
        Object.entries(extras).filter(([, v]) =>
          v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0)
        )
      );
      stop();
      finishBuild({ ...profile, ...cleanExtras });
    } catch(err) {
      stop();
      setError(err.message);
      setStep(candidates.length ? 'candidates' : 'search');
    }
  }

  function finishBuild(profile) {
    setBusiness(profile);
    setHtml(buildLanderHTML(profile));
    setStep('preview');
  }

  function reset() {
    setStep('search'); setQuery(''); setCandidates([]); setHtml(''); setBusiness(null); setError('');
  }

  /* ── Step 2: straight to ads, no account required ─────────────────── */
  function goToAds() {
    // The lander only lives in React state until Step 3 saves it -- that's
    // deliberate: let people build their ads first, capture the lead when
    // they want the files.
    setLanders([{
      id: 'local',
      name: business?.name || 'My lander',
      created_at: new Date().toISOString(),
      profile: business,
      local: true,
    }]);
    setDashboardTab('ads');
    setStep('dashboard');
  }

  /* ── Step 3: hand over the files (runs after the lead is captured) ── */
  function downloadAll() {
    const slug = slugify(business?.name || landers[0]?.name);
    const files = [];
    if (html) {
      const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
      files.push({ href: url, name: `${slug}-lander.html`, blob: true });
    }
    (adCanvasesRef.current || []).filter(Boolean).forEach((canvas, i) => {
      try { files.push({ href: canvas.toDataURL('image/png'), name: `${slug}-ad-${i + 1}.png` }); }
      catch { /* tainted canvas -- skip this ad rather than fail the batch */ }
    });
    // Stagger the clicks -- firing several programmatic downloads in the same
    // tick makes browsers silently drop all but the first.
    files.forEach((f, i) => setTimeout(() => {
      const a = document.createElement('a');
      a.href = f.href;
      a.download = f.name;
      a.click();
      if (f.blob) setTimeout(() => URL.revokeObjectURL(f.href), 2000);
    }, i * 400));
  }

  /* ── account creation (Step 2) ────────────────────────────────────── */
  function openAccountModal() {
    setAccountError(supabase ? '' : 'Account creation isn’t configured yet — check back soon.');
    setAccountForm({ name:'', email:'', phone:'' });
    setOtpCode('');
    setAccountModal('form');
  }

  function closeAccountModal() {
    setAccountModal('closed');
    setAccountError('');
    setOtpCode('');
  }

  async function submitAccountForm(e) {
    e.preventDefault();
    if (!supabase) return;
    const { name, email, phone } = accountForm;
    if (!name.trim() || !email.trim() || !phone.trim()) {
      setAccountError('Fill in all three fields.');
      return;
    }
    setAccountBusy(true);
    setAccountError('');
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { data: { name: name.trim(), phone: phone.trim() } },
      });
      if (otpError) throw otpError;
      setAccountModal('otp');
    } catch (err) {
      setAccountError(friendlyAuthError(err, 'Could not send the code. Try again.'));
    } finally {
      setAccountBusy(false);
    }
  }

  async function submitOtp(e) {
    e.preventDefault();
    if (!supabase) return;
    if (!otpCode.trim()) { setAccountError('Enter the code from your email.'); return; }
    setAccountBusy(true);
    setAccountError('');
    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: accountForm.email.trim(),
        token: otpCode.trim(),
        type: 'email',
      });
      if (verifyError) throw verifyError;
      const user = data.user;

      const { error: profileError } = await supabase.from('profiles').upsert({
        id: user.id,
        name: accountForm.name.trim(),
        phone: accountForm.phone.trim(),
        email: accountForm.email.trim(),
      });
      if (profileError) throw profileError;

      const { error: landerError } = await supabase.from('landers').insert({
        user_id: user.id,
        name: business?.name || 'Untitled lander',
        profile: business,
      });
      if (landerError) throw landerError;

      const { data: allLanders, error: listError } = await supabase
        .from('landers')
        .select('*')
        .order('created_at', { ascending: false });
      if (listError) throw listError;

      setLanders(allLanders || []);
      setAccountModal('closed');
      downloadAll();
    } catch (err) {
      setAccountError(friendlyAuthError(err, 'Invalid code. Try again.'));
    } finally {
      setAccountBusy(false);
    }
  }

  /* ── search (homepage) ────────────────────────────────────────────── */
  if (step === 'search') return (
    <Home query={query} setQuery={setQuery} error={error} onSearch={handleSearch} />
  );

  /* ── loading ───────────────────────────────────────────────────────── */
  if (step === 'loading') return (
    <div style={{minHeight:460,background:'#181D24',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:20,padding:32}}>
      <div style={{display:'flex',gap:8}}>
        {[0,1,2].map(i=><div key={i} className="lb-dot" style={{animationDelay:`${i*0.2}s`}}/>)}
      </div>
      <p style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:13,color:'#9AA3A8',letterSpacing:'.04em',margin:0,textAlign:'center',minHeight:20}}>{loadMsg}</p>
    </div>
  );

  /* ── candidates ────────────────────────────────────────────────────── */
  if (step === 'candidates') return (
    <div>
      <div style={{background:'#181D24',padding:'12px 20px',display:'flex',alignItems:'center',gap:10}}>
        <span style={{width:26,height:26,background:'#FF5A1F',borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,color:'#fff',flexShrink:0}}>▲</span>
        <span style={{fontFamily:"'Space Grotesk',system-ui,sans-serif",fontWeight:700,fontSize:14,color:'#fff',letterSpacing:'-.01em'}}>LanderBuilder</span>
      </div>

      <div style={{padding:'32px 20px 48px',maxWidth:600,margin:'0 auto'}}>
        <button className="lb-back" onClick={reset} style={{marginBottom:24}}>
          <i className="ti ti-arrow-left" aria-hidden="true" /> Back to search
        </button>
        <h2 style={{fontFamily:"'Space Grotesk',system-ui,sans-serif",fontWeight:700,fontSize:22,letterSpacing:'-.01em',color:'var(--text-primary)',margin:'0 0 6px'}}>Which business is yours?</h2>
        <p style={{color:'var(--text-secondary)',fontSize:14,margin:'0 0 24px'}}>Found {candidates.length} matches for "{query}"</p>

        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {candidates.map((c,i)=>(
            <div key={i} className="lb-card" onClick={()=>runBuild(c)}>
              <div style={{width:56,height:56,borderRadius:8,overflow:'hidden',flexShrink:0,background:'var(--surface-1)',border:'0.5px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                {c.photo
                  ? <img src={c.photo} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}} onError={e=>{e.target.style.display='none'; e.target.nextSibling.style.display='flex';}} />
                  : null}
                <span style={{display:c.photo?'none':'flex',width:'100%',height:'100%',alignItems:'center',justifyContent:'center',fontSize:18,color:'var(--text-muted)'}}><i className="ti ti-building-store" aria-hidden="true" /></span>
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontFamily:"'Space Grotesk',system-ui,sans-serif",fontWeight:700,fontSize:16,color:'var(--text-primary)',marginBottom:4,letterSpacing:'-.01em',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.name}</div>
                <div style={{fontSize:13,color:'var(--text-secondary)',marginBottom:6,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.address}</div>
                <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'center'}}>
                  {c.category&&<span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,letterSpacing:'.06em',textTransform:'uppercase',color:'var(--text-muted)'}}>{c.category}</span>}
                  {c.rating&&<span style={{fontSize:12,color:'var(--text-primary)'}}>★ <b>{Number(c.rating).toFixed(1)}</b> <span style={{color:'var(--text-muted)'}}>({c.review_count||0})</span></span>}
                  {c.phone&&<span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12,color:'var(--text-secondary)'}}>{c.phone}</span>}
                </div>
              </div>
              <span style={{flexShrink:0,fontFamily:"'IBM Plex Mono',monospace",fontSize:12,color:'#FF5A1F',fontWeight:600,letterSpacing:'.02em',display:'flex',alignItems:'center',gap:4}}>
                Build lander <i className="ti ti-arrow-right" aria-hidden="true" />
              </span>
            </div>
          ))}
        </div>

        {error && <div className="lb-error" style={{marginTop:16}}>{error}</div>}
      </div>
    </div>
  );

  /* ── preview ───────────────────────────────────────────────────────── */
  if (step === 'preview') {
    return (
      <div style={{display:'flex',flexDirection:'column',height:'100dvh',background:'#0E1318'}}>
        <div style={{flex:'0 0 10%',minHeight:52,background:'#181D24',padding:'0 16px',display:'flex',alignItems:'center',gap:8,borderBottom:'1px solid rgba(255,255,255,.08)'}}>
          <span style={{width:24,height:24,background:'#FF5A1F',borderRadius:5,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,color:'#fff',flexShrink:0}}>▲</span>
          <button className="lb-btn-signal" style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:8}} onClick={goToAds}>
            Step 2: Create Ads <i className="ti ti-arrow-right" aria-hidden="true" />
          </button>
        </div>

        <div style={{flex:'1 1 90%',minHeight:0,padding:'0 10px',display:'flex',justifyContent:'center'}}>
          <iframe ref={iframeRef} style={{width:'100%',maxWidth:480,height:'100%',border:'none',display:'block',background:'#fff'}} title="Lander preview — mobile" />
        </div>
      </div>
    );
  }

  /* ── dashboard (post-signup: Landers + Ads) ───────────────────────── */
  if (step === 'dashboard') {
    return (
      <div>
        <div style={{background:'#181D24',padding:'12px 20px',display:'flex',alignItems:'center',gap:10}}>
          <span style={{width:26,height:26,background:'#FF5A1F',borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,color:'#fff',flexShrink:0}}>▲</span>
          <span style={{fontFamily:"'Space Grotesk',system-ui,sans-serif",fontWeight:700,fontSize:14,color:'#fff',letterSpacing:'-.01em'}}>LanderBuilder</span>
          <button className="lb-btn-signal" style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:8,height:38}} onClick={openAccountModal}>
            Step 3: Download Lander &amp; Ads <i className="ti ti-download" aria-hidden="true" />
          </button>
        </div>

        <div style={{padding:'24px 20px 48px',maxWidth:720,margin:'0 auto'}}>
          <div style={{display:'flex',gap:20,marginBottom:24,borderBottom:'1px solid var(--border)'}}>
            {['landers','ads'].map(tab => (
              <button key={tab} onClick={()=>setDashboardTab(tab)} style={{
                background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',
                padding:'10px 2px',fontSize:14,fontWeight:600,textTransform:'capitalize',
                color: dashboardTab===tab ? 'var(--text-primary)' : 'var(--text-secondary)',
                borderBottom: dashboardTab===tab ? '2px solid #FF5A1F' : '2px solid transparent',
              }}>{tab}</button>
            ))}
          </div>

          {dashboardTab === 'landers' && (
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {landers.length === 0 && <p style={{color:'var(--text-secondary)',fontSize:14}}>No landers saved yet.</p>}
              {landers.map(l => (
                <div key={l.id} className="lb-card" style={{cursor:'default'}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontFamily:"'Space Grotesk',system-ui,sans-serif",fontWeight:700,fontSize:15,color:'var(--text-primary)'}}>{l.name}</div>
                    <div style={{fontSize:12,color:'var(--text-secondary)',marginTop:2}}>
                      {l.local ? 'Ready — download it in Step 3' : `Saved ${new Date(l.created_at).toLocaleDateString()}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {dashboardTab === 'ads' && <AdsTab landers={landers} canvasesRef={adCanvasesRef} />}
        </div>

        {accountModal !== 'closed' && (
          <div style={{position:'fixed',inset:0,zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
            <div style={{position:'absolute',inset:0,background:'rgba(14,19,24,.7)'}} onClick={closeAccountModal} />
            <div style={{position:'relative',background:'#fff',borderRadius:14,maxWidth:380,width:'100%',padding:'28px 24px',boxShadow:'0 20px 60px rgba(0,0,0,.4)'}}>
              <button onClick={closeAccountModal} aria-label="Close" style={{position:'absolute',top:10,right:14,background:'none',border:0,fontSize:26,lineHeight:1,color:'var(--text-secondary)',cursor:'pointer'}}>&times;</button>

              {accountModal === 'form' && (
                <>
                  <h3 style={{fontFamily:"'Space Grotesk',system-ui,sans-serif",fontWeight:700,fontSize:20,letterSpacing:'-.01em',margin:'0 0 8px',color:'var(--text-primary)'}}>Almost there</h3>
                  <p style={{fontSize:14,color:'var(--text-secondary)',margin:'0 0 20px',lineHeight:1.5}}>Tell us who you are and we'll save your lander and ads to an account, then download the files.</p>
                  <form onSubmit={submitAccountForm} style={{display:'flex',flexDirection:'column',gap:12}}>
                    <input className="lb-input" placeholder="Your name" autoComplete="name" value={accountForm.name} onChange={e=>setAccountForm({...accountForm, name:e.target.value})} />
                    <input className="lb-input" type="email" placeholder="Email" autoComplete="email" value={accountForm.email} onChange={e=>setAccountForm({...accountForm, email:e.target.value})} />
                    <input className="lb-input" type="tel" placeholder="Phone number" autoComplete="tel" value={accountForm.phone} onChange={e=>setAccountForm({...accountForm, phone:e.target.value})} />
                    {accountError && <div className="lb-error">{accountError}</div>}
                    <button className="lb-btn-signal" type="submit" disabled={accountBusy || !supabase} style={{width:'100%',justifyContent:'center'}}>
                      {accountBusy ? 'Sending code…' : 'Continue'}
                    </button>
                  </form>
                </>
              )}

              {accountModal === 'otp' && (
                <>
                  <h3 style={{fontFamily:"'Space Grotesk',system-ui,sans-serif",fontWeight:700,fontSize:20,letterSpacing:'-.01em',margin:'0 0 8px',color:'var(--text-primary)'}}>Check your email</h3>
                  <p style={{fontSize:14,color:'var(--text-secondary)',margin:'0 0 20px',lineHeight:1.5}}>We sent a verification code to {accountForm.email}.</p>
                  <form onSubmit={submitOtp} style={{display:'flex',flexDirection:'column',gap:12}}>
                    <input className="lb-input" placeholder="Verification code" inputMode="numeric" autoComplete="one-time-code" value={otpCode} onChange={e=>setOtpCode(e.target.value)} />
                    {accountError && <div className="lb-error">{accountError}</div>}
                    <button className="lb-btn-signal" type="submit" disabled={accountBusy} style={{width:'100%',justifyContent:'center'}}>
                      {accountBusy ? 'Verifying…' : 'Verify & Download'}
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}
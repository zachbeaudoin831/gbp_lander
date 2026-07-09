import { useState, useEffect, useRef } from "react";

/* ─── html helpers ─────────────────────────────────────────────────── */
const esc = s => s == null ? '' : String(s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  .replace(/"/g,'&quot;').replace(/'/g,'&#39;');

const starsStr = n => { const f=Math.max(0,Math.min(5,Math.round(n||0))); return '★'.repeat(f)+'☆'.repeat(5-f); };
const todayName = () => ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()];

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
  <div class="ticket-row"><span class="ticket-label">Tap to call</span></div>
  ${d.open_now!=null?`<p class="status-line"><span class="status-dot${d.open_now?'':' closed'}"></span>${d.open_now?'Open now':'Closed now'}</p>`:''}
  <a class="ticket-cta" href="${href}">${esc(phone)}</a>
</div>` : '';

  const CSS = `:root{--ink:#181D24;--paper:#EFF2EE;--signal:${d.brand_color||'#FF5A1F'};--signal-ink:${contrastInk(d.brand_color)};--slate:#5B6B79;--success:#1F8A5F;--line:#D8DCD9;--card:#fff;--radius:14px;--display:'Space Grotesk',system-ui,sans-serif;--body:'Inter',system-ui,sans-serif;--mono:'IBM Plex Mono',ui-monospace,monospace}*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}body{margin:0;font-family:var(--body);color:var(--ink);background:var(--paper);line-height:1.5}a{color:inherit}img{max-width:100%;display:block}.wrap{max-width:720px;margin:0 auto;padding:0 20px}.topbar{position:sticky;top:0;z-index:30;background:var(--ink);color:#fff;border-bottom:1px solid rgba(255,255,255,.08)}.topbar-inner{max-width:720px;margin:0 auto;padding:10px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px}.topbar-name{font-family:var(--display);font-weight:700;font-size:15px;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.topbar-rating{font-family:var(--mono);font-size:12px;color:#C7CDD2;white-space:nowrap}.topbar-call{flex-shrink:0;background:var(--signal);color:var(--signal-ink);font-family:var(--mono);font-weight:600;font-size:12px;padding:8px 14px;border-radius:999px;text-decoration:none;white-space:nowrap}.hero{position:relative;min-height:420px;display:flex;align-items:flex-end;color:#fff;background:var(--ink)}.hero-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.55}.hero-scrim{position:absolute;inset:0;background:linear-gradient(180deg,rgba(24,29,36,.15) 0%,rgba(24,29,36,.55) 55%,rgba(24,29,36,.95) 100%)}.hero-content{position:relative;width:100%;padding:48px 20px 28px;max-width:720px;margin:0 auto}.hero-eyebrow{font-family:var(--mono);font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#C7CDD2;margin:0 0 10px}.hero-name{font-family:var(--display);font-weight:700;font-size:clamp(28px,7vw,42px);line-height:1.05;letter-spacing:-.01em;margin:0 0 6px}.hero-tagline{font-size:15px;color:#DCE0E2;max-width:46ch;margin:0 0 22px}.offer-block{margin:4px 0 22px}.offer-headline{font-family:var(--display);font-weight:700;font-size:clamp(20px,4.5vw,26px);color:#fff;margin:0 0 6px;line-height:1.2;max-width:20ch}.offer-subhead{font-size:14px;color:#DCE0E2;margin:0 0 8px;max-width:46ch}.offer-guarantee{font-family:var(--mono);font-size:12px;color:#8FE3B8;margin:0}.about-text{font-size:15px;line-height:1.65;color:var(--ink);margin:0}.ticket{background:var(--card);color:var(--ink);border:2px dashed rgba(24,29,36,.35);border-radius:var(--radius);padding:18px 20px;max-width:380px}.ticket-row{display:flex;align-items:center;justify-content:space-between;gap:10px}.ticket-label{font-family:var(--mono);font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--slate)}.ticket-cta{display:inline-flex;align-items:center;gap:8px;margin-top:10px;width:100%;justify-content:center;background:var(--signal);color:var(--signal-ink);font-family:var(--mono);font-weight:700;font-size:clamp(20px,5.5vw,26px);letter-spacing:-.01em;padding:14px 16px;border-radius:8px;text-decoration:none}.status-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--success);margin-right:6px}.status-dot.closed{background:#9AA3A8}.status-line{font-family:var(--mono);font-size:12px;color:var(--slate);margin-top:10px}section{padding:32px 0;border-bottom:1px solid var(--line)}.wrap>section:last-of-type{border-bottom:none}.eyebrow{font-family:var(--mono);font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--slate);margin:0 0 14px}.chips{display:flex;flex-wrap:wrap;gap:8px}.chip{font-family:var(--body);font-weight:500;font-size:13px;background:var(--card);border:1px solid var(--line);border-radius:999px;padding:8px 14px}.filmstrip{display:flex;gap:10px;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:4px;margin:0 -20px;padding-left:20px;padding-right:20px}.filmstrip img{flex:0 0 auto;width:62vw;max-width:260px;height:180px;object-fit:cover;border-radius:10px;scroll-snap-align:start;background:var(--card)}.review-summary{font-family:var(--mono);font-size:14px;margin:0 0 16px}.review-summary b{font-size:16px}.review-summary .muted{color:var(--slate);font-weight:400}.review-list{display:flex;flex-direction:column;gap:12px;margin-bottom:14px}.review-card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px 16px}.review-card-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px}.review-author{font-weight:600;font-size:13px}.review-stars{font-family:var(--mono);font-size:12px;color:var(--signal);letter-spacing:1px}.review-text{font-size:14px;color:var(--ink);margin:0 0 6px;line-height:1.5}.review-time{font-family:var(--mono);font-size:11px;color:var(--slate);margin:0}.review-google-link{display:inline-block;font-family:var(--mono);font-size:12px;color:var(--slate);text-decoration:underline;text-decoration-color:var(--line)}.hours-table{width:100%;border-collapse:collapse;font-size:14px}.hours-table td{padding:8px 0;border-bottom:1px solid var(--line)}.hours-table td:last-child{text-align:right;font-family:var(--mono);font-size:13px;color:var(--slate)}.hours-table tr.today td{color:var(--ink);font-weight:600}.hours-table tr.today td:first-child::after{content:" · today";font-weight:400;font-family:var(--mono);font-size:11px;color:var(--signal)}.addr{font-size:14px;color:var(--slate)}.addr a{color:var(--ink);text-decoration:underline;text-decoration-color:var(--line)}footer{padding:24px 0 32px}footer .fine{font-size:12px;color:var(--slate)}.cta-band{background:var(--ink);color:#fff;padding:40px 0 44px;text-align:center}.cta-band .eyebrow{color:#9AA3A8}.cta-band-heading{font-family:var(--display);font-weight:700;font-size:clamp(22px,5.5vw,30px);letter-spacing:-.01em;margin:0 0 20px}.cta-band .ticket{margin:0 auto;text-align:left}.callbar{position:fixed;left:0;right:0;bottom:0;z-index:40;background:var(--ink);border-top:2px dashed rgba(255,255,255,.25);padding:12px 16px calc(12px + env(safe-area-inset-bottom))}.callbar a{display:flex;align-items:center;justify-content:center;gap:10px;background:var(--signal);color:var(--signal-ink);font-family:var(--mono);font-weight:600;font-size:15px;padding:14px;border-radius:10px;text-decoration:none}@media(min-width:760px){.hero{min-height:480px}}`;

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

${phone?`<section class="cta-band"><div class="wrap"><p class="eyebrow">Ready when you are</p><h2 class="cta-band-heading">${esc(first)}'s ready to help</h2>${ticket()}</div></section>`:''}

<div class="wrap">
  ${d.address?`<section><p class="eyebrow">Location</p><p class="addr">${esc(d.address)}${d.maps_url?` · <a href="${esc(d.maps_url)}" target="_blank" rel="noopener">Get directions</a>`:''}</p></section>`:''}
  <footer><p class="fine">Information sourced from this business's Google Business Profile${d.website?` and <a href="${esc(d.website)}" target="_blank" rel="noopener">website</a>`:''}</p></footer>
</div>

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
.lb-btn-dark.active{background:#FF5A1F;color:#fff;border-color:#FF5A1F}
.lb-btn-dl{background:#FF5A1F;color:#fff;border:none;border-radius:7px;padding:7px 16px;font-size:12px;font-weight:600;font-family:'IBM Plex Mono',monospace;letter-spacing:.02em;cursor:pointer;transition:opacity .15s}
.lb-btn-dl:hover{opacity:.88}
.lb-pill{cursor:pointer;background:var(--surface-2);border:1px solid var(--border);border-radius:999px;padding:6px 14px;font-size:13px;color:var(--text-secondary);transition:all .15s;font-family:inherit}
.lb-pill:hover{border-color:#FF5A1F;color:#FF5A1F;background:#FFF8F5}
.lb-card{background:var(--surface-2);border:0.5px solid var(--border);border-radius:12px;padding:16px 18px;display:flex;align-items:center;justify-content:space-between;gap:16px;cursor:pointer;transition:box-shadow .15s,border-color .15s}
.lb-card:hover{box-shadow:0 4px 20px rgba(0,0,0,.08);border-color:var(--border-strong)}
.lb-back{background:none;border:none;color:var(--text-secondary);font-size:14px;cursor:pointer;display:flex;align-items:center;gap:6px;padding:0;font-family:inherit;transition:color .15s}
.lb-back:hover{color:var(--text-primary)}
.lb-error{background:#FFF2EE;border:1.5px solid #FF5A1F;border-radius:8px;padding:14px 16px;color:#C0391A;font-size:14px;font-weight:500}
@keyframes lb-bounce{0%,80%,100%{transform:scale(0)}40%{transform:scale(1)}}
.lb-dot{width:10px;height:10px;border-radius:50%;background:#FF5A1F;animation:lb-bounce 1.2s ease-in-out infinite both}
.phone-shell{border-radius:40px;overflow:hidden;border:8px solid #2A333D;box-shadow:0 0 0 2px #404A57,0 28px 60px rgba(0,0,0,.55)}
`;

/* ─── main app ──────────────────────────────────────────────────────── */
export default function App() {
  const [step,       setStep]       = useState('search');
  const [query,      setQuery]      = useState('');
  const [loadMsg,    setLoadMsg]    = useState('');
  const [candidates, setCandidates] = useState([]);
  const [html,       setHtml]       = useState('');
  const [business,   setBusiness]   = useState(null);
  const [error,      setError]      = useState('');
  const [viewMode,   setViewMode]   = useState('mobile');
  const [copied,     setCopied]     = useState(false);
  const iframeRef = useRef(null);
  const blobRef   = useRef(null);
  const timerRef  = useRef(null);

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
  }, [step, html, viewMode]);

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

  function handleDownload() {
    if (!blobRef.current) return;
    const a = document.createElement('a');
    a.href = blobRef.current;
    a.download = ((business?.name||'lander').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''))+'.html';
    a.click();
  }

  async function handleCopy() {
    if (!html) return;
    try { await navigator.clipboard.writeText(html); setCopied(true); setTimeout(()=>setCopied(false), 2000); }
    catch { /* fallback: nothing */ }
  }

  function reset() {
    setStep('search'); setQuery(''); setCandidates([]); setHtml(''); setBusiness(null); setError('');
    setOfferAnswers({ dream_outcome:'', likelihood:'', time_delay:'', effort:'' });
  }

  /* ── search ────────────────────────────────────────────────────────── */
  if (step === 'search') return (
    <div>
      <div style={{background:'#181D24',padding:'12px 20px',display:'flex',alignItems:'center',gap:10}}>
        <span style={{width:26,height:26,background:'#FF5A1F',borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,color:'#fff',flexShrink:0}}>▲</span>
        <span style={{fontFamily:"'Space Grotesk',system-ui,sans-serif",fontWeight:700,fontSize:14,color:'#fff',letterSpacing:'-.01em'}}>LanderBuilder</span>
      </div>

      <div style={{padding:'52px 24px 48px',display:'flex',flexDirection:'column',alignItems:'center'}}>
        <div style={{maxWidth:540,width:'100%',textAlign:'center'}}>
          <p style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,letterSpacing:'.1em',textTransform:'uppercase',color:'#FF5A1F',margin:'0 0 16px'}}>Google Business Profile → landing page</p>
          <h1 style={{fontFamily:"'Space Grotesk',system-ui,sans-serif",fontWeight:700,fontSize:'clamp(26px,5vw,38px)',letterSpacing:'-.02em',color:'var(--text-primary)',margin:'0 0 14px',lineHeight:1.1}}>Turn your listing into a call-conversion page</h1>
          <p style={{color:'var(--text-secondary)',fontSize:15,margin:'0 0 36px',lineHeight:1.65}}>Search your Google Business Profile and we'll build a ready-to-deploy landing page using your real photos, hours, reviews, and services.</p>

          <div style={{display:'flex',gap:8,marginBottom:8}}>
            <input className="lb-input" value={query} onChange={e=>setQuery(e.target.value)}
              onKeyDown={e=>{ if (e.key === 'Enter') handleSearch(e); }}
              placeholder="Business name and city — e.g. Joe's Plumbing, Austin TX" />
            <button className="lb-btn-signal" type="button" onClick={handleSearch}>Find →</button>
          </div>
          <p style={{fontSize:12,color:'var(--text-muted)',margin:'0 0 14px',textAlign:'left'}}>One box — type the business name and city/state together, then hit Find.</p>

          <div style={{display:'flex',flexWrap:'wrap',gap:8,justifyContent:'center',marginBottom:24}}>
            {["Mike's Roofing, Nashville TN","Sunrise Dental, Phoenix AZ","Pacific HVAC, Seattle WA"].map(ex=>(
              <button key={ex} className="lb-pill" onClick={()=>setQuery(ex)}>{ex}</button>
            ))}
          </div>

          {error && <div className="lb-error">{error}</div>}

          <div style={{marginTop:40,borderTop:'0.5px solid var(--border)',paddingTop:32,display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
            {[
              ['<i class="ti ti-search" aria-hidden="true"></i>','Find your listing','We look up your real GBP data — name, phone, hours, photos, and reviews.'],
              ['<i class="ti ti-layout-dashboard" aria-hidden="true"></i>','Page is built for you','A call-conversion lander assembled from your actual profile, no templates.'],
              ['<i class="ti ti-download" aria-hidden="true"></i>','Download and deploy','Get clean HTML you can host on any subdomain, ready for ad traffic.'],
            ].map(([icon,title,desc])=>(
              <div key={title} style={{textAlign:'left',padding:'14px',background:'var(--surface-1)',borderRadius:10,border:'0.5px solid var(--border)'}}>
                <div style={{fontSize:18,color:'#FF5A1F',marginBottom:8}} dangerouslySetInnerHTML={{__html:icon}} />
                <div style={{fontWeight:500,fontSize:13,color:'var(--text-primary)',marginBottom:4}}>{title}</div>
                <div style={{fontSize:12,color:'var(--text-secondary)',lineHeight:1.5}}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
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
    const isMobile = viewMode === 'mobile';
    return (
      <div>
        <div style={{background:'#181D24',padding:'10px 16px',display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',borderBottom:'1px solid rgba(255,255,255,.08)'}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginRight:'auto',minWidth:0,overflow:'hidden'}}>
            <span style={{width:24,height:24,background:'#FF5A1F',borderRadius:5,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,color:'#fff',flexShrink:0}}>▲</span>
            <span style={{fontFamily:"'Space Grotesk',system-ui,sans-serif",fontWeight:700,fontSize:13,color:'#fff',letterSpacing:'-.01em',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{business?.name}</span>
          </div>
          <button className="lb-btn-dark" onClick={reset}><i className="ti ti-arrow-left" aria-hidden="true" /> New search</button>
          <div style={{display:'flex',gap:4}}>
            <button className={`lb-btn-dark${viewMode==='mobile'?' active':''}`} onClick={()=>setViewMode('mobile')}>
              <i className="ti ti-device-mobile" aria-hidden="true" /> Mobile
            </button>
            <button className={`lb-btn-dark${viewMode==='desktop'?' active':''}`} onClick={()=>setViewMode('desktop')}>
              <i className="ti ti-device-desktop" aria-hidden="true" /> Desktop
            </button>
          </div>
          <button className="lb-btn-dark" onClick={handleCopy} style={copied?{background:'rgba(31,138,95,.3)',color:'#6FD9A6',borderColor:'rgba(31,138,95,.4)'}:{}}>
            <i className={`ti ti-${copied?'check':'copy'}`} aria-hidden="true" /> {copied ? 'Copied!' : 'Copy HTML'}
          </button>
          <button className="lb-btn-dl" onClick={handleDownload}>
            <i className="ti ti-download" aria-hidden="true" /> Download HTML
          </button>
        </div>

        {isMobile ? (
          <div style={{background:'#0E1318',padding:'28px 0',display:'flex',justifyContent:'center',minHeight:820}}>
            <div className="phone-shell" style={{width:390,height:760,position:'relative',flexShrink:0}}>
              <iframe ref={iframeRef} style={{width:'100%',height:'100%',border:'none',display:'block'}} title="Lander preview — mobile" />
            </div>
          </div>
        ) : (
          <div style={{background:'#0E1318',padding:0}}>
            <iframe
              ref={iframeRef}
              style={{width:'100%',height:760,border:'none',display:'block'}}
              title="Lander preview — desktop"
              onLoad={e=>{
                try {
                  const h = e.target.contentDocument?.documentElement?.scrollHeight;
                  if (h && h > 200) e.target.style.height = Math.min(h+40, 2400)+'px';
                } catch {}
              }}
            />
          </div>
        )}
      </div>
    );
  }

  return null;
}
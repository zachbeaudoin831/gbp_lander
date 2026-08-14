import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabaseClient";
import Home, { LogoMark } from "./Home";
import { initPixel, trackSignup } from "./metaPixel";

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

/* ─── lander HTML generator ("Soft Light" template) ─────────────────── */
// Exported for the /admin asset portal, which regenerates any saved
// lander from its profile jsonb -- same input, same file the user got.
export function buildLanderHTML(d) {
  // Em dashes never reach the end user: spaced ones read as a comma pause,
  // anything left becomes a plain hyphen.
  const noDash = s => s == null ? '' : String(s).replace(/\s*—\s*/g, ', ').replace(/—/g, '-');
  const clean = s => esc(noDash(s));
  const titleCaseWords = s => String(s || '')
    .replace(/([^\s-]+)/g, w => w.charAt(0).toUpperCase() + w.slice(1));

  const phone = d.phone_national || d.phone_international || '';
  const href  = d.phone_international
    ? `tel:${d.phone_international.replace(/[^\d+]/g,'')}`
    : phone ? `tel:${phone.replace(/[^0-9+]/g,'')}` : null;
  const city  = (d.address||'').split(',')[1]?.trim()||'';
  const first = (d.name||'Us').split(' ')[0];
  const today = todayName();
  const initial = (d.name||'?').trim().charAt(0).toUpperCase();
  // Trailing country makes the maps embed treat the query as an address
  // search; without it Google resolves the business entity and shows the
  // place card with the rating + review count on the map.
  const mapAddr = (d.address||'').replace(/,\s*(USA|United States|Canada)\s*$/i,'');

  const headline = esc(titleCaseWords(noDash(d.offer_headline || d.name || '')));
  const sub = clean(d.offer_subhead || d.tagline);

  const phoneSvg = w => `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`;

  // Stat tiles under the photo collage; each renders only when its data exists.
  const alwaysOpen = (d.hours||[]).length === 7 && !(d.hours||[]).some(l => /closed/i.test(l));
  const todayLine = (d.hours||[]).find(l => l.startsWith(today));
  const todayTime = todayLine && todayLine.indexOf(':') > -1 ? todayLine.slice(todayLine.indexOf(':')+1).trim() : '';
  const stats = [];
  if (d.rating) stats.push({ n: `${Number(d.rating).toFixed(1)} ★`, l: `${d.review_count||0} Google reviews` });
  if (alwaysOpen) stats.push({ n: '7 days', l: 'Open every week' });
  else if (d.open_now != null) stats.push({ n: d.open_now ? 'Open now' : 'Closed now', l: todayTime ? `Today: ${esc(todayTime)}` : '' });
  if (city) stats.push({ n: esc(city), l: clean(d.category) || 'Local service' });

  const photos = (d.photos||[]).slice(0,5);

  const revs = (d.reviews||[]).filter(r => r && r.text).slice(0,4);

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

  const CSS = `:root{--bg:#FFFFFF;--bg2:#F7F8FA;--card:#FFFFFF;--line:#ECEDF0;--ink:#0B0C0E;--muted:#5C616B;--faint:#9AA0AA;--go:#16A34A;--go-soft:#EAF7EF;--gold:#F5A623;--display:'Sora',system-ui,sans-serif;--body:'Inter',system-ui,sans-serif;--r:18px;--r-lg:24px;--shadow:0 1px 2px rgba(11,12,14,.04),0 8px 24px rgba(11,12,14,.06)}*{box-sizing:border-box}html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}body{margin:0;font-family:var(--body);background:var(--bg);color:var(--ink);line-height:1.55;font-size:16px}img{max-width:100%;display:block}a{color:inherit}.wrap{max-width:1060px;margin:0 auto;padding:0 24px}.topbar{position:sticky;top:0;z-index:30;background:rgba(255,255,255,.85);backdrop-filter:blur(12px);border-bottom:1px solid var(--line)}.topbar-inner{max-width:1060px;margin:0 auto;padding:14px 24px;display:flex;align-items:center;justify-content:space-between;gap:12px}.brand{display:flex;align-items:center;gap:11px;font-family:var(--display);font-weight:700;font-size:17.5px;letter-spacing:-.01em;min-width:0}.brand-name{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.brand-mark{position:relative;flex-shrink:0;width:44px;height:44px;border-radius:12px;background:var(--ink);color:#fff;display:grid;place-items:center;font-size:17px;font-weight:800}.brand-mark.has-logo{background:#fff;border:1px solid var(--line)}.brand-mark.has-logo .bm-i{visibility:hidden}.brand-mark img{position:absolute;inset:3px;width:calc(100% - 6px);height:calc(100% - 6px);object-fit:contain;border-radius:8px}.topbar-actions{display:flex;align-items:center;gap:10px;flex-shrink:0}.btn{display:inline-flex;align-items:center;justify-content:center;gap:9px;font-weight:600;text-decoration:none;border-radius:12px;transition:transform .15s ease,box-shadow .15s ease;cursor:pointer;font-family:var(--body)}.btn:hover{transform:translateY(-1px)}.btn-primary{background:var(--ink);color:#fff;font-size:14px;padding:11px 18px;box-shadow:var(--shadow);white-space:nowrap}.btn-ghost{background:transparent;color:var(--muted);font-size:14px;padding:11px 14px;border:1px solid var(--line);white-space:nowrap}.hero{padding:64px 0 40px;text-align:center}.rating-pill{display:inline-flex;align-items:center;gap:9px;background:var(--bg2);border:1px solid var(--line);border-radius:999px;padding:8px 16px;font-size:13.5px;font-weight:500;color:var(--muted);margin-bottom:26px;flex-wrap:wrap;justify-content:center}.rating-pill .stars{color:var(--gold);letter-spacing:1px;font-size:13px}.rating-pill b{color:var(--ink);font-weight:700}.rating-pill .sep{width:1px;height:14px;background:var(--line)}.rating-pill .open{color:var(--go);font-weight:600}.rating-pill .open.closed{color:var(--faint)}.rating-pill .open::before{content:"●";margin-right:6px;font-size:9px;vertical-align:1px}h1{font-family:var(--display);font-weight:800;font-size:clamp(34px,6vw,58px);line-height:1.06;letter-spacing:-.03em;margin:0 auto 20px;max-width:20ch}.sub{font-size:clamp(16px,2.2vw,19px);color:var(--muted);margin:0 auto 34px;max-width:52ch}.cta-row{display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap}.cta-main{background:var(--ink);color:#fff;font-family:var(--display);font-weight:700;font-size:17px;padding:17px 30px;border-radius:14px;box-shadow:0 12px 32px rgba(11,12,14,.18)}.cta-sec{background:#fff;border:1px solid var(--line);color:var(--ink);font-weight:600;font-size:15px;padding:16px 24px;border-radius:14px;box-shadow:var(--shadow)}.cta-note{margin:18px 0 0;font-size:13px;color:var(--faint)}.collage{padding:34px 0 10px}.collage-grid{display:grid;gap:12px}.collage-grid img{width:100%;height:100%;object-fit:cover;border-radius:var(--r);background:var(--bg2)}.cg-5{grid-template-columns:1.6fr 1fr 1fr;grid-template-rows:190px 190px}.cg-5 img:first-child{grid-row:span 2}.cg-4{grid-template-columns:1fr 1fr;grid-template-rows:180px 180px}.cg-3{grid-template-columns:1.6fr 1fr;grid-template-rows:150px 150px}.cg-3 img:first-child{grid-row:span 2}.cg-2{grid-template-columns:1fr 1fr;grid-template-rows:240px}.cg-1{grid-template-columns:1fr;grid-template-rows:300px}.stats{padding:26px 0 8px}.stats-row{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.stats-row.n2{grid-template-columns:repeat(2,1fr)}.stats-row.n1{grid-template-columns:1fr}.stat{background:var(--bg2);border:1px solid var(--line);border-radius:var(--r);padding:22px 24px;text-align:center}.stat .n{font-family:var(--display);font-weight:800;font-size:26px;letter-spacing:-.02em}.stat .l{font-size:13px;color:var(--muted);margin-top:4px}section{padding:52px 0}.sec-head{text-align:center;margin-bottom:34px}.sec-eyebrow{display:inline-block;font-size:12px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--faint);margin:0 0 10px}.sec-title{font-family:var(--display);font-weight:700;font-size:clamp(24px,3.6vw,34px);letter-spacing:-.02em;margin:0}.about-text{font-size:15.5px;line-height:1.7;color:var(--muted);max-width:68ch;margin:0 auto;text-align:center}.chips{display:flex;flex-wrap:wrap;gap:10px;justify-content:center}.chips span{background:var(--card);border:1px solid var(--line);border-radius:999px;padding:10px 20px;font-size:14px;font-weight:500;color:var(--muted);box-shadow:var(--shadow)}.rev-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}.rev{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:24px;box-shadow:var(--shadow)}.rev-head{display:flex;align-items:center;gap:12px;margin-bottom:14px}.avatar{width:40px;height:40px;border-radius:999px;background:var(--go-soft);color:var(--go);display:grid;place-items:center;font-weight:700;font-size:15px;flex-shrink:0}.rev-author{font-weight:600;font-size:14.5px}.rev-time{font-size:12.5px;color:var(--faint)}.rev-stars{margin-left:auto;color:var(--gold);font-size:12px;letter-spacing:2px}.rev-text{font-size:14.5px;color:var(--muted);margin:0;line-height:1.65}.rev-cta{text-align:center;margin-top:26px}.rev-more{font-size:14px;font-weight:600;color:var(--ink);text-decoration:none;border-bottom:1.5px solid var(--line);padding-bottom:2px}.info-grid{display:grid;grid-template-columns:1fr 1.2fr;gap:14px;align-items:stretch}.info-card{background:var(--card);border:1px solid var(--line);border-radius:var(--r-lg);padding:28px;box-shadow:var(--shadow)}.info-card h3{font-family:var(--display);font-weight:700;font-size:18px;margin:0 0 18px}.hours{width:100%;border-collapse:collapse;font-size:14.5px}.hours td{padding:9px 0;border-bottom:1px solid var(--line)}.hours tr:last-child td{border-bottom:0}.hours td:last-child{text-align:right;color:var(--muted);font-variant-numeric:tabular-nums}.hours .today td{font-weight:600}.hours .today td:last-child{color:var(--go)}.map-card{padding:0;overflow:hidden;display:flex;flex-direction:column}.map-embed{width:100%;flex:1;min-height:260px;border:0;background:var(--bg2)}.addr{padding:18px 24px;font-size:14px;color:var(--muted);display:flex;align-items:center;justify-content:space-between;gap:12px}.addr a{font-weight:600;color:var(--ink);text-decoration:none;white-space:nowrap}.band{background:var(--ink);border-radius:var(--r-lg);padding:56px 32px;text-align:center;color:#fff;margin:20px 0 56px}.band h2{font-family:var(--display);font-weight:800;font-size:clamp(26px,4vw,38px);letter-spacing:-.02em;margin:0 0 12px}.band p{color:rgba(255,255,255,.65);margin:0 0 28px;font-size:16px}.band .cta-main{background:#fff;color:var(--ink);box-shadow:none}footer{padding:0 0 55px}.fine{font-size:12.5px;color:var(--faint);text-align:center}.callbar{position:fixed;left:0;right:0;bottom:0;z-index:40;background:rgba(255,255,255,.92);backdrop-filter:blur(12px);border-top:1px solid var(--line);padding:12px 18px calc(12px + env(safe-area-inset-bottom));display:none}.callbar a{display:flex;align-items:center;justify-content:center;gap:10px;background:var(--ink);color:#fff;font-family:var(--display);font-weight:700;font-size:16px;padding:15px;border-radius:14px;text-decoration:none}.askm{position:fixed;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;padding:20px}.askm[hidden]{display:none}.askm-backdrop{position:absolute;inset:0;background:rgba(11,12,14,.5)}.askm-card{position:relative;background:var(--card);color:var(--ink);border-radius:var(--r);max-width:380px;width:100%;padding:28px 24px;box-shadow:0 20px 60px rgba(11,12,14,.3)}.askm-x{position:absolute;top:10px;right:14px;background:none;border:0;font-size:26px;line-height:1;color:var(--faint);cursor:pointer}.askm-title{font-family:var(--display);font-weight:700;font-size:20px;letter-spacing:-.01em;margin:0 0 8px}.askm-sub{font-size:14px;color:var(--muted);margin:0 0 20px}.askm-btn{display:inline-flex;align-items:center;justify-content:center;width:100%;font-family:var(--body);font-weight:600;font-size:15px;padding:14px 16px;border-radius:12px;border:0;cursor:pointer}.askm-btn-primary{background:var(--ink);color:#fff}.askm-choices{display:flex;flex-direction:column;gap:10px}.askm-choice{background:#fff;color:var(--ink);border:1px solid var(--line);box-shadow:var(--shadow)}.askm-form{display:flex;flex-direction:column;gap:12px}.askm-input{width:100%;font-family:var(--body);font-size:16px;padding:12px 14px;border:1px solid var(--line);border-radius:10px;background:#fff;color:var(--ink)}.askm-input:focus{outline:2px solid var(--ink);outline-offset:1px}.askm-consent{font-size:11px;color:var(--faint);line-height:1.4;margin:0}@media(max-width:760px){.cg-5{grid-template-columns:1.4fr 1fr;grid-template-rows:150px 150px}.cg-5 img:nth-child(n+4){display:none}.stats-row,.stats-row.n2{grid-template-columns:1fr;gap:10px}.stat{display:flex;align-items:baseline;justify-content:space-between;text-align:left;padding:16px 20px}.stat .n{font-size:22px}.rev-grid,.info-grid{grid-template-columns:1fr}.callbar{display:block}.topbar .btn-primary{display:none}footer{padding-bottom:110px}section{padding:42px 0}}`;

  const hoursRows = (d.hours||[]).map(line => {
    const ci = line.indexOf(':');
    const day  = ci > -1 ? line.slice(0,ci).trim() : line;
    const time = ci > -1 ? line.slice(ci+1).trim() : '';
    return `<tr class="${day===today?'today':''}"><td>${esc(day)}</td><td>${esc(time)}</td></tr>`;
  }).join('');

  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${esc(d.name)}${d.category?` · ${clean(d.category)}`:''}</title>
${d.tagline?`<meta name="description" content="${clean(d.tagline)}">`:``}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Sora:wght@500;600;700;800&display=swap" rel="stylesheet">
<style>${CSS}</style></head><body>

<div class="topbar"><div class="topbar-inner">
  <span class="brand"><span class="brand-mark${d.logo_url ? ' has-logo' : ''}"><span class="bm-i">${esc(initial)}</span>${d.logo_url ? `<img src="${esc(d.logo_url)}" alt="" onerror="this.parentElement.classList.remove('has-logo');this.remove()">` : ''}</span><span class="brand-name">${esc(d.name)}</span></span>
  <div class="topbar-actions">
    ${d.maps_url?`<a class="btn btn-ghost" href="#location">Directions</a>`:''}
    ${href?`<a class="btn btn-primary" href="${href}">Call ${esc(phone)}</a>`:''}
  </div>
</div></div>

<header class="hero"><div class="wrap">
  ${(d.rating||d.open_now!=null)?`<div class="rating-pill">
    ${d.rating?`<span class="stars">${starsStr(d.rating)}</span><span><b>${Number(d.rating).toFixed(1)}</b> · ${d.review_count||0} Google reviews</span>`:''}
    ${(d.rating&&d.open_now!=null)?`<span class="sep"></span>`:''}
    ${d.open_now!=null?`<span class="open${d.open_now?'':' closed'}">${d.open_now?'Open now':'Closed now'}</span>`:''}
  </div>`:''}
  <h1>${headline}</h1>
  ${sub?`<p class="sub">${sub}</p>`:''}
  <div class="cta-row">
    ${href?`<a class="btn cta-main" href="${href}">${phoneSvg(19)} Call ${esc(phone)}</a>`:''}
    ${href?`<button type="button" class="btn cta-sec js-ask-open">Send a question</button>`:d.maps_url?`<a class="btn cta-sec" href="#location">Get directions</a>`:''}
  </div>
  ${d.offer_guarantee?`<p class="cta-note">✓ ${clean(d.offer_guarantee)}</p>`:''}
</div></header>

${photos.length?`<div class="collage"><div class="wrap"><div class="collage-grid cg-${photos.length}">${photos.map((p,i)=>`<img src="${esc(p)}" alt="${esc(d.name)} photo ${i+1}" loading="lazy" onerror="this.style.display='none'">`).join('')}</div></div></div>`:''}

${stats.length?`<div class="stats"><div class="wrap"><div class="stats-row n${stats.length}">${stats.map(s=>`<div class="stat"><div class="n">${s.n}</div><div class="l">${s.l}</div></div>`).join('')}</div></div></div>`:''}

${(revs.length||d.rating)?`<section><div class="wrap">
  <div class="sec-head"><p class="sec-eyebrow">Reviews</p><h2 class="sec-title">What neighbors say</h2></div>
  ${revs.length?`<div class="rev-grid">${revs.map(r=>`<div class="rev"><div class="rev-head"><span class="avatar">${esc((r.author||'G').trim().charAt(0).toUpperCase())}</span><div><div class="rev-author">${esc(r.author||'Google user')}</div>${r.relative_time?`<div class="rev-time">${esc(r.relative_time)}</div>`:''}</div>${r.rating!=null?`<span class="rev-stars">${starsStr(r.rating)}</span>`:''}</div><p class="rev-text">"${clean(r.text)}"</p></div>`).join('')}</div>`:''}
  ${d.maps_url?`<div class="rev-cta"><a class="rev-more" href="${esc(d.maps_url)}" target="_blank" rel="noopener">See all ${d.review_count||''} reviews on Google →</a></div>`:''}
</div></section>`:''}

${(d.about_summary||d.site_summary)?`<section style="padding-top:0"><div class="wrap">
  <div class="sec-head"><p class="sec-eyebrow">About</p><h2 class="sec-title">Get to know ${esc(first)}</h2></div>
  <p class="about-text">${clean(d.about_summary||d.site_summary)}</p>
</div></section>`:''}

${(d.services||[]).length?`<section style="padding-top:0"><div class="wrap">
  <div class="sec-head"><p class="sec-eyebrow">Services</p><h2 class="sec-title">What we do</h2></div>
  <div class="chips">${(d.services||[]).map(s=>`<span>${clean(s)}</span>`).join('')}</div>
</div></section>`:''}

${(hoursRows||d.address)?`<section id="location" style="padding-top:0"><div class="wrap">
  <div class="sec-head"><p class="sec-eyebrow">Visit</p><h2 class="sec-title">Hours &amp; location</h2></div>
  <div class="info-grid"${!(hoursRows&&d.address)?' style="grid-template-columns:1fr"':''}>
    ${hoursRows?`<div class="info-card"><h3>Hours</h3><table class="hours">${hoursRows}</table></div>`:''}
    ${d.address?`<div class="info-card map-card"><iframe class="map-embed" src="https://maps.google.com/maps?q=${encodeURIComponent(`${d.name||''}, ${mapAddr}`)}&z=14&output=embed" loading="lazy" title="Map to ${esc(d.name)}" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe><div class="addr"><span>${esc(mapAddr)}</span>${d.maps_url?`<a href="${esc(d.maps_url)}" target="_blank" rel="noopener">Directions →</a>`:''}</div></div>`:''}
  </div>
</div></section>`:''}

${(d.service_areas||[]).length?`<section style="padding-top:0"><div class="wrap">
  <div class="sec-head"><p class="sec-eyebrow">Coverage</p><h2 class="sec-title">Areas we service</h2></div>
  <div class="chips">${(d.service_areas||[]).map(a=>`<span>${clean(a)}</span>`).join('')}</div>
</div></section>`:''}

${href?`<div class="wrap"><div class="band">
  <h2>Call for quick assistance</h2>
  <p>${esc(d.name)} is ready to help.</p>
  <a class="btn cta-main" href="${href}">${phoneSvg(19)} Call ${esc(phone)}</a>
</div></div>`:''}

<footer><div class="wrap"><p class="fine">${esc(d.name)}</p></div></footer>

${href?`<div class="callbar"><a href="${href}">${phoneSvg(16)} Call ${esc(phone)}</a></div>`:''}

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

/* ─── thank-you page config ─────────────────────────────────────────
   VSL_EMBED_URL: paste a YouTube/Vimeo/Loom embed URL once the video is
   recorded (e.g. https://www.youtube.com/embed/XXXX). Until then the page
   shows a written launch guide in its place.
   BOOKING_URL: your $100 setup-call booking link (Calendly etc.). The
   booking section hides itself while this is empty. */
const VSL_EMBED_URL = "";
const BOOKING_URL = "";

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

async function generateAngles(payload) {
  return apiPost('/api/generate-angles', payload);
}

async function generateAngleAds(payload) {
  return apiPost('/api/generate-angle-ads', payload);
}

async function generateGoogleAdsCopy(payload) {
  return apiPost('/api/generate-google-ads', payload);
}

/* ─── built-step trace rows shown while the lander is assembled. Row 0
   mirrors the angle-research trace's first line and starts pre-completed,
   so the two loading screens read as one continuous checklist. ───────── */
const BUILD_ROWS = [
  'Finding best ad angles',
  'Writing your headline from the chosen angle',
  'Assembling photos, reviews & hours',
  'Polishing the design',
];

/* ─── app styles (injected once) ────────────────────────────────────── */
const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&family=Plus+Jakarta+Sans:wght@700&display=swap');
*{box-sizing:border-box}
body{margin:0;padding:0;font-family:'Instrument Sans',system-ui,sans-serif}
.lb-input{width:100%;height:48px;border:1.5px solid rgba(13,87,208,.45);border-radius:8px;padding:0 14px;font-size:15px;font-family:inherit;background:var(--surface-2);color:var(--text-primary);outline:none;transition:border-color .15s,box-shadow .15s;box-shadow:0 0 0 3px rgba(13,87,208,.10)}
.lb-input:focus{border-color:#0D57D0;box-shadow:0 0 0 3px rgba(13,87,208,.22)}
.lb-input::placeholder{color:var(--text-muted)}
.lb-btn-signal{background:#0D57D0;color:#fff;border:none;border-radius:10px;padding:0 20px;height:48px;font-size:15px;font-weight:600;font-family:inherit;cursor:pointer;white-space:nowrap;transition:background .15s,transform .15s;flex-shrink:0;box-shadow:0 6px 16px -4px rgba(13,87,208,.6)}
.lb-btn-signal:hover{background:#0A46A8;transform:translateY(-1px)}
.lb-btn-signal:disabled{opacity:.5;cursor:not-allowed}
.lb-btn-ghost{background:transparent;border:1px solid var(--border);border-radius:7px;padding:7px 14px;font-size:12px;color:var(--text-secondary);font-family:'IBM Plex Mono',monospace;letter-spacing:.02em;cursor:pointer;white-space:nowrap;transition:all .15s}
.lb-btn-ghost:hover{background:var(--surface-1);color:var(--text-primary)}
.lb-btn-ghost.active{background:#0D57D0;color:#fff;border-color:#0D57D0}
.lb-btn-dark{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.12);border-radius:7px;padding:7px 14px;font-size:12px;color:#C7CDD2;font-family:'IBM Plex Mono',monospace;letter-spacing:.02em;cursor:pointer;white-space:nowrap;transition:all .15s}
.lb-btn-dark:hover{background:rgba(255,255,255,.18);color:#fff}
.lb-pill{cursor:pointer;background:var(--surface-2);border:1px solid var(--border);border-radius:999px;padding:6px 14px;font-size:13px;color:var(--text-secondary);transition:all .15s;font-family:inherit}
.lb-pill:hover{border-color:#0D57D0;color:#0D57D0;background:#F0F5FE}
.lb-card{background:var(--surface-2);border:0.5px solid var(--border);border-radius:12px;padding:16px 18px;display:flex;align-items:center;justify-content:space-between;gap:16px;cursor:pointer;transition:box-shadow .15s,border-color .15s}
.lb-card:hover{box-shadow:0 4px 20px rgba(0,0,0,.08);border-color:var(--border-strong)}
.lb-back{background:none;border:none;color:var(--text-secondary);font-size:14px;cursor:pointer;display:flex;align-items:center;gap:6px;padding:0;font-family:inherit;transition:color .15s}
.lb-back:hover{color:var(--text-primary)}
.lb-error{background:#FFF2EE;border:1.5px solid #FF5A1F;border-radius:8px;padding:14px 16px;color:#C0391A;font-size:14px;font-weight:500}
@keyframes lb-spin{to{transform:rotate(360deg)}}
.lb-spinner{width:44px;height:44px;border-radius:50%;border:4px solid #E7EEFB;border-top-color:#0D57D0;animation:lb-spin .8s linear infinite}
@media (prefers-reduced-motion:reduce){.lb-spinner{animation-duration:1.6s}}
@keyframes lb-trace-in{to{opacity:1;transform:none}}
.lb-trace{display:flex;flex-direction:column;gap:4px;width:100%;max-width:380px}
.lb-trace-row{display:flex;align-items:center;gap:12px;padding:11px 14px;border-radius:10px;opacity:0;transform:translateY(6px);animation:lb-trace-in .35s ease forwards}
.lb-trace-row.active{background:#E7EEFB}
.lb-trace-icon{width:20px;height:20px;flex:none;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;color:#fff}
.lb-trace-icon.spin{border:2.5px solid #E7EEFB;border-top-color:#0D57D0;animation:lb-spin .7s linear infinite}
.lb-trace-icon.done{background:#0E8A5F}
.lb-trace-text{font-size:14px;color:#5C544C}
.lb-trace-row.active .lb-trace-text{color:#181310;font-weight:600}
.lb-trace-row.done .lb-trace-text{color:#8A8178}
@media (prefers-reduced-motion:reduce){.lb-trace-row{animation:none;opacity:1;transform:none}}
`;

/* ─── main-service placeholder examples ─────────────────────────────
   Curated call-getting services per trade, matched against the searched
   business's category + services. Falls back to the business's own
   services list, then to a generic pair. */
const SERVICE_EXAMPLES = [
  [['plumb', 'drain', 'sewer', 'rooter'], ['water heater replacement', 'drain cleaning']],
  [['hvac', 'heating', 'cooling', 'air condition', 'furnace'], ['AC repair', 'furnace replacement']],
  [['electric', 'wiring'], ['panel upgrades', 'EV charger installation']],
  [['roof', 'gutter', 'shingle'], ['roof repair', 'storm damage inspections']],
  [['pest', 'exterminat', 'termite'], ['termite treatment', 'rodent removal']],
  [['tree', 'arborist', 'stump'], ['tree removal', 'storm cleanup']],
  [['garage door'], ['spring replacement', 'new garage doors']],
  [['auto', 'mechanic', 'brake', 'transmission', 'tire'], ['brake service', 'transmission repair']],
  [['dental', 'dentist', 'orthodont'], ['new patient exams', 'teeth whitening']],
  [['landscap', 'lawn', 'irrigation'], ['lawn care', 'irrigation repair']],
  [['clean', 'maid', 'janitorial'], ['deep cleaning', 'move-out cleaning']],
  [['paint'], ['exterior painting', 'cabinet refinishing']],
  [['lock', 'locksmith'], ['lockouts', 'lock rekeying']],
];

function serviceExamples(profile) {
  const hay = `${profile?.category || ''} ${(profile?.services || []).join(' ')}`.toLowerCase();
  for (const [keys, examples] of SERVICE_EXAMPLES) {
    if (keys.some(k => hay.includes(k))) return examples;
  }
  const own = (profile?.services || []).filter(s => s && s.length >= 4 && s.length <= 30).slice(0, 2);
  if (own.length === 2) return own;
  return ['water heater replacement', 'roof repair'];
}

/* ─── Ads tab: lander photo + AI copy → downloadable ad graphic ─────── */
const AD_SIZE = 1080; // square, works on Facebook/Instagram feed and Google display

export const slugify = s => (String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')) || 'lander';

// The Google Search ads deliverable: a plain-text file the owner pastes into
// a Responsive Search Ad. Kept deliberately simple so it opens anywhere.
function buildGoogleAdsText(biz, g) {
  const head = g.headlines.map((h, i) => `${i + 1}. ${h}`).join('\n');
  const desc = g.descriptions.map((d, i) => `${i + 1}. ${d}`).join('\n');
  return `GOOGLE SEARCH ADS: ${biz?.name || 'your business'}

How to use: in Google Ads, create a Search campaign, add a Responsive Search
Ad, and paste these in. Turn on call assets so the ad can ring your phone
directly.

HEADLINES (Google mixes and matches these, 30 characters max each)
${head}

DESCRIPTIONS (Google shows up to 2 at a time, 90 characters max each)
${desc}
`;
}

// Google OAuth navigates the whole app away; the in-progress lander + ads are
// stashed under this key so the redirect back can rebuild the screen.
const PENDING_KEY = 'lb-pending-save';
// Set when the homepage "Sign In" button starts OAuth with nothing to save --
// tells the redirect back to open the dashboard instead of the homepage.
const SIGNIN_KEY = 'lb-signin-intent';

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

const MAX_ADS = 5; // photos on the lander collage = ads in the campaign kit

function AdsTab({ landers, canvasesRef, initialAds, onAdsState, onAllDrawn, onDownload }) {
  const [lander, setLander] = useState(null);
  const [angle, setAngle] = useState('offer'); // 'offer' | 'dont_delay' ad angle for AI copy (legacy landers without a chosen angle)
  const [photoUrls, setPhotoUrls] = useState(initialAds?.photoUrls || []); // up to MAX_ADS, in click order
  const [imgs, setImgs] = useState({});           // url -> loaded HTMLImageElement
  const [copy, setCopy] = useState(initialAds?.copy || { headline: '', subline: '', cta: '', primary_text: '' });
  const [variations, setVariations] = useState(initialAds?.variations || []); // per-ad copy, angle mode only
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(-1); // index of the variation whose primary text was just copied (-2 = legacy single copy)
  // Angle-mode wizard: photos → building (scripted trace while everything
  // generates) → ads + the create-account modal. A post-OAuth restore with
  // any photo selection drops straight back onto the finished-ads screen.
  const [stage, setStage] = useState((initialAds?.photoUrls?.length || 0) > 0 ? 'ads' : 'photos');
  const [googleAds, setGoogleAds] = useState(initialAds?.googleAds || null); // {headlines, descriptions} once generated
  const [varFailed, setVarFailed] = useState(false); // variations call failed -- proceed on prefill copy
  const [buildStep, setBuildStep] = useState(0);     // active row in the building trace
  const [minWaitDone, setMinWaitDone] = useState(false); // trace has played through once
  const [forceFinish, setForceFinish] = useState(false); // 30s failsafe -- never trap the user in the loader
  const autoGenRef = useRef(false); // variations auto-generation already kicked off for this lander
  const googleGenRef = useRef(!!initialAds?.googleAds); // google-ads generation already kicked off
  const autoAppliedRef = useRef(!!initialAds); // restored state keeps its stashed copy choice
  const buildTimersRef = useRef([]);
  const finishedRef = useRef(false);

  const profile = lander?.profile || null;
  const photos = profile?.photos || [];
  const angleMeta = profile?.chosen_angle || null; // set by the angle-picker flow
  const allLoaded = photoUrls.length > 0 && photoUrls.every(u => imgs[u]);

  const eyebrow = { fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: '0 0 10px' };

  // Coming from "Step 2: Create Ads" there's exactly one lander -- skip the
  // redundant click and drop the user straight into photo picking. When
  // state was restored after the OAuth redirect, keep the stashed photo
  // selection + copy instead of pickLander's prefill.
  useEffect(() => {
    if (landers.length === 1 && !lander) {
      if (initialAds) setLander(landers[0]);
      else pickLander(landers[0]);
    }
  }, [landers]); // eslint-disable-line react-hooks/exhaustive-deps

  // Let the parent stash the current selection before the OAuth redirect.
  useEffect(() => {
    onAdsState?.({ photoUrls, copy, variations, googleAds });
  }, [photoUrls, copy, variations, googleAds]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear any in-flight build timers if the tab unmounts mid-trace.
  useEffect(() => () => buildTimersRef.current.forEach(clearTimeout), []);

  function pickLander(l) {
    const p = l.profile || {};
    setLander(l); setError('');
    setVariations([]);
    autoGenRef.current = false; // new lander -- allow a fresh auto-generation
    // Angle mode runs the picker wizard -- the owner chooses the photos
    // themselves, so always start with none selected.
    setPhotoUrls([]);
    setStage('photos');
    setGoogleAds(null);
    googleGenRef.current = false;
    autoAppliedRef.current = false;
    setVarFailed(false);
    // Prefill from the lander's own offer so there's a usable ad before the
    // AI call -- generation then just tightens what's already here.
    setCopy({
      headline: p.offer_headline || p.tagline || l.name || '',
      subline: p.offer_subhead || (p.rating ? `Rated ${Number(p.rating).toFixed(1)}★ by ${p.review_count || 0} customers on Google` : ''),
      cta: p.chosen_angle?.cta_label || 'Call Today',
      primary_text: '',
    });
  }

  // Angle mode: auto-generate the 4 ad variations as soon as the lander is
  // picked (unless they were restored from the pre-OAuth stash).
  useEffect(() => {
    if (!profile || !angleMeta) return;
    // Google ads copy doesn't depend on which photos get picked, so it runs
    // while the owner is still browsing -- by the time they finish picking,
    // both AI calls are usually done and the build trace only has to cover
    // the photo renders. (Self-guarded: no-op if already started/restored.)
    generateGoogleAdsOnce();
    if (variations.length || autoGenRef.current) return;
    autoGenRef.current = true;
    handleGenerateVariations();
  }, [profile]); // eslint-disable-line react-hooks/exhaustive-deps

  // The owner already picked their photos during the funnel (they shape the
  // lander collage) -- reuse them here and jump straight into the
  // campaign-kit build instead of asking again.
  useEffect(() => {
    if (!profile || !angleMeta || stage !== 'photos' || photoUrls.length) return;
    const pre = (profile.lander_photos || []).filter(u => photos.includes(u)).slice(0, MAX_ADS);
    if (!pre.length) return;
    setPhotoUrls(pre);
    startBuild(pre);
  }, [profile]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleGenerateVariations() {
    if (!profile?.chosen_angle) return;
    setBusy(true); setError(''); setVarFailed(false);
    try {
      const res = await generateAngleAds({
        name: profile.name || lander?.name || '',
        category: profile.category || '',
        services: profile.services || [],
        service_areas: profile.service_areas || [],
        rating: profile.rating,
        review_count: profile.review_count,
        summary: profile.site_summary || profile.about_summary || null,
        main_service: profile.main_service || '',
        angle: profile.chosen_angle,
      });
      const list = (Array.isArray(res.variations) ? res.variations : [])
        .filter(v => v && v.headline).slice(0, MAX_ADS);
      if (!list.length) throw new Error('Could not write the ad variations. Hit Regenerate to retry.');
      setVariations(list);
    } catch (err) {
      setError(err.message);
      setVarFailed(true); // the build proceeds on the prefilled offer copy
    } finally {
      setBusy(false);
    }
  }

  function togglePhoto(url) {
    setError('');
    const next = photoUrls.includes(url)
      ? photoUrls.filter(u => u !== url)
      : photoUrls.length >= MAX_ADS ? photoUrls : [...photoUrls, url];
    setPhotoUrls(next);
    // Wizard: the final pick kicks off the build straight away.
    if (angleMeta && next.length === MAX_ADS) startBuild(next);
  }

  // The owner no longer hand-picks headlines -- the first AI variation (plus
  // the first non-empty supporting line) becomes the ad copy automatically.
  useEffect(() => {
    if (!angleMeta || !variations.length || autoAppliedRef.current) return;
    autoAppliedRef.current = true;
    const v = variations[0] || {};
    const withSub = variations.find(x => (x.subline || '').trim()) || v;
    setCopy(c => ({
      headline: v.headline || c.headline,
      subline: (withSub.subline || '').trim() ? withSub.subline : c.subline,
      cta: v.cta || c.cta,
      primary_text: v.primary_text || c.primary_text,
    }));
  }, [variations, angleMeta]); // eslint-disable-line react-hooks/exhaustive-deps

  async function generateGoogleAdsOnce() {
    if (googleGenRef.current || !profile?.chosen_angle) return;
    googleGenRef.current = true;
    try {
      const res = await generateGoogleAdsCopy({
        name: profile.name || lander?.name || '',
        category: profile.category || '',
        services: profile.services || [],
        service_areas: profile.service_areas || [],
        rating: profile.rating,
        review_count: profile.review_count,
        summary: profile.site_summary || profile.about_summary || null,
        main_service: profile.main_service || '',
        angle: profile.chosen_angle,
      });
      setGoogleAds({ headlines: res.headlines || [], descriptions: res.descriptions || [] });
    } catch {
      // Never block the funnel on this file -- the download just won't
      // include the Google ads text.
      setGoogleAds({ headlines: [], descriptions: [] });
    }
  }

  const BUILD_STEPS = [
    `Writing ad copy for "${profile?.main_service || profile?.category || 'your service'}"`,
    'Creating your Meta ads',
    'Creating your Google ads',
    'Finalizing your campaign kit',
  ];

  function startBuild(urls) {
    if (stage === 'building' || !(urls?.length || photoUrls.length)) return;
    setError('');
    setStage('building');
    setBuildStep(0);
    setMinWaitDone(false);
    setForceFinish(false);
    finishedRef.current = false;
    buildTimersRef.current.forEach(clearTimeout);
    const timers = [];
    // Scripted trace: one row every ~1.2s, then the gate opens once the real
    // work (copy + google ads + photo loads) has also finished. Both AI
    // calls start back at the photo picker, so ~4.8s of trace usually covers
    // whatever's left.
    BUILD_STEPS.forEach((_, i) => { if (i > 0) timers.push(setTimeout(() => setBuildStep(i), i * 1200)); });
    timers.push(setTimeout(() => setMinWaitDone(true), BUILD_STEPS.length * 1200));
    timers.push(setTimeout(() => setForceFinish(true), 30000)); // failsafe: never trap the user here
    buildTimersRef.current = timers;
    generateGoogleAdsOnce();
    // Retry if the auto-gen failed earlier. The autoGenRef guard matters when
    // startBuild fires in the same commit as the auto-gen effect (pre-picked
    // photos): `busy` hasn't updated yet, so without it this double-calls.
    if (!variations.length && !busy && (varFailed || !autoGenRef.current)) {
      autoGenRef.current = true;
      handleGenerateVariations();
    }
  }

  // The gate: trace played through AND copy settled AND google ads settled
  // AND every chosen photo loaded -- then show the ads and pop the
  // create-account modal (onDownload → handleStep3).
  useEffect(() => {
    if (stage !== 'building' || finishedRef.current) return;
    const copySettled = variations.length > 0 || varFailed;
    const googleSettled = googleAds !== null;
    const ready = copySettled && googleSettled && allLoaded;
    if (!minWaitDone || (!ready && !forceFinish)) return;
    finishedRef.current = true;
    buildTimersRef.current.forEach(clearTimeout);
    setStage('ads');
    onDownload?.();
  }, [stage, variations, varFailed, googleAds, allLoaded, minWaitDone, forceFinish]); // eslint-disable-line react-hooks/exhaustive-deps

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
      // Every selected photo rendered onto a MOUNTED canvas -- downloads
      // queued behind the OAuth redirect can fire now. The canvas check
      // matters: during the 'building' stage the grid isn't mounted, and
      // reporting "drawn" then would let the capture path export blanks.
      if (photoUrls.length && photoUrls.every((u, i) => imgs[u] && canvasesRef.current[i])) onAllDrawn?.();
    })();
    return () => { cancelled = true; };
    // `stage` is a dep so the flip building → ads (which mounts the
    // canvases) re-runs the draw -- by then copy/imgs have settled and
    // nothing else would trigger it.
  }, [photoUrls, imgs, copy, variations, profile, canvasesRef, stage]); // eslint-disable-line react-hooks/exhaustive-deps

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
        angle,
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

  async function copyPrimaryText(text, which) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(-1), 1600);
    } catch { /* clipboard unavailable -- the text is visible to copy by hand */ }
  }

  if (!landers.length) return (
    <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Save a lander first. Ads are built from a lander's photos and offer.</p>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {stage !== 'building' && (
      <div>
        <p style={eyebrow}>Lander</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {landers.map(l => (
            <button key={l.id} className={`lb-btn-ghost${lander?.id === l.id ? ' active' : ''}`} onClick={() => pickLander(l)}>{l.name}</button>
          ))}
        </div>
      </div>
      )}

      {lander && angleMeta && stage !== 'building' && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['Photos', 'Your ads'].map((label, i) => {
            const idx = ['photos', 'ads'].indexOf(stage);
            const st = i < idx ? 'done' : i === idx ? 'active' : 'todo';
            return (
              <span key={label} style={{
                fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase',
                borderRadius: 999, padding: '6px 14px', fontWeight: 600,
                background: st === 'active' ? '#0D57D0' : st === 'done' ? '#E7EEFB' : 'var(--surface-2)',
                color: st === 'active' ? '#fff' : st === 'done' ? '#0D57D0' : 'var(--text-muted)',
                border: st === 'todo' ? '1px solid var(--border)' : '1px solid transparent',
              }}>{st === 'done' ? '✓' : i + 1} · {label}</span>
            );
          })}
        </div>
      )}

      {lander && (!angleMeta || stage === 'photos') && (
        <div>
          <p style={eyebrow}>{angleMeta ? `Pick ${MAX_ADS} photos for your ${profile?.main_service || 'service'} ads · ${photoUrls.length} of ${MAX_ADS} selected` : `Photos: pick up to ${MAX_ADS}`}</p>
          {photos.length === 0
            ? <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0 }}>This lander has no photos to build ads from.</p>
            : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(110px,1fr))', gap: 8 }}>
                {photos.map((p, i) => {
                  const idx = photoUrls.indexOf(p);
                  return (
                    <button key={p} onClick={() => togglePhoto(p)} style={{
                      position: 'relative', padding: 0, border: idx > -1 ? '3px solid #0D57D0' : '3px solid transparent',
                      borderRadius: 10, overflow: 'hidden', cursor: 'pointer', background: 'var(--surface-1)',
                      aspectRatio: '1',
                    }}>
                      <img src={p} alt={`Photo ${i + 1}`} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      {idx > -1 && (
                        <span style={{
                          position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: '50%',
                          background: '#0D57D0', color: '#fff', fontSize: 12, fontWeight: 700,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>{idx + 1}</span>
                      )}
                    </button>
                  );
                })}
              </div>}
          {angleMeta && photoUrls.length > 0 && photoUrls.length < MAX_ADS && (
            <button className="lb-btn-signal" style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 8 }} onClick={() => startBuild()}>
              Create my ads with {photoUrls.length} photo{photoUrls.length === 1 ? '' : 's'} <i className="ti ti-arrow-right" aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      {lander && angleMeta && stage === 'building' && (
        <div style={{ minHeight: 340, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 30, padding: '40px 0' }}>
          <p style={{ fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif", fontWeight: 700, fontSize: 20, letterSpacing: '-.01em', color: 'var(--text-primary)', margin: 0, textAlign: 'center' }}>
            Building your campaign kit
          </p>
          <div className="lb-trace">
            {BUILD_STEPS.map((s, i) => i > buildStep ? null : (
              <div key={s} className={`lb-trace-row${i === buildStep ? ' active' : ' done'}`}>
                <span className={`lb-trace-icon ${i === buildStep ? 'spin' : 'done'}`} aria-hidden="true">
                  {i < buildStep && <i className="ti ti-check" style={{ fontSize: 12 }} />}
                </span>
                <span className="lb-trace-text">{s}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {lander && photoUrls.length > 0 && !angleMeta && (
        <div>
          <p style={eyebrow}>Copy</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Angle</span>
              {[['offer', 'Our offer'], ['dont_delay', "Don't delay"]].map(([val, label]) => (
                <button key={val} className={`lb-btn-ghost${angle === val ? ' active' : ''}`} onClick={() => setAngle(val)} title={val === 'dont_delay' ? 'Name a problem people ignore, show what it becomes, position you as the fast fix' : "Sell the landing page's offer"}>
                  {label}
                </button>
              ))}
            </div>
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

      {lander && photoUrls.length > 0 && (!angleMeta || stage === 'ads') && (
        <div>
          {angleMeta && (
            <button className="lb-back" style={{ marginBottom: 16 }} onClick={() => setStage('photos')}>
              <i className="ti ti-arrow-left" aria-hidden="true" /> Change photos
            </button>
          )}
          <p style={eyebrow}>{angleMeta ? (allLoaded ? `Your ${photoUrls.length} ads` : `Generating your ${photoUrls.length} ads…`) : `Your ads (${photoUrls.length})`}</p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {photoUrls.map((url, i) => (
              <div key={url} style={{ flex: '1 1 220px', maxWidth: 340 }}>
                {!imgs[url] && <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: '0 0 6px' }}>Generating ad…</p>}
                <canvas ref={el => { canvasesRef.current[i] = el; }} width={AD_SIZE} height={AD_SIZE}
                  style={{ width: '100%', borderRadius: 12, border: '0.5px solid var(--border)', display: imgs[url] ? 'block' : 'none' }} />
              </div>
            ))}
          </div>
          {(copy.primary_text || '').trim() && (
            <div style={{ marginTop: 16, maxWidth: 560 }}>
              <p style={eyebrow}>Primary text (paste next to the image in your ad)</p>
              <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.55, margin: '0 0 8px' }}>{copy.primary_text}</p>
              <button className="lb-btn-ghost" onClick={() => copyPrimaryText(copy.primary_text, -2)}>{copied === -2 ? 'Copied!' : 'Copy primary text'}</button>
            </div>
          )}
          {angleMeta ? (
            <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
              <button className="lb-btn-signal" onClick={onDownload} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                Download my lander &amp; ads <i className="ti ti-download" aria-hidden="true" />
              </button>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>
                Comes with instructions for putting them live yourself. No agency required.
              </p>
            </div>
          ) : (
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 14 }}>
              Happy with them? Hit <b>Step 3: Download Lander &amp; Ads</b> up top to get the files.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── main app ──────────────────────────────────────────────────────── */
export default function App() {
  const [step,       setStep]       = useState('search');
  const [query,      setQuery]      = useState('');
  const [loadSteps,  setLoadSteps]  = useState([]); // labels for the current loading trace
  const [loadIndex,  setLoadIndex]  = useState(0);  // steps before this index are "done", this one is "active"
  const [candidates, setCandidates] = useState([]);
  const [html,       setHtml]       = useState('');
  const [business,   setBusiness]   = useState(null);
  const [error,      setError]      = useState('');
  const [accountModal, setAccountModal] = useState('closed'); // 'closed' | 'auth'
  const [accountError,  setAccountError] = useState('');
  const [accountBusy,   setAccountBusy]  = useState(false);
  const [landers,       setLanders]      = useState([]);
  const [dashboardTab,  setDashboardTab] = useState('landers');
  const [restoredAds,   setRestoredAds]  = useState(null); // ads state rebuilt after the OAuth redirect
  const [deliverables,  setDeliverables] = useState([]);   // files listed on the thank-you page
  const [pendingProfile, setPendingProfile] = useState(null); // profile held while we ask the main-service question
  const [mainService,    setMainService]    = useState('');
  const [scanDone,       setScanDone]       = useState(false); // website scan (offer generation) finished
  const [angles,         setAngles]         = useState([]);    // researched ad angles awaiting the owner's pick
  const [pickedPhotos,   setPickedPhotos]   = useState([]);    // photos chosen for the lander (and reused for the ads), in click order
  const offerPromiseRef = useRef(null); // in-flight website-scan/offer call, started once the profile lands
  const profilePromiseRef = useRef(null); // in-flight profile fetch, started the moment a business is selected
  const anglesPromiseRef = useRef(null); // in-flight angle research, runs behind the photo-picking step
  const [builtPhase, setBuiltPhase] = useState('building'); // 'built' step: building → ready → adsSpin → adsReady
  const [buildIndex, setBuildIndex] = useState(0);          // active row in the built-step trace
  const [showPage,   setShowPage]   = useState(false);      // desktop page popup over the built step
  const [previewNoteHidden, setPreviewNoteHidden] = useState(false); // "everything can change" banner dismissed
  const timerRef  = useRef(null);
  const adCanvasesRef = useRef([]);     // canvases drawn by AdsTab, exported at Step 3
  const adsStateRef = useRef(null);     // AdsTab's current {photoUrls, copy}, for the pre-redirect stash
  const adsDrawnRef = useRef(false);    // all selected ad canvases have rendered
  const pendingDownloadRef = useRef(null); // {biz, wantAds} queued until canvases are ready
  const savedOnceRef = useRef(false);   // guard against duplicate lander inserts on repeat Step 3 clicks
  const savedLanderRef = useRef(null);  // {landerId, userId} of this session's save, for the asset upload

  useEffect(() => {
    let s = document.getElementById('lb-global-css');
    if (!s) {
      s = document.createElement('style');
      s.id = 'lb-global-css';
      s.textContent = GLOBAL_CSS;
      document.head.appendChild(s);
    }
    initPixel();
    // Warm the backend while the visitor is still reading the homepage AND
    // count the visit (the denominator for the admin click→search ratio) --
    // Vercel's Python cold start would otherwise land on their first search.
    apiGet('/api/visit').catch(() => {});
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // After the Google OAuth redirect the app boots fresh -- rebuild the
  // dashboard from the pre-redirect stash and, once the session lands,
  // finish the save + downloads.
  useEffect(() => {
    let raw = null;
    try { raw = sessionStorage.getItem(PENDING_KEY); } catch { /* storage blocked */ }
    if (!raw) return;
    let pending = null;
    try { pending = JSON.parse(raw); } catch { /* corrupt stash */ }
    if (!pending?.business) {
      try { sessionStorage.removeItem(PENDING_KEY); } catch { /* ignore */ }
      return;
    }

    setBusiness(pending.business);
    setHtml(buildLanderHTML(pending.business));
    setLanders([{
      id: 'local',
      name: pending.business.name || 'My lander',
      created_at: new Date().toISOString(),
      profile: pending.business,
      local: true,
    }]);
    setRestoredAds(pending.ads || null);
    setDashboardTab('ads');
    setStep('dashboard');

    if (!supabase) return;
    // detectSessionInUrl parses the OAuth callback asynchronously -- check
    // for a session AND listen for one; whichever lands first wins. If the
    // user cancelled sign-in, neither fires and they're simply back on the
    // dashboard with their work intact, free to hit Step 3 again.
    let handled = false;
    const attempt = user => {
      if (handled || !user) return;
      handled = true;
      finishAuthedSave(user, pending.business);
    };
    supabase.auth.getSession().then(({ data }) => attempt(data?.session?.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => attempt(session?.user));
    return () => sub?.subscription?.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Homepage "Sign In" redirect: nothing to save, just wait for the session
  // and open the dashboard. The pending-save flow above takes priority.
  useEffect(() => {
    if (!supabase) return;
    let intent = null;
    try {
      if (sessionStorage.getItem(PENDING_KEY)) return; // save flow owns this redirect
      intent = sessionStorage.getItem(SIGNIN_KEY);
      sessionStorage.removeItem(SIGNIN_KEY);
    } catch { /* storage blocked */ }
    if (!intent) return;
    let handled = false;
    const attempt = user => {
      if (handled || !user) return;
      handled = true;
      enterDashboard();
    };
    supabase.auth.getSession().then(({ data }) => attempt(data?.session?.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => attempt(session?.user));
    return () => sub?.subscription?.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Advances loadIndex through `steps` on a timer, one at a time, holding on
  // the last step (still spinning, never looping back) if the real work
  // outruns the scripted list -- a finished row should never "un-complete".
  function cycleSteps(steps, interval=1600) {
    if (timerRef.current) clearInterval(timerRef.current);
    setLoadSteps(steps);
    setLoadIndex(0);
    let i = 0;
    timerRef.current = setInterval(() => {
      i++;
      if (i >= steps.length) { clearInterval(timerRef.current); timerRef.current = null; return; }
      setLoadIndex(i);
    }, interval);
    return () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
  }

  async function handleSearch(e) {
    if (e?.preventDefault) e.preventDefault();
    if (!query.trim()) { setError('Type a business name first, e.g. "Joe\'s Plumbing, Austin TX".'); return; }
    setError('');
    setStep('loading');
    const stop = cycleSteps(['Searching Google Business listings', 'Looking up matching businesses', 'Finding the right profile']);
    try {
      const results = await findCandidates(query.trim());
      stop();
      const valid = (Array.isArray(results) ? results : []).filter(r=>r&&r.name);
      if (!valid.length) { setError('No businesses found. Try adding a city or state.'); setStep('search'); return; }
      setCandidates(valid); setStep('candidates');
    } catch(err) { stop(); setError(err.message); setStep('search'); }
  }

  function runBuild(candidate) {
    // Straight to the main-service question -- no loading screen between.
    // The profile fetch (and the website scan it feeds) runs behind the
    // question; handleServiceSubmit awaits whatever hasn't finished yet, and
    // a fetch failure surfaces there as the form error.
    setError('');
    setScanDone(false);
    setPendingProfile(null);
    setMainService('');
    setStep('service');
    const load = getProfile(candidate.place_id).then(profile => {
      setPendingProfile(profile);
      const scan = generateOffer({
        website: profile.website,
        name: profile.name,
        category: profile.category,
        tagline: profile.tagline,
        services: profile.services || [],
        service_areas: profile.service_areas || [],
      }).catch(() => ({}));
      offerPromiseRef.current = scan;
      scan.then(() => setScanDone(true));
      return profile;
    });
    load.catch(() => {}); // handled at submit time; this just silences the unhandled-rejection warning
    profilePromiseRef.current = load;
  }

  // The AI only returns fields it's confident about (e.g. a refined category
  // or services list); drop nulls and empty arrays so they don't blank out
  // real profile data.
  const cleanExtras = extras => Object.fromEntries(
    Object.entries(extras || {}).filter(([, v]) =>
      v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0)
    )
  );

  async function handleServiceSubmit(e) {
    if (e?.preventDefault) e.preventDefault();
    const svc = mainService.trim();
    if (!svc) { setError('Type the service you want more calls for, e.g. "water heater replacement".'); return; }
    setError('');
    // Angle research runs behind the photo-picking step -- by the time the
    // owner has tapped their photos, the angles are usually ready.
    anglesPromiseRef.current = (async () => {
      const profile = await profilePromiseRef.current;
      let extras = {};
      // The website scan cleans the services/service-areas chips and feeds
      // the angle research. It races the owner picking photos (10s+), so a
      // generous cap costs almost nothing in perceived wait -- but a stalled
      // scrape still must not sit between the owner and their angles.
      try {
        const scan = offerPromiseRef.current;
        if (scan) extras = (await Promise.race([scan, new Promise(res => setTimeout(() => res(null), 12000))])) || {};
      } catch { /* scan failed -- continue without it */ }
      const merged = { ...profile, ...cleanExtras(extras), main_service: svc };
      const res = await generateAngles({
        name: merged.name,
        category: merged.category || '',
        services: merged.services || [],
        service_areas: merged.service_areas || [],
        rating: merged.rating,
        review_count: merged.review_count,
        address: merged.address || '',
        reviews: (merged.reviews || []).slice(0, 5).map(r => ({
          author: r.author, rating: r.rating, text: (r.text || '').slice(0, 600),
        })),
        summary: merged.site_summary || merged.about_summary || null,
        main_service: svc,
      });
      const list = (Array.isArray(res.angles) ? res.angles : []).filter(a => a && a.label && a.hook);
      if (!list.length) throw new Error('Could not build angles for this business. Try again.');
      return { merged, list };
    })();
    anglesPromiseRef.current.catch(() => {}); // surfaced when awaited; this silences the unhandled-rejection warning
    // The photo grid needs the profile; it usually loaded while they typed.
    if (pendingProfile) {
      if (!(pendingProfile.photos || []).length) { continueToAngles([]); return; }
      setPickedPhotos([]);
      setStep('photopick');
      window.scrollTo(0, 0);
      return;
    }
    setStep('loading');
    const stop = cycleSteps(['Pulling your Google photos'], 1700);
    try {
      const profile = await profilePromiseRef.current;
      stop();
      if (!(profile.photos || []).length) { continueToAngles([]); return; }
      setPickedPhotos([]);
      setStep('photopick');
      window.scrollTo(0, 0);
    } catch (err) {
      stop();
      setError(err.message);
      setStep('service');
    }
  }

  function toggleLanderPhoto(url) {
    const next = pickedPhotos.includes(url)
      ? pickedPhotos.filter(u => u !== url)
      : pickedPhotos.length >= MAX_ADS ? pickedPhotos : [...pickedPhotos, url];
    setPickedPhotos(next);
    // The final pick moves the funnel forward on its own.
    const target = Math.min(MAX_ADS, (pendingProfile?.photos || []).length);
    if (next.length === target && target > 0) continueToAngles(next);
  }

  async function continueToAngles(picked) {
    setStep('loading');
    const stop = cycleSteps([
      'Finding best ad angles',
      'Studying campaigns that made the phone ring',
      'Reading your reviews for proof points',
      `Matching angles to "${mainService.trim() || 'your service'}"`,
      'Shortlisting the strongest angles',
    ], 1700);
    try {
      const { merged, list } = await anglesPromiseRef.current;
      stop();
      const rest = (merged.photos || []).filter(p => !picked.includes(p));
      setBusiness({
        ...merged,
        // The collage renders the first photos in order, so the owner's picks
        // lead (first pick = hero tile) and the rest trail as spares.
        photos: [...picked, ...rest],
        lander_photos: picked, // Step 2 builds the ads from these same photos
      });
      setAngles(list);
      setStep('angles');
      window.scrollTo(0, 0);
    } catch (err) {
      stop();
      setError(err.message);
      setStep('service');
    }
  }

  function chooseAngle(a) {
    // The chosen angle rewrites the lander's above-the-fold offer and rides
    // along in the profile so the Ads step (and any later session) knows
    // which angle this campaign runs on.
    finishBuild({
      ...business,
      offer_headline: a.lander_headline || a.hook,
      offer_subhead: a.lander_subhead || business?.offer_subhead || null,
      chosen_angle: a,
    });
  }

  function finishBuild(profile) {
    setBusiness(profile);
    setHtml(buildLanderHTML(profile));
    setShowPage(false);
    setBuiltPhase('building');
    setBuildIndex(1); // row 0 ("Finding best ad angles") arrives already checked
    setStep('built');
    // Short scripted trace while the (instant) build "runs" -- ends in the
    // completed state with the View button instead of holding forever.
    // 700ms/row: quick enough to feel snappy, slow enough to read.
    if (timerRef.current) clearInterval(timerRef.current);
    let i = 1;
    timerRef.current = setInterval(() => {
      i++;
      if (i >= BUILD_ROWS.length) {
        clearInterval(timerRef.current); timerRef.current = null;
        setBuiltPhase('ready');
        return;
      }
      setBuildIndex(i);
    }, 700);
  }

  // Closing the page popup is what kicks off the ads handoff: the trace
  // grows a "creating matching ads" spinner, then flips green with the
  // button into Step 2.
  function closePageModal() {
    setShowPage(false);
    if (builtPhase === 'ready') {
      setBuiltPhase('adsSpin');
      setTimeout(() => setBuiltPhase('adsReady'), 1300);
    }
  }

  function reset() {
    setStep('search'); setQuery(''); setCandidates([]); setHtml(''); setBusiness(null); setError('');
    setPendingProfile(null); setMainService(''); setAngles([]); setScanDone(false);
    setPickedPhotos([]);
    setBuiltPhase('building'); setBuildIndex(0); setShowPage(false);
    offerPromiseRef.current = null;
    profilePromiseRef.current = null;
    anglesPromiseRef.current = null;
  }

  /* ── returning users: sign in from the homepage, sign out anywhere ── */
  async function enterDashboard() {
    const { data: allLanders } = await supabase
      .from('landers')
      .select('*')
      .order('created_at', { ascending: false });
    setLanders(allLanders || []);
    setDashboardTab('landers');
    setStep('dashboard');
  }

  function handleHomeSignIn() {
    if (!supabase) return;
    supabase.auth.getSession().then(async ({ data }) => {
      if (data?.session?.user) { enterDashboard(); return; }
      try { sessionStorage.setItem(SIGNIN_KEY, '1'); } catch { /* storage blocked */ }
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      if (oauthError) setError(friendlyAuthError(oauthError, 'Could not start Google sign-in. Try again.'));
    });
  }

  async function handleSignOut() {
    try { await supabase?.auth.signOut(); } catch { /* already signed out */ }
    try { sessionStorage.removeItem(PENDING_KEY); sessionStorage.removeItem(SIGNIN_KEY); } catch { /* ignore */ }
    savedOnceRef.current = false;
    adsDrawnRef.current = false;
    adsStateRef.current = null;
    pendingDownloadRef.current = null;
    setRestoredAds(null);
    setLanders([]);
    reset();
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

  /* ── Step 3: hand over the files (runs after the lead is captured) ──
     Nothing auto-downloads. Once the save lands (and, after the OAuth
     redirect, once the ad canvases have re-rendered) the files are
     captured into state and the user lands on the thank-you page, where
     each file has its own download button. Capturing happens here, while
     the canvases are still mounted -- they unmount when we leave the
     dashboard. */
  function maybeDownload() {
    const pend = pendingDownloadRef.current;
    if (!pend) return;
    if (pend.wantAds && !adsDrawnRef.current) return; // canvases still rendering
    pendingDownloadRef.current = null;
    const slug = slugify(pend.biz?.name);
    const files = [];
    const uploads = []; // exact copies of the deliverables, for the admin asset portal
    if (pend.biz) {
      const landerHtml = buildLanderHTML(pend.biz);
      const htmlBlob = new Blob([landerHtml], { type: 'text/html' });
      files.push({ href: URL.createObjectURL(htmlBlob), name: `${slug}-lander.html`, label: 'Landing page', detail: 'Single HTML file. Host it on any subdomain', kind: 'html', previewHtml: landerHtml });
      uploads.push({ name: `${slug}-lander.html`, blob: htmlBlob, contentType: 'text/html' });
    }
    const gAds = adsStateRef.current?.googleAds;
    if (pend.biz && gAds?.headlines?.length) {
      const gBlob = new Blob([buildGoogleAdsText(pend.biz, gAds)], { type: 'text/plain' });
      files.push({ href: URL.createObjectURL(gBlob), name: `${slug}-google-ads.txt`, label: 'Google Search ads', detail: 'Headlines and descriptions, ready to paste into a Responsive Search Ad', kind: 'gads', previewHeadline: gAds.headlines[0], previewDesc: gAds.descriptions?.[0] });
      uploads.push({ name: `${slug}-google-ads.txt`, blob: gBlob, contentType: 'text/plain' });
    }
    (adCanvasesRef.current || []).filter(Boolean).forEach((canvas, i) => {
      try {
        files.push({ href: canvas.toDataURL('image/png'), name: `${slug}-ad-${i + 1}.png`, label: `Ad graphic ${i + 1}`, detail: '1080×1080 PNG, ready for Meta', kind: 'png' });
        uploads.push({ name: `${slug}-ad-${i + 1}.png`, canvas, contentType: 'image/png' });
      } catch { /* tainted canvas -- skip this ad rather than fail the batch */ }
    });
    uploadAssets(uploads);
    setDeliverables(files);
    setStep('thankyou');
    window.scrollTo(0, 0);
  }

  // Mirror the delivered files into the private `assets` bucket at
  // {user_id}/{lander_id}/ so the admin portal can show exactly what this
  // signup walked away with. Entirely fire-and-forget: any failure here is
  // invisible to the user, whose downloads already work from local state.
  function uploadAssets(uploads) {
    const saved = savedLanderRef.current;
    if (!supabase || !saved?.landerId || !uploads.length) return;
    const put = (name, blob, contentType) => {
      supabase.storage
        .from('assets')
        .upload(`${saved.userId}/${saved.landerId}/${name}`, blob, { contentType, upsert: true })
        .catch(() => {});
    };
    uploads.forEach(u => {
      if (u.blob) put(u.name, u.blob, u.contentType);
      else u.canvas.toBlob(b => { if (b) put(u.name, b, u.contentType); }, 'image/png');
    });
  }

  function handleAdsDrawn() {
    adsDrawnRef.current = true;
    maybeDownload();
  }

  function downloadDeliverable(f) {
    const a = document.createElement('a');
    a.href = f.href;
    a.download = f.name;
    a.click();
  }

  /* ── Step 3 auth: Google sign-in, then save + download ────────────── */
  function closeAccountModal() {
    setAccountModal('closed');
    setAccountError('');
  }

  function handleStep3() {
    if (!supabase) {
      setAccountError('Account creation isn’t configured yet. Check back soon.');
      setAccountModal('auth');
      return;
    }
    // Already signed in (e.g. downloading a second time this session)?
    // Skip the modal entirely.
    supabase.auth.getSession().then(({ data }) => {
      const user = data?.session?.user;
      if (user) {
        finishAuthedSave(user, business);
      } else {
        setAccountError('');
        setAccountModal('auth');
      }
    });
  }

  async function startGoogleAuth() {
    if (!supabase) return;
    // The OAuth redirect unloads the whole app -- stash everything needed to
    // rebuild this screen (and finish the save) when Google sends us back.
    try {
      sessionStorage.setItem(PENDING_KEY, JSON.stringify({ business, ads: adsStateRef.current }));
    } catch { /* storage blocked -- worst case the user redoes the ads */ }
    setAccountBusy(true);
    setAccountError('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      setAccountBusy(false);
      setAccountError(friendlyAuthError(error, 'Could not start Google sign-in. Try again.'));
    }
    // On success the browser navigates away; nothing more to do here.
  }

  async function finishAuthedSave(user, biz) {
    setAccountBusy(true);
    try {
      // biz is null when a returning user signs in with nothing new built --
      // nothing to save, but any freshly made ads still download below.
      if (!savedOnceRef.current && biz) {
        const { error: profileError } = await supabase.from('profiles').upsert({
          id: user.id,
          name: user.user_metadata?.full_name || user.user_metadata?.name || user.email,
          email: user.email,
          // No form field for phone anymore -- Google doesn't provide one, so
          // use the business's own number from their Google listing, which is
          // already in the profile data we're saving.
          phone: biz?.phone_national || biz?.phone_international || null,
        });
        if (profileError) throw profileError;

        const { data: savedLander, error: landerError } = await supabase.from('landers').insert({
          user_id: user.id,
          name: biz?.name || 'Untitled lander',
          profile: biz,
        }).select('id').single();
        if (landerError) throw landerError;
        savedLanderRef.current = { landerId: savedLander?.id, userId: user.id };
        savedOnceRef.current = true;
        // The real "this ad worked" moment: a new business owner just
        // finished Google sign-in and their first lander saved.
        trackSignup({ email: user.email, phone: biz?.phone_national || biz?.phone_international });
        // Mirror the signup into GoHighLevel so follow-up lives in the CRM.
        // Fire-and-forget: the backend answers ok:false rather than erroring,
        // and even a network failure must never break the save flow.
        apiPost('/api/ghl-contact', {
          name: user.user_metadata?.full_name || user.user_metadata?.name || user.email,
          email: user.email,
          phone: biz?.phone_national || biz?.phone_international || null,
          business: biz?.name || null,
        }).catch(() => {});

        const { data: allLanders } = await supabase
          .from('landers')
          .select('*')
          .order('created_at', { ascending: false });
        if (allLanders?.length) setLanders(allLanders);
      }
      try { sessionStorage.removeItem(PENDING_KEY); } catch { /* ignore */ }
      setAccountModal('closed');
      setAccountError('');
      pendingDownloadRef.current = {
        biz,
        wantAds: (adsStateRef.current?.photoUrls?.length || 0) > 0,
      };
      maybeDownload();
    } catch (err) {
      setAccountError(friendlyAuthError(err, 'Could not save your account. Try again.'));
      setAccountModal('auth');
    } finally {
      setAccountBusy(false);
    }
  }

  /* ── search (homepage) ────────────────────────────────────────────── */
  if (step === 'search') return (
    <Home query={query} setQuery={setQuery} error={error} onSearch={handleSearch} onSignIn={handleHomeSignIn} />
  );

  /* ── loading ───────────────────────────────────────────────────────── */
  if (step === 'loading') return (
    <div style={{minHeight:'100dvh',background:'#fff',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:34,padding:32}}>
      <div style={{display:'flex',alignItems:'center',gap:8}}>
        <LogoMark size={26} />
        <span style={{fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif",fontWeight:700,fontSize:15,color:'#181310',letterSpacing:'-.01em'}}>SendKPI</span>
      </div>
      <div className="lb-trace">
        {loadSteps.map((s, i) => i > loadIndex ? null : (
          <div key={s} className={`lb-trace-row${i === loadIndex ? ' active' : ' done'}`}>
            <span className={`lb-trace-icon ${i === loadIndex ? 'spin' : 'done'}`} aria-hidden="true">
              {i < loadIndex && <i className="ti ti-check" style={{fontSize:12}} />}
            </span>
            <span className="lb-trace-text">{s}</span>
          </div>
        ))}
      </div>
    </div>
  );

  /* ── candidates ────────────────────────────────────────────────────── */
  if (step === 'candidates') return (
    <div style={{background:'#fff',minHeight:'100dvh'}}>
      <div style={{background:'#181D24',padding:'12px 20px',display:'flex',alignItems:'center',gap:10}}>
        <LogoMark size={26} ring="#181D24" />
        <span style={{fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif",fontWeight:700,fontSize:14,color:'#fff',letterSpacing:'-.01em',marginLeft:-5}}>SendKPI</span>
      </div>

      <div style={{padding:'32px 20px 48px',maxWidth:600,margin:'0 auto'}}>
        <button className="lb-back" onClick={reset} style={{marginBottom:24}}>
          <i className="ti ti-arrow-left" aria-hidden="true" /> Back to search
        </button>
        <h2 style={{fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif",fontWeight:700,fontSize:22,letterSpacing:'-.01em',color:'var(--text-primary)',margin:'0 0 6px'}}>Which business is yours?</h2>
        <p style={{color:'var(--text-secondary)',fontSize:14,margin:'0 0 24px'}}>Found {candidates.length} matches for "{query}"</p>

        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {candidates.map((c,i)=>(
            <div key={i} className="lb-card" onClick={()=>runBuild(c)} style={{background:'#F4F5F3',borderColor:'#E5E7E3'}}>
              <div style={{width:56,height:56,borderRadius:8,overflow:'hidden',flexShrink:0,background:'var(--surface-1)',border:'0.5px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                {c.photo
                  ? <img src={c.photo} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}} onError={e=>{e.target.style.display='none'; e.target.nextSibling.style.display='flex';}} />
                  : null}
                <span style={{display:c.photo?'none':'flex',width:'100%',height:'100%',alignItems:'center',justifyContent:'center',fontSize:18,color:'var(--text-muted)'}}><i className="ti ti-building-store" aria-hidden="true" /></span>
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif",fontWeight:700,fontSize:16,color:'var(--text-primary)',marginBottom:4,letterSpacing:'-.01em',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.name}</div>
                <div style={{fontSize:13,color:'var(--text-secondary)',marginBottom:6,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.address}</div>
                <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'center'}}>
                  {c.category&&<span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,letterSpacing:'.06em',textTransform:'uppercase',color:'var(--text-muted)'}}>{c.category}</span>}
                  {c.rating&&<span style={{fontSize:12,color:'var(--text-primary)'}}>★ <b>{Number(c.rating).toFixed(1)}</b> <span style={{color:'var(--text-muted)'}}>({c.review_count||0})</span></span>}
                  {c.phone&&<span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12,color:'var(--text-secondary)'}}>{c.phone}</span>}
                </div>
              </div>
              <button className="lb-btn-signal" style={{flexShrink:0,height:40,padding:'0 24px',fontSize:14}}>Select</button>
            </div>
          ))}
        </div>

        {error && <div className="lb-error" style={{marginTop:16}}>{error}</div>}
      </div>
    </div>
  );

  /* ── main-service question (website scan continues behind it) ──────── */
  if (step === 'service') {
    const mono = { fontFamily: "'IBM Plex Mono',monospace" };
    return (
      <div style={{background:'#fff',minHeight:'100dvh'}}>
        <div style={{background:'#181D24',padding:'12px 20px',display:'flex',alignItems:'center',gap:10}}>
          <LogoMark size={26} ring="#181D24" />
          <span style={{fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif",fontWeight:700,fontSize:14,color:'#fff',letterSpacing:'-.01em',marginLeft:-5}}>SendKPI</span>
        </div>

        <div style={{padding:'32px 20px 48px',maxWidth:600,margin:'0 auto'}}>
          <div style={{background:'#F4F5F3',border:'1px solid #E5E7E3',borderRadius:12,padding:'16px 18px',marginBottom:28}}>
            <p style={{...mono,fontSize:12,color:pendingProfile?'#1F8A5F':'var(--text-secondary)',margin:'0 0 8px'}}>
              {pendingProfile ? '✓ Pulling profile information' : '▸ Pulling profile information…'}
            </p>
            <p style={{...mono,fontSize:12,color:scanDone?'#1F8A5F':'var(--text-secondary)',margin:0}}>
              {scanDone ? '✓ Scanning website from profile' : '▸ Scanning website from profile…'}
            </p>
          </div>

          <h2 style={{fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif",fontWeight:700,fontSize:22,letterSpacing:'-.01em',color:'var(--text-primary)',margin:'0 0 6px'}}>
            While we scan: what's the main service you want more calls for?
          </h2>
          <p style={{color:'var(--text-secondary)',fontSize:14,margin:'0 0 20px',lineHeight:1.55}}>
            We'll research winning ad angles for {pendingProfile?.name || 'your business'} and build the page and ads around that one service.
          </p>

          <form onSubmit={handleServiceSubmit} style={{display:'flex',flexDirection:'column',gap:12}}>
            <input
              className="lb-input"
              autoFocus
              placeholder="Type the service offering you want more calls for here."
              value={mainService}
              onChange={e => setMainService(e.target.value)}
            />
            <button className="lb-btn-signal" type="submit" style={{alignSelf:'flex-start',display:'flex',alignItems:'center',gap:8}}>
              Find my winning angles <i className="ti ti-arrow-right" aria-hidden="true" />
            </button>
          </form>

          {error && <div className="lb-error" style={{marginTop:16}}>{error}</div>}
        </div>
      </div>
    );
  }

  /* ── photo picker: the owner's picks become the lander collage and the
     ads, while the angle research runs behind this screen ─────────────── */
  if (step === 'photopick') {
    const photos = pendingProfile?.photos || [];
    const target = Math.min(MAX_ADS, photos.length);
    return (
      <div style={{background:'#fff',minHeight:'100dvh'}}>
        <div style={{background:'#181D24',padding:'12px 20px',display:'flex',alignItems:'center',gap:10}}>
          <LogoMark size={26} ring="#181D24" />
          <span style={{fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif",fontWeight:700,fontSize:14,color:'#fff',letterSpacing:'-.01em',marginLeft:-5}}>SendKPI</span>
        </div>

        <div style={{padding:'32px 20px 64px',maxWidth:640,margin:'0 auto'}}>
          <p style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,letterSpacing:'.1em',textTransform:'uppercase',color:'#0D57D0',margin:'0 0 10px'}}>
            {pickedPhotos.length} of {target} selected
          </p>
          <h2 style={{fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif",fontWeight:700,fontSize:24,letterSpacing:'-.01em',color:'var(--text-primary)',margin:'0 0 6px'}}>
            Pick {target} photos that show your {mainService.trim() || 'best'} work
          </h2>
          <p style={{color:'var(--text-secondary)',fontSize:14,margin:'0 0 16px',lineHeight:1.55}}>
            Straight from your Google Business Profile. These go on your landing page and become your ads, so choose the ones that fit "{mainService.trim() || 'your service'}". Your first pick becomes the main photo.
          </p>
          <div style={{background:'#E7EEFB',border:'1px solid #D3DFF6',borderRadius:12,padding:'13px 16px',display:'flex',gap:10,alignItems:'flex-start',fontSize:13.5,color:'#2A3550',lineHeight:1.5,marginBottom:16}}>
            <i className="ti ti-pencil" aria-hidden="true" style={{color:'#0D57D0',flexShrink:0,marginTop:2}} />
            <span><b style={{color:'var(--text-primary)'}}>These aren't set in stone.</b> Pick the best of what's here. Once your page and ads are built, we can customize everything: your exact photos, services, wording, all of it.</span>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(110px,1fr))',gap:8}}>
            {photos.map((p, i) => {
              const idx = pickedPhotos.indexOf(p);
              return (
                <button key={p} onClick={() => toggleLanderPhoto(p)} style={{
                  position:'relative', padding:0, border: idx > -1 ? '3px solid #0D57D0' : '3px solid transparent',
                  borderRadius:10, overflow:'hidden', cursor:'pointer', background:'var(--surface-1)',
                  aspectRatio:'1',
                }}>
                  <img src={p} alt={`Photo ${i + 1}`} loading="lazy" style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}} />
                  {idx > -1 && (
                    <span style={{
                      position:'absolute', top:6, right:6, width:22, height:22, borderRadius:'50%',
                      background:'#0D57D0', color:'#fff', fontSize:12, fontWeight:700,
                      display:'flex', alignItems:'center', justifyContent:'center',
                    }}>{idx + 1}</span>
                  )}
                </button>
              );
            })}
          </div>

          {pickedPhotos.length > 0 && pickedPhotos.length < target && (
            <button className="lb-btn-signal" style={{marginTop:20,display:'flex',alignItems:'center',gap:8}} onClick={() => continueToAngles(pickedPhotos)}>
              Continue with {pickedPhotos.length} photo{pickedPhotos.length === 1 ? '' : 's'} <i className="ti ti-arrow-right" aria-hidden="true" />
            </button>
          )}

          {error && <div className="lb-error" style={{marginTop:16}}>{error}</div>}
        </div>
      </div>
    );
  }

  /* ── angle picker (research results) ───────────────────────────────── */
  if (step === 'angles') {
    return (
      <div style={{background:'#fff',minHeight:'100dvh'}}>
        <div style={{background:'#181D24',padding:'12px 20px',display:'flex',alignItems:'center',gap:10}}>
          <LogoMark size={26} ring="#181D24" />
          <span style={{fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif",fontWeight:700,fontSize:14,color:'#fff',letterSpacing:'-.01em',marginLeft:-5}}>SendKPI</span>
        </div>

        <div style={{padding:'32px 20px 64px',maxWidth:640,margin:'0 auto'}}>
          <p style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,letterSpacing:'.1em',textTransform:'uppercase',color:'#0D57D0',margin:'0 0 10px'}}>
            {angles.length} winning angles found
          </p>
          <h2 style={{fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif",fontWeight:700,fontSize:24,letterSpacing:'-.01em',color:'var(--text-primary)',margin:'0 0 6px'}}>
            Pick the angle for your campaign
          </h2>
          <p style={{color:'var(--text-secondary)',fontSize:14,margin:'0 0 26px',lineHeight:1.55}}>
            Researched for {business?.main_service ? `"${business.main_service}"` : 'your main service'} and customized to {business?.name || 'your business'}: your reviews, your area, your trade. The one you pick shapes the landing page and all your ads.
          </p>

          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            {angles.map(a => (
              <div key={a.id || a.label} className="lb-card" onClick={() => chooseAngle(a)}
                style={{background:'#F4F5F3',borderColor:'#E5E7E3',alignItems:'flex-start',flexDirection:'column',gap:8}}>
                <div style={{display:'flex',alignItems:'center',gap:10,width:'100%'}}>
                  <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10.5,letterSpacing:'.08em',textTransform:'uppercase',color:'#0D57D0',fontWeight:600,background:'#E7EEFB',borderRadius:999,padding:'4px 10px'}}>{a.label}</span>
                  <button className="lb-btn-signal" style={{marginLeft:'auto',flexShrink:0,height:38,padding:'0 22px',fontSize:14}}>Select</button>
                </div>
                <div style={{fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif",fontWeight:700,fontSize:17,letterSpacing:'-.01em',color:'var(--text-primary)',lineHeight:1.25}}>
                  "{a.hook}"
                </div>
                {a.why && <p style={{fontSize:13.5,color:'var(--text-secondary)',margin:0,lineHeight:1.5}}>{a.why}</p>}
              </div>
            ))}
          </div>

          {error && <div className="lb-error" style={{marginTop:16}}>{error}</div>}
        </div>
      </div>
    );
  }

  /* ── built: trace completion → desktop page popup → ads handoff ────── */
  if (step === 'built') {
    const rows = BUILD_ROWS
      .map((s, i) => ({
        text: s,
        state: builtPhase !== 'building' || i < buildIndex ? 'done' : i === buildIndex ? 'active' : 'hidden',
      }))
      .filter(r => r.state !== 'hidden');
    if (builtPhase !== 'building') rows.push({ text: 'Landing page completed', state: 'done' });
    if (builtPhase === 'adsSpin')  rows.push({ text: 'Creating your matching ads', state: 'active' });
    if (builtPhase === 'adsReady') rows.push({ text: 'Matching ads ready', state: 'done' });
    return (
      <div style={{minHeight:'100dvh',background:'#fff',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:34,padding:32}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <LogoMark size={26} />
          <span style={{fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif",fontWeight:700,fontSize:15,color:'#181310',letterSpacing:'-.01em'}}>SendKPI</span>
        </div>
        <div className="lb-trace">
          {rows.map(r => (
            <div key={r.text} className={`lb-trace-row${r.state === 'active' ? ' active' : ' done'}`}>
              <span className={`lb-trace-icon ${r.state === 'active' ? 'spin' : 'done'}`} aria-hidden="true">
                {r.state === 'done' && <i className="ti ti-check" style={{fontSize:12}} />}
              </span>
              <span className="lb-trace-text">{r.text}</span>
            </div>
          ))}
        </div>

        {builtPhase === 'ready' && (
          <button className="lb-btn-signal" onClick={() => setShowPage(true)} style={{display:'flex',alignItems:'center',gap:8}}>
            View my page <i className="ti ti-eye" aria-hidden="true" />
          </button>
        )}
        {builtPhase === 'adsReady' && (
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:12}}>
            <button className="lb-btn-signal" onClick={goToAds} style={{display:'flex',alignItems:'center',gap:8}}>
              Step 2: Build my ads <i className="ti ti-arrow-right" aria-hidden="true" />
            </button>
            <button className="lb-back" onClick={() => setShowPage(true)}>
              <i className="ti ti-eye" aria-hidden="true" /> View my page again
            </button>
          </div>
        )}

        {showPage && (
          <div style={{position:'fixed',inset:0,zIndex:100,background:'rgba(14,19,24,.72)',padding:'clamp(8px,2vw,28px)'}}>
            <div style={{width:'100%',height:'100%',maxWidth:1280,margin:'0 auto',background:'#fff',borderRadius:16,overflow:'hidden',display:'flex',flexDirection:'column',boxShadow:'0 30px 80px rgba(0,0,0,.45)'}}>
              <div style={{flexShrink:0,background:'#181D24',padding:'10px 14px',display:'flex',alignItems:'center',gap:14}}>
                <button onClick={closePageModal} style={{display:'flex',alignItems:'center',gap:8,background:'#fff',color:'#181D24',border:'none',borderRadius:10,padding:'11px 22px',fontSize:15,fontWeight:700,cursor:'pointer',fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif"}}>
                  <i className="ti ti-arrow-left" aria-hidden="true" /> Back
                </button>
                <span style={{color:'#C7CDD2',fontSize:13,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>Your landing page · desktop preview</span>
              </div>
              {!previewNoteHidden && (
                <div style={{flexShrink:0,background:'#FFF4DC',color:'#8A6100',fontSize:13,padding:'9px 16px',display:'flex',alignItems:'center',justifyContent:'center',gap:8,borderBottom:'1px solid #F2E3B8',fontWeight:600}}>
                  <i className="ti ti-pencil" aria-hidden="true" />
                  <span>This is your first draft. Images, services, service areas, and wording can all be customized.</span>
                  <button onClick={() => setPreviewNoteHidden(true)} aria-label="Dismiss" style={{marginLeft:10,background:'none',border:'none',color:'#B99B4A',fontWeight:700,cursor:'pointer',fontSize:14,padding:0}}>✕</button>
                </div>
              )}
              <iframe srcDoc={html} title="Landing page preview (desktop)" style={{flex:1,width:'100%',border:'none',background:'#fff'}} />
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ── thank-you (post-save: VSL + gated downloads + call offer) ────── */
  if (step === 'thankyou') {
    const first = (business?.name || landers[0]?.name || 'your business').split(',')[0];
    return (
      <div style={{minHeight:'100dvh',background:'var(--surface-1)'}}>
        <div style={{background:'#181D24',padding:'12px 20px',display:'flex',alignItems:'center',gap:10}}>
          <LogoMark size={26} ring="#181D24" />
          <span style={{fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif",fontWeight:700,fontSize:14,color:'#fff',letterSpacing:'-.01em',marginLeft:-5}}>SendKPI</span>
          <button className="lb-btn-dark" style={{marginLeft:'auto'}} onClick={()=>setStep('dashboard')}>Back to dashboard</button>
        </div>

        <div style={{padding:'40px 20px 64px',maxWidth:680,margin:'0 auto'}}>
          <p style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12,letterSpacing:'.1em',textTransform:'uppercase',color:'#0D57D0',margin:'0 0 12px'}}>You're all set</p>
          <h1 style={{fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif",fontWeight:700,fontSize:'clamp(26px,5vw,36px)',letterSpacing:'-.01em',color:'var(--text-primary)',margin:'0 0 10px',lineHeight:1.15}}>Your lander and ads for {first} are ready</h1>
          <p style={{fontSize:15,color:'var(--text-secondary)',margin:'0 0 32px',lineHeight:1.6}}>They're saved to your account, and the files are below.{VSL_EMBED_URL ? ' First, two minutes on how to get them live and making the phone ring:' : ''}</p>

          {VSL_EMBED_URL && (
            <div style={{position:'relative',paddingTop:'56.25%',borderRadius:12,overflow:'hidden',background:'#181D24',marginBottom:32}}>
              <iframe src={VSL_EMBED_URL} title="How to launch your lander and ads" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen style={{position:'absolute',inset:0,width:'100%',height:'100%',border:0}} />
            </div>
          )}

          <p style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,letterSpacing:'.1em',textTransform:'uppercase',color:'var(--text-muted)',margin:'0 0 12px'}}>Your files</p>
          <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:36}}>
            {deliverables.length === 0 && <p style={{color:'var(--text-secondary)',fontSize:14}}>No files here yet. Head back to the dashboard and hit Step 3 again.</p>}
            {deliverables.map(f => (
              <div key={f.name} className="lb-card" style={{cursor:'default'}}>
                {f.kind && (
                  <div aria-hidden="true" style={{width:64,height:64,borderRadius:10,border:'1px solid var(--border)',overflow:'hidden',flexShrink:0,background:'#fff'}}>
                    {f.kind === 'png' && <img src={f.href} alt="" style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}} />}
                    {f.kind === 'html' && (
                      <iframe srcDoc={f.previewHtml} sandbox="" scrolling="no" tabIndex={-1} title=""
                        style={{width:480,height:480,border:0,transform:'scale(0.1334)',transformOrigin:'0 0',pointerEvents:'none',display:'block'}} />
                    )}
                    {f.kind === 'gads' && (
                      <div style={{width:220,height:220,transform:'scale(0.291)',transformOrigin:'0 0',padding:'14px 12px',boxSizing:'border-box',fontFamily:'arial,sans-serif',textAlign:'left'}}>
                        <div style={{fontSize:11,fontWeight:700,color:'#202124',marginBottom:6}}>Sponsored</div>
                        <div style={{fontSize:16,color:'#1a0dab',lineHeight:1.25,marginBottom:5,display:'-webkit-box',WebkitLineClamp:3,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{f.previewHeadline}</div>
                        <div style={{fontSize:12,color:'#4d5156',lineHeight:1.4,display:'-webkit-box',WebkitLineClamp:3,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{f.previewDesc || ''}</div>
                      </div>
                    )}
                  </div>
                )}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif",fontWeight:700,fontSize:14,color:'var(--text-primary)'}}>{f.label}</div>
                  <div style={{fontSize:12,color:'var(--text-secondary)',marginTop:2}}>{f.detail}</div>
                </div>
                <button className="lb-btn-signal" style={{height:40,display:'flex',alignItems:'center',gap:8}} onClick={()=>downloadDeliverable(f)}>
                  Download <i className="ti ti-download" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>

          {BOOKING_URL && (
            <div style={{background:'#181D24',borderRadius:14,padding:'26px 24px'}}>
              <p style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,letterSpacing:'.1em',textTransform:'uppercase',color:'#8FE3B8',margin:'0 0 10px'}}>Want it live today?</p>
              <p style={{fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif",fontWeight:700,fontSize:20,color:'#fff',margin:'0 0 8px',letterSpacing:'-.01em'}}>Book a $100 setup call</p>
              <p style={{fontSize:14,color:'#C7CDD2',margin:'0 0 18px',lineHeight:1.6}}>We'll get on a call and set it all up together: lander on your subdomain, ads loaded into Meta, tracking on. You leave with a live funnel.</p>
              <a className="lb-btn-signal" href={BOOKING_URL} target="_blank" rel="noopener" style={{display:'inline-flex',alignItems:'center',gap:8,textDecoration:'none',lineHeight:'48px'}}>
                Book my setup call <i className="ti ti-arrow-right" aria-hidden="true" />
              </a>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ── dashboard (post-signup: Landers + Ads) ───────────────────────── */
  if (step === 'dashboard') {
    return (
      <div>
        <div style={{background:'#181D24',padding:'12px 20px',display:'flex',alignItems:'center',gap:10}}>
          <LogoMark size={26} ring="#181D24" />
          <span style={{fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif",fontWeight:700,fontSize:14,color:'#fff',letterSpacing:'-.01em',marginLeft:-5}}>SendKPI</span>
          <button className="lb-btn-signal" style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:8,height:38}} onClick={handleStep3}>
            Step 3: Download Lander &amp; Ads <i className="ti ti-download" aria-hidden="true" />
          </button>
          <button className="lb-btn-dark" onClick={handleSignOut}>Sign out</button>
        </div>

        <div style={{padding:'24px 20px 48px',maxWidth:720,margin:'0 auto'}}>
          <div style={{display:'flex',gap:20,marginBottom:24,borderBottom:'1px solid var(--border)'}}>
            {['landers','ads'].map(tab => (
              <button key={tab} onClick={()=>setDashboardTab(tab)} style={{
                background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',
                padding:'10px 2px',fontSize:14,fontWeight:600,textTransform:'capitalize',
                color: dashboardTab===tab ? 'var(--text-primary)' : 'var(--text-secondary)',
                borderBottom: dashboardTab===tab ? '2px solid #0D57D0' : '2px solid transparent',
              }}>{tab}</button>
            ))}
          </div>

          {dashboardTab === 'landers' && (
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {landers.length === 0 && <p style={{color:'var(--text-secondary)',fontSize:14}}>No landers saved yet.</p>}
              {landers.map(l => (
                <div key={l.id} className="lb-card" style={{cursor:'default'}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif",fontWeight:700,fontSize:15,color:'var(--text-primary)'}}>{l.name}</div>
                    <div style={{fontSize:12,color:'var(--text-secondary)',marginTop:2}}>
                      {l.local ? 'Ready. Download it in Step 3' : `Saved ${new Date(l.created_at).toLocaleDateString()}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {dashboardTab === 'ads' && (
            <AdsTab
              landers={landers}
              canvasesRef={adCanvasesRef}
              initialAds={restoredAds}
              onAdsState={s => { adsStateRef.current = s; }}
              onAllDrawn={handleAdsDrawn}
              onDownload={handleStep3}
            />
          )}
        </div>

        {accountModal !== 'closed' && (
          <div style={{position:'fixed',inset:0,zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
            <div style={{position:'absolute',inset:0,background:'rgba(14,19,24,.7)'}} onClick={closeAccountModal} />
            <div style={{position:'relative',background:'#fff',borderRadius:14,maxWidth:380,width:'100%',padding:'28px 24px',boxShadow:'0 20px 60px rgba(0,0,0,.4)'}}>
              <button onClick={closeAccountModal} aria-label="Close" style={{position:'absolute',top:10,right:14,background:'none',border:0,fontSize:26,lineHeight:1,color:'var(--text-secondary)',cursor:'pointer'}}>&times;</button>
              <h3 style={{fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif",fontWeight:700,fontSize:20,letterSpacing:'-.01em',margin:'0 0 8px',color:'var(--text-primary)'}}>Your campaign kit is ready</h3>
              <p style={{fontSize:14,color:'var(--text-secondary)',margin:'0 0 20px',lineHeight:1.5}}>Create your free account to download your call lander and ads. Everything will be waiting on the next page.</p>
              {accountError && <div className="lb-error" style={{marginBottom:12}}>{accountError}</div>}
              <button className="lb-btn-signal" onClick={startGoogleAuth} disabled={accountBusy || !supabase} style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'center',gap:10}}>
                <span style={{display:'flex',alignItems:'center',justifyContent:'center',width:22,height:22,borderRadius:6,background:'#fff',flexShrink:0}} aria-hidden="true">
                  <svg width="14" height="14" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                  </svg>
                </span>
                {accountBusy ? 'Working…' : 'Continue with Google'}
              </button>
              <p style={{fontSize:12,color:'var(--text-secondary)',margin:'14px 0 0',lineHeight:1.5}}>We only use your Google name and email to create your account. No access to anything else.</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}
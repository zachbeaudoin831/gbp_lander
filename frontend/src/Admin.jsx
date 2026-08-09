/* ─── /admin — asset portal ─────────────────────────────────────────────
   Zach's internal lookup: every business that finished Google OAuth,
   searchable, with the exact lander + ad files they downloaded.

   Auth is the same Google OAuth the funnel uses — no second login system.
   What makes this page work as admin is the RLS layer (db/003): is_admin()
   grants the allow-listed email SELECT on all profiles/landers/assets.
   Anyone else who signs in here gets only their own rows back, and the UI
   below additionally shows them a "not authorized" wall. CRM work (status,
   notes, follow-up) lives in GoHighLevel — this page is only the asset
   library. */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";
import { buildLanderHTML, slugify } from "./App.jsx";

const ADMIN_EMAILS = ["zkbmarketing@gmail.com"];

/* Local Supabase doesn't exist in dev (no .env), so /admin?mock=1 renders
   the signed-in portal with fixture data instead. import.meta.env.DEV is
   false in prod builds, so this whole path is dead-code-eliminated there. */
const MOCK = import.meta.env.DEV && new URLSearchParams(window.location.search).has("mock");
const MOCK_LEADS = !MOCK ? [] : [
  {
    id: "mock-1", name: "Duncan Wilson", email: "duncan@example.com", phone: "(831) 555-0199",
    created_at: "2026-08-07T18:00:00Z",
    landers: [{
      id: "mock-lander-1", user_id: "mock-1", name: "Duncan Plumbing", created_at: "2026-08-07T18:02:00Z",
      profile: {
        name: "Duncan Plumbing", category: "Plumber", address: "3212 Mission Dr, Santa Cruz, CA",
        phone_national: "(831) 555-0199", rating: 4.9, review_count: 152,
        tagline: "Fast, honest plumbing since 1982", main_service: "water heater replacement",
        services: ["Drain cleaning", "Water heaters", "Leak repair"],
        service_areas: ["Santa Cruz", "Capitola"], reviews: [], photos: [], hours: [],
      },
    }],
  },
  { id: "mock-2", name: "Rosa Alvarez", email: "rosa@example.com", phone: null, created_at: "2026-08-05T12:00:00Z", landers: [] },
];

// Deterministic fake usage for /admin?mock=1 (no Date.now/random in render —
// derived from day index so it's stable across reloads).
function mockUsage() {
  const daily = [], aiDaily = [];
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today); d.setUTCDate(d.getUTCDate() - i);
    const day = d.toISOString().slice(0, 10);
    const wobble = (i * 7) % 5;
    daily.push({ day, endpoint: "search", calls: 3 + wobble });
    daily.push({ day, endpoint: "profile", calls: 1 + (wobble % 3) });
    daily.push({ day, endpoint: "photo", calls: 8 * (1 + (wobble % 3)) + (i === 4 ? 640 : 0) }); // day-4 spike = the "bot"
    daily.push({ day, endpoint: "generate-offer", calls: 1 + (wobble % 2) });
    daily.push({ day, endpoint: "lead", calls: wobble % 2 });
    aiDaily.push({ day, model: "claude-sonnet-5", calls: 3 + (wobble % 3), input_tokens: 5200 * (3 + wobble), output_tokens: 1400 * (3 + wobble), cache_creation_tokens: 0, cache_read_tokens: 0 });
  }
  return {
    daily, aiDaily,
    topIps: [
      { ip: "203.0.113.9", calls: 812, last_seen: today.toISOString(), user_agent: "python-requests/2.31", blocked: false },
      { ip: "198.51.100.4", calls: 61, last_seen: today.toISOString(), user_agent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5)", blocked: false },
      { ip: "192.0.2.77", calls: 24, last_seen: today.toISOString(), user_agent: "Mozilla/5.0 (Macintosh; Intel Mac OS X)", blocked: true },
    ],
    blocked: [{ ip: "192.0.2.77", note: "scraper", created_at: today.toISOString() }],
  };
}

const ADMIN_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@700;800&display=swap');
.ap-wrap { max-width: 980px; margin: 0 auto; padding: 28px 20px 80px; }
.ap-h1 { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; font-weight: 800; font-size: 24px; letter-spacing: -.02em; margin: 0; }
.ap-search { width: 100%; box-sizing: border-box; padding: 12px 14px; font-size: 15px; font-family: inherit; border: 1px solid var(--border-strong); border-radius: 10px; background: var(--surface-2); outline: none; }
.ap-search:focus { border-color: var(--signal); }
.ap-card { background: var(--surface-2); border: 1px solid var(--border); border-radius: 12px; padding: 16px 18px; cursor: pointer; transition: border-color .12s; }
.ap-card:hover { border-color: var(--border-strong); }
.ap-card.open { border-color: var(--signal); cursor: default; }
.ap-name { font-weight: 600; font-size: 15px; }
.ap-meta { color: var(--text-secondary); font-size: 13px; }
.ap-btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; font-size: 13px; font-weight: 600; font-family: inherit; border-radius: 8px; border: 1px solid var(--border-strong); background: var(--surface-1); color: var(--text-primary); cursor: pointer; text-decoration: none; }
.ap-btn:hover { background: var(--surface-2); }
.ap-btn.primary { background: var(--signal); border-color: var(--signal); color: #fff; }
.ap-btn.primary:hover { filter: brightness(1.05); }
.ap-ads { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
.ap-ad img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 8px; border: 1px solid var(--border); display: block; }
.ap-frame { width: 100%; height: 420px; border: 1px solid var(--border); border-radius: 10px; background: #fff; }
.ap-tag { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; background: var(--surface-1); border: 1px solid var(--border); color: var(--text-secondary); }
.ap-tabs { display: flex; gap: 4px; background: var(--surface-1); border: 1px solid var(--border); border-radius: 10px; padding: 4px; width: fit-content; }
.ap-tab { padding: 7px 18px; font-size: 13px; font-weight: 600; font-family: inherit; border: none; border-radius: 7px; background: transparent; color: var(--text-secondary); cursor: pointer; }
.ap-tab.active { background: var(--surface-2); color: var(--text-primary); box-shadow: 0 1px 2px rgba(11,11,11,.08); }
.ap-stat { background: var(--surface-2); border: 1px solid var(--border); border-radius: 12px; padding: 14px 18px; flex: 1; min-width: 150px; }
.ap-stat .v { font-size: 22px; font-weight: 700; letter-spacing: -.01em; }
.ap-stat .l { font-size: 12px; color: var(--text-secondary); margin-top: 2px; }
.ap-stat .s { font-size: 12px; color: var(--text-muted); margin-top: 6px; }
.ap-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.ap-table th { text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; color: var(--text-muted); padding: 8px 10px; border-bottom: 1px solid var(--border); }
.ap-table td { padding: 9px 10px; border-bottom: 1px solid var(--surface-1); vertical-align: middle; }
.ap-mini { padding: 4px 10px; font-size: 12px; }
.ap-legend { display: flex; gap: 16px; font-size: 12px; color: var(--text-secondary); flex-wrap: wrap; }
.ap-legend .dot { display: inline-block; width: 9px; height: 9px; border-radius: 3px; margin-right: 6px; vertical-align: -1px; }
`;

function fmtDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch { return ""; }
}

/* One saved lander inside an open lead card: live preview, download, and
   the stored ad graphics pulled from the assets bucket. */
function LanderAssets({ lander }) {
  const [assets, setAssets] = useState(null); // null = loading, [] = none stored
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!supabase) { setAssets([]); return; }
    (async () => {
      const folder = `${lander.user_id}/${lander.id}`;
      const { data: files, error } = await supabase.storage.from("assets").list(folder);
      if (cancelled || error || !files?.length) { if (!cancelled) setAssets([]); return; }
      const paths = files.map(f => `${folder}/${f.name}`);
      const { data: signed } = await supabase.storage.from("assets").createSignedUrls(paths, 3600);
      if (cancelled) return;
      setAssets((signed || []).filter(s => s.signedUrl).map((s, i) => ({
        name: files[i].name,
        url: s.signedUrl,
        // Supabase signed URLs honor a `download` query param -- appending it
        // turns the same link into a forced file download.
        downloadUrl: `${s.signedUrl}&download=${encodeURIComponent(files[i].name)}`,
        isImage: /\.png$|\.jpe?g$|\.webp$/i.test(files[i].name),
      })));
    })();
    return () => { cancelled = true; };
  }, [lander.id, lander.user_id]);

  function downloadRebuiltLander() {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([buildLanderHTML(lander.profile)], { type: "text/html" }));
    a.download = `${slugify(lander.name)}-lander.html`;
    a.click();
  }

  const storedLander = assets?.find(f => f.name.endsWith(".html"));
  const storedDocs = assets?.filter(f => !f.isImage && !f.name.endsWith(".html")) || [];
  const storedAds = assets?.filter(f => f.isImage) || [];

  return (
    <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14, marginTop: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <span className="ap-name" style={{ fontSize: 14 }}>{lander.name}</span>
        <span className="ap-tag">saved {fmtDate(lander.created_at)}</span>
        <span style={{ flex: 1 }} />
        <button className="ap-btn" onClick={() => setShowPreview(v => !v)}>
          {showPreview ? "Hide preview" : "Preview lander"}
        </button>
        {storedDocs.map(f => (
          <a key={f.name} className="ap-btn" href={f.downloadUrl}>
            {f.name.includes("google-ads") ? "Google ads" : f.name}
          </a>
        ))}
        {storedLander
          ? <a className="ap-btn primary" href={storedLander.downloadUrl}>Download lander</a>
          : <button className="ap-btn primary" onClick={downloadRebuiltLander}>Download lander</button>}
      </div>

      {showPreview && (
        <iframe
          className="ap-frame"
          title={`${lander.name} preview`}
          sandbox="allow-scripts allow-same-origin"
          srcDoc={buildLanderHTML(lander.profile)}
          style={{ marginBottom: 12 }}
        />
      )}

      {assets === null && <p className="ap-meta" style={{ margin: 0 }}>Loading ad files…</p>}
      {assets !== null && storedAds.length === 0 && (
        <p className="ap-meta" style={{ margin: 0 }}>
          No stored ad graphics for this lander (files are captured at download time — older signups predate that).
        </p>
      )}
      {storedAds.length > 0 && (
        <div className="ap-ads">
          {storedAds.map(f => (
            <div className="ap-ad" key={f.name}>
              <img src={f.url} alt={f.name} loading="lazy" />
              <a className="ap-btn" href={f.downloadUrl} style={{ width: "100%", boxSizing: "border-box", justifyContent: "center", marginTop: 6 }}>
                Download
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Usage tab ──────────────────────────────────────────────────────────
   Traffic + spend dashboard fed by the backend's request/token logs
   (db/004_usage.sql). Dollar figures are ESTIMATES computed client-side
   from the rate tables below — the authoritative numbers live in the GCP
   billing console and the Anthropic console. */

// Google Places rates, USD per call. Tune to match your SKU tier if Google's
// pricing changes — these only affect the displayed estimate.
const GOOGLE_PRICE = { search: 0.032, profile: 0.017, photo: 0.007 };

// Claude rates, USD per million tokens, matched by model substring.
const CLAUDE_PRICE = [
  ["fable", { inp: 10, out: 50 }],
  ["opus", { inp: 5, out: 25 }],
  ["haiku", { inp: 1, out: 5 }],
  ["sonnet", { inp: 3, out: 15 }],
];
const claudeRate = model => (CLAUDE_PRICE.find(([k]) => String(model || "").includes(k)) || CLAUDE_PRICE[3])[1];
const aiRowCost = r => {
  const p = claudeRate(r.model);
  return (r.input_tokens * p.inp + r.cache_creation_tokens * p.inp * 1.25 + r.cache_read_tokens * p.inp * 0.1 + r.output_tokens * p.out) / 1e6;
};

// Chart series — fixed order and hues from the validated palette; endpoints
// roll up into the category that actually bills.
const CATS = [
  { key: "google", label: "Google Places", color: "#2a78d6" },
  { key: "ai", label: "Claude AI", color: "#eb6834" },
  { key: "other", label: "Other", color: "#1baf7a" },
];
const catOf = e => (e === "search" || e === "profile" || e === "photo") ? "google" : e.startsWith("generate-") ? "ai" : "other";

const money = n => n >= 10 ? `$${n.toFixed(0)}` : `$${n.toFixed(2)}`;
const num = n => n.toLocaleString("en-US");

function DailyChart({ days }) {
  const [hover, setHover] = useState(null); // index into days
  const W = 720, H = 190, padL = 34, padB = 18, padT = 8;
  const plotW = W - padL - 6, plotH = H - padT - padB;
  const max = Math.max(1, ...days.map(d => d.google + d.ai + d.other));
  const step = plotW / days.length, barW = Math.max(2, step - 2);
  const y = v => padT + plotH - (v / max) * plotH;

  // Topmost segment of each stack gets a 4px rounded data-end.
  const seg = (x, top, bottom, rounded) => {
    const h = Math.max(0, bottom - top);
    if (h <= 0) return null;
    const r = rounded ? Math.min(4, barW / 2, h) : 0;
    return `M${x},${bottom} L${x},${top + r} Q${x},${top} ${x + r},${top} L${x + barW - r},${top} Q${x + barW},${top} ${x + barW},${top + r} L${x + barW},${bottom} Z`;
  };

  const gridVals = [max, max / 2];
  const hoverDay = hover != null ? days[hover] : null;

  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", display: "block" }} onMouseLeave={() => setHover(null)}>
        {gridVals.map(v => (
          <g key={v}>
            <line x1={padL} x2={W - 6} y1={y(v)} y2={y(v)} stroke="#e1e0d9" strokeWidth="1" />
            <text x={padL - 6} y={y(v) + 3.5} textAnchor="end" fontSize="10" fill="#898781">{Math.round(v)}</text>
          </g>
        ))}
        <line x1={padL} x2={W - 6} y1={y(0)} y2={y(0)} stroke="#c3c2b7" strokeWidth="1" />
        {days.map((d, i) => {
          const x = padL + i * step + 1;
          const stack = [d.google, d.ai, d.other];
          const tops = []; let acc = 0;
          for (const v of stack) { acc += v; tops.push(acc); }
          const topIdx = stack.reduce((t, v, j) => (v > 0 ? j : t), 0);
          return (
            <g key={d.day} opacity={hover == null || hover === i ? 1 : 0.45}>
              {stack.map((v, j) => {
                if (v <= 0) return null;
                const prev = j === 0 ? 0 : tops[j - 1];
                const bottomPx = y(prev) - (j > 0 ? 2 : 0); // 2px spacer between stacked fills
                const topPx = Math.min(y(tops[j]), bottomPx);
                return <path key={j} d={seg(x, topPx, bottomPx, j === topIdx)} fill={CATS[j].color} />;
              })}
              {i % 7 === 0 && (
                <text x={x + barW / 2} y={H - 4} textAnchor="middle" fontSize="9.5" fill="#898781">
                  {new Date(d.day + "T00:00:00Z").toLocaleDateString("en-US", { month: "numeric", day: "numeric", timeZone: "UTC" })}
                </text>
              )}
              <rect x={padL + i * step} y={0} width={step} height={H - padB} fill="transparent"
                onMouseEnter={() => setHover(i)} />
            </g>
          );
        })}
      </svg>
      {hoverDay && (
        <div style={{
          position: "absolute", top: 0, left: `${((padL + hover * step) / W) * 100}%`,
          transform: hover > days.length / 2 ? "translateX(-105%)" : "translateX(12px)",
          background: "var(--surface-2)", border: "1px solid var(--border-strong)", borderRadius: 8,
          padding: "8px 12px", fontSize: 12, pointerEvents: "none", boxShadow: "0 2px 8px rgba(11,11,11,.10)", whiteSpace: "nowrap",
        }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            {new Date(hoverDay.day + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}
          </div>
          {CATS.map(c => (
            <div key={c.key}><span className="dot" style={{ background: c.color, display: "inline-block", width: 9, height: 9, borderRadius: 3, marginRight: 6 }} />{c.label}: {num(hoverDay[c.key])}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function UsageTab() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  async function load() {
    if (MOCK) { setData(mockUsage()); return; }
    const [daily, topIps, aiDaily, blockedRes] = await Promise.all([
      supabase.rpc("usage_daily", { days: 30 }),
      supabase.rpc("usage_top_ips", { days: 7 }),
      supabase.rpc("ai_usage_daily", { days: 30 }),
      supabase.from("blocked_ips").select("*").order("created_at", { ascending: false }),
    ]);
    const err = daily.error || topIps.error || aiDaily.error || blockedRes.error;
    if (err) { setError("Could not load usage data — has db/004_usage.sql been run?"); return; }
    setData({ daily: daily.data || [], topIps: topIps.data || [], aiDaily: aiDaily.data || [], blocked: blockedRes.data || [] });
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function setBlocked(ip, block) {
    if (MOCK) {
      setData(d => ({
        ...d,
        topIps: d.topIps.map(r => r.ip === ip ? { ...r, blocked: block } : r),
        blocked: block ? [...d.blocked, { ip, note: "", created_at: new Date().toISOString() }] : d.blocked.filter(b => b.ip !== ip),
      }));
      return;
    }
    const { error: e } = block
      ? await supabase.from("blocked_ips").insert({ ip, note: "blocked from dashboard" })
      : await supabase.from("blocked_ips").delete().eq("ip", ip);
    if (e) setError("Could not update the blocklist.");
    else load();
  }

  if (error) return <p className="ap-meta" style={{ color: "#B3261E" }}>{error}</p>;
  if (!data) return <p className="ap-meta">Loading usage…</p>;

  // Roll the raw per-endpoint rows into per-day category stacks over a full
  // 30-day timeline (zero-filled so quiet days still show).
  const byDay = new Map();
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today); d.setUTCDate(d.getUTCDate() - i);
    const day = d.toISOString().slice(0, 10);
    byDay.set(day, { day, google: 0, ai: 0, other: 0 });
  }
  let googleCost30 = 0, googleCalls30 = 0, todayCalls = 0;
  const todayKey = today.toISOString().slice(0, 10);
  for (const r of data.daily) {
    const day = String(r.day).slice(0, 10);
    const slot = byDay.get(day);
    if (slot) slot[catOf(r.endpoint)] += Number(r.calls);
    if (GOOGLE_PRICE[r.endpoint] != null) { googleCost30 += Number(r.calls) * GOOGLE_PRICE[r.endpoint]; googleCalls30 += Number(r.calls); }
    if (day === todayKey) todayCalls += Number(r.calls);
  }
  const aiCalls30 = data.aiDaily.reduce((s, r) => s + Number(r.calls), 0);
  const aiCost30 = data.aiDaily.reduce((s, r) => s + aiRowCost(r), 0);
  const aiTokens30 = data.aiDaily.reduce((s, r) => s + Number(r.input_tokens) + Number(r.output_tokens), 0);
  const blockedOnly = data.blocked.filter(b => !data.topIps.some(t => t.ip === b.ip));

  return (
    <>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <div className="ap-stat">
          <div className="v">{money(googleCost30)}</div>
          <div className="l">Google Places, est. last 30 days</div>
          <div className="s">{num(googleCalls30)} billed calls</div>
        </div>
        <div className="ap-stat">
          <div className="v">{money(aiCost30)}</div>
          <div className="l">Claude API, est. last 30 days</div>
          <div className="s">{num(aiCalls30)} calls · {num(aiTokens30)} tokens</div>
        </div>
        <div className="ap-stat">
          <div className="v">{num(todayCalls)}</div>
          <div className="l">API requests today</div>
          <div className="s">all endpoints</div>
        </div>
      </div>

      <div className="ap-card" style={{ cursor: "default", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 10, flexWrap: "wrap" }}>
          <span className="ap-name">Daily API calls, last 30 days</span>
          <span style={{ flex: 1 }} />
          <div className="ap-legend">
            {CATS.map(c => <span key={c.key}><span className="dot" style={{ background: c.color }} />{c.label}</span>)}
          </div>
        </div>
        <DailyChart days={[...byDay.values()]} />
      </div>

      <div className="ap-card" style={{ cursor: "default", marginBottom: 20 }}>
        <div className="ap-name" style={{ marginBottom: 4 }}>Top IPs, last 7 days</div>
        <p className="ap-meta" style={{ margin: "0 0 10px" }}>
          A single IP with hundreds of calls and a script-like user agent is your bot. Blocks take effect within a minute.
        </p>
        <div style={{ overflowX: "auto" }}>
          <table className="ap-table">
            <thead><tr><th>IP</th><th>Requests</th><th>Last seen</th><th>User agent</th><th /></tr></thead>
            <tbody>
              {data.topIps.length === 0 && <tr><td colSpan={5} className="ap-meta">No traffic logged yet.</td></tr>}
              {data.topIps.map(r => (
                <tr key={r.ip}>
                  <td style={{ fontFamily: "ui-monospace, monospace", fontSize: 12 }}>{r.ip}{r.blocked && <span className="ap-tag" style={{ marginLeft: 8, color: "#B3261E", borderColor: "#B3261E" }}>blocked</span>}</td>
                  <td>{num(Number(r.calls))}</td>
                  <td className="ap-meta">{fmtDate(r.last_seen)}</td>
                  <td className="ap-meta" style={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.user_agent || "—"}</td>
                  <td style={{ textAlign: "right" }}>
                    <button className="ap-btn ap-mini" onClick={() => setBlocked(r.ip, !r.blocked)}>
                      {r.blocked ? "Unblock" : "Block"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {blockedOnly.length > 0 && (
          <p className="ap-meta" style={{ margin: "12px 0 0" }}>
            Also blocked (no recent traffic): {blockedOnly.map(b => (
              <span key={b.ip} className="ap-tag" style={{ marginRight: 6 }}>
                {b.ip} <a href="#" onClick={e => { e.preventDefault(); setBlocked(b.ip, false); }} style={{ color: "inherit" }}>×</a>
              </span>
            ))}
          </p>
        )}
      </div>

      <p className="ap-meta" style={{ fontSize: 12 }}>
        Dollar figures are estimates from logged calls and current list prices; the authoritative numbers are in the{" "}
        <a href="https://console.cloud.google.com/billing" target="_blank" rel="noopener noreferrer">GCP billing console</a> and the{" "}
        <a href="https://platform.claude.com/settings/cost" target="_blank" rel="noopener noreferrer">Anthropic console</a>.
        Logging starts from the day this feature shipped.
      </p>
    </>
  );
}

export default function Admin() {
  const [session, setSession] = useState(undefined); // undefined = checking, null = signed out
  const [leads, setLeads] = useState([]);            // profiles + their landers, newest first
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState(null);
  const [tab, setTab] = useState("leads"); // 'leads' | 'usage'

  useEffect(() => {
    if (MOCK) { setSession({ user: { email: ADMIN_EMAILS[0] } }); return; }
    if (!supabase) { setSession(null); return; }
    supabase.auth.getSession().then(({ data }) => setSession(data?.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s ?? null));
    return () => sub?.subscription?.unsubscribe();
  }, []);

  const email = session?.user?.email || "";
  const isAdmin = ADMIN_EMAILS.includes(email);

  // Load everything once (volume is small); landers.user_id has no FK to
  // profiles PostgREST can embed through, so join the two lists client-side.
  useEffect(() => {
    if (!session || !isAdmin) return;
    if (MOCK) { setLeads(MOCK_LEADS); return; }
    (async () => {
      const [{ data: profiles, error: pErr }, { data: landers, error: lErr }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("landers").select("*").order("created_at", { ascending: false }),
      ]);
      if (pErr || lErr) { setLoadError("Could not load signups — has db/003_admin_portal.sql been run?"); return; }
      const byUser = new Map();
      (landers || []).forEach(l => {
        if (!byUser.has(l.user_id)) byUser.set(l.user_id, []);
        byUser.get(l.user_id).push(l);
      });
      setLeads((profiles || []).map(p => ({ ...p, landers: byUser.get(p.id) || [] })));
    })();
  }, [session, isAdmin]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter(l =>
      [l.name, l.email, l.phone, ...l.landers.map(x => x.name), ...l.landers.map(x => x.profile?.main_service)]
        .some(v => String(v || "").toLowerCase().includes(q))
    );
  }, [leads, query]);

  async function signIn() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/admin` },
    });
  }

  const shell = children => (
    <div style={{ minHeight: "100dvh", background: "var(--paper)" }}>
      <style>{ADMIN_CSS}</style>
      <div style={{ background: "#181D24", padding: "14px 20px", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 700, fontSize: 15, color: "#fff", letterSpacing: "-.01em" }}>
          SendKPI <span style={{ color: "var(--signal)" }}>Admin</span>
        </span>
        <span style={{ flex: 1 }} />
        {session && (
          <button className="ap-btn" style={{ background: "transparent", color: "#fff", borderColor: "#3A424D" }} onClick={() => supabase?.auth.signOut()}>
            Sign out
          </button>
        )}
      </div>
      <div className="ap-wrap">{children}</div>
    </div>
  );

  if (!supabase && !MOCK) return shell(<p className="ap-meta">Supabase isn’t configured in this build (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).</p>);
  if (session === undefined) return shell(<p className="ap-meta">Checking session…</p>);
  if (!session) return shell(
    <div style={{ maxWidth: 380, margin: "80px auto 0", textAlign: "center" }}>
      <h1 className="ap-h1" style={{ marginBottom: 8 }}>Asset portal</h1>
      <p className="ap-meta" style={{ marginBottom: 20 }}>Sign in with the admin Google account to look up leads and their marketing files.</p>
      <button className="ap-btn primary" style={{ fontSize: 14, padding: "11px 22px" }} onClick={signIn}>Sign in with Google</button>
    </div>
  );
  if (!isAdmin) return shell(
    <div style={{ maxWidth: 420, margin: "80px auto 0", textAlign: "center" }}>
      <h1 className="ap-h1" style={{ marginBottom: 8 }}>Not authorized</h1>
      <p className="ap-meta">{email} doesn’t have admin access. Sign out and use the admin account.</p>
    </div>
  );

  return shell(
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 16, margin: "6px 0 18px", flexWrap: "wrap" }}>
        <div className="ap-tabs">
          <button className={`ap-tab${tab === "leads" ? " active" : ""}`} onClick={() => setTab("leads")}>Leads</button>
          <button className={`ap-tab${tab === "usage" ? " active" : ""}`} onClick={() => setTab("usage")}>Usage</button>
        </div>
        {tab === "leads" && <span className="ap-meta">{leads.length} signup{leads.length === 1 ? "" : "s"}</span>}
      </div>
      {tab === "usage" && <UsageTab />}
      {tab === "leads" && <>
      <input
        className="ap-search"
        placeholder="Search by name, business, email, or phone…"
        value={query}
        onChange={e => setQuery(e.target.value)}
        style={{ marginBottom: 16 }}
      />
      {loadError && <p className="ap-meta" style={{ color: "#B3261E" }}>{loadError}</p>}
      {!loadError && filtered.length === 0 && (
        <p className="ap-meta">{leads.length === 0 ? "No signups yet." : "No matches for that search."}</p>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map(lead => {
          const open = openId === lead.id;
          return (
            <div key={lead.id} className={`ap-card${open ? " open" : ""}`} onClick={() => !open && setOpenId(lead.id)}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div style={{ minWidth: 200 }}>
                  <div className="ap-name">{lead.name}</div>
                  <div className="ap-meta">
                    {lead.landers[0]?.name || "No lander saved"}
                    {lead.landers.length > 1 ? ` +${lead.landers.length - 1} more` : ""}
                  </div>
                  {lead.landers[0]?.profile?.main_service && (
                    <div className="ap-tag" style={{ marginTop: 4 }}>wants calls for: {lead.landers[0].profile.main_service}</div>
                  )}
                </div>
                <span style={{ flex: 1 }} />
                <div className="ap-meta" style={{ textAlign: "right" }}>
                  <div>
                    <a href={`mailto:${lead.email}`} onClick={e => e.stopPropagation()} style={{ color: "inherit" }}>{lead.email}</a>
                    {lead.phone ? <> · <a href={`tel:${lead.phone}`} onClick={e => e.stopPropagation()} style={{ color: "inherit" }}>{lead.phone}</a></> : null}
                  </div>
                  <div>signed up {fmtDate(lead.created_at)}</div>
                </div>
                {open && (
                  <button className="ap-btn" onClick={e => { e.stopPropagation(); setOpenId(null); }}>Close</button>
                )}
              </div>
              {open && lead.landers.length === 0 && (
                <p className="ap-meta" style={{ borderTop: "1px solid var(--border)", paddingTop: 14, marginTop: 14, marginBottom: 0 }}>
                  This account signed in but never saved a lander.
                </p>
              )}
              {open && lead.landers.map(l => <LanderAssets key={l.id} lander={l} />)}
            </div>
          );
        })}
      </div>
      </>}
    </>
  );
}

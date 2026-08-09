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
        tagline: "Fast, honest plumbing since 1982",
        services: ["Drain cleaning", "Water heaters", "Leak repair"],
        service_areas: ["Santa Cruz", "Capitola"], reviews: [], photos: [], hours: [],
      },
    }],
  },
  { id: "mock-2", name: "Rosa Alvarez", email: "rosa@example.com", phone: null, created_at: "2026-08-05T12:00:00Z", landers: [] },
];

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

  const storedLander = assets?.find(f => !f.isImage);
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

export default function Admin() {
  const [session, setSession] = useState(undefined); // undefined = checking, null = signed out
  const [leads, setLeads] = useState([]);            // profiles + their landers, newest first
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState(null);

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
      [l.name, l.email, l.phone, ...l.landers.map(x => x.name)]
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
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, margin: "6px 0 18px" }}>
        <h1 className="ap-h1">Leads</h1>
        <span className="ap-meta">{leads.length} signup{leads.length === 1 ? "" : "s"}</span>
      </div>
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
    </>
  );
}

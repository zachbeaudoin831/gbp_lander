import { useEffect, useState } from "react";
import { LogoMark } from "./Home";
import { KitDelivery, describeKitFile } from "./App.jsx";

/* /kit?id=…&t=… -- the page the kit email links to. Pulls the stored files
   (signed URLs, 1h) from the backend and renders the same delivery page the
   visitor saw right after signing up, so "come back for it later" works
   without an account. */

const API_BASE = "https://gbp-lander.vercel.app";

function Shell({ children }) {
  return (
    <div style={{ minHeight: "100dvh", background: "var(--surface-1)" }}>
      <div style={{ background: "#181D24", padding: "12px 20px", display: "flex", alignItems: "center", gap: 10 }}>
        <LogoMark size={26} ring="#181D24" />
        <span style={{ fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif", fontWeight: 700, fontSize: 14, color: "#fff", letterSpacing: "-.01em", marginLeft: -5 }}>SendKPI</span>
      </div>
      <div style={{ padding: "48px 20px", maxWidth: 680, margin: "0 auto", color: "var(--text-secondary)", fontSize: 15, lineHeight: 1.6 }}>{children}</div>
    </div>
  );
}

export default function Kit() {
  const [state, setState] = useState({ status: "loading" });

  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    const id = qs.get("id"), t = qs.get("t");
    if (!id || !t) { setState({ status: "missing" }); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/kit?id=${encodeURIComponent(id)}&t=${encodeURIComponent(t)}`);
        if (!res.ok) { setState({ status: res.status === 404 ? "missing" : "error" }); return; }
        const data = await res.json();
        // Pull each file down once so previews and the zip work off local
        // bytes (the signed URLs are cross-origin and expire).
        const files = [];
        for (const f of data.files || []) {
          const meta = describeKitFile(f.name);
          try {
            const r = await fetch(f.url);
            if (!r.ok) continue;
            if (meta.kind === "html") {
              const html = await r.text();
              files.push({ ...meta, name: f.name, previewHtml: html, href: URL.createObjectURL(new Blob([html], { type: "text/html" })) });
            } else if (meta.kind === "gads") {
              const text = await r.text();
              const lines = text.split("\n").map(l => l.trim());
              const after = h => { const i = lines.findIndex(l => l.startsWith(h)); return i > -1 ? (lines[i + 1] || "").replace(/^\d+\.\s*/, "") : ""; };
              files.push({ ...meta, name: f.name, text, href: URL.createObjectURL(new Blob([text], { type: "text/plain" })), previewHeadline: after("HEADLINES"), previewDesc: after("DESCRIPTIONS") });
            } else {
              files.push({ ...meta, name: f.name, href: URL.createObjectURL(await r.blob()) });
            }
          } catch { /* skip unreadable file */ }
        }
        // Storage lists alphabetically; show the kit in its natural order.
        const rank = f => /-split-test-lander-|-lander-v\d\.html$/.test(f.name) ? 0 : /-google-ads/.test(f.name) ? 1 : /-meta-ads-copy/.test(f.name) ? 2 : 3;
        files.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
        if (!cancelled) setState({ status: "ready", business: data.business, files });
      } catch {
        if (!cancelled) setState({ status: "error" });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (state.status === "loading") return <Shell>Fetching your files…</Shell>;
  if (state.status === "missing") return <Shell>This link isn't valid. Check the email for the full link, or build a fresh kit at <a href="/" style={{ color: "#0D57D0" }}>sendkpi.com</a>.</Shell>;
  if (state.status === "error") return <Shell>Couldn't load your files right now. Give it a minute and reload.</Shell>;
  if (!state.files.length) return <Shell>Your files aren't in storage yet. If you just signed up, give it a minute and reload; otherwise build a fresh kit at <a href="/" style={{ color: "#0D57D0" }}>sendkpi.com</a>.</Shell>;
  return <KitDelivery bizName={state.business || ""} files={state.files} emailedTo={null} />;
}

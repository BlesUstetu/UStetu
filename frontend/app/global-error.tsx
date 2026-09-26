"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[USTETU FRONTEND RUNTIME ERROR]", error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#070a10", color: "#f4f7ff", fontFamily: "system-ui, sans-serif" }}>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
          <section style={{ width: "min(720px, 100%)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 20, padding: 28, background: "rgba(13,18,32,.96)", boxShadow: "0 20px 80px rgba(0,0,0,.45)" }}>
            <div style={{ fontSize: 11, letterSpacing: ".18em", opacity: .6 }}>USTETU FRONTEND</div>
            <h1 style={{ margin: "10px 0 8px", fontSize: 28 }}>Frontend runtime error</h1>
            <p style={{ margin: "0 0 18px", color: "#aeb9cc" }}>
              The static page was delivered, but the browser encountered a JavaScript error while starting the application.
            </p>
            <div style={{ padding: 16, borderRadius: 14, background: "#090d17", border: "1px solid rgba(255,255,255,.08)", overflowWrap: "anywhere", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12, lineHeight: 1.6 }}>
              {error?.message || "Unknown frontend runtime error"}
            </div>
            {error?.digest ? (
              <div style={{ marginTop: 10, fontSize: 11, opacity: .55, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                Digest: {error.digest}
              </div>
            ) : null}
            <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
              <button type="button" onClick={() => reset()} style={{ border: 0, borderRadius: 12, padding: "11px 16px", cursor: "pointer", fontWeight: 700 }}>
                Reload
              </button>
              <button type="button" onClick={() => window.location.reload()} style={{ border: "1px solid rgba(255,255,255,.14)", borderRadius: 12, padding: "11px 16px", cursor: "pointer", color: "#f4f7ff", background: "transparent", fontWeight: 700 }}>
                Hard Reload
              </button>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}

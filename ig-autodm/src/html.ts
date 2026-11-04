export function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const CSS = `
:root{--bg:#f6f4f1;--card:#fff;--text:#1d1b19;--muted:#6f6a64;--line:#e6e1da;--accent:#c2416b;--accent-ink:#fff;
--ok:#1f7a4d;--ok-bg:#e3f4ea;--warn:#8a5a00;--warn-bg:#fff2d6;--bad:#a12a2a;--bad-bg:#fbe4e4;--chip:#f1ece6}
@media (prefers-color-scheme:dark){:root{--bg:#141312;--card:#1e1c1a;--text:#f1ede8;--muted:#a59f97;--line:#34302c;
--accent:#e0628b;--ok:#6fd39f;--ok-bg:#183326;--warn:#f0c46a;--warn-bg:#3a2e12;--bad:#f08b8b;--bad-bg:#3d1b1b;--chip:#2a2724}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:16px/1.5 system-ui,-apple-system,"Segoe UI",Arial,sans-serif}
main{max-width:760px;margin:0 auto;padding:16px 16px 64px}
h1{font-size:22px;margin:8px 0 4px}h2{font-size:17px;margin:0 0 12px}
a{color:var(--accent)}
.muted{color:var(--muted);font-size:14px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px;margin:14px 0}
.row{display:flex;gap:12px;align-items:center;flex-wrap:wrap}
.spacer{flex:1}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1px solid var(--line);background:var(--card);
color:var(--text);border-radius:10px;padding:9px 14px;font:inherit;font-size:15px;cursor:pointer;text-decoration:none}
.btn.primary{background:var(--accent);border-color:var(--accent);color:var(--accent-ink)}
.btn.danger{color:var(--bad)}
.btn.small{padding:5px 10px;font-size:14px}
form.inline{display:inline}
label{display:block;font-weight:600;margin:14px 0 6px}
input[type=text],input[type=url],input[type=password],textarea{width:100%;border:1px solid var(--line);border-radius:10px;
padding:10px 12px;font:inherit;background:var(--bg);color:var(--text)}
textarea{min-height:96px;resize:vertical}
.check{display:flex;gap:10px;align-items:center;font-weight:500;margin:10px 0}
.check input{width:20px;height:20px;accent-color:var(--accent)}
.hint{color:var(--muted);font-size:13px;margin-top:4px}
.chip{display:inline-block;background:var(--chip);border-radius:999px;padding:2px 10px;font-size:13px;margin:2px}
.banner{border-radius:12px;padding:12px 14px;margin:12px 0;font-size:15px}
.banner.ok{background:var(--ok-bg);color:var(--ok)}.banner.warn{background:var(--warn-bg);color:var(--warn)}
.banner.bad{background:var(--bad-bg);color:var(--bad)}
.rule{display:flex;gap:12px;align-items:flex-start}
.thumb{width:64px;height:84px;border-radius:8px;object-fit:cover;background:var(--chip);flex:none}
.rule .body{flex:1;min-width:0}
.cap{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.off{opacity:.55}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.tile{display:block;border:1px solid var(--line);border-radius:12px;overflow:hidden;background:var(--card);color:var(--text);text-decoration:none}
.tile img{width:100%;aspect-ratio:4/5;object-fit:cover;display:block;background:var(--chip)}
.tile div{padding:6px 8px;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tile.used{outline:2px solid var(--accent)}
table{width:100%;border-collapse:collapse;font-size:14px}
td,th{padding:8px 4px;border-bottom:1px solid var(--line);text-align:start;vertical-align:top}
.st{font-weight:600}.st.sent{color:var(--ok)}.st.failed,.st.expired{color:var(--bad)}.st.pending,.st.sending{color:var(--warn)}
.preview{background:var(--bg);border:1px solid var(--line);border-radius:16px;padding:12px;max-width:320px;white-space:pre-wrap}
.preview .pbtn{display:block;margin-top:10px;text-align:center;border-top:1px solid var(--line);padding-top:8px;color:var(--accent);font-weight:600}
.err{color:var(--bad);font-size:14px}
`;

export function page(title: string, body: string, opts: { status?: number; headers?: HeadersInit } = {}): Response {
  const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${esc(title)}</title><style>${CSS}</style></head><body><main>${body}</main></body></html>`;
  const headers = new Headers(opts.headers);
  headers.set("Content-Type", "text/html; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "same-origin");
  headers.set(
    "Content-Security-Policy",
    "default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
  );
  return new Response(html, { status: opts.status ?? 200, headers });
}

export function redirect(location: string, headers: HeadersInit = {}): Response {
  const h = new Headers(headers);
  h.set("Location", location);
  return new Response(null, { status: 303, headers: h });
}

export function timeAgo(ms: number): string {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return "עכשיו";
  const m = Math.round(s / 60);
  if (m < 60) return `לפני ${m} דק'`;
  const h = Math.round(m / 60);
  if (h < 24) return `לפני ${h} שע'`;
  return `לפני ${Math.round(h / 24)} ימים`;
}

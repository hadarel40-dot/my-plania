// דף הניהול: חוקים (ריל + מילת מפתח + הודעה), הגדרות, ופעילות אחרונה
import type { Env, Rule } from "./types";
import {
  getAppSettings,
  getRule,
  getSetting,
  listRules,
  queueStats,
  recentComments,
  sentInLastHour,
  setSetting,
} from "./db";
import { checkLogin, clearSessionCookie, isLoggedIn, makeSessionCookie, sameOrigin } from "./auth";
import { esc, page, redirect, timeAgo } from "./html";
import { buildMessage, parseKeywords, parseVariants, validateRuleInput } from "./match";
import {
  completeOAuth,
  getConnection,
  getMedia,
  listMedia,
  mediaThumb,
  oauthDialogUrl,
  subscribeComments,
  type Media,
} from "./instagram";
import { processQueue } from "./sender";

const DEFAULT_MESSAGE = "היי {שם}! איזה כיף שהגבת 💛\nהנה מה שהבטחתי:";

export async function handleAdmin(request: Request, env: Env, url: URL): Promise<Response> {
  const path = url.pathname.replace(/\/+$/, "") || "/admin";
  const method = request.method;

  if (path === "/admin/login") {
    if (method === "POST") return loginPost(request, env);
    return loginPage();
  }
  // החזרה מפייסבוק מגיעה מאתר אחר, אז עוגיית הכניסה (SameSite=Strict) לא נשלחת. מאמתים לפי עוגיית ה-state
  if (path === "/admin/callback" && method === "GET") return oauthCallback(request, env, url);
  if (!(await isLoggedIn(request, env))) return redirect("/admin/login");
  if (method === "POST" && !sameOrigin(request)) return new Response("Forbidden", { status: 403 });

  try {
    if (method === "GET" && path === "/admin") return await dashboard(env, url);
    if (method === "GET" && path === "/admin/new") return await mediaPicker(env, url);
    if (method === "GET" && path === "/admin/rule") return await ruleForm(env, url);
    if (method === "POST") {
      const form = await request.formData();
      const f = (k: string) => String(form.get(k) ?? "");
      switch (path) {
        case "/admin/rule":
          return await saveRule(env, form);
        case "/admin/rule/toggle":
          await env.DB.prepare("UPDATE rules SET active = 1 - active, updated_at = ? WHERE id = ?")
            .bind(Date.now(), Number(f("id")))
            .run();
          return redirect("/admin");
        case "/admin/rule/delete":
          await env.DB.prepare("DELETE FROM rules WHERE id = ?").bind(Number(f("id"))).run();
          return redirect("/admin?msg=" + encodeURIComponent("הריל הוסר"));
        case "/admin/settings":
          await setSetting(env, "enabled", form.get("enabled") ? "1" : "0");
          await setSetting(env, "test_mode", form.get("test_mode") ? "1" : "0");
          await setSetting(env, "test_username", f("test_username").trim().replace(/^@/, ""));
          await setSetting(env, "variants", parseVariants(f("variants")).join("\n"));
          return redirect("/admin?msg=" + encodeURIComponent("ההגדרות נשמרו"));
        case "/admin/subscribe":
          await subscribeComments(env);
          await setSetting(env, "subscribed", "1");
          return redirect("/admin?msg=" + encodeURIComponent("קבלת התגובות הופעלה"));
        case "/admin/connect": {
          if (!env.META_APP_ID || !env.META_APP_SECRET)
            throw new Error("חסרים META_APP_ID או META_APP_SECRET בהגדרות השרת");
          const state = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");
          return redirect(oauthDialogUrl(env, url.origin + "/admin/callback", state), {
            "Set-Cookie": `${STATE_COOKIE}=${state}; Path=/admin/callback; HttpOnly; Secure; SameSite=Lax; Max-Age=900`,
          });
        }
        case "/admin/retry":
          await env.DB.prepare(
            "UPDATE comments SET status = 'pending', attempts = 0, next_try_at = ? WHERE status = 'failed' AND received_at > ?",
          )
            .bind(Date.now(), Date.now() - 7 * 86400_000)
            .run();
          await processQueue(env);
          return redirect("/admin?msg=" + encodeURIComponent("ניסיתי לשלוח שוב"));
        case "/admin/logout":
          return redirect("/admin/login", { "Set-Cookie": clearSessionCookie() });
      }
    }
  } catch (e) {
    return page(
      "שגיאה",
      `<h1>משהו השתבש</h1><div class="banner bad">${esc((e as Error).message)}</div><a class="btn" href="/admin">חזרה</a>`,
      { status: 500 },
    );
  }
  return new Response("Not found", { status: 404 });
}

const STATE_COOKIE = "igdm_state";

async function oauthCallback(request: Request, env: Env, url: URL): Promise<Response> {
  const fail = (m: string) =>
    page("חיבור", `<h1>החיבור לא הצליח</h1><div class="banner bad">${esc(m)}</div><a class="btn" href="/admin">חזרה</a>`, {
      status: 400,
      headers: { "Set-Cookie": `${STATE_COOKIE}=; Path=/admin/callback; HttpOnly; Secure; SameSite=Lax; Max-Age=0` },
    });
  const cookieState = (request.headers.get("Cookie") ?? "").match(new RegExp(`(?:^|;\\s*)${STATE_COOKIE}=([0-9a-f]{32})`))?.[1];
  const state = url.searchParams.get("state") ?? "";
  if (!cookieState || cookieState !== state) return fail("הקישור פג. מתחילים שוב מדף הניהול");
  if (url.searchParams.get("error")) return fail(url.searchParams.get("error_description") || "בוטל");
  const code = url.searchParams.get("code");
  if (!code) return fail("לא התקבל קוד מפייסבוק");
  try {
    const conn = await completeOAuth(env, code, url.origin + "/admin/callback");
    let msg = `מחובר ל-@${conn.igUsername}`;
    try {
      await subscribeComments(env);
      await setSetting(env, "subscribed", "1");
    } catch (e) {
      await setSetting(env, "subscribed", "0");
      msg += `. ההרשמה להתראות על תגובות לא הצליחה: ${(e as Error).message}`;
    }
    return redirect("/admin?msg=" + encodeURIComponent(msg), {
      "Set-Cookie": `${STATE_COOKIE}=; Path=/admin/callback; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
    });
  } catch (e) {
    return fail((e as Error).message);
  }
}

function loginPage(error = "", status = 200): Response {
  return page(
    "כניסה",
    `<div class="card" style="max-width:380px;margin:48px auto">
      <h1>תגובה ← הודעה</h1><p class="muted">כניסה לדף הניהול</p>
      ${error ? `<div class="banner bad">${esc(error)}</div>` : ""}
      <form method="post" action="/admin/login">
        <label for="pw">סיסמה</label>
        <input id="pw" type="password" name="password" autocomplete="current-password" required autofocus>
        <p><button class="btn primary" type="submit">כניסה</button></p>
      </form></div>`,
    { status },
  );
}

async function loginPost(request: Request, env: Env): Promise<Response> {
  if (!sameOrigin(request)) return new Response("Forbidden", { status: 403 });
  const form = await request.formData();
  const error = await checkLogin(request, env, String(form.get("password") ?? ""));
  if (error) return loginPage(error, 401);
  return redirect("/admin", { "Set-Cookie": await makeSessionCookie(env) });
}

async function dashboard(env: Env, url: URL): Promise<Response> {
  const [settings, rules, stats, recent, lastHour, tokenError] = await Promise.all([
    getAppSettings(env),
    listRules(env),
    queueStats(env),
    recentComments(env, 25),
    sentInLastHour(env),
    getSetting(env, "ig_token_error"),
  ]);

  // פרטי החשבון ותמונות הריילס (כתובות התמונות של אינסטגרם פגות, אז מביאים מחדש)
  const conn = await getConnection(env);
  const connected = !!(conn.token && conn.igId);
  const me = connected ? { username: conn.igUsername || conn.igId } : null;
  let igError = "";
  const subscribed = connected ? (await getSetting(env, "subscribed")) === "1" : null;
  const thumbs = new Map<string, string>();
  try {
    if (!connected) throw new Error("");
    const media = await listMedia(env);
    for (const m of media.data) thumbs.set(m.id, mediaThumb(m));
    const missing = rules.filter((r) => !thumbs.has(r.media_id)).slice(0, 8);
    await Promise.all(
      missing.map((r) =>
        getMedia(env, r.media_id)
          .then((m) => thumbs.set(m.id, mediaThumb(m)))
          .catch(() => {}),
      ),
    );
  } catch (e) {
    igError = (e as Error).message;
  }

  const msg = url.searchParams.get("msg");
  const banners: string[] = [];
  if (msg) banners.push(`<div class="banner ok">${esc(msg)}</div>`);
  const connectBtn = (label: string) =>
    `<form class="inline" method="post" action="/admin/connect"><button class="btn small" type="submit">${label}</button></form>`;
  if (!connected)
    banners.push(`<div class="banner warn">חשבון האינסטגרם עוד לא מחובר. ${connectBtn("חיבור החשבון")}</div>`);
  else if (igError)
    banners.push(`<div class="banner bad">אין חיבור לאינסטגרם: ${esc(igError)} ${connectBtn("חיבור מחדש")}</div>`);
  else if (tokenError) banners.push(`<div class="banner warn">בעיה בטוקן של אינסטגרם: ${esc(tokenError)}</div>`);
  if (subscribed === false)
    banners.push(`<div class="banner warn">החשבון עוד לא מקבל התראות על תגובות.
      <form class="inline" method="post" action="/admin/subscribe"><button class="btn small" type="submit">להפעיל עכשיו</button></form></div>`);
  if (!settings.enabled) banners.push(`<div class="banner bad">המערכת כבויה. לא נשלחות הודעות.</div>`);
  else if (settings.testMode)
    banners.push(
      settings.testUsername
        ? `<div class="banner warn">מצב בדיקה: הודעות נשלחות רק ל-@${esc(settings.testUsername)}. כשהבדיקה עברה, מכבים את מצב הבדיקה למטה.</div>`
        : `<div class="banner warn">מצב בדיקה פעיל, אבל לא הוגדר חשבון בדיקה, אז שום הודעה לא נשלחת. כתבי למטה את שם המשתמש של חשבון הבדיקה.</div>`,
    );

  const ruleCards = rules.length
    ? rules
        .map((r) => {
          const thumb = thumbs.get(r.media_id);
          return `<div class="card rule ${r.active ? "" : "off"}">
          ${thumb ? `<img class="thumb" src="${esc(thumb)}" alt="" loading="lazy">` : `<div class="thumb"></div>`}
          <div class="body">
            <div class="cap">${esc(r.media_caption || "ריל בלי כיתוב")}</div>
            <div>${parseKeywords(r.keywords).map((k) => `<span class="chip">${esc(k)}</span>`).join("")}</div>
            <div class="muted">${r.active ? "פעיל" : "כבוי"} · נשלחו ${r.sent}${r.queued ? ` · בתור ${r.queued}` : ""}
              ${r.media_permalink ? ` · <a href="${esc(r.media_permalink)}" target="_blank" rel="noopener">לריל</a>` : ""}</div>
            <div class="row" style="margin-top:8px">
              <a class="btn small" href="/admin/rule?id=${r.id}">עריכה</a>
              <form class="inline" method="post" action="/admin/rule/toggle"><input type="hidden" name="id" value="${r.id}">
                <button class="btn small" type="submit">${r.active ? "כיבוי" : "הפעלה"}</button></form>
              <form class="inline" method="post" action="/admin/rule/delete" onsubmit="return confirm('להסיר את הריל מהמערכת?')">
                <input type="hidden" name="id" value="${r.id}"><button class="btn small danger" type="submit">הסרה</button></form>
            </div>
          </div></div>`;
        })
        .join("")
    : `<div class="card muted">עוד אין ריילס. לוחצים על "ריל חדש" ובוחרים ריל.</div>`;

  const statusName: Record<string, string> = {
    pending: "בתור",
    sending: "נשלח עכשיו",
    sent: "נשלח",
    failed: "נכשל",
    expired: "פג תוקף",
    skipped: "דולג",
  };
  const activity = recent.length
    ? `<table><tr><th>מי</th><th>תגובה</th><th>מצב</th><th>מתי</th></tr>${recent
        .map(
          (c) => `<tr><td>@${esc(c.username)}</td><td>${esc(c.text.slice(0, 60))}</td>
          <td><span class="st ${esc(c.status)}">${esc(statusName[c.status] ?? c.status)}</span>
          ${c.dm_mode === "text" ? `<div class="muted">נשלח בלי כפתור</div>` : ""}
          ${c.error && c.status !== "sent" ? `<div class="err">${esc(c.error)}</div>` : ""}
          ${c.reply_error ? `<div class="muted">התגובה הפומבית נכשלה: ${esc(c.reply_error)}</div>` : ""}</td>
          <td class="muted">${timeAgo(c.received_at)}</td></tr>`,
        )
        .join("")}</table>`
    : `<p class="muted">עוד אין תגובות שהתאימו.</p>`;

  return page(
    "ניהול",
    `<div class="row"><div><h1>תגובה ← הודעה</h1>
      <div class="muted">${me ? `@${esc(me.username)}` : "לא מחובר"} · נשלחו בשעה האחרונה ${lastHour}/${esc(env.HOURLY_LIMIT)}
      · בתור ${stats.queued}</div></div><span class="spacer"></span>
      <form class="inline" method="post" action="/admin/logout"><button class="btn small" type="submit">יציאה</button></form></div>
    ${banners.join("")}
    <div class="row" style="margin-top:18px"><h2 style="margin:0">ריילס</h2><span class="spacer"></span>
      <a class="btn primary" href="/admin/new">+ ריל חדש</a></div>
    ${ruleCards}

    <div class="card"><h2>הגדרות</h2>
      <form method="post" action="/admin/settings">
        <label class="check"><input type="checkbox" name="enabled" ${settings.enabled ? "checked" : ""}> המערכת פעילה</label>
        <div class="hint">כשזה כבוי, שום הודעה לא נשלחת. ככה עוצרים הכול בלחיצה אחת.</div>
        <label class="check"><input type="checkbox" name="test_mode" ${settings.testMode ? "checked" : ""}> מצב בדיקה</label>
        <div class="hint">במצב בדיקה עונים רק לחשבון הבדיקה.</div>
        <label for="tu">חשבון בדיקה (שם משתמש)</label>
        <input id="tu" type="text" name="test_username" value="${esc(settings.testUsername)}" placeholder="למשל my.test.account" dir="ltr">
        <label for="vars">נוסחי התגובה הפומבית (נוסח בכל שורה, נבחר אחד באקראי)</label>
        <textarea id="vars" name="variants" rows="6">${esc(settings.variants)}</textarea>
        <p><button class="btn primary" type="submit">שמירה</button></p>
      </form></div>

    <div class="card"><div class="row"><h2 style="margin:0">פעילות אחרונה</h2><span class="spacer"></span>
      ${stats.failed ? `<form class="inline" method="post" action="/admin/retry"><button class="btn small" type="submit">לנסות שוב את מה שנכשל</button></form>` : ""}</div>
      ${activity}<p class="muted">נשמרות רק תגובות שהתאימו למילת מפתח, ונמחקות אחרי 90 יום.</p></div>`,
  );
}

async function mediaPicker(env: Env, url: URL): Promise<Response> {
  const after = url.searchParams.get("after") ?? undefined;
  const [media, rules] = await Promise.all([listMedia(env, after), listRules(env)]);
  const used = new Set(rules.map((r) => r.media_id));
  const next = media.paging?.next ? media.paging.cursors?.after : undefined;
  const tiles = media.data
    .map(
      (m) => `<a class="tile ${used.has(m.id) ? "used" : ""}" href="/admin/rule?media=${encodeURIComponent(m.id)}">
        <img src="${esc(mediaThumb(m))}" alt="" loading="lazy">
        <div>${used.has(m.id) ? "✓ " : ""}${esc((m.caption ?? "").slice(0, 40) || kind(m))}</div></a>`,
    )
    .join("");
  return page(
    "בחירת ריל",
    `<div class="row"><h1>איזה ריל?</h1><span class="spacer"></span><a class="btn" href="/admin">ביטול</a></div>
     <p class="muted">לוחצים על הריל או הפוסט. מסומן בצבע = כבר יש לו מילת מפתח.</p>
     <div class="grid">${tiles || `<p class="muted">לא נמצאו פוסטים.</p>`}</div>
     ${next ? `<p><a class="btn" href="/admin/new?after=${encodeURIComponent(next)}">עוד ריילס ←</a></p>` : ""}`,
  );
}

function kind(m: Media): string {
  if (m.media_product_type === "REELS") return "ריל";
  if (m.media_type === "CAROUSEL_ALBUM") return "קרוסלה";
  return "פוסט";
}

async function ruleForm(env: Env, url: URL, values?: Partial<Rule>, errors: string[] = []): Promise<Response> {
  let rule: Partial<Rule> | null = values ?? null;
  const id = Number(url.searchParams.get("id") || values?.id || 0);
  if (!rule && id) rule = await getRule(env, id);
  if (!rule) {
    rule = {
      media_id: url.searchParams.get("media") ?? "",
      keywords: "",
      message: DEFAULT_MESSAGE,
      button_title: "",
      button_url: "",
      use_name: 1,
      public_reply: 1,
      active: 1,
    };
  }
  let media: Media | null = null;
  try {
    if (rule.media_id) media = await getMedia(env, rule.media_id);
  } catch {
    /* מציגים בלי תמונה */
  }
  const preview = buildMessage(rule.message ?? "", "noa.cohen", !!rule.use_name);
  return page(
    id ? "עריכת ריל" : "ריל חדש",
    `<div class="row"><h1>${id ? "עריכה" : "ריל חדש"}</h1><span class="spacer"></span><a class="btn" href="/admin">ביטול</a></div>
    ${errors.length ? `<div class="banner bad">${errors.map(esc).join("<br>")}</div>` : ""}
    <form method="post" action="/admin/rule">
      <input type="hidden" name="id" value="${id || ""}">
      <input type="hidden" name="media_id" value="${esc(rule.media_id)}">
      <div class="card rule">
        ${media ? `<img class="thumb" src="${esc(mediaThumb(media))}" alt="">` : `<div class="thumb"></div>`}
        <div class="body"><div class="cap">${esc(media?.caption || rule.media_caption || "ריל")}</div>
          ${id ? "" : `<a class="muted" href="/admin/new">החלפת ריל</a>`}</div>
      </div>
      <div class="card">
        <label for="kw">מילות מפתח</label>
        <input id="kw" type="text" name="keywords" value="${esc(rule.keywords)}" placeholder="מדריך, מדרך, guide" required>
        <div class="hint">מפרידים בפסיק. כדאי להוסיף שגיאות כתיב. מספיק שהמילה מופיעה בתוך התגובה.</div>

        <label for="msg">ההודעה הפרטית</label>
        <textarea id="msg" name="message" maxlength="600" required>${esc(rule.message)}</textarea>
        <div class="hint">{שם} מוחלף בשם המשתמש של מי שהגיב/ה.</div>
        <label class="check"><input id="usename" type="checkbox" name="use_name" ${rule.use_name ? "checked" : ""}> להוסיף את השם</label>

        <label for="bt">טקסט הכפתור <span class="muted" id="btc"></span></label>
        <input id="bt" type="text" name="button_title" value="${esc(rule.button_title)}" maxlength="20" placeholder="למדריך המלא" required>
        <label for="bu">הקישור בכפתור</label>
        <input id="bu" type="url" name="button_url" value="${esc(rule.button_url)}" placeholder="https://..." dir="ltr" required>

        <label class="check"><input type="checkbox" name="public_reply" ${rule.public_reply ? "checked" : ""}> להגיב גם בפומבי מתחת לתגובה</label>
        <label class="check"><input type="checkbox" name="active" ${rule.active ? "checked" : ""}> פעיל</label>
      </div>
      <div class="card"><h2>ככה זה ייראה</h2>
        <div class="preview"><span id="pv">${esc(preview)}</span><span class="pbtn" id="pb">${esc(rule.button_title || "כפתור")}</span></div>
      </div>
      <p><button class="btn primary" type="submit">שמירה</button></p>
    </form>
    <script>
      (function(){
        var m=document.getElementById('msg'),u=document.getElementById('usename'),b=document.getElementById('bt'),
            pv=document.getElementById('pv'),pb=document.getElementById('pb'),c=document.getElementById('btc');
        function upd(){
          var name=u.checked?'noa.cohen':'';
          var t=m.value.replace(/\\{\\s*(שם|name)\\s*\\}/gi,name);
          if(!name)t=t.replace(/[ \\t]+([!?.,:;])/g,'$1').replace(/[ \\t]{2,}/g,' ');
          pv.textContent=t.trim();pb.textContent=b.value||'כפתור';c.textContent='('+Array.from(b.value).length+'/20)';
        }
        [m,u,b].forEach(function(el){el.addEventListener('input',upd);el.addEventListener('change',upd)});upd();
      })();
    </script>`,
  );
}

async function saveRule(env: Env, form: FormData): Promise<Response> {
  const f = (k: string) => String(form.get(k) ?? "");
  const input = {
    id: Number(f("id")) || undefined,
    media_id: f("media_id").trim(),
    keywords: parseKeywords(f("keywords")).join(", "),
    message: f("message").replace(/\r\n/g, "\n").trim(),
    button_title: f("button_title").trim(),
    button_url: f("button_url").trim(),
    use_name: form.get("use_name") ? 1 : 0,
    public_reply: form.get("public_reply") ? 1 : 0,
    active: form.get("active") ? 1 : 0,
  };
  const errors = validateRuleInput(input);
  if (errors.length) {
    return ruleForm(env, new URL("http://x/admin/rule"), { ...input, keywords: f("keywords") }, errors);
  }
  let caption = "";
  let permalink = "";
  try {
    const m = await getMedia(env, input.media_id);
    caption = (m.caption ?? "").slice(0, 200);
    permalink = m.permalink ?? "";
  } catch {
    /* נשמר גם בלי כיתוב */
  }
  const now = Date.now();
  if (input.id) {
    await env.DB.prepare(
      `UPDATE rules SET media_id=?, media_caption=?, media_permalink=?, keywords=?, message=?, button_title=?,
         button_url=?, use_name=?, public_reply=?, active=?, updated_at=? WHERE id=?`,
    )
      .bind(
        input.media_id,
        caption,
        permalink,
        input.keywords,
        input.message,
        input.button_title,
        input.button_url,
        input.use_name,
        input.public_reply,
        input.active,
        now,
        input.id,
      )
      .run();
  } else {
    await env.DB.prepare(
      `INSERT INTO rules (media_id, media_caption, media_permalink, keywords, message, button_title, button_url,
         use_name, public_reply, active, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
      .bind(
        input.media_id,
        caption,
        permalink,
        input.keywords,
        input.message,
        input.button_title,
        input.button_url,
        input.use_name,
        input.public_reply,
        input.active,
        now,
        now,
      )
      .run();
  }
  return redirect("/admin?msg=" + encodeURIComponent("נשמר"));
}

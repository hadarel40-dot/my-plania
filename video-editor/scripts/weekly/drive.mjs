/**
 * הורדה מהדרייב לתהליך השבועי, בלי מגבלת 10MB: האתר מוריד בשם חשבון השירות ומעביר את הקובץ בחתיכות.
 * הסוד (CRON_SECRET) לא נמצא כאן ולא עובר בצ'אט: פרוקסי הסביבה מזריק אותו לבקשות לאתר.
 *
 * node drive.mjs list                  -> רשימת הקבצים בתיקייה (JSON)
 * node drive.mjs get <id> <קובץ יעד>   -> הורדת קובץ
 */
import fs from "node:fs";

const SITE = "https://my-plania.vercel.app/api/studio/drive-file";
// הערך מוחלף בפרוקסי בסוד האמיתי
const headers = { authorization: "Bearer placeholder" };

const [cmd, id, out] = process.argv.slice(2);
if (cmd === "list") {
  const res = await fetch(`${SITE}?list=1`, { headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`list: ${res.status} ${body.error ?? ""}`);
  console.log(JSON.stringify(body.files, null, 1));
} else if (cmd === "get" && id && out) {
  const fd = fs.openSync(out, "w");
  let start = 0, total = Infinity;
  while (start < total) {
    const res = await fetch(`${SITE}?id=${encodeURIComponent(id)}&start=${start}`, { headers });
    if (res.status === 416) break;
    if (!res.ok) throw new Error(`get ${id}: ${res.status}`);
    total = Number(res.headers.get("x-total-size")) || start;
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length) break;
    fs.writeSync(fd, buf);
    start += buf.length;
  }
  fs.closeSync(fd);
  console.log("saved", out, start);
} else {
  console.error("usage: node drive.mjs list | get <id> <out>");
  process.exit(1);
}

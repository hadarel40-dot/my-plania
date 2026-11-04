// שליחת ההודעות מהתור: Private Reply עם כפתור, ואחריו תגובה פומבית
import type { CommentRow, Env, Rule } from "./types";
import { DAY, MINUTE } from "./types";
import { getAppSettings, getRule, sentInLastHour, setSetting } from "./db";
import { buildMessage, parseVariants, pickRandom } from "./match";
import { GraphError, replyToComment, sendPrivateReplyButton, sendPrivateReplyText } from "./instagram";

const MAX_ATTEMPTS = 5;
/** מטא מאפשרת Private Reply רק עד 7 ימים אחרי התגובה */
const REPLY_WINDOW = 7 * DAY;
/** בכל הרצה, כדי להישאר מתחת למגבלת הבקשות של Worker חינמי */
const MAX_PER_RUN = 12;

export async function processQueue(env: Env, max = MAX_PER_RUN): Promise<number> {
  const now = Date.now();
  // תגובה ש"נתקעה" באמצע שליחה (למשל קריסה) חוזרת לתור. מטא בעצמה חוסמת Private Reply שני לאותה תגובה
  await env.DB.prepare("UPDATE comments SET status = 'pending' WHERE status = 'sending' AND next_try_at < ?")
    .bind(now - 10 * MINUTE)
    .run();
  await env.DB.prepare(
    "UPDATE comments SET status = 'expired', error = 'עברו 7 ימים מהתגובה' WHERE status = 'pending' AND received_at < ?",
  )
    .bind(now - REPLY_WINDOW)
    .run();

  const settings = await getAppSettings(env);
  if (!settings.enabled) return 0;
  const capacity = Number(env.HOURLY_LIMIT || 150) - (await sentInLastHour(env));
  const take = Math.min(max, capacity);
  if (take <= 0) return 0;

  const { results } = await env.DB.prepare(
    "SELECT * FROM comments WHERE status = 'pending' AND next_try_at <= ? ORDER BY received_at LIMIT ?",
  )
    .bind(now, take)
    .all<CommentRow>();

  const variants = parseVariants(settings.variants);
  let sent = 0;
  for (const row of results) {
    // תופסים את השורה. אם הרצה אחרת כבר תפסה אותה, מדלגים
    const claim = await env.DB.prepare(
      "UPDATE comments SET status = 'sending', next_try_at = ? WHERE comment_id = ? AND status = 'pending'",
    )
      .bind(Date.now(), row.comment_id)
      .run();
    if (claim.meta.changes === 0) continue;
    const rule = await getRule(env, row.rule_id);
    if (!rule || !rule.active) {
      await finish(env, row, "skipped", { error: "החוק נמחק או כובה" });
      continue;
    }
    if (await sendOne(env, row, rule, variants)) sent++;
  }
  return sent;
}

async function sendOne(env: Env, row: CommentRow, rule: Rule, variants: string[]): Promise<boolean> {
  const text = buildMessage(rule.message, row.username, !!rule.use_name);
  let mode: "button" | "text" = "button";
  try {
    try {
      await sendPrivateReplyButton(env, row.comment_id, text, rule.button_title.trim(), rule.button_url.trim());
    } catch (e) {
      if (!(e instanceof GraphError) || e.transient || e.authProblem) throw e;
      // אם הכפתור נדחה, שולחים טקסט רגיל עם הקישור בסוף
      mode = "text";
      await sendPrivateReplyText(env, row.comment_id, `${text}\n\n${rule.button_url.trim()}`);
    }
  } catch (e) {
    const err = e instanceof GraphError ? e : new GraphError(String((e as Error)?.message ?? e), 0);
    if (err.authProblem) await setSetting(env, "ig_token_error", err.message);
    const attempts = row.attempts + 1;
    if (err.transient && attempts < MAX_ATTEMPTS) {
      await env.DB.prepare(
        "UPDATE comments SET status = 'pending', attempts = ?, error = ?, next_try_at = ? WHERE comment_id = ?",
      )
        .bind(attempts, err.message, Date.now() + attempts * 5 * MINUTE, row.comment_id)
        .run();
    } else {
      await finish(env, row, "failed", { error: err.message, attempts });
    }
    return false;
  }

  let replyError: string | null = null;
  const variant = rule.public_reply ? pickRandom(variants) : undefined;
  if (variant) {
    try {
      await replyToComment(env, row.comment_id, variant);
    } catch (e) {
      replyError = (e as Error).message;
    }
  }
  await env.DB.prepare(
    `UPDATE comments SET status = 'sent', sent_at = ?, attempts = ?, dm_mode = ?, error = NULL, reply_error = ?
     WHERE comment_id = ?`,
  )
    .bind(Date.now(), row.attempts + 1, mode, replyError, row.comment_id)
    .run();
  return true;
}

async function finish(
  env: Env,
  row: CommentRow,
  status: "failed" | "skipped",
  extra: { error: string; attempts?: number },
) {
  await env.DB.prepare("UPDATE comments SET status = ?, error = ?, attempts = ? WHERE comment_id = ?")
    .bind(status, extra.error, extra.attempts ?? row.attempts, row.comment_id)
    .run();
}

/** מוחק תגובות ישנות מ-90 יום, וניסיונות התחברות ישנים */
export async function cleanup(env: Env) {
  await env.DB.prepare("DELETE FROM comments WHERE received_at < ?").bind(Date.now() - 90 * DAY).run();
  await env.DB.prepare("DELETE FROM login_attempts WHERE window_start < ?").bind(Date.now() - DAY).run();
}

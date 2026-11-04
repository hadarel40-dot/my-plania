import type { CommentRow, Env, Rule } from "./types";
import { HOUR } from "./types";

export async function getSetting(env: Env, key: string): Promise<string | null> {
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key = ?").bind(key).first<{ value: string }>();
  return row?.value ?? null;
}

export async function setSetting(env: Env, key: string, value: string): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  )
    .bind(key, value)
    .run();
}

export const DEFAULT_VARIANTS = [
  "שלחתי לך בפרטי 💌",
  "נשלח! תציצי בהודעות 📩",
  "מחכה לך בפרטי ✨",
  "שלחתי, תהני 💛",
  "שלחתי בפרטי! אם לא רואה, תבדקי בבקשות הודעה 💌",
].join("\n");

export interface AppSettings {
  enabled: boolean;
  testMode: boolean;
  testUsername: string;
  variants: string;
}

export async function getAppSettings(env: Env): Promise<AppSettings> {
  const { results } = await env.DB.prepare(
    "SELECT key, value FROM settings WHERE key IN ('enabled','test_mode','test_username','variants')",
  ).all<{ key: string; value: string }>();
  const m = new Map(results.map((r) => [r.key, r.value]));
  return {
    enabled: (m.get("enabled") ?? "1") === "1",
    // ברירת מחדל: מצב בדיקה פעיל, כדי ששום הודעה לא תצא לעוקבים לפני שבדקת
    testMode: (m.get("test_mode") ?? "1") === "1",
    testUsername: m.get("test_username") ?? "",
    variants: m.get("variants") ?? DEFAULT_VARIANTS,
  };
}

export async function activeRulesForMedia(env: Env, mediaId: string): Promise<Rule[]> {
  const { results } = await env.DB.prepare("SELECT * FROM rules WHERE media_id = ? AND active = 1 ORDER BY id")
    .bind(mediaId)
    .all<Rule>();
  return results;
}

export async function getRule(env: Env, id: number): Promise<Rule | null> {
  return env.DB.prepare("SELECT * FROM rules WHERE id = ?").bind(id).first<Rule>();
}

export async function listRules(env: Env): Promise<(Rule & { sent: number; queued: number })[]> {
  const { results } = await env.DB.prepare(
    `SELECT r.*,
       (SELECT COUNT(*) FROM comments c WHERE c.rule_id = r.id AND c.status = 'sent') AS sent,
       (SELECT COUNT(*) FROM comments c WHERE c.rule_id = r.id AND c.status IN ('pending','sending')) AS queued
     FROM rules r ORDER BY r.active DESC, r.updated_at DESC`,
  ).all<Rule & { sent: number; queued: number }>();
  return results;
}

export async function sentInLastHour(env: Env): Promise<number> {
  const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM comments WHERE sent_at > ?")
    .bind(Date.now() - HOUR)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

export async function alreadyHandledUser(env: Env, ruleId: number, userId: string): Promise<boolean> {
  const row = await env.DB.prepare(
    "SELECT 1 AS x FROM comments WHERE rule_id = ? AND user_id = ? AND status IN ('pending','sending','sent') LIMIT 1",
  )
    .bind(ruleId, userId)
    .first();
  return !!row;
}

export async function recentComments(env: Env, limit = 30): Promise<CommentRow[]> {
  const { results } = await env.DB.prepare("SELECT * FROM comments ORDER BY received_at DESC LIMIT ?")
    .bind(limit)
    .all<CommentRow>();
  return results;
}

export async function queueStats(env: Env) {
  const row = await env.DB.prepare(
    `SELECT
       SUM(CASE WHEN status IN ('pending','sending') THEN 1 ELSE 0 END) AS queued,
       SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
       SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sent
     FROM comments`,
  ).first<{ queued: number | null; failed: number | null; sent: number | null }>();
  return { queued: row?.queued ?? 0, failed: row?.failed ?? 0, sent: row?.sent ?? 0 };
}

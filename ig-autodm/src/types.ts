export interface Env {
  DB: D1Database;
  GRAPH_BASE: string;
  HOURLY_LIMIT: string;
  META_APP_ID: string;
  META_APP_SECRET: string;
  /** מזהה ה-Configuration של Facebook Login for Business / Unified login (לא סודי) */
  META_LOGIN_CONFIG_ID: string;
  WEBHOOK_VERIFY_TOKEN: string;
  /** אופציונלי: חיבור ידני בלי כפתור החיבור */
  IG_ACCESS_TOKEN?: string;
  IG_USER_ID?: string;
  ADMIN_PASSWORD: string;
}

export interface Rule {
  id: number;
  media_id: string;
  media_caption: string;
  media_permalink: string;
  keywords: string;
  message: string;
  button_title: string;
  button_url: string;
  use_name: number;
  public_reply: number;
  active: number;
  created_at: number;
  updated_at: number;
}

export type CommentStatus = "pending" | "sending" | "sent" | "failed" | "expired" | "skipped";

export interface CommentRow {
  comment_id: string;
  rule_id: number;
  media_id: string;
  user_id: string;
  username: string;
  text: string;
  status: CommentStatus;
  attempts: number;
  dm_mode: string | null;
  error: string | null;
  reply_error: string | null;
  received_at: number;
  next_try_at: number;
  sent_at: number | null;
}

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

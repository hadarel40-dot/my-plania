/** Supabase פעיל רק כשהוגדרו שני המשתנים. אחרת העורך עובד מקומית בדפדפן */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
export const supabaseEnabled = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

export const MEDIA_BUCKET = "media";

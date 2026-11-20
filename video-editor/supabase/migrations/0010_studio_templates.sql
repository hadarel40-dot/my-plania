-- תבניות מוכנות: לכל הצעה ולכל פריט נשמרת התבנית, כדי שהטיוטה (גם האוטומטית) תיכתב לפי המבנה שלה
alter table public.studio_suggestions add column if not exists template text;
alter table public.studio_items add column if not exists template text;
-- studio_cron_context ו-studio_cron_add_suggestions עודכנו כך שיכללו את template (ראו את ההגדרות במסד)

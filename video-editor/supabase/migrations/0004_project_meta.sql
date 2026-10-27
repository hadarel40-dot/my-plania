-- תקציר של כל פרויקט ללוח הפרויקטים (תמונה ממוזערת, מספר קליפים, משך וכו').
-- העורך מעדכן אותו בכל שמירה, כך שהלוח לא צריך לטעון את המסמך המלא.
alter table public.projects add column meta jsonb not null default '{}'::jsonb;

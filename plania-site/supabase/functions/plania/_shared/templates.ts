// Email templates that Base44 used to keep (base44/emails/*.html, MJML), compiled to plain HTML.
// The compiled files live in supabase/templates/ and are stored in the private "templates" bucket;
// {{name}} placeholders are filled in when the email is sent, with the values HTML-escaped.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export const TEMPLATE_SUBJECTS: Record<string, string> = { PriceQuote: 'הצעת מחיר מ-Plania’s' };

const cache = new Map<string, string>();

async function loadTemplate(db: SupabaseClient, name: string) {
  if (cache.has(name)) return cache.get(name)!;
  const { data, error } = await db.storage.from('templates').download(`${name}.html`);
  if (error || !data) throw new Error(`Unknown email template ${name}`);
  const html = await data.text();
  cache.set(name, html);
  return html;
}

export async function renderTemplate(
  db: SupabaseClient,
  name: string,
  variables: Record<string, string>,
  escape: (v: unknown) => string
) {
  const html = await loadTemplate(db, name);
  return html.replace(/{{\s*([a-z_]+)\s*}}/g, (_, key) => escape(variables[key] ?? ''));
}

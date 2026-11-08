// What the server functions used to get from the Base44 SDK, rebuilt on Supabase.
// createClientFromRequest(req) returns an object with the same shape
// (auth.me, asServiceRole.entities, asServiceRole.integrations.Core, asServiceRole.connectors),
// so the function bodies stayed as they were.
import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { renderTemplate, TEMPLATE_SUBJECTS } from './templates.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const PRIVATE_BUCKET = 'private';

const TABLES: Record<string, string> = {
  Lead: 'leads',
  TravelQuestionnaire: 'travel_questionnaires',
  BusinessQuestionnaire: 'business_questionnaires',
  ClientProject: 'client_projects',
  ClientMaterial: 'client_materials',
  SiteVisit: 'site_visits',
  SocialSnapshot: 'social_snapshots',
};

class ApiError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

// deno-lint-ignore no-explicit-any
function check({ data, error }: { data: any; error: { message: string; code?: string } | null }): any {
  if (error) throw new ApiError(error.message, error.code === 'PGRST116' ? 404 : 400);
  return data;
}

// deno-lint-ignore no-explicit-any
function applySort(q: any, sort?: string) {
  if (!sort) return q;
  const desc = sort.startsWith('-');
  return q.order(desc ? sort.slice(1) : sort, { ascending: !desc });
}

// deno-lint-ignore no-explicit-any
function applyWhere(q: any, where: Record<string, unknown> = {}) {
  for (const [field, value] of Object.entries(where)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [op, v] of Object.entries(value as Record<string, unknown>)) {
        const fn = ({ $gte: 'gte', $gt: 'gt', $lte: 'lte', $lt: 'lt', $ne: 'neq', $in: 'in' } as Record<string, string>)[op];
        if (!fn) throw new ApiError(`Unsupported filter ${op}`);
        q = q[fn](field, v);
      }
    } else if (value === null) {
      q = q.is(field, null);
    } else {
      q = q.eq(field, value);
    }
  }
  return q;
}

function entity(db: SupabaseClient, table: string) {
  const from = () => db.from(table);
  return {
    async list(sort?: string, limit?: number) {
      let q = applySort(from().select('*'), sort);
      if (limit) q = q.limit(limit);
      return check(await q);
    },
    // deno-lint-ignore no-explicit-any
    async filter(where: Record<string, unknown>, sortOrOptions?: any, limit?: number) {
      const opts = typeof sortOrOptions === 'object' && sortOrOptions ? sortOrOptions : { sort: sortOrOptions, limit };
      let q = applySort(applyWhere(from().select('*'), where), opts.sort);
      if (opts.limit) q = q.limit(opts.limit);
      return check(await q);
    },
    async get(id: string) {
      return check(await from().select('*').eq('id', id).single());
    },
    async create(data: Record<string, unknown>) {
      return check(await from().insert(data).select('*').single());
    },
    async update(id: string, data: Record<string, unknown>) {
      return check(await from().update(data).eq('id', id).select('*').single());
    },
    async delete(id: string) {
      check(await from().delete().eq('id', id));
      return { success: true };
    },
  };
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

type EmailInput = {
  to: string;
  subject?: string;
  html?: string;
  body?: string;
  template_name?: string;
  variables?: Record<string, string>;
};

// Emails go out through Resend (resend.com). RESEND_API_KEY is a secret saved on the project;
// MAIL_FROM is the sender, e.g. "Plania’s <hello@hadarelifergan.com>" once the domain is verified there.
async function sendEmail(input: EmailInput, db: SupabaseClient) {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) throw new ApiError('שליחת מיילים עוד לא הוגדרה (חסר RESEND_API_KEY)', 503);
  let html = input.html || '';
  const text = !html && input.body ? input.body : undefined;
  let subject = input.subject || '';
  if (input.template_name) {
    html = await renderTemplate(db, input.template_name, input.variables || {}, escapeHtml);
    subject = subject || TEMPLATE_SUBJECTS[input.template_name] || '';
  }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: Deno.env.get('MAIL_FROM') || 'Plania’s <onboarding@resend.dev>',
      to: [input.to],
      subject,
      ...(html ? { html } : { text: text || '' }),
    }),
  });
  if (!response.ok) {
    throw new ApiError(`Resend ${response.status}: ${(await response.text()).slice(0, 300)}`, 502);
  }
  return { success: true };
}

async function signedUrl({ file_uri, expires_in = 3600 }: { file_uri: string; expires_in?: number }, db: SupabaseClient) {
  const { data, error } = await db.storage.from(PRIVATE_BUCKET).createSignedUrl(file_uri, expires_in);
  if (error) throw new ApiError(error.message);
  return { signed_url: data.signedUrl };
}

// Instagram and Google Calendar used Base44's connectors. Here they read secrets saved on the project:
// INSTAGRAM_ACCESS_TOKEN, and GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET + GOOGLE_REFRESH_TOKEN.
// Without them the functions answer "not connected yet", exactly as before connecting.
async function googleAccessToken() {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
  const refreshToken = Deno.env.get('GOOGLE_REFRESH_TOKEN');
  if (!clientId || !clientSecret || !refreshToken) return '';
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!response.ok) return '';
  return (await response.json()).access_token || '';
}

const connectors = {
  async getAccessToken(type: string) {
    if (type === 'googlecalendar') return googleAccessToken();
    if (type === 'instagram') return Deno.env.get('INSTAGRAM_ACCESS_TOKEN') || '';
    return '';
  },
  async getConnection(type: string) {
    return { accessToken: await connectors.getAccessToken(type) };
  },
};

export function createClientFromRequest(req: Request) {
  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const entities = Object.fromEntries(Object.entries(TABLES).map(([name, table]) => [name, entity(db, table)]));
  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');

  return {
    auth: {
      // The signed-in person, with the role from public.profiles. 401 when nobody is signed in.
      async me() {
        if (!jwt) throw new ApiError('Not signed in', 401);
        const { data, error } = await db.auth.getUser(jwt);
        if (error || !data.user) throw new ApiError('Not signed in', 401);
        const { data: profile } = await db.from('profiles').select('*').eq('id', data.user.id).maybeSingle();
        return {
          id: data.user.id,
          email: data.user.email,
          full_name: profile?.full_name || '',
          role: profile?.role || 'user',
        };
      },
    },
    asServiceRole: {
      entities,
      integrations: {
        Core: {
          SendEmail: (input: EmailInput) => sendEmail(input, db),
          CreateFileSignedUrl: (args: { file_uri: string; expires_in?: number }) => signedUrl(args, db),
          // Reads a stored file, for the ZIP download
          async DownloadFile(file_uri: string) {
            const { data, error } = await db.storage.from(PRIVATE_BUCKET).download(file_uri);
            if (error) throw new ApiError(error.message);
            return data;
          },
        },
      },
      connectors,
    },
  };
}

// Wraps a Base44-style handler (req => Response) so it answers the browser, including the CORS preflight.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

export function serve(handler: (req: Request) => Promise<Response>) {
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    let response: Response;
    try {
      response = await handler(req);
    } catch (error) {
      response = Response.json({ error: (error as Error).message }, { status: 500 });
    }
    const headers = new Headers(response.headers);
    for (const [k, v] of Object.entries(CORS)) headers.set(k, v);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  });
}

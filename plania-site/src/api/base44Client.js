// The site's connection to its server. It used to be the Base44 SDK; it is now Supabase.
// The object keeps the same shape the rest of the code already calls
// (base44.entities.Lead.list, base44.auth.me, base44.functions.invoke ...), so the pages did not change.
import { createClient } from '@supabase/supabase-js';

// Public values: the publishable key is meant to ship in the browser; the RLS rules in
// supabase/migrations decide what it can read or write.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://xiujuumljfujxwcgffwe.supabase.co';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_E8pkFGlaZrlOqYNQAot-4g_4Yf7VPqG';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { flowType: 'pkce', persistSession: true, detectSessionInUrl: true },
});

const TABLES = {
  Lead: 'leads',
  TravelQuestionnaire: 'travel_questionnaires',
  BusinessQuestionnaire: 'business_questionnaires',
  ClientProject: 'client_projects',
  ClientMaterial: 'client_materials',
  SiteVisit: 'site_visits',
  SocialSnapshot: 'social_snapshots',
};

const PRIVATE_BUCKET = 'private';

// Errors look like the old SDK's (axios style), because the pages read error.response.data.error
function apiError(message, status = 400, data) {
  const error = new Error(message);
  error.status = status;
  error.response = { status, data: data || { error: message } };
  return error;
}

function check({ data, error }) {
  if (error) throw apiError(error.message, error.code === 'PGRST116' ? 404 : 400);
  return data;
}

// '-created_date' -> newest first, 'created_date' -> oldest first
function applySort(query, sort) {
  if (!sort) return query;
  const desc = sort.startsWith('-');
  return query.order(desc ? sort.slice(1) : sort, { ascending: !desc });
}

// { field: value } and { field: { $gte: x } } filters, as the old SDK accepted them
function applyWhere(query, where = {}) {
  let q = query;
  for (const [field, value] of Object.entries(where)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [op, v] of Object.entries(value)) {
        const fn = { $gte: 'gte', $gt: 'gt', $lte: 'lte', $lt: 'lt', $ne: 'neq', $in: 'in' }[op];
        if (!fn) throw apiError(`Unsupported filter ${op}`);
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

function entity(name) {
  const table = TABLES[name];
  const from = () => supabase.from(table);
  return {
    async list(sort, limit) {
      let q = applySort(from().select('*'), sort);
      if (limit) q = q.limit(limit);
      return check(await q);
    },
    async filter(where, sortOrOptions, limit) {
      const opts = typeof sortOrOptions === 'object' && sortOrOptions ? sortOrOptions : { sort: sortOrOptions, limit };
      let q = applySort(applyWhere(from().select('*'), where), opts.sort);
      if (opts.limit) q = q.limit(opts.limit);
      return check(await q);
    },
    async get(id) {
      return check(await from().select('*').eq('id', id).single());
    },
    async create(data) {
      // Visitors may add rows but not read them back, so only ask for the row back when signed in
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        check(await from().insert(data));
        return { ...data };
      }
      return check(await from().insert(data).select('*').single());
    },
    async update(id, data) {
      return check(await from().update(data).eq('id', id).select('*').single());
    },
    async delete(id) {
      check(await from().delete().eq('id', id));
      return { success: true };
    },
    async count(where = {}) {
      const { count, error } = await applyWhere(from().select('*', { count: 'exact', head: true }), where);
      if (error) throw apiError(error.message);
      return count ?? 0;
    },
  };
}

const entities = Object.fromEntries(Object.keys(TABLES).map((name) => [name, entity(name)]));

const origin = () => window.location.origin;
const absolute = (path) => (path && path.startsWith('http') ? path : `${origin()}${path || '/'}`);

const auth = {
  async me() {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw apiError('Not signed in', 401);
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).maybeSingle();
    return {
      id: data.user.id,
      email: data.user.email,
      full_name: profile?.full_name || data.user.user_metadata?.full_name || '',
      role: profile?.role || 'user',
    };
  },
  async isAuthenticated() {
    const { data } = await supabase.auth.getSession();
    return Boolean(data.session);
  },
  async loginViaEmailPassword(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw apiError(error.message, 401);
    return { access_token: data.session?.access_token, user: data.user };
  },
  loginWithProvider(provider, returnTo = '/') {
    return supabase.auth.signInWithOAuth({ provider, options: { redirectTo: absolute(returnTo) } });
  },
  async logout(redirectUrl) {
    await supabase.auth.signOut();
    if (redirectUrl) window.location.href = redirectUrl;
  },
  redirectToLogin(returnUrl) {
    const back = returnUrl ? new URL(returnUrl, origin()) : null;
    const returnTo = back ? `${back.pathname}${back.search}` : '/';
    window.location.href = `/login?returnTo=${encodeURIComponent(returnTo)}`;
  },
  async register({ email, password }) {
    const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: origin() } });
    if (error) throw apiError(error.message);
    return { success: true };
  },
  async verifyOtp({ email, otpCode }) {
    const { data, error } = await supabase.auth.verifyOtp({ email, token: otpCode, type: 'signup' });
    if (error) throw apiError(error.message);
    return { access_token: data.session?.access_token };
  },
  async resendOtp(email) {
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    if (error) throw apiError(error.message);
  },
  async resetPasswordRequest(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin()}/reset-password?token=email-link`,
    });
    if (error) throw apiError(error.message);
  },
  // The link in the email signs the person in (supabase-js reads it from the URL), then the new password is saved
  async resetPassword({ newPassword }) {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw apiError(error.message);
  },
  // The session is kept by supabase-js, so there is nothing to store by hand
  setToken() {},
};

const functions = {
  async invoke(name, body = {}) {
    // All server functions live in one Edge Function, supabase/functions/plania
    const { data, error } = await supabase.functions.invoke(`plania/${name}`, { body });
    if (error) {
      let payload = null;
      let status = 500;
      try {
        status = error.context?.status ?? 500;
        payload = await error.context.json();
      } catch {
        payload = null;
      }
      throw apiError(payload?.error || error.message, status, payload || undefined);
    }
    return { data };
  },
};

function safeName(name) {
  return String(name || 'file').replace(/[^\w.\-]+/g, '_').slice(-80);
}

const integrations = {
  Core: {
    async UploadPrivateFile({ file }) {
      const path = `uploads/${crypto.randomUUID()}-${safeName(file.name)}`;
      const { error } = await supabase.storage.from(PRIVATE_BUCKET).upload(path, file, {
        contentType: file.type || undefined,
      });
      if (error) throw apiError(error.message);
      return { file_uri: path };
    },
    async CreateFileSignedUrl({ file_uri, expires_in = 3600 }) {
      const { data, error } = await supabase.storage.from(PRIVATE_BUCKET).createSignedUrl(file_uri, expires_in);
      if (error) throw apiError(error.message);
      return { signed_url: data.signedUrl };
    },
  },
};

const app = {
  async getPublicSettings() {
    return { id: 'plania', public_settings: {} };
  },
};

export const base44 = { entities, auth, functions, integrations, app };

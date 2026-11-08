# PLANIA'S site

The public site (home, business, travel, Plania), questionnaires, quotes, client portal and the
admin panel at `/hp-manage-7k2x`. It used to run on Base44; it now runs on its own:

| Part | Where |
|---|---|
| Frontend | React + Vite (`src/`), any static host (Vercel / Netlify: `vercel.json`, `public/_redirects`) |
| Database, sign-in, files | Supabase project **Planias** (`xiujuumljfujxwcgffwe`) |
| Tables and permissions | `supabase/migrations/*.sql` (RLS: the admin sees everything, visitors may only submit) |
| Server functions | One Edge Function, `supabase/functions/plania`, routing to `handlers/<name>.ts` |
| Emails | Resend, through the `RESEND_API_KEY` secret; templates in `supabase/templates/` |

`src/api/base44Client.js` keeps the old `base44.*` interface (entities, auth, functions, files) on top of
Supabase, so the pages did not change. `supabase/functions/plania/_shared/base44.ts` does the same for the
server functions.

## Run locally

```bash
npm install
npm run dev
```

It talks to the live Supabase project. `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` can point it elsewhere.

## Deploy

- Frontend: `npm run build`, publish `dist/`.
- Server function: `supabase functions deploy plania --remote=xiujuumljfujxwcgffwe` (needs `SUPABASE_ACCESS_TOKEN`).
- Database changes: add a file under `supabase/migrations/`.

## Secrets on the Supabase project (Edge Functions → Secrets)

| Name | For |
|---|---|
| `RESEND_API_KEY` | sending quotes and lead notifications |
| `MAIL_FROM` | sender, e.g. `Plania’s <hello@hadarelifergan.com>` (domain verified in Resend) |
| `INSTAGRAM_ACCESS_TOKEN` | the Social tab |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` | syncing follow-ups to Google Calendar |

## Admin

Accounts signing up with `hadarel40@gmail.com` or `planiasmartplan@gmail.com` become admin automatically
(`public.handle_new_user`). Everyone else is a regular user and sees nothing.

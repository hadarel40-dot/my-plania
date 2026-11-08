# AGENTS.md

User-owned app code. Keep changes focused and follow existing conventions. Start with `README.md`.

- Frontend: `src/`. Server access goes through `src/api/base44Client.js` (Supabase underneath).
- Server functions: `supabase/functions/plania/handlers/*.ts`, registered in `supabase/functions/plania/index.ts`.
- Schema and permissions: new SQL files in `supabase/migrations/`; every table keeps RLS on.
- Before finishing: `npm run lint` and `npm run build`.

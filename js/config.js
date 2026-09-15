/**
 * Supabase project config for the optional Codeforces baseline comparison feature (the
 * Tourist / Top 500 / Top 10,000 / Average user tiers on the Codeforces page — see README's
 * "Codeforces baseline data"). Only loaded on codeforces.html; everything else in the app is
 * local-only and needs none of this.
 *
 * These are NOT secrets — the "anon" key is Supabase's public client key, meant to be
 * shipped in frontend code. The baseline tables are protected by their row-level security
 * policies (public read, write-only via the service role), not by keeping this key hidden.
 * It's safe to commit your real values here.
 *
 * To enable it:
 *   1. Create a free project at https://supabase.com.
 *   2. Apply supabase/migrations/ — either `npx supabase db push` (after `supabase login`
 *      and `supabase link`), or paste the migration file's contents into the SQL editor.
 *   3. In Project Settings -> API, copy the "Project URL" and "anon public" key below.
 *   4. Deploy and schedule supabase/functions/sync-cf-baseline (see README) to actually
 *      populate the baseline tables — the comparison tiers stay empty until it's run.
 *
 * Leave the placeholders as-is to run in local-only mode (the comparison tiers just won't
 * show; "Compare with someone" still works, since it's a live public API call with no backend).
 */
const SUPABASE_CONFIG = {
  url: "https://ieiamgyuhstmjajpcuxj.supabase.co",
  anonKey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllaWFtZ3l1aHN0bWphanBjdXhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0MTUzNjcsImV4cCI6MjEwNDk5MTM2N30.Mz_1SpBj5MCJJalfQjonqps3Eh39WdNv-xfNslxaudw",
};

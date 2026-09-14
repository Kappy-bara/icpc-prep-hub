/**
 * Supabase project config for optional cloud sync (sign in + cross-device data).
 *
 * These are NOT secrets — the "anon" key is Supabase's public client key, meant to be
 * shipped in frontend code. Your data is protected by the row-level security policies
 * in supabase/schema.sql (each user can only read/write their own row), not by keeping
 * this key hidden. It's safe to commit your real values here.
 *
 * To enable cloud sync:
 *   1. Create a free project at https://supabase.com.
 *   2. In the SQL editor, run supabase/schema.sql from this repo.
 *   3. In Project Settings -> API, copy the "Project URL" and "anon public" key below.
 *   4. In Authentication -> URL Configuration, add the URL(s) you'll run this app from
 *      (e.g. http://localhost:8080 and your GitHub Pages URL) to "Redirect URLs" —
 *      otherwise magic-link sign-in emails won't redirect back correctly.
 *
 * Leave the placeholders as-is to run in local-only mode (no sign-in card shown).
 */
const SUPABASE_CONFIG = {
  url: "YOUR_SUPABASE_PROJECT_URL",
  anonKey: "YOUR_SUPABASE_ANON_KEY",
};

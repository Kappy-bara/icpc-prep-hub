/**
 * Initializes the Supabase client from js/config.js, if configured. Cloud
 * features stay hidden and the app runs local-only when they're not.
 */
const CLOUD_ENABLED = Boolean(
  window.supabase &&
    SUPABASE_CONFIG.url &&
    SUPABASE_CONFIG.anonKey &&
    !SUPABASE_CONFIG.url.startsWith("YOUR_") &&
    !SUPABASE_CONFIG.anonKey.startsWith("YOUR_")
);

const supabaseClient = CLOUD_ENABLED ? window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey) : null;

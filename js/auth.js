/**
 * Passwordless (magic-link) auth via Supabase. No-ops gracefully when cloud
 * sync isn't configured (see supabase-client.js).
 */
const Auth = {
  _listeners: [],

  onChange(fn) {
    this._listeners.push(fn);
  },

  _emit(session) {
    for (const fn of this._listeners) fn(session);
  },

  async init() {
    if (!CLOUD_ENABLED) return null;
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    supabaseClient.auth.onAuthStateChange((_event, newSession) => {
      this._emit(newSession);
    });
    return session;
  },

  async signInWithEmail(email) {
    if (!CLOUD_ENABLED) throw new Error("Cloud sync isn't configured (see js/config.js).");
    const { error } = await supabaseClient.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + window.location.pathname },
    });
    if (error) throw error;
  },

  async signOut() {
    if (!CLOUD_ENABLED) return;
    await supabaseClient.auth.signOut();
  },

  currentUser() {
    return CLOUD_ENABLED ? supabaseClient.auth.getUser().then((r) => r.data.user) : Promise.resolve(null);
  },
};

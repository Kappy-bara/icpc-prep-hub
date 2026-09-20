/**
 * Supabase Auth: Codeforces-handle sign-in. Owns only *auth* state (are we signed in, as whom)
 * — never touches app data (roadmap/points/solves/etc.), that's js/storage.js's job once Auth says
 * who's signed in. Uses the same `supabaseClient` js/cf-baseline.js already talks to for the
 * (unrelated) public baseline-comparison feature — one client instance for the whole app, not two.
 *
 * Sign-in flow: the user verifies their Codeforces handle (compile-error challenge, handled by
 * js/auth-ui.js + js/cf-verify.js), then we call the `cf-signin` Edge Function which server-side
 * re-validates the submission, finds or creates their account, and returns a magic-link token that
 * we redeem here to establish a session. No email is ever required.
 */
const Auth = {
  client: supabaseClient,
  session: null,
  user: null, // session?.user ?? null, kept as its own field so callers don't have to null-chain
  ready: null, // Promise<void>, resolves once the first getSession() check has completed

  /** Whether this deployment even has Supabase configured — same gate js/cf-baseline.js uses. */
  isConfigured() {
    return CLOUD_ENABLED;
  },

  isSignedIn() {
    return Boolean(this.user);
  },

  _setSession(session) {
    const wasSignedIn = this.isSignedIn();
    this.session = session;
    this.user = session ? session.user : null;
    if (wasSignedIn !== this.isSignedIn() || wasSignedIn) {
      // Fires on every real transition (signed out -> in, in -> out), and also on a same-state
      // refresh while already signed in (e.g. a token refresh swapping in a new session object) —
      // harmless for listeners, which just re-render from Store's current state either way.
      document.dispatchEvent(new CustomEvent("icpc:auth-changed"));
    }
  },

  init() {
    if (!this.isConfigured()) {
      this.ready = Promise.resolve();
      return;
    }
    this.ready = this.client.auth.getSession().then(({ data }) => {
      this._setSession(data.session);
    });
    this.client.auth.onAuthStateChange((_event, session) => {
      this._setSession(session);
    });
  },

  /**
   * Signs in by Codeforces handle. Calls the `cf-signin` Edge Function which server-side validates
   * the compile-error submission, finds or creates an account for this handle, and returns a
   * magic-link token. We then redeem that token client-side to establish a session.
   *
   * Returns { ok: true, returning: boolean } on success, { ok: false, error, retryable? } on failure.
   */
  async signInWithHandle(handle, problem, startedAtMs) {
    try {
      const { data: fnData, error: fnError } = await this.client.functions.invoke("cf-signin", {
        body: { handle, problem, startedAtMs },
      });
      if (fnError) {
        // Edge Function invocation error (network, 5xx, etc.)
        return { ok: false, error: fnError.message || "Network error calling sign-in service" };
      }
      if (fnData.error) {
        // Application-level error returned by the function
        return { ok: false, error: fnData.error, retryable: fnData.retryable || false };
      }

      // Redeem the magic-link token to establish a session
      const { error: verifyError } = await this.client.auth.verifyOtp({
        token_hash: fnData.token_hash,
        type: "magiclink",
      });
      if (verifyError) {
        return { ok: false, error: verifyError.message || "Couldn't establish session" };
      }

      return { ok: true, returning: fnData.returning };
    } catch (e) {
      return { ok: false, error: e.message || "Network error" };
    }
  },

  /**
   * Flushes any pending debounced Store save BEFORE actually signing out — writes are debounced
   * ~400ms (see js/storage.js), so making a change and immediately signing out used to lose it
   * silently: the scheduled save would still fire later, but by then Store.clear() (triggered by
   * this very sign-out, see js/shell.js) had already dropped the in-memory data it needed to send,
   * so _writeNow() found nothing to write and quietly no-op'd. Flushing first means the write lands
   * while the session (and RLS write access) is still valid.
   */
  async signOut() {
    await Store.flush();
    try {
      const { error } = await this.client.auth.signOut();
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message || "Network error" };
    }
  },
};

Auth.init();

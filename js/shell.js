/**
 * Shared bootstrap — runs on every page, owns whatever must behave
 * identically no matter which page loaded first: nav, theme, and the full
 * auth-session -> Store cloud/local hydration flow. Pages that need to react
 * to sign-in state (currently only dashboard.js) listen for the
 * "icpc:auth-changed" event this dispatches, rather than duplicating this
 * logic — same decoupled pattern this app already uses for "roadmap:changed".
 */
const Shell = {
  _lastUserId: undefined, // undefined = not yet resolved; null = signed out; string = that user's id

  isCloudMode() {
    return Store._mode === "cloud";
  },

  async handleAuthSession(session) {
    const newUserId = session && session.user ? session.user.id : null;
    if (newUserId === this._lastUserId) {
      // Same user as already loaded — Supabase re-emits auth events on things like the tab
      // regaining focus (it proactively re-validates/refreshes the session), which would
      // otherwise silently reset in-progress page state (e.g. an active CF-handle
      // verification) for no real reason. Nothing actually changed, so do nothing.
      return;
    }
    this._lastUserId = newUserId;

    if (session && session.user) {
      const userId = session.user.id;
      try {
        const { data: row, error } = await supabaseClient.from("profiles").select("cf_handle, cf_verified, app_data").eq("id", userId).single();
        if (error) throw error;
        const cloudHasData = row.app_data && Object.keys(row.app_data).length > 0;
        if (!cloudHasData && Store.hasMeaningfulLocalData()) {
          const importLocal = confirm(
            "You have local data on this device. Import it into your new account?\n\nOK = import it. Cancel = start fresh in the cloud (your local data stays put and untouched on this device)."
          );
          if (importLocal) {
            await Store.seedCloudFromLocal(userId);
          } else {
            Store.enterCloudMode(userId, row);
          }
        } else {
          Store.enterCloudMode(userId, row);
        }
      } catch (e) {
        console.error("Failed to load cloud profile.", e);
        document.dispatchEvent(new CustomEvent("icpc:auth-changed", { detail: { signedIn: null, error: e.message } }));
        return;
      }
      document.dispatchEvent(new CustomEvent("icpc:auth-changed", { detail: { signedIn: true, email: session.user.email } }));
    } else {
      await Store.exitCloudMode();
      document.dispatchEvent(new CustomEvent("icpc:auth-changed", { detail: { signedIn: false } }));
    }
    // Theme.init() already applied a theme at page load, using whatever Store.data was
    // *before* this async cloud hydration swapped in the real (local or cloud) data — re-apply
    // now so the page doesn't sit on a stale/default theme until the next manual toggle.
    Theme.apply();
    Nav.updatePointsBadge();
  },

  init() {
    Nav.render(location.pathname);
    Theme.init(); // must run after Nav.render() creates #theme-toggle
    Nav.updatePointsBadge();
    if (CLOUD_ENABLED) {
      Auth.onChange((s) => this.handleAuthSession(s));
      Auth.init().then((s) => this.handleAuthSession(s));
    }
  },
};

document.addEventListener("DOMContentLoaded", () => Shell.init());

/**
 * The shared "sign in" gate, mounted by js/shell.js into #auth-gate on every gated page — one
 * implementation instead of duplicating sign-in markup per page. Reuses the .login-gate/.login-card
 * classes from this project's earlier local-login design (css/styles.css) as-is.
 *
 * The flow is now Codeforces-handle-only (no email):
 *   Step 1: Enter your Codeforces handle
 *   Step 2: Compile-error verification challenge (prove you own the handle)
 *   Step 3: Server-side verification + account creation/login via the cf-signin Edge Function
 */
const AuthUI = {
  _handle: "",
  _problem: null,
  _startedAtMs: 0,

  mount(container) {
    if (!container) return;
    if (!Auth.isConfigured()) {
      container.hidden = false;
      container.innerHTML = `
        <div class="login-gate">
          <div class="login-card">
            <h1 class="login-title">Accounts aren't set up on this deployment</h1>
            <p class="login-subtitle">This deployment doesn't have Supabase configured (see js/config.js), so there's nowhere to sign in to.</p>
          </div>
        </div>
      `;
      return;
    }
    container.hidden = false;
    this._renderHandleStep(container);
  },

  unmount(container) {
    if (!container) return;
    container.hidden = true;
    container.innerHTML = "";
  },

  /** Step 1: Enter your Codeforces handle. */
  _renderHandleStep(container) {
    container.innerHTML = `
      <div class="login-gate">
        <div class="login-card">
          <h1 class="login-title">Sign in</h1>
          <p class="login-subtitle">
            Enter your Codeforces handle &mdash; you'll prove you own it with a quick
            compile-error submission, then you're in. No email needed.
          </p>
          <form id="auth-handle-form" class="login-form">
            <label for="auth-handle-input">Codeforces handle</label>
            <input type="text" id="auth-handle-input" placeholder="e.g. tourist" autocomplete="off" required />
            <button type="submit" class="btn-primary login-submit">Continue</button>
          </form>
          <span id="auth-handle-status" class="sync-status"></span>
        </div>
      </div>
    `;

    $("auth-handle-form").addEventListener("submit", async (evt) => {
      evt.preventDefault();
      const handle = $("auth-handle-input").value.trim();
      if (!handle) return;
      const submitBtn = evt.target.querySelector('button[type="submit"]');
      const statusEl = $("auth-handle-status");
      submitBtn.disabled = true;
      statusEl.textContent = "Checking handle…";
      statusEl.className = "sync-status";

      // Validate the handle exists on Codeforces before starting the challenge
      try {
        const res = await fetch(
          `https://codeforces.com/api/user.info?handles=${encodeURIComponent(handle)}`
        );
        if (!res.ok) {
          submitBtn.disabled = false;
          statusEl.textContent = "Codeforces API is unreachable right now. Try again in a moment.";
          statusEl.className = "sync-status error";
          return;
        }
        const json = await res.json();
        if (json.status !== "OK" || !json.result || !json.result.length) {
          submitBtn.disabled = false;
          statusEl.textContent = `No Codeforces user named "${handle}" exists. Check the spelling.`;
          statusEl.className = "sync-status error";
          return;
        }
        // Use the canonical casing from Codeforces
        this._handle = json.result[0].handle;
      } catch (e) {
        submitBtn.disabled = false;
        statusEl.textContent = "Couldn't reach the Codeforces API. Check your connection and try again.";
        statusEl.className = "sync-status error";
        return;
      }

      this._problem = CFVerify.pickProblem();
      this._startedAtMs = Date.now();
      this._renderVerifyStep(container);
    });
  },

  /** Step 2: Compile-error verification challenge. */
  _renderVerifyStep(container) {
    const { _handle: handle, _problem: problem } = this;
    container.innerHTML = `
      <div class="login-gate">
        <div class="login-card">
          <h1 class="login-title">Verify you own this handle</h1>
          <p class="login-subtitle">
            Prove you're <strong>${escapeHtml(handle)}</strong> by submitting a compile error.
          </p>
          <ol class="verify-steps">
            <li>Open the <a href="${CFVerify.problemUrl(problem)}" target="_blank" rel="noopener noreferrer">submit page for ${escapeHtml(problem.name)} (${problem.contestId}${problem.index})</a></li>
            <li>Submit <strong>any code that fails to compile</strong> (e.g. just type <code>error</code>) as <strong>${escapeHtml(handle)}</strong></li>
            <li>Come back here and click the button below within ${CFVerify.WINDOW_MINUTES} minutes</li>
          </ol>
          <div class="form-actions" style="margin-top: 1rem;">
            <button id="auth-check-btn" type="button" class="btn-primary login-submit">I submitted it &mdash; sign me in</button>
          </div>
          <span id="auth-verify-status" class="sync-status"></span>
          <details style="margin-top: 1rem;">
            <summary>Manual fallback (paste JSON)</summary>
            <p><a href="https://codeforces.com/api/user.status?handle=${encodeURIComponent(handle)}&from=1&count=30" target="_blank" rel="noopener noreferrer">Open Codeforces API URL &rarr;</a></p>
            <textarea id="auth-manual-json" rows="5" placeholder="Paste the JSON response here"></textarea>
            <button id="auth-manual-btn" type="button" class="btn-secondary" style="margin-top: 0.5rem;">Check pasted JSON</button>
          </details>
          <button type="button" id="auth-use-different-handle" class="btn-icon" style="margin-top: 0.75rem;">Use a different handle</button>
        </div>
      </div>
    `;

    $("auth-check-btn").addEventListener("click", async (evt) => {
      const btn = evt.currentTarget;
      const statusEl = $("auth-verify-status");
      btn.disabled = true;
      statusEl.textContent = "Checking your submissions…";
      statusEl.className = "sync-status";

      // First do a client-side pre-check (faster feedback if no submission found yet)
      const preCheck = await CFVerify.checkLive(handle, problem, this._startedAtMs);
      if (!preCheck.ok) {
        btn.disabled = false;
        statusEl.textContent = `Couldn't reach Codeforces (${preCheck.error}). Try the manual fallback below.`;
        statusEl.className = "sync-status error";
        return;
      }
      if (!preCheck.verified) {
        btn.disabled = false;
        statusEl.textContent = "No matching compile-error submission found yet. Submit it, then try again.";
        statusEl.className = "sync-status error";
        return;
      }

      // Client-side check passed — now call the server for the real sign-in
      statusEl.textContent = "Verified! Signing you in…";
      await this._doSignIn(container, statusEl, btn);
    });

    $("auth-manual-btn").addEventListener("click", async (evt) => {
      const btn = evt.currentTarget;
      const text = $("auth-manual-json").value.trim();
      const statusEl = $("auth-verify-status");
      btn.disabled = true;
      try {
        const ok = CFVerify.checkManual(text, handle, problem, this._startedAtMs);
        if (!ok) {
          btn.disabled = false;
          statusEl.textContent = "No matching compile-error submission found in that JSON.";
          statusEl.className = "sync-status error";
          return;
        }
        statusEl.textContent = "Verified! Signing you in…";
        statusEl.className = "sync-status";
        await this._doSignIn(container, statusEl, btn);
      } catch (e) {
        btn.disabled = false;
        statusEl.textContent = `Couldn't parse that JSON: ${e.message}`;
        statusEl.className = "sync-status error";
      }
    });

    $("auth-use-different-handle").addEventListener("click", () => {
      this._renderHandleStep(container);
    });
  },

  /** Calls the Edge Function to create/find the account and establish a session. */
  async _doSignIn(container, statusEl, triggerBtn) {
    const result = await Auth.signInWithHandle(
      this._handle,
      this._problem,
      this._startedAtMs
    );
    if (!result.ok) {
      if (triggerBtn) triggerBtn.disabled = false;
      statusEl.textContent = result.error;
      statusEl.className = "sync-status error";
      return;
    }
    // Success — onAuthStateChange fires, shell.js reacts, auth-gate unmounts.
    // Nothing else to do here.
  },
};

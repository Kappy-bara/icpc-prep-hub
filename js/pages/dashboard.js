/** Dashboard page: login (by Codeforces verification), preferences, timeline, roadmap summary, recent solves, backup. */
(function () {
  let verifyState = null; // { handle, problem, startedAtMs } while a login verification is in progress

  function refreshDynamic() {
    Nav.updatePointsBadge();
    Timeline.render($("timeline-root"));
    Gamification.renderStreak($("streak-root"));
    Roadmap.renderSummary($("roadmap-summary-root"));
    SolvedLogUI.render($("solved-log-root"), { limit: 5 });
  }

  // --- Logged-in view: preferences + logout ---

  function renderLoggedInView() {
    const p = Store.data.profile;
    $("logged-in-handle").textContent = p.cfHandle;
    $("logged-in-start-date").textContent = p.gamificationStart ? new Date(p.gamificationStart).toLocaleDateString() : "today";
    $("focus-tags-input").value = (p.focusTags && p.focusTags[0]) || "";
    $("target-date-input").value = p.targetDate || "";
  }

  function wirePrefsForm() {
    $("prefs-form").addEventListener("submit", (evt) => {
      evt.preventDefault();
      Store.update((d) => {
        const chosenTag = $("focus-tags-input").value;
        d.profile.focusTags = chosenTag ? [chosenTag] : [];
        d.profile.targetDate = $("target-date-input").value || null;
      });
      const note = $("prefs-saved-note");
      note.hidden = false;
      setTimeout(() => (note.hidden = true), 1800);
      refreshDynamic();
    });

    $("logout-btn").addEventListener("click", () => {
      // Logging out saves the current session into its own account slot first (see Store.logout)
      // — nothing here is lost, logging back in as the same handle restores it exactly.
      Store.logout();
      verifyState = null;
      renderAuthState();
      refreshDynamic();
    });
  }

  // --- Logged-out view: login (== Codeforces handle verification) ---

  function wireLoginForm() {
    $("login-form").addEventListener("submit", (evt) => {
      evt.preventDefault();
      const handle = $("login-handle-input").value.trim();
      if (!handle) return;
      verifyState = { handle, problem: CFVerify.pickProblem(), startedAtMs: Date.now() };
      renderAuthState();
    });
  }

  function completeLogin(handle) {
    // Restores this handle's own saved progress if it's a returning login, or starts a fresh
    // account (with today as the gamification start date) if it's brand new — see Store.login.
    // Either way, this is the only place cfVerified ever becomes true.
    Store.login(handle);
    verifyState = null;
    renderAuthState();
    refreshDynamic();
  }

  function renderVerifySection() {
    const root = $("cf-verify-section");
    if (!root) return;
    if (!verifyState) {
      root.innerHTML = "";
      return;
    }

    const { handle, problem } = verifyState;
    root.innerHTML = `
      <p>1. Open the <a href="${CFVerify.problemUrl(problem)}" target="_blank" rel="noopener noreferrer">submit page for ${escapeHtml(problem.name)} (${problem.contestId}${problem.index})</a> — it pre-selects the problem, no searching needed.</p>
      <p>2. Submit ANY code that fails to compile (e.g. delete a semicolon) as <strong>${escapeHtml(handle)}</strong>, within the next ${CFVerify.WINDOW_MINUTES} minutes.</p>
      <div class="form-actions">
        <button id="check-verify-btn" type="button" class="btn-primary">I submitted it — check now</button>
        <button id="cancel-verify-btn" type="button" class="btn-icon">Cancel</button>
      </div>
      <span id="verify-status" class="sync-status"></span>
      <details>
        <summary>Manual fallback (paste JSON)</summary>
        <p><a href="${CFSync.apiUrl(handle)}" target="_blank" rel="noopener noreferrer">Open Codeforces API URL →</a></p>
        <textarea id="verify-manual-json" rows="5" placeholder="Paste the JSON response here"></textarea>
        <button id="verify-manual-btn" type="button" class="btn-secondary">Check pasted JSON</button>
      </details>
    `;

    $("check-verify-btn").addEventListener("click", async () => {
      const statusEl = $("verify-status");
      statusEl.textContent = "Checking…";
      statusEl.className = "sync-status";
      const result = await CFVerify.checkLive(handle, problem, verifyState.startedAtMs);
      if (!result.ok) {
        statusEl.textContent = `Live check failed (${result.error}). Use the manual fallback below.`;
        statusEl.className = "sync-status error";
        return;
      }
      if (result.verified) {
        completeLogin(handle);
      } else {
        statusEl.textContent = "No matching compile-error submission found yet. Submit it, then try again.";
        statusEl.className = "sync-status error";
      }
    });

    $("cancel-verify-btn").addEventListener("click", () => {
      verifyState = null;
      renderAuthState();
    });

    $("verify-manual-btn").addEventListener("click", () => {
      const text = $("verify-manual-json").value.trim();
      const statusEl = $("verify-status");
      try {
        const ok = CFVerify.checkManual(text, handle, problem, verifyState.startedAtMs);
        if (ok) {
          completeLogin(handle);
        } else {
          statusEl.textContent = "No matching compile-error submission found in that JSON.";
          statusEl.className = "sync-status error";
        }
      } catch (e) {
        statusEl.textContent = `Couldn't parse that JSON: ${e.message}`;
        statusEl.className = "sync-status error";
      }
    });
  }

  /** Top-level toggle between the login gate (login form + verify steps) and the full dashboard. */
  function renderAuthState() {
    const loggedIn = Boolean(Store.data.profile.cfVerified);
    $("login-gate").hidden = loggedIn;
    $("dashboard-content").hidden = !loggedIn;
    if (loggedIn) {
      renderLoggedInView();
      return;
    }
    $("login-form").hidden = Boolean(verifyState);
    if (!verifyState) $("login-handle-input").value = "";
    renderVerifySection();
  }

  function wireDataCard() {
    $("export-btn").addEventListener("click", () => {
      const blob = new Blob([Store.exportJSON()], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `icpc-prep-hub-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });

    const fileInput = $("import-file-input");
    fileInput.addEventListener("change", async () => {
      const file = fileInput.files[0];
      if (!file) return;
      const text = await file.text();
      const status = $("data-status");
      try {
        Store.importJSON(text);
        status.textContent = "Import successful.";
        status.className = "sync-status success";
        verifyState = null;
        renderAuthState();
        refreshDynamic();
        Theme.apply();
      } catch (e) {
        status.textContent = `Import failed: ${e.message}`;
        status.className = "sync-status error";
      }
      fileInput.value = "";
    });

    $("reset-btn").addEventListener("click", () => {
      if (!confirm("This clears all ICPC Prep Hub data (every logged-in handle's roadmap progress, points, logs, rewards) on this browser. This can't be undone unless you've exported a backup. Continue?")) {
        return;
      }
      Store.resetAll();
      verifyState = null;
      renderAuthState();
      refreshDynamic();
      Theme.apply();
      $("data-status").textContent = "All data reset.";
      $("data-status").className = "sync-status success";
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    wireLoginForm();
    wirePrefsForm();
    renderAuthState();
    wireDataCard();
    refreshDynamic();
  });

  document.addEventListener("icpc:points-changed", () => {
    Nav.updatePointsBadge();
    Gamification.renderStreak($("streak-root"));
  });
})();

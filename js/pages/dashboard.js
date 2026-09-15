/** Dashboard page: profile, Codeforces verification, timeline, roadmap summary, recent solves, backup. */
(function () {
  let verifyState = null; // { problem, startedAtMs } while a CF verification is in progress

  function todayISODate() {
    return new Date().toISOString().slice(0, 10);
  }

  function renderProfileForm() {
    const p = Store.data.profile;
    $("cf-handle-input").value = p.cfHandle || "";
    $("focus-tags-input").value = (p.focusTags && p.focusTags[0]) || "";
    $("target-date-input").value = p.targetDate || "";
  }

  function refreshDynamic() {
    Nav.updatePointsBadge();
    Timeline.render($("timeline-root"));
    Gamification.renderStreak($("streak-root"));
    Roadmap.renderSummary($("roadmap-summary-root"));
    SolvedLogUI.render($("solved-log-root"), { limit: 5 });
  }

  function wireProfileForm() {
    $("profile-form").addEventListener("submit", (evt) => {
      evt.preventDefault();
      const newHandle = $("cf-handle-input").value.trim();
      Store.update((d) => {
        if (d.profile.cfHandle !== newHandle) {
          d.profile.cfVerified = false; // handle changed — needs (re-)verification
          // Also reset the start date, not just the verified flag — otherwise switching to a
          // different (already-owned or newly-forged) handle keeps the OLD start date, and that
          // handle's entire back-catalog of solves between the old date and now would suddenly
          // count for points on the next sync. A new handle gets a fresh start date the next
          // time it's verified, same as a first-time verification.
          d.profile.gamificationStart = null;
          verifyState = null;
        }
        d.profile.cfHandle = newHandle;
        // gamificationStart is intentionally not editable here — see markVerified() below. It's
        // set automatically (and only) the moment CF verification succeeds, so it can't be
        // backdated to retroactively cash in a windfall from old solves.
        const chosenTag = $("focus-tags-input").value;
        d.profile.focusTags = chosenTag ? [chosenTag] : [];
        d.profile.targetDate = $("target-date-input").value || null;
      });
      const note = $("profile-saved-note");
      note.hidden = false;
      setTimeout(() => (note.hidden = true), 1800);
      renderCFVerifySection();
      refreshDynamic();
    });
  }

  // --- Codeforces handle verification ---

  function markVerified() {
    Store.update((d) => {
      d.profile.cfVerified = true;
      if (!d.profile.gamificationStart) d.profile.gamificationStart = todayISODate();
    });
    verifyState = null;
    renderProfileForm();
    renderCFVerifySection();
  }

  function renderCFVerifySection() {
    const root = $("cf-verify-section");
    if (!root) return;
    const { cfHandle, cfVerified } = Store.data.profile;

    if (!cfHandle) {
      root.innerHTML = `<p class="card-subtitle">Enter a Codeforces handle in the Profile card above, then come back here to verify it.</p>`;
      return;
    }
    if (cfVerified) {
      const startDate = Store.data.profile.gamificationStart;
      const startLabel = startDate ? new Date(startDate).toLocaleDateString() : "today";
      root.innerHTML = `
        <p class="verified-note">✓ Verified as <strong>${escapeHtml(cfHandle)}</strong>.</p>
        <p class="card-subtitle">Points have been accumulating since <strong>${startLabel}</strong> &mdash;
        set automatically the moment you verified, and not editable, so there's no way to backdate a windfall
        from solves before it.</p>
      `;
      return;
    }
    if (!verifyState) {
      root.innerHTML = `
        <p class="card-subtitle">
          <strong>${escapeHtml(cfHandle)}</strong> isn't verified yet &mdash; you can still sync and
          explore its data, but solves score 0 points and your rewards stay locked (see the
          Self-rule page) until you verify. Prove you own it here.
        </p>
        <button id="start-verify-btn" type="button" class="btn-secondary">Start verification</button>
      `;
      $("start-verify-btn").addEventListener("click", () => {
        verifyState = { problem: CFVerify.pickProblem(), startedAtMs: Date.now() };
        renderCFVerifySection();
      });
      return;
    }

    const { problem } = verifyState;
    root.innerHTML = `
      <p>1. Open the <a href="${CFVerify.problemUrl(problem)}" target="_blank" rel="noopener noreferrer">submit page for ${escapeHtml(problem.name)} (${problem.contestId}${problem.index})</a> — it pre-selects the problem, no searching needed.</p>
      <p>2. Submit ANY code that fails to compile (e.g. delete a semicolon) as <strong>${escapeHtml(cfHandle)}</strong>, within the next ${CFVerify.WINDOW_MINUTES} minutes.</p>
      <div class="form-actions">
        <button id="check-verify-btn" type="button" class="btn-primary">I submitted it — check now</button>
        <button id="cancel-verify-btn" type="button" class="btn-icon">Cancel</button>
      </div>
      <span id="verify-status" class="sync-status"></span>
      <details>
        <summary>Manual fallback (paste JSON)</summary>
        <p><a href="${CFSync.apiUrl(cfHandle)}" target="_blank" rel="noopener noreferrer">Open Codeforces API URL →</a></p>
        <textarea id="verify-manual-json" rows="5" placeholder="Paste the JSON response here"></textarea>
        <button id="verify-manual-btn" type="button" class="btn-secondary">Check pasted JSON</button>
      </details>
    `;

    $("check-verify-btn").addEventListener("click", async () => {
      const statusEl = $("verify-status");
      statusEl.textContent = "Checking…";
      statusEl.className = "sync-status";
      const result = await CFVerify.checkLive(cfHandle, problem, verifyState.startedAtMs);
      if (!result.ok) {
        statusEl.textContent = `Live check failed (${result.error}). Use the manual fallback below.`;
        statusEl.className = "sync-status error";
        return;
      }
      if (result.verified) {
        markVerified();
      } else {
        statusEl.textContent = "No matching compile-error submission found yet. Submit it, then try again.";
        statusEl.className = "sync-status error";
      }
    });

    $("cancel-verify-btn").addEventListener("click", () => {
      verifyState = null;
      renderCFVerifySection();
    });

    $("verify-manual-btn").addEventListener("click", () => {
      const text = $("verify-manual-json").value.trim();
      const statusEl = $("verify-status");
      try {
        const ok = CFVerify.checkManual(text, cfHandle, problem, verifyState.startedAtMs);
        if (ok) {
          markVerified();
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

  function wireDataCard() {
    $("export-btn").addEventListener("click", () => {
      const blob = new Blob([Store.exportJSON()], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `icpc-prep-hub-backup-${todayISODate()}.json`;
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
        renderProfileForm();
        renderCFVerifySection();
        refreshDynamic();
        Theme.apply();
      } catch (e) {
        status.textContent = `Import failed: ${e.message}`;
        status.className = "sync-status error";
      }
      fileInput.value = "";
    });

    $("reset-btn").addEventListener("click", () => {
      if (!confirm("This clears all ICPC Prep Hub data (roadmap progress, points, logs, rewards) on this browser. This can't be undone unless you've exported a backup. Continue?")) {
        return;
      }
      Store.resetAll();
      renderProfileForm();
      renderCFVerifySection();
      refreshDynamic();
      Theme.apply();
      $("data-status").textContent = "All data reset.";
      $("data-status").className = "sync-status success";
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    renderProfileForm();
    wireProfileForm();
    renderCFVerifySection();
    wireDataCard();
    refreshDynamic();
  });

  document.addEventListener("icpc:points-changed", () => {
    Nav.updatePointsBadge();
    Gamification.renderStreak($("streak-root"));
  });
})();

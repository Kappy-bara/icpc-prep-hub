/** Dashboard page: account/sign-in, profile, timeline, roadmap summary, recent solves, backup. */
(function () {
  let verifyState = null; // { problem, startedAtMs } while a CF verification is in progress

  function todayISODate() {
    return new Date().toISOString().slice(0, 10);
  }

  function parseTags(text) {
    return text
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
  }

  function renderProfileForm() {
    const p = Store.data.profile;
    $("cf-handle-input").value = p.cfHandle || "";
    $("gamification-start-input").value = p.gamificationStart || "";
    $("focus-tags-input").value = (p.focusTags || []).join(", ");
    $("target-date-input").value = p.targetDate || "";
  }

  function refreshDynamic() {
    Nav.updatePointsBadge();
    Timeline.render($("timeline-root"));
    Roadmap.renderSummary($("roadmap-summary-root"));
    SolvedLogUI.render($("solved-log-root"), { limit: 5 });
  }

  function wireProfileForm() {
    $("profile-form").addEventListener("submit", (evt) => {
      evt.preventDefault();
      const newHandle = $("cf-handle-input").value.trim();
      Store.update((d) => {
        if (d.profile.cfHandle !== newHandle) {
          d.profile.cfVerified = false; // handle changed — needs (re-)verification in cloud mode
          verifyState = null;
        }
        d.profile.cfHandle = newHandle;
        d.profile.gamificationStart = $("gamification-start-input").value || null;
        d.profile.focusTags = parseTags($("focus-tags-input").value);
        d.profile.targetDate = $("target-date-input").value || null;
      });
      const note = $("profile-saved-note");
      note.hidden = false;
      setTimeout(() => (note.hidden = true), 1800);
      renderAccountCard();
      refreshDynamic();
    });
  }

  // --- Account card: sign-in, sign-out, CF handle verification ---

  function setSigninStatus(msg, kind) {
    const el = $("signin-status");
    if (!el) return;
    el.textContent = msg;
    el.className = `sync-status ${kind || ""}`;
  }

  function showSignedIn(signedIn, email) {
    $("account-signed-out").hidden = signedIn;
    $("account-signed-in").hidden = !signedIn;
    if (signedIn) {
      $("account-email").textContent = email || "";
      $("account-avatar").textContent = (email || "?").charAt(0).toUpperCase();
    }
  }

  async function markVerified(handle) {
    Store.update((d) => {
      d.profile.cfVerified = true;
    });
    verifyState = null;
    if (CLOUD_ENABLED && Store._userId) {
      try {
        await supabaseClient.from("profiles").update({ cf_handle: handle, cf_verified: true }).eq("id", Store._userId);
      } catch (e) {
        console.error("Failed to persist CF verification.", e);
      }
    }
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
      root.innerHTML = `<p class="verified-note">✓ Verified as <strong>${escapeHtml(cfHandle)}</strong>.</p>`;
      return;
    }
    if (!verifyState) {
      root.innerHTML = `
        <p class="card-subtitle">Prove you own <strong>${escapeHtml(cfHandle)}</strong> to enable cloud sync for it.</p>
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
      <p>1. Open <a href="${CFVerify.problemUrl(problem)}" target="_blank" rel="noopener noreferrer">${escapeHtml(problem.name)} (${problem.contestId}${problem.index})</a>.</p>
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
        markVerified(cfHandle);
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
        const ok = CFVerify.checkManual(text, problem, verifyState.startedAtMs);
        if (ok) {
          markVerified(cfHandle);
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

  function renderAccountCard() {
    if (!CLOUD_ENABLED) return;
    renderCFVerifySection();
  }

  function wireAccountCard() {
    if (!CLOUD_ENABLED) {
      $("account-card-unavailable").hidden = false;
      $("account-card-body").hidden = true;
      return;
    }

    $("signin-form").addEventListener("submit", async (evt) => {
      evt.preventDefault();
      const email = $("signin-email-input").value.trim();
      if (!email) return;
      setSigninStatus("Sending magic link…", "");
      try {
        await Auth.signInWithEmail(email);
        setSigninStatus("Check your email for a sign-in link.", "success");
      } catch (e) {
        setSigninStatus(`Couldn't send link: ${e.message}`, "error");
      }
    });

    $("sign-out-btn").addEventListener("click", async () => {
      await Auth.signOut();
    });

    Store.onCloudStatus((status, detail) => {
      const el = $("cloud-sync-status");
      if (!el) return;
      const labels = { saving: "Saving…", saved: "Synced", error: `Sync error: ${detail}` };
      el.textContent = labels[status] || "";
      el.className = `sync-status ${status === "error" ? "error" : status === "saved" ? "success" : ""}`;
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
        renderAccountCard();
        refreshDynamic();
        Theme.apply();
      } catch (e) {
        status.textContent = `Import failed: ${e.message}`;
        status.className = "sync-status error";
      }
      fileInput.value = "";
    });

    $("reset-btn").addEventListener("click", () => {
      const cloudNote = Shell.isCloudMode() ? " This also overwrites your synced cloud copy." : "";
      if (!confirm(`This clears all ICPC Prep Hub data (roadmap progress, points, logs, rewards).${cloudNote} This can't be undone unless you've exported a backup. Continue?`)) {
        return;
      }
      Store.resetAll();
      renderProfileForm();
      renderAccountCard();
      refreshDynamic();
      Theme.apply();
      $("data-status").textContent = "All data reset.";
      $("data-status").className = "sync-status success";
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    renderProfileForm();
    wireProfileForm();
    wireAccountCard();
    wireDataCard();
    refreshDynamic();
  });

  document.addEventListener("icpc:auth-changed", (evt) => {
    verifyState = null;
    renderProfileForm();
    if (CLOUD_ENABLED) {
      showSignedIn(Boolean(evt.detail.signedIn), evt.detail.email);
      if (evt.detail.error) setSigninStatus(`Couldn't load your account data: ${evt.detail.error}`, "error");
    }
    renderAccountCard();
    refreshDynamic();
  });
})();

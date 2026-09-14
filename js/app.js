/**
 * App bootstrap: wires up all the cards to the Store and the render
 * functions in the other modules.
 */
(function () {
  function $(id) {
    return document.getElementById(id);
  }

  function todayISODate() {
    return new Date().toISOString().slice(0, 10);
  }

  let verifyState = null; // { problem, startedAtMs } while a CF verification is in progress

  function isCloudMode() {
    return Store._mode === "cloud";
  }

  /** Shared gate for the three CF-write entry points: in cloud mode, they require a verified handle. */
  function requireVerifiedIfCloud() {
    if (isCloudMode() && !Store.data.profile.cfVerified) {
      setSyncStatus("Verify your Codeforces handle in the Account card first.", "error");
      return false;
    }
    return true;
  }

  function renderPointsBadge() {
    $("points-badge").textContent = `${Store.data.points.balance} pts`;
  }

  function renderProfileForm() {
    const p = Store.data.profile;
    $("cf-handle-input").value = p.cfHandle || "";
    $("gamification-start-input").value = p.gamificationStart || "";
    $("focus-tags-input").value = (p.focusTags || []).join(", ");
    $("target-date-input").value = p.targetDate || "";
  }

  function parseTags(text) {
    return text
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
  }

  function renderSolvedLog() {
    const root = $("solved-log-root");
    const log = Store.data.solvedLog.slice().sort((a, b) => (a.solvedDate < b.solvedDate ? 1 : -1));
    const recent = log.slice(0, 12);
    if (!recent.length) {
      root.innerHTML = `<p class="empty-note">No solves logged yet. Sync with Codeforces or log one manually above.</p>`;
      return;
    }
    root.innerHTML = recent
      .map((p) => {
        const date = new Date(p.solvedDate).toLocaleDateString();
        const ratingLabel = p.rating ? p.rating : "unrated";
        const tagsLabel = (p.tags || []).slice(0, 4).join(", ");
        return `
          <div class="solved-row">
            <span class="solved-key">${escapeHtml(p.contestId && p.index ? `${p.contestId}${p.index}` : p.key)}</span>
            <span class="solved-name">${escapeHtml(p.name)}</span>
            <span class="solved-rating">${ratingLabel}</span>
            <span class="solved-tags">${escapeHtml(tagsLabel)}</span>
            <span class="solved-date">${date}</span>
            <span class="solved-points">+${p.points}</span>
            <span class="solved-source badge-${p.source}">${p.source === "cf-sync" ? "CF sync" : "manual"}</span>
          </div>`;
      })
      .join("");
  }

  function renderRewards() {
    const root = $("rewards-list");
    const { rewards, points } = Store.data;
    if (!rewards.length) {
      root.innerHTML = `<p class="empty-note">No rewards yet &mdash; add one below.</p>`;
    } else {
      root.innerHTML = rewards
        .map(
          (r) => `
          <div class="reward-row">
            <span class="reward-name">${escapeHtml(r.name)}</span>
            <span class="reward-cost">${r.cost} pts</span>
            <button type="button" class="btn-secondary btn-redeem" data-reward-id="${r.id}" ${points.balance < r.cost ? "disabled" : ""}>Redeem</button>
            <button type="button" class="btn-icon btn-remove-reward" data-reward-id="${r.id}" aria-label="Remove reward">&times;</button>
          </div>`
        )
        .join("");
    }

    root.querySelectorAll(".btn-redeem").forEach((btn) => {
      btn.addEventListener("click", () => {
        Gamification.redeemReward(btn.dataset.rewardId);
        refreshDynamic();
      });
    });
    root.querySelectorAll(".btn-remove-reward").forEach((btn) => {
      btn.addEventListener("click", () => {
        Gamification.removeReward(btn.dataset.rewardId);
        refreshDynamic();
      });
    });

    const history = $("redemption-history");
    const redemptions = Store.data.redemptions.slice(0, 15);
    history.innerHTML = redemptions.length
      ? redemptions
          .map(
            (r) => `
          <div class="redemption-row">
            <span>${escapeHtml(r.rewardName)}</span>
            <span>${r.cost} pts</span>
            <span>${new Date(r.date).toLocaleString()}</span>
          </div>`
          )
          .join("")
      : `<p class="empty-note">No redemptions yet.</p>`;
  }

  function escapeHtml(str) {
    return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function refreshDynamic() {
    renderPointsBadge();
    Timeline.render($("timeline-root"));
    Reports.render($("reports-root"));
    renderSolvedLog();
    renderRewards();
  }
  window.refreshDynamic = refreshDynamic;

  function renderRoadmapAndDependents() {
    Roadmap.render($("roadmap-root"));
    refreshDynamic();
  }

  function setSyncStatus(msg, kind) {
    const el = $("sync-status");
    el.textContent = msg;
    el.className = `sync-status ${kind || ""}`;
  }

  async function handleSyncNow() {
    const handle = Store.data.profile.cfHandle.trim();
    if (!handle) {
      setSyncStatus("Set your Codeforces handle in the profile card first.", "error");
      return;
    }
    if (!requireVerifiedIfCloud()) return;
    setSyncStatus("Fetching…", "");
    const result = await CFSync.fetchLive(handle);
    if (!result.ok) {
      setSyncStatus(`Live fetch failed (${result.error}). Use the manual fallback below.`, "error");
      $("manual-sync-details").open = true;
      return;
    }
    const { added, pointsGained } = CFSync.applyProblems(result.problems);
    setSyncStatus(`Synced. ${added} new solve${added === 1 ? "" : "s"} added (+${pointsGained} pts).`, "success");
    renderRoadmapAndDependents();
  }

  function handleManualSync() {
    const text = $("manual-json-input").value.trim();
    if (!text) {
      setSyncStatus("Paste the JSON response first.", "error");
      return;
    }
    if (!requireVerifiedIfCloud()) return;
    try {
      const problems = CFSync.parseManual(text);
      const { added, pointsGained } = CFSync.applyProblems(problems);
      setSyncStatus(`Synced from pasted JSON. ${added} new solve${added === 1 ? "" : "s"} added (+${pointsGained} pts).`, "success");
      $("manual-json-input").value = "";
      refreshDynamic();
    } catch (e) {
      setSyncStatus(`Couldn't parse that JSON: ${e.message}`, "error");
    }
  }

  function handleManualLog(evt) {
    evt.preventDefault();
    const contestId = $("log-contest-id").value.trim();
    const index = $("log-index").value.trim();
    const name = $("log-name").value.trim();
    const rating = $("log-rating").value ? Number($("log-rating").value) : null;
    const tags = parseTags($("log-tags").value);
    const solvedDate = $("log-date").value ? new Date($("log-date").value).toISOString() : new Date().toISOString();

    if (!name && !(contestId && index)) {
      setSyncStatus("Give the solve a name or a contest ID + index.", "error");
      return;
    }
    if (!requireVerifiedIfCloud()) return;

    const { added, pointsGained } = CFSync.logSingle({ contestId, index, name, rating, tags, solvedDate });
    setSyncStatus(added ? `Logged (+${pointsGained} pts).` : "That problem is already logged.", added ? "success" : "");
    evt.target.reset();
    $("log-date").value = todayISODate();
    refreshDynamic();
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
      $("manual-api-link").href = Store.data.profile.cfHandle ? CFSync.apiUrl(Store.data.profile.cfHandle) : "#";
      const note = $("profile-saved-note");
      note.hidden = false;
      setTimeout(() => (note.hidden = true), 1800);
      renderAccountCard();
      renderRoadmapAndDependents();
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
    if (signedIn) $("account-email").textContent = email || "";
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
    refreshDynamic();
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

  async function handleAuthSession(session) {
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
        setSigninStatus(`Couldn't load your account data: ${e.message}`, "error");
        return;
      }
      showSignedIn(true, session.user.email);
    } else {
      await Store.exitCloudMode();
      showSignedIn(false);
    }
    verifyState = null;
    renderProfileForm();
    renderAccountCard();
    renderRoadmapAndDependents();
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

    Auth.onChange(handleAuthSession);
    Auth.init().then((session) => handleAuthSession(session));
  }

  function wireSyncCard() {
    $("sync-now-btn").addEventListener("click", handleSyncNow);
    $("manual-sync-btn").addEventListener("click", handleManualSync);
    $("manual-log-form").addEventListener("submit", handleManualLog);
    $("log-date").value = todayISODate();
    $("manual-api-link").href = Store.data.profile.cfHandle ? CFSync.apiUrl(Store.data.profile.cfHandle) : "#";
  }

  function wireRewardsForm() {
    $("add-reward-form").addEventListener("submit", (evt) => {
      evt.preventDefault();
      const name = $("reward-name-input").value.trim();
      const cost = Number($("reward-cost-input").value);
      if (!name || !cost || cost <= 0) return;
      Gamification.addReward(name, Math.round(cost));
      evt.target.reset();
      refreshDynamic();
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
        renderRoadmapAndDependents();
        Theme.apply();
      } catch (e) {
        status.textContent = `Import failed: ${e.message}`;
        status.className = "sync-status error";
      }
      fileInput.value = "";
    });

    $("reset-btn").addEventListener("click", () => {
      const cloudNote = isCloudMode() ? " This also overwrites your synced cloud copy." : "";
      if (!confirm(`This clears all ICPC Prep Hub data (roadmap progress, points, logs, rewards).${cloudNote} This can't be undone unless you've exported a backup. Continue?`)) {
        return;
      }
      Store.resetAll();
      renderProfileForm();
      renderAccountCard();
      renderRoadmapAndDependents();
      Theme.apply();
      $("data-status").textContent = "All data reset.";
      $("data-status").className = "sync-status success";
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    Theme.init();
    renderProfileForm();
    wireProfileForm();
    wireSyncCard();
    wireRewardsForm();
    wireDataCard();
    wireAccountCard();
    renderRoadmapAndDependents();
  });
})();

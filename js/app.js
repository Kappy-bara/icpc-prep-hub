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

    const { added, pointsGained } = CFSync.logSingle({ contestId, index, name, rating, tags, solvedDate });
    setSyncStatus(added ? `Logged (+${pointsGained} pts).` : "That problem is already logged.", added ? "success" : "");
    evt.target.reset();
    $("log-date").value = todayISODate();
    refreshDynamic();
  }

  function wireProfileForm() {
    $("profile-form").addEventListener("submit", (evt) => {
      evt.preventDefault();
      Store.update((d) => {
        d.profile.cfHandle = $("cf-handle-input").value.trim();
        d.profile.gamificationStart = $("gamification-start-input").value || null;
        d.profile.focusTags = parseTags($("focus-tags-input").value);
        d.profile.targetDate = $("target-date-input").value || null;
      });
      $("manual-api-link").href = Store.data.profile.cfHandle ? CFSync.apiUrl(Store.data.profile.cfHandle) : "#";
      const note = $("profile-saved-note");
      note.hidden = false;
      setTimeout(() => (note.hidden = true), 1800);
      renderRoadmapAndDependents();
    });
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
        renderRoadmapAndDependents();
        Theme.apply();
      } catch (e) {
        status.textContent = `Import failed: ${e.message}`;
        status.className = "sync-status error";
      }
      fileInput.value = "";
    });

    $("reset-btn").addEventListener("click", () => {
      if (!confirm("This clears all locally stored ICPC Prep Hub data (roadmap progress, points, logs, rewards). This can't be undone unless you've exported a backup. Continue?")) {
        return;
      }
      Store.resetAll();
      renderProfileForm();
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
    renderRoadmapAndDependents();
  });
})();

/** Codeforces page: sync, solved log, reports, and the new analysis card. */
(function () {
  function todayISODate() {
    return new Date().toISOString().slice(0, 10);
  }

  function parseTags(text) {
    return text
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
  }

  function setSyncStatus(msg, kind) {
    const el = $("sync-status");
    el.textContent = msg;
    el.className = `sync-status ${kind || ""}`;
  }

  /**
   * Syncing works for any handle — Codeforces solve history is public data, so there's no
   * reason to block it. But nothing stops you typing in someone else's handle either, so this
   * badge makes it obvious whether the configured handle has actually been proven to be yours
   * (see the Profile card on the Dashboard), instead of silently treating unverified data the
   * same as verified data.
   */
  function renderVerifyBadge() {
    const el = $("cf-verify-status-badge");
    if (!el) return;
    const { cfHandle, cfVerified } = Store.data.profile;
    if (!cfHandle) {
      el.textContent = "No Codeforces handle set yet — add one on the Dashboard, then come back here to sync.";
      el.className = "card-subtitle";
    } else if (cfVerified) {
      el.innerHTML = `<span class="verified-note">&check; Syncing as verified handle <strong>${escapeHtml(cfHandle)}</strong>.</span>`;
      el.className = "card-subtitle";
    } else {
      el.innerHTML = `&#9888; Syncing as <strong>${escapeHtml(cfHandle)}</strong>, which isn't verified yet &mdash; this could be anyone's public solve history, not necessarily yours. <a href="dashboard.html">Verify it on the Dashboard</a>.`;
      el.className = "card-subtitle";
    }
  }

  function refreshDynamic() {
    Nav.updatePointsBadge();
    SolvedLogUI.render($("solved-log-root"));
    Reports.render($("reports-root"));
    CFAnalysis.render($("cf-analysis-root"));
  }

  async function handleSyncNow() {
    const handle = Store.data.profile.cfHandle.trim();
    if (!handle) {
      setSyncStatus("Set your Codeforces handle on the Dashboard first.", "error");
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
    CFSync.applyAnalysis(result);
    setSyncStatus(`Synced. ${added} new solve${added === 1 ? "" : "s"} added (+${pointsGained} pts). Fetching rating history…`, "success");
    refreshDynamic();

    const ratingResult = await CFSync.fetchRatingHistory(handle);
    if (ratingResult.ok) {
      CFSync.applyRatingHistory(ratingResult.history);
      setSyncStatus(`Synced. ${added} new solve${added === 1 ? "" : "s"} added (+${pointsGained} pts).`, "success");
      refreshDynamic();
    } else {
      setSyncStatus(`Synced (+${pointsGained} pts), but rating history failed: ${ratingResult.error}.`, "success");
    }
  }

  function handleManualSync() {
    const text = $("manual-json-input").value.trim();
    if (!text) {
      setSyncStatus("Paste the JSON response first.", "error");
      return;
    }
    try {
      const result = CFSync.parseManual(text);
      const { added, pointsGained } = CFSync.applyProblems(result.problems);
      CFSync.applyAnalysis(result);
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

  function wireSyncCard() {
    $("sync-now-btn").addEventListener("click", handleSyncNow);
    $("manual-sync-btn").addEventListener("click", handleManualSync);
    $("manual-log-form").addEventListener("submit", handleManualLog);
    $("log-date").value = todayISODate();
    $("manual-api-link").href = Store.data.profile.cfHandle ? CFSync.apiUrl(Store.data.profile.cfHandle) : "#";
  }

  document.addEventListener("DOMContentLoaded", () => {
    wireSyncCard();
    renderVerifyBadge();
    refreshDynamic();
  });

  document.addEventListener("icpc:auth-changed", () => {
    $("manual-api-link").href = Store.data.profile.cfHandle ? CFSync.apiUrl(Store.data.profile.cfHandle) : "#";
    renderVerifyBadge();
    refreshDynamic();
  });
})();

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

  /** "+N pts", or a note explaining why it's stuck at 0 if the handle isn't verified yet. */
  function ptsLabel(pointsGained) {
    if (pointsGained === 0 && !Store.data.profile.cfVerified) {
      return "+0 pts — verify your handle to earn points";
    }
    return `+${pointsGained} pts`;
  }

  /**
   * Syncing works for any handle — Codeforces solve history is public data, so there's no
   * reason to block *viewing* it (solved log, accuracy, rating chart, etc. all still populate).
   * But solves only earn points once the configured handle has passed CF verification (see
   * gamification.js computePoints) — this badge makes that consequence obvious upfront instead
   * of silently syncing "for free" and leaving you to wonder why the balance didn't move.
   */
  function renderVerifyBadge() {
    const el = $("cf-verify-status-badge");
    if (!el) return;
    const { cfHandle, cfVerified } = Store.data.profile;
    if (!cfHandle) {
      el.textContent = "No Codeforces handle set yet — add one on the Dashboard, then come back here to sync.";
      el.className = "card-subtitle";
    } else if (cfVerified) {
      el.innerHTML = `<span class="verified-note">&check; Syncing as verified handle <strong>${escapeHtml(cfHandle)}</strong> &mdash; solves earn points normally.</span>`;
      el.className = "card-subtitle";
    } else {
      el.innerHTML = `&#9888; Syncing as <strong>${escapeHtml(cfHandle)}</strong>, which isn't verified yet &mdash; solves will sync and show up in your stats, but they'll score <strong>0 points</strong> until you <a href="dashboard.html">verify it on the Dashboard</a>.`;
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
    setSyncStatus(`Synced. ${added} new solve${added === 1 ? "" : "s"} added (${ptsLabel(pointsGained)}). Fetching Codeforces Rating history…`, "success");
    refreshDynamic();

    const ratingResult = await CFSync.fetchRatingHistory(handle);
    if (ratingResult.ok) {
      CFSync.applyRatingHistory(ratingResult.history);
      setSyncStatus(`Synced. ${added} new solve${added === 1 ? "" : "s"} added (${ptsLabel(pointsGained)}).`, "success");
      refreshDynamic();
    } else {
      setSyncStatus(`Synced (${ptsLabel(pointsGained)}), but Codeforces Rating history failed: ${ratingResult.error}.`, "success");
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
      setSyncStatus(`Synced from pasted JSON. ${added} new solve${added === 1 ? "" : "s"} added (${ptsLabel(pointsGained)}).`, "success");
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
    setSyncStatus(added ? `Logged (${ptsLabel(pointsGained)}).` : "That problem is already logged.", added ? "success" : "");
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
})();

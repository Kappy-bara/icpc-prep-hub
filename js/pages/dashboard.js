/** Dashboard page: preferences, timeline, roadmap summary, recent solves, backup.
 * Handle verification has moved to the sign-in flow (js/auth-ui.js + cf-signin Edge Function),
 * so by the time a user reaches this page, they're already verified. */
(function () {
  function refreshDynamic() {
    Nav.updatePointsBadge();
    Nav.updateAccountArea();
    Timeline.render($("timeline-root"));
    Gamification.renderStreak($("streak-root"));
    Roadmap.renderSummary($("roadmap-summary-root"));
    SolvedLogUI.render($("solved-log-root"), { limit: 5 });
  }

  function applyLockState() {
    const signedIn = Auth.isSignedIn() && Store.isLoaded();
    const signinContainer = $("dashboard-signin");
    const contentContainer = $("dashboard-content");

    if (signedIn) {
      signinContainer.hidden = true;
      contentContainer.hidden = false;
      AuthUI.unmount(signinContainer);
    } else {
      signinContainer.hidden = false;
      contentContainer.hidden = true;
      AuthUI.mount(signinContainer);
    }
    return signedIn;
  }

  // --- Profile & preferences ---

  function renderProfile() {
    const p = Store.data.profile;
    $("verified-handle").textContent = p.cfHandle;
    $("gamification-start-date").textContent = p.gamificationStart ? new Date(p.gamificationStart).toLocaleDateString() : "today";
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
  }

  // --- Backup & restore ---

  function downloadExport() {
    const blob = new Blob([Store.exportJSON()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `icpc-prep-hub-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function wireDataCard() {
    const actionsDefault = $("data-actions-default");
    const confirmZone = $("data-confirm-zone");
    const fileInput = $("import-file-input");
    const status = $("data-status");

    function closeConfirm() {
      confirmZone.hidden = true;
      confirmZone.innerHTML = "";
      actionsDefault.hidden = false;
    }

    // Reset wipes everything and Import silently overwrites everything with the picked file's
    // contents, but previously only Reset had any confirmation (a bare native confirm(), easy to
    // click through on muscle memory) and Import had none. This renders a warning + an "export a
    // backup first" escape hatch + a confirm/cancel pair in place of the normal buttons instead.
    function showConfirm(message, onConfirm) {
      actionsDefault.hidden = true;
      confirmZone.hidden = false;
      confirmZone.innerHTML = `
        <p>&#9888; ${escapeHtml(message)}</p>
        <div class="form-actions">
          <button type="button" id="data-confirm-export-first" class="btn-secondary">Export a backup first</button>
          <button type="button" id="data-confirm-yes" class="btn-danger">Yes, I'm sure</button>
          <button type="button" id="data-confirm-cancel" class="btn-icon">Cancel</button>
        </div>
      `;
      $("data-confirm-export-first").addEventListener("click", downloadExport);
      $("data-confirm-yes").addEventListener("click", async () => {
        closeConfirm();
        await onConfirm();
      });
      $("data-confirm-cancel").addEventListener("click", () => {
        closeConfirm();
        fileInput.value = ""; // no-op if this confirm wasn't triggered by a file pick
      });
    }

    $("export-btn").addEventListener("click", downloadExport);

    fileInput.addEventListener("change", () => {
      const file = fileInput.files[0];
      if (!file) return;
      showConfirm(
        `This will REPLACE all of your current roadmap progress, points, logs, and rewards with the contents of "${file.name}". Your verified Codeforces handle stays linked either way. This can't be undone.`,
        async () => {
          const text = await file.text();
          status.textContent = "Importing…";
          status.className = "sync-status";
          const result = await Store.importJSON(text);
          if (result.ok) {
            status.textContent = "Import successful.";
            status.className = "sync-status success";
            renderProfile();
            refreshDynamic();
          } else {
            status.textContent = `Import failed: ${result.error}`;
            status.className = "sync-status error";
          }
          fileInput.value = "";
        }
      );
    });

    $("reset-btn").addEventListener("click", () => {
      showConfirm(
        "This clears your roadmap progress, points, logs, and rewards. Your verified Codeforces handle stays linked. This can't be undone.",
        async () => {
          status.textContent = "Resetting…";
          status.className = "sync-status";
          const result = await Store.resetAll();
          if (result.ok) {
            renderProfile();
            refreshDynamic();
            status.textContent = "Progress reset.";
            status.className = "sync-status success";
          } else {
            status.textContent = `Reset failed: ${result.error}`;
            status.className = "sync-status error";
          }
        }
      );
    });
  }

  function isReady() {
    return applyLockState();
  }

  // #page-body's forms are static markup wired once and never re-created — but "ready" can first
  // become true either on the initial DOMContentLoaded (the common case: already signed in when
  // the page loads) OR later, on icpc:external-data-change (sign in happens *after* page load, via
  // AuthUI mounted in the separate #auth-gate area). This flag makes wiring idempotent across
  // either path, so the forms get attached exactly once whichever one fires first.
  let wired = false;
  function wireOnce() {
    if (wired) return;
    wired = true;
    wirePrefsForm();
    wireDataCard();
  }

  document.addEventListener("DOMContentLoaded", async () => {
    await Shell.ready;
    if (!isReady()) return;
    wireOnce();
    renderProfile();
    refreshDynamic();
  });

  document.addEventListener("icpc:points-changed", () => {
    if (!isReady()) return;
    Nav.updatePointsBadge();
    Gamification.renderStreak($("streak-root"));
  });

  // Sign-in/out elsewhere, another tab/device syncing, a focus-triggered refetch — see storage.js
  // and shell.js. wireOnce() is a no-op if DOMContentLoaded already wired the forms (the common
  // case); it's what actually wires them the first time if sign-in happens after page load.
  document.addEventListener("icpc:external-data-change", () => {
    if (!isReady()) return;
    wireOnce();
    renderProfile();
    refreshDynamic();
  });
})();

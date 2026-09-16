/**
 * Roadmap page: the full checklist, locked behind Codeforces verification — same
 * verified-gates-the-real-content pattern as self-rule.js's points/rewards lock, applied here so
 * checking off topics isn't possible before you've proven the handle is yours (previously the only
 * thing verification gated was points; the roadmap checklist itself was editable by anyone with no
 * check at all, which read as a bug once points/rewards already worked this way).
 */
(function () {
  function applyLockState() {
    const unlocked = Boolean(Store.data.profile.cfVerified);
    $("roadmap-locked-card").hidden = unlocked;
    $("roadmap-root").hidden = !unlocked;
    return unlocked;
  }

  function render() {
    if (!applyLockState()) return;
    Roadmap.render($("roadmap-root"));
  }
  document.addEventListener("DOMContentLoaded", render);
})();

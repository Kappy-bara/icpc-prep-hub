/** Home page: a small progress teaser plus links into the rest of the app. */
(function () {
  function render() {
    const root = $("home-progress-root");
    if (!root) return;
    const overall = Roadmap.overallProgress();
    const points = Store.data.points.balance;
    const solvedCount = Store.data.solvedLog.length;
    const hasStarted = overall.done > 0 || points > 0 || solvedCount > 0;

    root.innerHTML = `
      <div class="report-windows">
        <div class="stat-tile"><div class="stat-value">${points}</div><div class="stat-label">points</div></div>
        <div class="stat-tile"><div class="stat-value">${overall.percent}%</div><div class="stat-label">roadmap complete</div></div>
        <div class="stat-tile"><div class="stat-value">${solvedCount}</div><div class="stat-label">problems solved</div></div>
      </div>
      <p class="card-subtitle">
        ${hasStarted ? "Keep going — check the Dashboard for your full timeline and pacing." : "Head to the Dashboard to set up your profile and get started."}
      </p>
    `;
  }

  document.addEventListener("DOMContentLoaded", render);
  document.addEventListener("icpc:auth-changed", render);
})();

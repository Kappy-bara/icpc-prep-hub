/**
 * Codeforces Analysis card: tag-ratio-vs-baseline comparison (js/cf-baseline.js),
 * accuracy per tag, rating trajectory, and unsolved/attempted problems — all
 * driven by Store.data.cf.* populated during sync (js/cf-sync.js).
 */
const CFAnalysis = {
  _tier: "top500",
  _window: "lastYear",

  TIERS: [
    { id: "top500", label: "Top 500" },
    { id: "top10000", label: "Top 10,000" },
    { id: "average", label: "Average user" },
  ],
  WINDOWS: [
    { id: "lastYear", label: "Last year" },
    { id: "allTime", label: "All time" },
  ],

  render(container) {
    if (!container) return;
    container.innerHTML = `
      <div class="report-toggle" id="cf-tier-toggle">
        ${this.TIERS.map((t) => `<button type="button" data-tier="${t.id}" class="${t.id === this._tier ? "active" : ""}">${t.label}</button>`).join("")}
      </div>
      <div class="report-toggle" id="cf-window-toggle">
        ${this.WINDOWS.map((w) => `<button type="button" data-window="${w.id}" class="${w.id === this._window ? "active" : ""}">${w.label}</button>`).join("")}
      </div>

      <div class="cf-analysis-section">
        <h3>Your tag mix vs. the baseline</h3>
        <p class="card-subtitle" id="cf-baseline-subtitle"></p>
        <div id="cf-baseline-root"></div>
      </div>
      <div class="cf-analysis-section">
        <h3>Accuracy per tag</h3>
        <p class="card-subtitle">Average wrong attempts before AC, by tag (lower is better; needs at least 2 solves in a tag to show).</p>
        <div id="cf-accuracy-root" class="bar-list"></div>
      </div>
      <div class="cf-analysis-section">
        <h3>Rating trajectory</h3>
        <div id="cf-rating-chart-root"></div>
      </div>
      <div class="cf-analysis-section">
        <h3>Unsolved / attempted</h3>
        <p class="card-subtitle">Problems you've tried but haven't solved yet &mdash; ready-made practice targets.</p>
        <div id="cf-unsolved-root" class="solved-log"></div>
      </div>
    `;

    container.querySelectorAll("#cf-tier-toggle button").forEach((btn) => {
      btn.addEventListener("click", () => {
        this._tier = btn.dataset.tier;
        this.render(container);
      });
    });
    container.querySelectorAll("#cf-window-toggle button").forEach((btn) => {
      btn.addEventListener("click", () => {
        this._window = btn.dataset.window;
        this.render(container);
      });
    });

    this.renderBaseline($("cf-baseline-root"), $("cf-baseline-subtitle"));
    this.renderAccuracy($("cf-accuracy-root"));
    this.renderRatingChart($("cf-rating-chart-root"));
    this.renderUnsolved($("cf-unsolved-root"));
  },

  renderBaseline(root, subtitleEl) {
    const result = CFBaseline.compareTags({ tier: this._tier, window: this._window });
    const cutoffLabel = this._tier === "average" ? `~${result.ratingCutoff} rated` : `${result.ratingCutoff}+ rated`;
    subtitleEl.textContent = `${result.tierLabel} (${cutoffLabel}) · ${result.baselineProblemCount} baseline problems in this window`;

    if (!result.baselineProblemCount) {
      root.innerHTML = `<p class="empty-note">No baseline data for this window yet.</p>`;
      return;
    }
    if (result.insufficientData) {
      root.innerHTML = `<p class="empty-note">Log or sync at least 5 solves in this window to see a comparison (you have ${result.yourTotal}).</p>`;
      return;
    }

    const verdictLabel = { weak: "Weak", strong: "Strong", "on-par": "On par" };
    const rows = result.rows.slice(0, 15);
    const maxRatio = Math.max(0.01, ...rows.map((r) => Math.max(r.yourRatio, r.baselineRatio)));

    root.innerHTML = `
      <div class="cf-legend">
        <span><span class="cf-legend-swatch" style="background:var(--text-muted);opacity:.35"></span>Baseline</span>
        <span><span class="cf-legend-swatch" style="background:var(--accent)"></span>You</span>
      </div>
      ${rows
        .map(
          (r) => `
        <div class="bar-row-compare">
          <span class="bar-label">${escapeHtml(r.tag)}</span>
          <div class="bar-track-dual">
            <div class="bar-fill-baseline" style="width:${(r.baselineRatio / maxRatio) * 100}%"></div>
            <div class="bar-fill-mine" style="width:${(r.yourRatio / maxRatio) * 100}%"></div>
          </div>
          <span class="bar-verdict verdict-${r.verdict}">${verdictLabel[r.verdict]}</span>
        </div>`
        )
        .join("")}
    `;
  },

  renderAccuracy(root) {
    const { solvedLog, cf } = Store.data;
    const tagStats = {};
    for (const p of solvedLog) {
      const wrong = cf.attemptStats[p.key] || 0;
      for (const tag of p.tags || []) {
        if (!tagStats[tag]) tagStats[tag] = { totalWrong: 0, count: 0 };
        tagStats[tag].totalWrong += wrong;
        tagStats[tag].count += 1;
      }
    }
    const rows = Object.entries(tagStats)
      .map(([tag, s]) => ({ tag, avgWrong: s.count ? s.totalWrong / s.count : 0, count: s.count }))
      .filter((r) => r.count >= 2)
      .sort((a, b) => b.avgWrong - a.avgWrong)
      .slice(0, 12);

    if (!rows.length) {
      root.innerHTML = `<p class="empty-note">Sync your Codeforces handle above to see this (needs at least 2 solves in a tag).</p>`;
      return;
    }
    const maxAvg = Math.max(0.01, ...rows.map((r) => r.avgWrong));
    root.innerHTML = rows
      .map(
        (r) => `
      <div class="bar-row">
        <span class="bar-label">${escapeHtml(r.tag)}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${(r.avgWrong / maxAvg) * 100}%"></div></div>
        <span class="bar-count">${r.avgWrong.toFixed(1)}</span>
      </div>`
      )
      .join("");
  },

  renderRatingChart(root) {
    const history = Store.data.cf.ratingHistory;
    if (!history.length) {
      root.innerHTML = `<p class="empty-note">Sync your Codeforces handle above to see your rating trajectory.</p>`;
      return;
    }
    const width = 640;
    const height = 180;
    const padding = 30;
    const n = history.length;
    const ratings = history.map((h) => h.newRating);
    const minR = Math.min(...ratings) - 50;
    const maxR = Math.max(...ratings) + 50;
    const x = (i) => padding + (i / Math.max(1, n - 1)) * (width - 2 * padding);
    const y = (r) => height - padding - ((r - minR) / (maxR - minR)) * (height - 2 * padding);
    const points = history.map((h, i) => `${x(i)},${y(h.newRating)}`).join(" ");
    const last = history[n - 1];

    root.innerHTML = `
      <div class="rating-chart-wrap">
        <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Rating over ${n} contest${n === 1 ? "" : "s"}, ending at ${last.newRating}">
          <polyline points="${points}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
          ${history
            .map(
              (h, i) =>
                `<circle cx="${x(i)}" cy="${y(h.newRating)}" r="3" fill="var(--accent)"><title>${escapeHtml(h.contestName)}: ${h.oldRating} → ${h.newRating}</title></circle>`
            )
            .join("")}
        </svg>
      </div>
      <p class="card-subtitle">${n} contest${n === 1 ? "" : "s"} · current rating ${last.newRating}</p>
    `;
  },

  renderUnsolved(root) {
    const list = Store.data.cf.unsolvedAttempted;
    if (!list.length) {
      root.innerHTML = `<p class="empty-note">Sync your Codeforces handle above to see problems you've tried but haven't solved yet.</p>`;
      return;
    }
    root.innerHTML = list
      .slice(0, 20)
      .map((p) => {
        const date = new Date(p.lastAttemptDate).toLocaleDateString();
        const ratingLabel = p.rating ? p.rating : "unrated";
        const tagsLabel = (p.tags || []).slice(0, 4).join(", ");
        return `
          <div class="solved-row">
            <span class="solved-key">${escapeHtml(p.contestId && p.index ? `${p.contestId}${p.index}` : p.key)}</span>
            <span class="solved-name">${escapeHtml(p.name)}</span>
            <span class="solved-rating">${ratingLabel}</span>
            <span class="solved-tags">${escapeHtml(tagsLabel)}</span>
            <span class="solved-date">${date}</span>
            <span class="solved-rating">${p.attemptCount} attempt${p.attemptCount === 1 ? "" : "s"}</span>
          </div>`;
      })
      .join("");
  },
};

/**
 * Codeforces Analysis card: tag-ratio-vs-baseline comparison (js/cf-baseline.js),
 * accuracy per tag, rating trajectory, and unsolved/attempted problems — all
 * driven by Store.data.cf.* populated during sync (js/cf-sync.js).
 */
const CFAnalysis = {
  _tier: "top500",
  _window: "lastYear",

  TIERS: [
    { id: "tourist", label: "Tourist" },
    { id: "top500", label: "Top 500" },
    { id: "top10000", label: "Top 10,000" },
    { id: "average", label: "Average user" },
  ],
  WINDOWS: [
    { id: "lastYear", label: "Last year" },
    { id: "allTime", label: "All time" },
  ],

  RANK_TITLES: [
    [3000, "Legendary Grandmaster"],
    [2600, "International Grandmaster"],
    [2400, "Grandmaster"],
    [2300, "International Master"],
    [2100, "Master"],
    [1900, "Candidate Master"],
    [1600, "Expert"],
    [1400, "Specialist"],
    [1200, "Pupil"],
    [0, "Newbie"],
  ],

  rankTitle(rating) {
    if (rating == null) return null;
    for (const [cutoff, title] of this.RANK_TITLES) {
      if (rating >= cutoff) return title;
    }
    return null;
  },

  render(container) {
    if (!container) return;
    container.innerHTML = `
      <div id="cf-summary-root"></div>
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
        <h3>Solve activity</h3>
        <div id="cf-heatmap-root"></div>
      </div>
      <div class="cf-analysis-section">
        <h3>Unsolved / attempted</h3>
        <p class="card-subtitle">Problems you've tried but haven't solved yet &mdash; ready-made practice targets.</p>
        <div id="cf-unsolved-root" class="solved-log"></div>
      </div>
      <div class="cf-analysis-section">
        <h3>Next problem recommendations</h3>
        <p class="card-subtitle">Unsolved problems in your weak tags (from the comparison above), just above a target rating blended from your current CF rating and what you've actually been solving lately.</p>
        <button id="cf-recommend-btn" type="button" class="btn-secondary">Get recommendations</button>
        <span id="cf-recommend-status" class="sync-status"></span>
        <div id="cf-recommend-root" class="solved-log"></div>
      </div>
    `;

    $("cf-recommend-btn").addEventListener("click", () => this.handleRecommend());

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

    this.renderSummary($("cf-summary-root"));
    this.renderBaseline($("cf-baseline-root"), $("cf-baseline-subtitle"));
    this.renderAccuracy($("cf-accuracy-root"));
    this.renderRatingChart($("cf-rating-chart-root"));
    this.renderHeatmap($("cf-heatmap-root"));
    this.renderUnsolved($("cf-unsolved-root"));
    $("cf-recommend-root").innerHTML = "";
  },

  /** Weak tags from the currently-selected tier/window, for the recommendation filter. */
  currentWeakTags() {
    const result = CFBaseline.compareTags({ tier: this._tier, window: this._window });
    return result.rows.filter((r) => r.verdict === "weak").map((r) => r.tag);
  },

  async handleRecommend() {
    const statusEl = $("cf-recommend-status");
    const root = $("cf-recommend-root");
    const weakTags = this.currentWeakTags();
    if (!weakTags.length) {
      statusEl.textContent = "No weak tags found for this tier/window — nothing specific to recommend against.";
      statusEl.className = "sync-status error";
      return;
    }
    const targetRating = CFRecommend.computeTargetRating();
    statusEl.textContent = "Fetching the problem set…";
    statusEl.className = "sync-status";
    const result = await CFRecommend.fetchRecommendations({ weakTags, targetRating });
    if (!result.ok) {
      statusEl.textContent = `Failed: ${result.error}`;
      statusEl.className = "sync-status error";
      return;
    }
    if (!result.problems.length) {
      statusEl.textContent = `No unsolved problems found rated ${result.low}–${result.high} in: ${weakTags.join(", ")}.`;
      statusEl.className = "sync-status";
      root.innerHTML = "";
      return;
    }
    statusEl.textContent = `${result.problems.length} problems rated ${result.low}–${result.high}, tagged: ${weakTags.join(", ")}.`;
    statusEl.className = "sync-status success";
    root.innerHTML = result.problems
      .map((p) => {
        const tagsLabel = (p.tags || []).slice(0, 4).join(", ");
        return `
          <div class="solved-row">
            <span class="solved-key"><a href="https://codeforces.com/problemset/problem/${p.contestId}/${p.index}" target="_blank" rel="noopener noreferrer">${p.contestId}${p.index}</a></span>
            <span class="solved-name">${escapeHtml(p.name)}</span>
            <span class="solved-rating">${p.rating}</span>
            <span class="solved-tags">${escapeHtml(tagsLabel)}</span>
          </div>`;
      })
      .join("");
  },

  renderHeatmap(root) {
    const counts = {};
    for (const p of Store.data.solvedLog) {
      const day = p.solvedDate.slice(0, 10);
      counts[day] = (counts[day] || 0) + 1;
    }
    if (!Object.keys(counts).length) {
      root.innerHTML = `<p class="empty-note">No solves logged yet.</p>`;
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setDate(start.getDate() - 370); // ~53 weeks back
    start.setDate(start.getDate() - start.getDay()); // align to a Sunday

    const cells = [];
    const cursor = new Date(start);
    while (cursor <= today) {
      const key = cursor.toISOString().slice(0, 10);
      cells.push({ date: key, count: counts[key] || 0 });
      cursor.setDate(cursor.getDate() + 1);
    }

    const level = (c) => (c === 0 ? 0 : c === 1 ? 1 : c <= 3 ? 2 : c <= 6 ? 3 : 4);
    const totalSolves = cells.reduce((s, c) => s + c.count, 0);
    const activeDays = cells.filter((c) => c.count > 0).length;

    root.innerHTML = `
      <div class="heatmap-grid">
        ${cells.map((c) => `<div class="heatmap-cell level-${level(c.count)}" title="${c.date}: ${c.count} solve${c.count === 1 ? "" : "s"}"></div>`).join("")}
      </div>
      <div class="heatmap-legend">
        <span>Less</span>
        <span class="heatmap-cell level-0"></span>
        <span class="heatmap-cell level-1"></span>
        <span class="heatmap-cell level-2"></span>
        <span class="heatmap-cell level-3"></span>
        <span class="heatmap-cell level-4"></span>
        <span>More</span>
      </div>
      <p class="card-subtitle">${totalSolves} solve${totalSolves === 1 ? "" : "s"} logged across ${activeDays} active day${activeDays === 1 ? "" : "s"} in the last year.</p>
    `;
  },

  renderSummary(root) {
    const { solvedLog, cf } = Store.data;
    const ratedSolves = solvedLog.filter((p) => p.rating);
    const avgRating = ratedSolves.length ? Math.round(ratedSolves.reduce((s, p) => s + p.rating, 0) / ratedSolves.length) : null;
    const currentRating = cf.ratingHistory.length ? cf.ratingHistory[cf.ratingHistory.length - 1].newRating : null;
    const rank = this.rankTitle(currentRating);

    root.innerHTML = `
      <div class="report-windows">
        <div class="stat-tile"><div class="stat-value">${solvedLog.length}</div><div class="stat-label">total solved</div></div>
        <div class="stat-tile"><div class="stat-value">${avgRating ?? "—"}</div><div class="stat-label">avg. solved rating</div></div>
        <div class="stat-tile"><div class="stat-value">${currentRating ?? "—"}</div><div class="stat-label">${rank || "current rating"}</div></div>
        <div class="stat-tile"><div class="stat-value">${cf.ratingHistory.length}</div><div class="stat-label">contests synced</div></div>
      </div>
    `;
  },

  renderBaseline(root, subtitleEl) {
    const result = CFBaseline.compareTags({ tier: this._tier, window: this._window });
    let cutoffLabel;
    if (this._tier === "tourist") cutoffLabel = "real solve history";
    else if (this._tier === "average") cutoffLabel = `~${result.ratingCutoff} rated`;
    else cutoffLabel = `${result.ratingCutoff}+ rated`;
    const baselineNoun = this._tier === "tourist" ? "of tourist's solves" : "baseline problems";
    subtitleEl.textContent = `${result.tierLabel} (${cutoffLabel}) · ${result.baselineProblemCount} ${baselineNoun} in this window`;

    if (!result.baselineProblemCount) {
      root.innerHTML = `<p class="empty-note">No baseline data for this window yet.</p>`;
      return;
    }
    if (result.insufficientData) {
      root.innerHTML = `<p class="empty-note">Log or sync at least 5 solves in this window to see a comparison (you have ${result.yourTotal}).</p>`;
      return;
    }

    const verdictLabel = { weak: "Weak", strong: "Strong", "on-par": "On par" };
    const rows = result.rows;
    const maxRatio = Math.max(0.01, ...rows.map((r) => Math.max(r.yourRatio, r.baselineRatio)));
    const pct = (r) => Math.round(r * 100);

    root.innerHTML = `
      <div class="cf-legend">
        <span><span class="cf-legend-swatch" style="background:var(--text-muted);opacity:.35"></span>Baseline</span>
        <span><span class="cf-legend-swatch verdict-fill-weak"></span>Weak</span>
        <span><span class="cf-legend-swatch verdict-fill-on-par"></span>On par</span>
        <span><span class="cf-legend-swatch verdict-fill-strong"></span>Strong</span>
      </div>
      <div class="bar-scroll">
        ${rows
          .map(
            (r) => `
          <div class="bar-row-compare">
            <div class="bar-row-top">
              <span class="bar-label">${escapeHtml(r.tag)} <span class="bar-label-count">(${r.yourCount} solved)</span></span>
              <span class="bar-verdict verdict-${r.verdict}">${verdictLabel[r.verdict]} &middot; ${pct(r.yourRatio)}% vs ${pct(r.baselineRatio)}%</span>
            </div>
            <div class="bar-track-dual">
              <div class="bar-fill-baseline" style="width:${(r.baselineRatio / maxRatio) * 100}%"></div>
              <div class="bar-fill-mine verdict-fill-${r.verdict}" style="width:${(r.yourRatio / maxRatio) * 100}%"></div>
              <div class="bar-marker" style="left:${(r.baselineRatio / maxRatio) * 100}%"></div>
            </div>
          </div>`
          )
          .join("")}
      </div>
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
      .sort((a, b) => b.avgWrong - a.avgWrong);

    if (!rows.length) {
      root.innerHTML = `<p class="empty-note">Sync your Codeforces handle above to see this (needs at least 2 solves in a tag).</p>`;
      return;
    }
    const maxAvg = Math.max(0.01, ...rows.map((r) => r.avgWrong));
    root.innerHTML = `<div class="bar-scroll">${rows
      .map(
        (r) => `
      <div class="bar-row">
        <div class="bar-row-top">
          <span class="bar-label">${escapeHtml(r.tag)} <span class="bar-label-count">(${r.count} solved)</span></span>
          <span class="bar-count">${r.avgWrong.toFixed(1)} wrong/solve</span>
        </div>
        <div class="bar-track"><div class="bar-fill" style="width:${(r.avgWrong / maxAvg) * 100}%"></div></div>
      </div>`
      )
      .join("")}</div>`;
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
    const percentile = CFBaseline.percentileForRating(last.newRating);
    const percentileLabel = percentile ? ` · top ~${percentile}% of active rated Codeforces users` : "";
    const rank = this.rankTitle(last.newRating);
    const rankLabel = rank ? ` (${rank})` : "";

    const peak = history.reduce((m, h) => Math.max(m, h.newRating), -Infinity);
    const peakLabel = peak > last.newRating ? ` · peak ${peak}` : "";

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
      <p class="card-subtitle">${n} contest${n === 1 ? "" : "s"} · current rating ${last.newRating}${rankLabel}${peakLabel}${percentileLabel}</p>
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

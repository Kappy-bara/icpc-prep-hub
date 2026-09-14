/**
 * Compares the signed-in user's own solved-tag ratios against the static
 * CF_BASELINE_DATA (see js/cf-baseline-data.js + scripts/generate-cf-baseline.js).
 * Pure computation, no DOM — rendered by js/cf-analysis.js.
 */
const CF_BASELINE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const CF_BASELINE_VERDICT_THRESHOLD = 0.05; // +/- 5 percentage points
const CF_BASELINE_MIN_SOLVES = 5;

function cfBaselineCleanTags(tags) {
  return (tags || []).filter((t) => !t.startsWith("*"));
}

const CFBaseline = {
  /** "allTime" -> no cutoff; "lastYear" -> ISO cutoff 1 year ago. */
  windowCutoffISO(window) {
    return window === "lastYear" ? new Date(Date.now() - CF_BASELINE_YEAR_MS).toISOString() : null;
  },

  /** { total, ratios: {tag: ratio} } for the user's own solvedLog in the given window. */
  yourTagRatios(window) {
    const cutoff = this.windowCutoffISO(window);
    const entries = Store.data.solvedLog.filter((p) => !cutoff || p.solvedDate >= cutoff);
    const total = entries.length;
    const counts = {};
    for (const p of entries) {
      for (const tag of cfBaselineCleanTags(p.tags)) {
        counts[tag] = (counts[tag] || 0) + 1;
      }
    }
    const ratios = {};
    for (const [tag, count] of Object.entries(counts)) ratios[tag] = count / total;
    return { total, ratios };
  },

  /** Per-tag comparison rows for the given tier ("top500"|"top10000"|"average") and window ("allTime"|"lastYear"). */
  compareTags({ tier, window }) {
    const tierData = CF_BASELINE_DATA.tiers[tier];
    const baselineWindow = tierData.windows[window];
    const yours = this.yourTagRatios(window);

    const allTags = new Set([...Object.keys(baselineWindow.tagRatios), ...Object.keys(yours.ratios)]);
    const rows = [...allTags].map((tag) => {
      const yourRatio = yours.ratios[tag] || 0;
      const baselineRatio = baselineWindow.tagRatios[tag] || 0;
      const delta = yourRatio - baselineRatio;
      let verdict = "on-par";
      if (delta <= -CF_BASELINE_VERDICT_THRESHOLD) verdict = "weak";
      else if (delta >= CF_BASELINE_VERDICT_THRESHOLD) verdict = "strong";
      return { tag, yourRatio, baselineRatio, delta, verdict };
    });
    rows.sort((a, b) => b.baselineRatio - a.baselineRatio);

    return {
      rows,
      yourTotal: yours.total,
      insufficientData: yours.total < CF_BASELINE_MIN_SOLVES,
      tierLabel: tierData.label,
      ratingCutoff: tierData.ratingCutoff,
      baselineProblemCount: baselineWindow.problemCount,
    };
  },

  /** Smallest p (1-99) such that a rating this high clears the "top p%" cutoff, or null without a rating. */
  percentileForRating(rating) {
    if (rating == null) return null;
    const percentiles = CF_BASELINE_DATA.percentiles;
    for (let p = 1; p <= 99; p++) {
      if (percentiles[p] <= rating) return p;
    }
    return 99;
  },
};

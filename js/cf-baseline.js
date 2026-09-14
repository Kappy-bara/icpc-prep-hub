/**
 * Compares the signed-in user's own solved-tag ratios against the static
 * CF_BASELINE_DATA (see js/cf-baseline-data.js + scripts/generate-cf-baseline.js).
 * Pure computation, no DOM — rendered by js/cf-analysis.js.
 */
const CF_BASELINE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const CF_BASELINE_MIN_SOLVES = 5;

function cfBaselineCleanTags(tags) {
  return (tags || []).filter((t) => !t.startsWith("*"));
}

/**
 * Classifies yourCount against expectedCount (= baselineRatio * yourTotal — the count you'd
 * have if you matched the baseline's tag mix exactly). R = yourCount / expectedCount is the
 * single normalized signal driving both the verdict band and the color hue.
 *
 *   R <  0.3           Very Weak
 *   0.3 <= R < 0.6      Weak
 *   0.6 <= R < 1.25     On-Par
 *   1.25 <= R < 2.0     Strong
 *   R >= 2.0            Excellent
 *
 * Zero solves in a tag that's part of the baseline gets its own friendly verdict rather than
 * being lumped in with "Very Weak" — you haven't failed at it, you just haven't started.
 */
function cfBaselineClassify(yourCount, expectedCount) {
  if (yourCount === 0) return { verdict: "start", label: "Just Start Buddy", r: 0 };
  const r = expectedCount > 0 ? yourCount / expectedCount : 2.5; // no baseline presence at all -> treat as a strong signal
  if (r < 0.3) return { verdict: "very-weak", label: "Very Weak", r };
  if (r < 0.6) return { verdict: "weak", label: "Weak", r };
  if (r < 1.25) return { verdict: "on-par", label: "On-Par", r };
  if (r < 2.0) return { verdict: "strong", label: "Strong", r };
  return { verdict: "excellent", label: "Excellent", r };
}

/**
 * Gradual red -> green -> light blue hue for a given R, continuous but anchored to the
 * verdict band boundaries so each band actually reads as its intended color (a naive
 * linear 0-2 -> 0-210 map washes "Weak" out to yellow-green instead of red).
 */
const CF_BASELINE_HUE_POINTS = [
  [0, 0], // Very Weak: red
  [0.3, 15], // Very Weak/Weak boundary: red-orange
  [0.6, 40], // Weak/On-Par boundary: orange
  [1.0, 130], // On-Par center: green
  [1.25, 165], // On-Par/Strong boundary: teal
  [2.0, 210], // Strong/Excellent boundary: light blue
  [2.5, 225], // Excellent: blue
];

function cfBaselineHue(r) {
  const clamped = Math.max(0, Math.min(2.5, r));
  for (let i = 0; i < CF_BASELINE_HUE_POINTS.length - 1; i++) {
    const [r0, h0] = CF_BASELINE_HUE_POINTS[i];
    const [r1, h1] = CF_BASELINE_HUE_POINTS[i + 1];
    if (clamped <= r1) return h0 + ((clamped - r0) / (r1 - r0)) * (h1 - h0);
  }
  return CF_BASELINE_HUE_POINTS[CF_BASELINE_HUE_POINTS.length - 1][1];
}

const CFBaseline = {
  /** "allTime" -> no cutoff; "lastYear" -> ISO cutoff 1 year ago. */
  windowCutoffISO(window) {
    return window === "lastYear" ? new Date(Date.now() - CF_BASELINE_YEAR_MS).toISOString() : null;
  },

  /** { total, counts: {tag: count}, ratios: {tag: ratio} } for the user's own solvedLog in the given window. */
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
    return { total, counts, ratios };
  },

  /** Per-tag comparison rows for the given tier ("top500"|"top10000"|"average") and window ("allTime"|"lastYear"). */
  compareTags({ tier, window }) {
    const tierData = CF_BASELINE_DATA.tiers[tier];
    const baselineWindow = tierData.windows[window];
    const yours = this.yourTagRatios(window);

    const allTags = new Set([...Object.keys(baselineWindow.tagRatios), ...Object.keys(yours.ratios)]);
    const rows = [...allTags].map((tag) => {
      const yourRatio = yours.ratios[tag] || 0;
      const yourCount = yours.counts[tag] || 0;
      const baselineRatio = baselineWindow.tagRatios[tag] || 0;
      const expectedCount = baselineRatio * yours.total;
      const { verdict, label, r } = cfBaselineClassify(yourCount, expectedCount);
      const hue = cfBaselineHue(r);
      return { tag, yourRatio, yourCount, baselineRatio, expectedCount, verdict, verdictLabel: label, r, hue };
    });
    rows.sort((a, b) => b.baselineRatio - a.baselineRatio);

    return {
      rows,
      yourTotal: yours.total,
      insufficientData: yours.total < CF_BASELINE_MIN_SOLVES,
      tierLabel: tierData.label,
      ratingCutoff: tierData.ratingCutoff,
      avgSolvedCount: baselineWindow.problemCount,
      sampleSize: baselineWindow.sampleSize,
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

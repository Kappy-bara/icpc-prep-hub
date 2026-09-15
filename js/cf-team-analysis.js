/**
 * ICPC Team Analyzer: fetches up to 3 Codeforces handles' public data live (nothing stored,
 * nothing synced — same trust model as the Codeforces page's "Compare with someone" tier) and
 * builds a comparative analysis: per-member summary, team-wide tag gaps, a suggested role
 * split, and non-topic signals (accuracy/bug-rate, live-contest solve speed).
 *
 * "Insights" here are a deterministic template built from the real computed numbers, not a live
 * AI call — an LLM API key can't be safely embedded in this site's client-side JS the way the
 * Supabase anon key can (Row Level Security protects that one; no LLM provider has an equivalent
 * guard over token spend), and a grounded template can't hallucinate a plausible-sounding but
 * wrong insight. See README for the reasoning if a real-LLM version is ever wanted later.
 */
const TeamAnalysis = {
  _members: null, // set by a successful analyze() call; render() reads from here

  // Tags evaluated for "team gap" flagging — exists only to avoid flagging a legitimately rare
  // tag (e.g. "chinese remainder theorem") as a weakness just because nobody's solved much of
  // it, which is normal, not a real gap.
  CORE_TAGS: [
    "dp", "greedy", "graphs", "trees", "dsu", "geometry", "number theory", "combinatorics",
    "binary search", "two pointers", "data structures", "implementation", "math", "brute force",
    "constructive algorithms", "strings", "bitmasks", "dfs and similar", "shortest paths",
    "divide and conquer", "probabilities", "games", "sortings", "hashing",
  ],

  ROLES: [
    { id: "algorithmist", label: "Algorithmist", tags: ["dp", "graphs", "trees", "data structures", "dsu", "shortest paths", "divide and conquer"] },
    { id: "math", label: "Math & Theory Specialist", tags: ["number theory", "combinatorics", "geometry", "probabilities", "games", "matrices", "fft"] },
    { id: "implementation", label: "Implementation & Speed Lead", tags: ["implementation", "brute force", "constructive algorithms", "strings", "sortings", "two pointers", "binary search"] },
  ],
  ROLE_PERMS: [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]],

  // Same CF rank-tier table as CFAnalysis.RANK_TITLES, duplicated rather than pulling in all of
  // cf-analysis.js (~500 lines tied to Store.data/Shell.isCloudMode/Codeforces-page DOM ids)
  // just for this stable 10-line constant.
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

  MIN_CONTEST_SOLVES_FOR_SPEED: 5,
  MIN_TAG_SAMPLE: 2,
  TEAM_GAP_RATIO_CUTOFF: 0.03,
  TEAM_GAP_MAX_SHOWN: 6,
  IMPLEMENTATION_WATCH_TAGS: ["implementation", "brute force", "constructive algorithms"],
  IMPLEMENTATION_GAP_PTS: 15,
  TAG_COMPARISON_MAX_ROWS: 20,

  rankTitle(rating) {
    if (rating == null) return null;
    for (const [cutoff, title] of this.RANK_TITLES) {
      if (rating >= cutoff) return title;
    }
    return null;
  },

  /** One handle's full picture: solved problems, tag ratios, accuracy, live-contest speed, rating. */
  async fetchMemberData(handle) {
    const [subsResult, ratingResult] = await Promise.all([CFSync.fetchRawSubmissions(handle), CFSync.fetchRatingHistory(handle)]);
    if (!subsResult.ok) return { handle, ok: false, error: subsResult.error };
    const submissions = subsResult.submissions;
    const problems = CFSync.extractSolved(submissions);
    const attemptStats = CFSync.deriveAttemptStats(submissions);
    const tagStats = CFBaseline.tagRatiosFromEntries(problems);
    const speed = this.computeSolveSpeed(submissions);
    const accuracyByTag = this.computeAccuracyByTag(problems, attemptStats);
    const overallAccuracy = this.computeOverallAccuracy(problems, attemptStats);
    const ratingHistory = ratingResult.ok ? ratingResult.history : [];
    const currentRating = ratingHistory.length ? ratingHistory[ratingHistory.length - 1].newRating : null;
    return { handle, ok: true, problems, tagStats, speed, accuracyByTag, overallAccuracy, currentRating, totalSolved: problems.length };
  },

  /**
   * Live-contest solve speed — the "slow submission time" ask. Only counts submissions made
   * DURING a real contest (participantType "CONTESTANT"), so someone who only virtual-
   * participates or upsolves will legitimately show "not enough data" here, not a fabricated
   * number. Reports the median (not mean) minutes-to-AC across a member's earliest AC per
   * problem, since a single very-late solve shouldn't skew the whole picture.
   */
  computeSolveSpeed(submissions) {
    const bestByProblem = new Map();
    for (const sub of submissions) {
      if (sub.verdict !== "OK") continue;
      if (!sub.author || sub.author.participantType !== "CONTESTANT") continue;
      if (typeof sub.relativeTimeSeconds !== "number" || sub.relativeTimeSeconds < 0) continue;
      const key = Gamification.problemKey(sub.problem.contestId, sub.problem.index);
      const prev = bestByProblem.get(key);
      if (prev === undefined || sub.relativeTimeSeconds < prev) bestByProblem.set(key, sub.relativeTimeSeconds);
    }
    const minutes = [...bestByProblem.values()].map((s) => s / 60).sort((a, b) => a - b);
    if (minutes.length < this.MIN_CONTEST_SOLVES_FOR_SPEED) return { insufficientData: true, sampleSize: minutes.length };
    const mid = Math.floor(minutes.length / 2);
    const medianMinutes = minutes.length % 2 ? minutes[mid] : (minutes[mid - 1] + minutes[mid]) / 2;
    return { insufficientData: false, medianMinutes, sampleSize: minutes.length };
  },

  /** Per-tag accuracy, same formula as CFAnalysis.renderAccuracy — count/(count+totalWrong). */
  computeAccuracyByTag(problems, attemptStats) {
    const tagStats = {};
    for (const p of problems) {
      const wrong = attemptStats[p.key] || 0;
      for (const tag of p.tags || []) {
        if (!tagStats[tag]) tagStats[tag] = { totalWrong: 0, count: 0 };
        tagStats[tag].totalWrong += wrong;
        tagStats[tag].count += 1;
      }
    }
    const out = {};
    for (const [tag, s] of Object.entries(tagStats)) {
      if (s.count < this.MIN_TAG_SAMPLE) continue;
      out[tag] = { accuracyPct: (s.count / (s.count + s.totalWrong)) * 100, count: s.count };
    }
    return out;
  },

  /** Single aggregate accuracy number across all solved problems, or null with zero solves. */
  computeOverallAccuracy(problems, attemptStats) {
    if (!problems.length) return null;
    let count = 0;
    let totalWrong = 0;
    for (const p of problems) {
      count++;
      totalWrong += attemptStats[p.key] || 0;
    }
    return { accuracyPct: (count / (count + totalWrong)) * 100, count };
  },

  topTags(member, n) {
    return Object.entries(member.tagStats.ratios)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([tag, ratio]) => ({ tag, ratio }));
  },

  /** Tags where even the strongest team member barely solves any — worth practicing together. */
  computeTeamGaps(members) {
    return this.CORE_TAGS.map((tag) => ({ tag, maxRatio: Math.max(...members.map((m) => m.tagStats.ratios[tag] || 0)) }))
      .filter((r) => r.maxRatio < this.TEAM_GAP_RATIO_CUTOFF)
      .sort((a, b) => a.maxRatio - b.maxRatio)
      .slice(0, this.TEAM_GAP_MAX_SHOWN);
  },

  /**
   * A member's specific weak spot within "implementation-ish" tags, when it's notably worse
   * than their own overall accuracy — a targeted, evidence-based version of "you have a slow/
   * buggy implementation" rather than a vague claim.
   */
  implementationCallout(member) {
    const overall = member.overallAccuracy;
    if (!overall) return null;
    let worst = null;
    for (const tag of this.IMPLEMENTATION_WATCH_TAGS) {
      const s = member.accuracyByTag[tag];
      if (!s) continue;
      const gap = overall.accuracyPct - s.accuracyPct;
      if (gap >= this.IMPLEMENTATION_GAP_PTS && (!worst || gap > worst.gap)) worst = { tag, pct: s.accuracyPct, gap };
    }
    if (!worst) return null;
    return `Especially bug-prone on "${worst.tag}" problems (${worst.pct.toFixed(0)}% vs ${overall.accuracyPct.toFixed(0)}% overall accuracy) — worth extra care there.`;
  },

  /**
   * Role scores as three independent tag-ratio profiles — deliberately no rating component
   * (bundling rating into one role would just make the highest-rated player always "win"
   * Algorithmist regardless of their actual tag profile; rating is shown separately instead).
   * Each component is min-max normalized only across members who actually have that data, so a
   * member with no live-contest submissions isn't unfairly zeroed out of the Implementation
   * role — their score there falls back to averaging whichever of {tags, accuracy, speed} they
   * actually have.
   */
  scoreRoles(members) {
    const tagAvg = (m, tags) => tags.reduce((s, t) => s + (m.tagStats.ratios[t] || 0), 0) / tags.length;
    const raw = members.map((m) => ({
      algo: tagAvg(m, this.ROLES[0].tags),
      math: tagAvg(m, this.ROLES[1].tags),
      impl: tagAvg(m, this.ROLES[2].tags),
      accuracy: m.overallAccuracy ? m.overallAccuracy.accuracyPct / 100 : null,
      speed: m.speed.insufficientData ? null : -m.speed.medianMinutes,
    }));
    const norm = (key) => {
      const present = raw.map((r, i) => ({ i, v: r[key] })).filter((x) => x.v != null);
      if (present.length < 2) return Object.fromEntries(present.map((x) => [x.i, 0.5]));
      const vals = present.map((x) => x.v);
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      return Object.fromEntries(present.map((x) => [x.i, max > min ? (x.v - min) / (max - min) : 0.5]));
    };
    const nAlgo = norm("algo");
    const nMath = norm("math");
    const nImpl = norm("impl");
    const nAcc = norm("accuracy");
    const nSpeed = norm("speed");
    return members.map((_, i) => {
      const implParts = [nImpl[i] ?? 0];
      if (nAcc[i] != null) implParts.push(nAcc[i]);
      if (nSpeed[i] != null) implParts.push(nSpeed[i]);
      return [nAlgo[i] ?? 0, nMath[i] ?? 0, implParts.reduce((s, v) => s + v, 0) / implParts.length];
    });
  },

  /**
   * Best member-to-role assignment by brute-force search over all 6 permutations of 3 roles —
   * NOT a greedy "assign the single highest score first" loop, which is provably non-optimal
   * even at 3x3 (locking in the best individual cell can foreclose a much better global
   * pairing). At n=3 exhaustive search is trivial and always correct.
   */
  bestAssignment(matrix) {
    let best = null;
    for (const perm of this.ROLE_PERMS) {
      const total = perm.reduce((s, roleIdx, memberIdx) => s + matrix[memberIdx][roleIdx], 0);
      if (!best || total > best.total) best = { perm, total };
    }
    return best.perm;
  },

  /** Fastest/middle/slowest labels, relative to THIS team only — no universal absolute cutoff. */
  rankSpeeds(members) {
    const withSpeed = members.map((m, i) => ({ i, minutes: m.speed.insufficientData ? null : m.speed.medianMinutes }));
    const usable = withSpeed.filter((x) => x.minutes != null).sort((a, b) => a.minutes - b.minutes);
    const labels = new Array(members.length).fill(null);
    if (usable.length >= 2) {
      usable.forEach((x, rank) => {
        labels[x.i] = rank === 0 ? "Fastest on the team" : rank === usable.length - 1 ? "Slowest on the team" : "Middle of the team";
      });
    }
    return labels;
  },

  accuracyLabel(pct) {
    if (pct >= 85) return "Very clean";
    if (pct >= 70) return "Solid";
    if (pct >= 50) return "Debug-heavy";
    return "Very debug-heavy";
  },

  /** Deterministic, data-grounded summary — not free-form generation, see file header. */
  buildSummaryParagraph(member, roleLabel, speedRankLabel) {
    const rank = this.rankTitle(member.currentRating);
    const ratingPart = member.currentRating != null ? `rated ${member.currentRating}${rank ? ` (${rank})` : ""}` : "unrated";
    const topTags = this.topTags(member, 2);
    const topTagsPart = topTags.length ? ` Strongest in ${topTags.map((t) => t.tag).join(" and ")}.` : "";
    const acc = member.overallAccuracy;
    const accPart = acc ? ` ${this.accuracyLabel(acc.accuracyPct)} accuracy (${acc.accuracyPct.toFixed(0)}%).` : " Not enough solves yet to measure accuracy.";
    const speedPart = speedRankLabel ? ` ${speedRankLabel}.` : member.speed.insufficientData ? " Not enough live-contest data to rank solving speed." : "";
    return `${member.handle} is ${ratingPart}, ${member.totalSolved} solved.${topTagsPart}${accPart}${speedPart} Suggested role: ${roleLabel}.`;
  },

  /**
   * Validates and fetches all 3 handles. Returns { ok:true, members } on full success, or
   * { ok:false, error } (a pre-fetch validation problem, no fetch attempted) / { ok:false,
   * error, members } (one or more handles failed to fetch — error lists which ones) otherwise.
   * On success, caches members for render() to read.
   */
  async analyze(handles) {
    const trimmed = handles.map((h) => (h || "").trim());
    if (trimmed.some((h) => !h)) return { ok: false, error: "Enter all three Codeforces handles." };
    const lower = trimmed.map((h) => h.toLowerCase());
    if (new Set(lower).size !== lower.length) {
      return { ok: false, error: "Enter three different handles — you can't compare a handle with itself." };
    }
    const members = await Promise.all(trimmed.map((h) => this.fetchMemberData(h)));
    const failed = members.filter((m) => !m.ok);
    if (failed.length) {
      return { ok: false, error: failed.map((m) => `${m.handle}: ${m.error}`).join(" · "), members };
    }
    this._members = members;
    return { ok: true, members };
  },

  render(root) {
    if (!root) return;
    const members = this._members;
    if (!members) {
      root.innerHTML = "";
      return;
    }
    const matrix = this.scoreRoles(members);
    const assignment = this.bestAssignment(matrix);
    const speedLabels = this.rankSpeeds(members);
    const gaps = this.computeTeamGaps(members);
    const totalUnique = new Set(members.flatMap((m) => m.problems.map((p) => p.key))).size;

    const rolesTableHtml = members
      .map((m, i) => `<div class="stat-tile"><div class="stat-value">${escapeHtml(this.ROLES[assignment[i]].label)}</div><div class="stat-label">${escapeHtml(m.handle)}</div></div>`)
      .join("");

    const gapsHtml = gaps.length
      ? `<p class="card-subtitle">Nobody on the team solves much of: <strong>${gaps.map((g) => escapeHtml(g.tag)).join(", ")}</strong> &mdash; worth practicing together.</p>`
      : `<p class="card-subtitle">No major team-wide gaps found among common ICPC topics &mdash; solid shared coverage.</p>`;

    root.innerHTML = `
      <section class="card">
        <h2>Team insights</h2>
        <p class="card-subtitle">
          Suggested roles based on solve history &mdash; a starting point, not a verdict.
          ${members.length} handles compared, ${totalUnique} unique problems solved across the team.
        </p>
        <div class="report-windows">${rolesTableHtml}</div>
        ${gapsHtml}
      </section>
      <div class="card-grid">
        ${members.map((m, i) => this.memberCardHtml(m, this.ROLES[assignment[i]].label, speedLabels[i])).join("")}
      </div>
      <section class="card">
        <h2>Tag mix comparison</h2>
        <p class="card-subtitle">
          Each bar shows what share of that person's solves carry the tag &mdash; the same
          "share of solves" percentage used elsewhere in this app, not a head-to-head score.
        </p>
        <div id="team-tag-comparison-root"></div>
      </section>
    `;
    this.renderTagComparison($("team-tag-comparison-root"), members);
  },

  memberCardHtml(member, roleLabel, speedRankLabel) {
    const rank = this.rankTitle(member.currentRating);
    const acc = member.overallAccuracy;
    const accPct = acc ? acc.accuracyPct.toFixed(0) : null;
    const speedValue = speedRankLabel
      ? speedRankLabel.replace(" on the team", "").replace(" of the team", "")
      : member.speed.insufficientData
        ? "N/A"
        : `${Math.round(member.speed.medianMinutes)}m`;
    const implCallout = this.implementationCallout(member);
    const summary = this.buildSummaryParagraph(member, roleLabel, speedRankLabel);
    const topTags = this.topTags(member, 4);

    return `
      <div class="card">
        <h3>${escapeHtml(member.handle)} <span class="role-badge">${escapeHtml(roleLabel)}</span></h3>
        <p class="card-subtitle">${escapeHtml(summary)}</p>
        <div class="report-windows">
          <div class="stat-tile"><div class="stat-value">${member.currentRating ?? "—"}</div><div class="stat-label">${escapeHtml(rank || "rating")}</div></div>
          <div class="stat-tile"><div class="stat-value">${member.totalSolved}</div><div class="stat-label">total solved</div></div>
          <div class="stat-tile"><div class="stat-value">${accPct != null ? accPct + "%" : "—"}</div><div class="stat-label">accuracy</div></div>
          <div class="stat-tile"><div class="stat-value">${escapeHtml(speedValue)}</div><div class="stat-label">solve speed (team rank)</div></div>
        </div>
        ${implCallout ? `<p class="card-subtitle">${escapeHtml(implCallout)}</p>` : ""}
        <p class="card-subtitle">Strongest tags: ${topTags.length ? topTags.map((t) => escapeHtml(t.tag)).join(", ") : "—"}</p>
      </div>
    `;
  },

  renderTagComparison(root, members) {
    if (!root) return;
    const colors = ["var(--accent)", "var(--secondary)", "var(--warn)"];
    const allTags = new Set();
    for (const m of members) for (const tag of Object.keys(m.tagStats.ratios)) allTags.add(tag);

    const rows = [...allTags]
      .map((tag) => ({ tag, maxRatio: Math.max(...members.map((m) => m.tagStats.ratios[tag] || 0)) }))
      .sort((a, b) => b.maxRatio - a.maxRatio)
      .slice(0, this.TAG_COMPARISON_MAX_ROWS);

    if (!rows.length) {
      root.innerHTML = `<p class="empty-note">No solved-problem tags found across the team yet.</p>`;
      return;
    }

    root.innerHTML = `
      <div class="cf-legend">
        ${members.map((m, i) => `<span><span class="cf-legend-swatch" style="background:${colors[i]}"></span>${escapeHtml(m.handle)}</span>`).join("")}
      </div>
      ${rows
        .map((r) => {
          const lines = members
            .map((m, i) => {
              const ratio = m.tagStats.ratios[r.tag] || 0;
              const pct = Math.round(ratio * 100);
              return `
              <div class="bar-team-line">
                <span class="bar-team-dot" style="background:${colors[i]}"></span>
                <span class="bar-team-handle">${escapeHtml(m.handle)}</span>
                <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${colors[i]}"></div></div>
                <span class="bar-count">${pct}%</span>
              </div>`;
            })
            .join("");
          return `
          <div class="bar-row-team">
            <span class="bar-label">${escapeHtml(r.tag)}</span>
            ${lines}
          </div>`;
        })
        .join("")}
    `;
  },
};

/**
 * ICPC Team Analyzer: fetches up to 3 Codeforces handles' public data live (nothing stored,
 * nothing synced — same trust model as the Codeforces page's "Compare with someone" tier) and
 * builds a comparative analysis: per-member summary, team-wide tag gaps, a suggested
 * Reader/Coder/Thinker role split plus a Math/Graphs-DS/Geometry-Strings domain split, and
 * non-topic signals (accuracy/bug-rate, live-contest solve speed).
 *
 * The role/domain model and the tag buckets behind it are grounded in real ICPC coaching
 * literature, not invented from scratch — see README's "ICPC Team Analyzer" section for the
 * sources (Neel Mishra's "ICPC Team Strategy"; the KTH contest-wiki "Team strategy" page; and
 * Codeforces' own "Rating the Difficulty of Codeforces Problems" for the reach/ceiling metric
 * and for the per-topic rating methodology below).
 *
 * Two deliberate methodology choices worth calling out (both found by testing against real
 * lopsided teams, not designed upfront):
 *  - Strength-in-a-topic is measured as a per-topic RATING (the average Codeforces difficulty of
 *    the problems solved in that topic — the same number space as a player's own rating), not a
 *    solve-count RATIO. A ratio conflates "how much I practice this" with "how good I am at it"
 *    — someone can rack up a high ratio solving 100 easy problems in a tag while someone else
 *    solves 20 hard ones in it and is clearly stronger. See topicRatings()/topicRatingAvg().
 *  - Reader breadth is computed over each member's most RECENT solves (READER_RECENT_WINDOW),
 *    not their lifetime history. A player with thousands of career solves will have mechanically
 *    touched nearly every tag in existence just from sheer volume, which made the highest-volume
 *    player look like the best "generalist" regardless of whether that's true — a sample-size
 *    artifact, not a real signal. See recentTagCounts().
 * Reader breadth itself uses Pielou's evenness index, a standard diversity-index technique.
 *
 * "Insights" here are a deterministic template built from the real computed numbers, not a live
 * AI call — an LLM API key can't be safely embedded in this site's client-side JS the way the
 * Supabase anon key can (Row Level Security protects that one; no LLM provider has an equivalent
 * guard over token spend), and a grounded template can't hallucinate a plausible-sounding but
 * wrong insight. See README for the reasoning if a real-LLM version is ever wanted later.
 */

/**
 * Min-max normalizes `values` (one number per member, or null for "no data") to 0..1, only
 * across entries that aren't null. Fewer than 2 present entries can't be meaningfully ranked, so
 * everyone gets a neutral 0.5 instead of an arbitrary 0 or 1 — this is what stops a member with
 * no live-contest submissions (or no rated solves) from being unfairly zeroed out of a role that
 * partly depends on that signal; their score there just falls back to whatever data they do have.
 */
function normalizeValues(values) {
  const present = values.map((v, i) => ({ i, v })).filter((x) => x.v != null);
  const out = new Array(values.length).fill(0.5);
  if (present.length < 2) return out;
  const vals = present.map((x) => x.v);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  for (const x of present) out[x.i] = max > min ? (x.v - min) / (max - min) : 0.5;
  return out;
}

const TeamAnalysis = {
  _members: null, // set by a successful analyze() call; render() reads from here

  // "Standard technique" tags a strong Coder should knock out fast and cleanly — greedy,
  // straightforward implementation, basic simulation. The complement (THINKER_TAGS) is what
  // calls for real insight. This split mirrors how ICPC coaching literature actually separates
  // "problem-solving" skill from "implementation" skill as two different axes, not one scale.
  CODER_TAGS: ["implementation", "brute force", "constructive algorithms", "sortings", "two pointers", "binary search", "greedy"],
  THINKER_TAGS: [
    "dp", "graphs", "trees", "data structures", "dsu", "number theory", "combinatorics", "math",
    "geometry", "probabilities", "games", "divide and conquer", "fft", "shortest paths", "strings",
    "bitmasks", "dfs and similar",
  ],
  // Evaluated for "team gap" flagging — exists only to avoid flagging a legitimately rare tag
  // (e.g. "chinese remainder theorem") as a weakness just because nobody's solved much of it,
  // which is normal, not a real gap.
  get CORE_TAGS() {
    return [...this.CODER_TAGS, ...this.THINKER_TAGS, "hashing"];
  },

  // Topic-ownership domains — a second, independent axis from ROLES below. Real ICPC teams
  // assign both: a workflow role (who reads/codes/thinks) AND domain ownership (who takes any
  // problem that's clearly math, clearly graphs, etc.), and the two don't have to line up.
  DOMAINS: [
    { id: "math", label: "Math & Number Theory", tags: ["math", "number theory", "combinatorics", "probabilities", "fft", "matrices", "chinese remainder theorem"] },
    { id: "graphs-ds", label: "Graphs & Data Structures", tags: ["graphs", "trees", "dsu", "data structures", "shortest paths", "divide and conquer", "flows", "2-sat", "graph matchings"] },
    { id: "geometry-strings", label: "Geometry & Strings", tags: ["geometry", "strings", "string suffix structures", "hashing"] },
  ],

  // Reader/Coder/Thinker: the standard 3-person ICPC role split (see file header for sources).
  ROLES: [
    { id: "reader", label: "Reader", blurb: "Reads fastest, spots the easy problems, classifies the rest by topic" },
    { id: "coder", label: "Coder", blurb: "Fastest, cleanest implementer of standard-technique problems" },
    { id: "thinker", label: "Thinker", blurb: "Cracks the hardest, most insight-heavy problems" },
  ],
  ASSIGNMENT_PERMS: [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]],

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

  FETCH_RETRIES: 2, // extra attempts after the first, only for retryable (rate-limit/transient) failures
  RETRY_DELAY_MS: 1500,
  HANDLE_STAGGER_MS: 400, // gap before starting the next handle's fetches, on top of full sequencing below

  MIN_CONTEST_SOLVES_FOR_SPEED: 5,
  MIN_TAG_SAMPLE: 2,
  MIN_TOPIC_RATING_SAMPLE: 3, // fewer rated solves in a tag than this = not enough signal to trust its average rating
  READER_RECENT_WINDOW: 150, // Reader breadth looks at only this many of a member's MOST RECENT solves — see file header
  KNOWLEDGE_GAP_RATIO_CUTOFF: 0.03,
  EXECUTION_GAP_MIN_COUNT: 6,
  EXECUTION_GAP_ACCURACY_CUTOFF: 60,
  TEAM_GAP_MAX_SHOWN: 6,
  IMPLEMENTATION_WATCH_TAGS: ["implementation", "brute force", "constructive algorithms"],
  IMPLEMENTATION_GAP_PTS: 15,
  REACH_TOP_N: 10, // how many of a member's hardest solves define their "ceiling"
  REACH_MIN_SAMPLE: 3, // below this many rated solves, reach isn't a meaningful signal
  TAG_COMPARISON_MAX_ROWS: 20,
  TAG_RATING_MIN: 800, // fixed scale for the tag-rating bar chart (real CF rating floor/ceiling),
  TAG_RATING_MAX: 3500, // so bar width is comparable across tags/members, not re-normalized per row

  rankTitle(rating) {
    if (rating == null) return null;
    for (const [cutoff, title] of this.RANK_TITLES) {
      if (rating >= cutoff) return title;
    }
    return null;
  },

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  },

  /**
   * Codeforces' API rate-limits bursts of concurrent requests — firing all 3 handles' fetches at
   * once (this app used to) reliably produced two different-looking symptoms of the same root
   * cause: the whole analyze() call failing outright (a 429/503 on one of the requests), or a
   * *specific* member quietly showing "unrated" because only their rating-history call got
   * rate-limited while their submissions call happened to succeed (fetchMemberData previously
   * treated a failed rating fetch as "this person just has no rated history" instead of "this
   * request failed"). Retrying a couple of times before giving up fixes both — but only for
   * failures that look transient (rate-limit/server-hiccup HTTP codes, or a generic network
   * error); a permanent failure like "handle not found" (HTTP 400) is retried for nothing, so
   * fail fast there instead of making the user wait through pointless retries.
   */
  async fetchWithRetry(fetchFn) {
    let result;
    for (let attempt = 0; attempt <= this.FETCH_RETRIES; attempt++) {
      result = await fetchFn();
      if (result.ok) return result;
      const transient = /HTTP (429|503|502|504)/.test(result.error || "") || /network|fetch/i.test(result.error || "");
      if (!transient || attempt === this.FETCH_RETRIES) return result;
      await this.sleep(this.RETRY_DELAY_MS);
    }
    return result;
  },

  /** One handle's full picture: solved problems, tag ratios/ratings, accuracy, live-contest speed, rating. */
  async fetchMemberData(handle) {
    const subsResult = await this.fetchWithRetry(() => CFSync.fetchRawSubmissions(handle));
    if (!subsResult.ok) return { handle, ok: false, error: subsResult.error };
    const ratingResult = await this.fetchWithRetry(() => CFSync.fetchRatingHistory(handle));
    if (!ratingResult.ok) return { handle, ok: false, error: `rating history: ${ratingResult.error}` };
    const submissions = subsResult.submissions;
    const problems = CFSync.extractSolved(submissions);
    const attemptStats = CFSync.deriveAttemptStats(submissions);
    const tagStats = CFBaseline.tagRatiosFromEntries(problems);
    const topicRatings = this.topicRatings(problems);
    const speed = this.computeSolveSpeed(submissions);
    const accuracyByTag = this.computeAccuracyByTag(problems, attemptStats);
    const overallAccuracy = this.computeOverallAccuracy(problems, attemptStats);
    const currentRating = ratingResult.history.length ? ratingResult.history[ratingResult.history.length - 1].newRating : null;
    return { handle, ok: true, problems, tagStats, topicRatings, speed, accuracyByTag, overallAccuracy, currentRating, totalSolved: problems.length };
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
      out[tag] = { accuracyPct: (s.count / (s.count + s.totalWrong)) * 100, count: s.count, totalWrong: s.totalWrong };
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
    return { accuracyPct: (count / (count + totalWrong)) * 100, count, totalWrong };
  },

  /**
   * Team-wide headline numbers, shown up front so "Team insights" doesn't open straight into a
   * bare gap list — average/spread of rating (spread flags a very lopsided team early), one
   * combined accuracy figure (aggregated from raw counts across all 3 members, not an average of
   * percentages, which would misweight whoever has fewer solves), and how much of the app's core
   * ICPC tag list the team has touched at all vs. never gone near.
   */
  computeTeamStats(members) {
    const ratings = members.map((m) => m.currentRating).filter((r) => r != null);
    const avgRating = ratings.length ? Math.round(ratings.reduce((s, r) => s + r, 0) / ratings.length) : null;
    const ratingSpread = ratings.length >= 2 ? Math.max(...ratings) - Math.min(...ratings) : null;
    let count = 0;
    let totalWrong = 0;
    for (const m of members) {
      if (!m.overallAccuracy) continue;
      count += m.overallAccuracy.count;
      totalWrong += m.overallAccuracy.totalWrong;
    }
    const combinedAccuracy = count ? (count / (count + totalWrong)) * 100 : null;
    const tagsCovered = this.CORE_TAGS.filter((tag) => members.some((m) => (m.tagStats.counts[tag] || 0) > 0)).length;
    return { avgRating, ratingSpread, combinedAccuracy, tagsCovered, totalCoreTags: this.CORE_TAGS.length };
  },

  /**
   * Per-tag STRENGTH, not practice volume: the average Codeforces rating of the problems a
   * member has solved that carry each tag — the same number space as a player's own rating, so
   * "Math & Number Theory: ~2800" reads exactly like a rating. This is deliberately NOT a solve-
   * count ratio (see file header) — a ratio only tells you how much of someone's practice
   * concentrated on a tag, not how hard a problem in it they can actually solve. Gated by
   * MIN_TOPIC_RATING_SAMPLE per tag so a tag touched only once or twice doesn't produce a noisy
   * "rating" off a single data point.
   */
  topicRatings(problems) {
    const byTag = {};
    for (const p of problems) {
      if (p.rating == null) continue;
      for (const tag of p.tags || []) {
        if (!byTag[tag]) byTag[tag] = { sum: 0, count: 0 };
        byTag[tag].sum += p.rating;
        byTag[tag].count += 1;
      }
    }
    const out = {};
    for (const [tag, s] of Object.entries(byTag)) {
      if (s.count < this.MIN_TOPIC_RATING_SAMPLE) continue;
      out[tag] = { avgRating: s.sum / s.count, count: s.count };
    }
    return out;
  },

  /** Average topic rating across `tags`, over only the ones this member has enough signal for; null if none. */
  topicRatingAvg(member, tags) {
    const vals = tags.map((t) => member.topicRatings[t]).filter(Boolean).map((s) => s.avgRating);
    if (!vals.length) return null;
    return vals.reduce((s, v) => s + v, 0) / vals.length;
  },

  /**
   * Tag-occurrence counts over only a member's most recent N solves (READER_RECENT_WINDOW) — see
   * file header for why lifetime counts are the wrong input for a breadth/generalist signal.
   * `p.tags` can include CF's internal "*special" marker tag; filtered out the same way
   * CFBaseline's own tag-ratio helper does, so this stays consistent with tagStats elsewhere.
   */
  recentTagCounts(member, n) {
    const recent = [...member.problems].sort((a, b) => (a.solvedDate < b.solvedDate ? 1 : -1)).slice(0, n);
    const counts = {};
    for (const p of recent) {
      for (const tag of cfBaselineCleanTags(p.tags)) {
        counts[tag] = (counts[tag] || 0) + 1;
      }
    }
    return counts;
  },

  /**
   * Pielou's evenness index (a standard ecology/information-theory diversity measure): 1.0 means
   * solves are spread perfectly evenly across every tag touched (a true generalist — good Reader
   * material), 0 means everything is concentrated in one tag (a narrow specialist). Computed on
   * tag-occurrence counts, not solved-problem counts, since one problem can carry several tags —
   * treating each tag-occurrence as one unit of the distribution is what makes this a valid
   * probability distribution to take entropy over.
   */
  tagEvenness(counts) {
    const values = Object.values(counts).filter((c) => c > 0);
    if (values.length <= 1) return 0;
    const total = values.reduce((s, c) => s + c, 0);
    let entropy = 0;
    for (const c of values) {
      const p = c / total;
      entropy -= p * Math.log2(p);
    }
    return entropy / Math.log2(values.length); // normalized to 0..1 (Pielou's J)
  },

  /**
   * How far above their own current rating a member typically reaches at their best — the
   * average rating of their top REACH_TOP_N hardest solves, minus their current rating. Uses the
   * top solves rather than a straight average across their whole history deliberately: someone
   * with thousands of solved problems has necessarily solved a huge tail of easy ones while
   * leveling up over the years, which would swamp a plain average and make it a poor Thinker
   * signal for experienced players. The "ceiling" (best few reaches) is a much more direct
   * measure of insight/ambition, and is the same reasoning Codeforces' own problem-rating
   * methodology uses to define difficulty relative to a solver's rating (see README sources).
   */
  computeReach(member) {
    if (member.currentRating == null) return null;
    const rated = member.problems.map((p) => p.rating).filter((r) => r != null).sort((a, b) => b - a);
    if (rated.length < this.REACH_MIN_SAMPLE) return null;
    const top = rated.slice(0, this.REACH_TOP_N);
    const avgTop = top.reduce((s, r) => s + r, 0) / top.length;
    return avgTop - member.currentRating;
  },

  topTags(member, n) {
    return Object.entries(member.tagStats.ratios)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([tag, ratio]) => ({ tag, ratio }));
  },

  /** Tags where even the strongest team member barely solves any — a knowledge gap, not just bad luck. */
  computeKnowledgeGaps(members) {
    return this.CORE_TAGS.map((tag) => ({ tag, maxRatio: Math.max(...members.map((m) => m.tagStats.ratios[tag] || 0)) }))
      .filter((r) => r.maxRatio < this.KNOWLEDGE_GAP_RATIO_CUTOFF)
      .sort((a, b) => a.maxRatio - b.maxRatio)
      .slice(0, this.TEAM_GAP_MAX_SHOWN);
  },

  /**
   * Tags the team attempts plenty of but still gets wrong a lot — a different failure mode than
   * a knowledge gap (this is "we know the theory, we keep messing up the execution"), matching
   * the classic post-contest-review distinction between a knowledge gap and an implementation
   * mistake (see README sources). Aggregates counts/wrong-attempts across all 3 members' own
   * per-tag accuracy (not an average of percentages, which would misweight small samples) before
   * computing one team-wide accuracy per tag.
   */
  computeExecutionGaps(members) {
    const tagAgg = {};
    for (const m of members) {
      for (const [tag, s] of Object.entries(m.accuracyByTag)) {
        if (!this.CORE_TAGS.includes(tag)) continue;
        const agg = tagAgg[tag] || { count: 0, totalWrong: 0 };
        agg.count += s.count;
        agg.totalWrong += s.totalWrong;
        tagAgg[tag] = agg;
      }
    }
    return Object.entries(tagAgg)
      .map(([tag, agg]) => ({ tag, count: agg.count, accuracyPct: (agg.count / (agg.count + agg.totalWrong)) * 100 }))
      .filter((r) => r.count >= this.EXECUTION_GAP_MIN_COUNT && r.accuracyPct < this.EXECUTION_GAP_ACCURACY_CUTOFF)
      .sort((a, b) => a.accuracyPct - b.accuracyPct)
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
   * Reader/Coder/Thinker scores, each built from signals that actually match that role's real
   * job (see file header for sourcing) rather than one generic formula for all three:
   *  - Reader: breadth, not raw skill — Pielou's evenness (see tagEvenness) blended with distinct
   *    tag count, both computed over each member's RECENT solves only (see recentTagCounts and
   *    the file header for why). A Reader's job is recognizing ANY problem type fast, so a broad
   *    recent generalist beats a narrow specialist here regardless of rating or career length.
   *  - Coder: per-topic RATING (see topicRatingAvg) in "standard technique" tags, blended with
   *    overall accuracy and live-contest solve speed — the three things that define fast, clean,
   *    standard-problem execution.
   *  - Thinker: per-topic RATING in "insight-heavy" tags, blended with current rating and "reach"
   *    (computeReach) — the two direct measures of raw problem-solving power research ties to
   *    this role, on top of a topic-specific difficulty ceiling.
   * Every component is null-safe end to end: normalizeValues degrades gracefully whenever a
   * member lacks a given signal (no live-contest submissions, no rated solves in a tag bucket,
   * etc.), falling back to whatever data they do have instead of unfairly zeroing them out.
   */
  scoreRoles(members) {
    const recentCounts = members.map((m) => this.recentTagCounts(m, this.READER_RECENT_WINDOW));
    const evenness = recentCounts.map((c) => this.tagEvenness(c));
    const breadthCount = recentCounts.map((c) => Object.keys(c).length);
    const nEven = normalizeValues(evenness);
    const nBreadth = normalizeValues(breadthCount);
    const readerScore = members.map((_, i) => 0.5 * nEven[i] + 0.5 * nBreadth[i]);

    const coderTagRaw = members.map((m) => this.topicRatingAvg(m, this.CODER_TAGS));
    const accRaw = members.map((m) => (m.overallAccuracy ? m.overallAccuracy.accuracyPct / 100 : null));
    const speedRaw = members.map((m) => (m.speed.insufficientData ? null : -m.speed.medianMinutes));
    const nCoderTag = normalizeValues(coderTagRaw);
    const nAcc = normalizeValues(accRaw);
    const nSpeed = normalizeValues(speedRaw);
    const coderScore = members.map((_, i) => {
      const parts = [];
      if (coderTagRaw[i] != null) parts.push(nCoderTag[i]);
      if (accRaw[i] != null) parts.push(nAcc[i]);
      if (speedRaw[i] != null) parts.push(nSpeed[i]);
      return parts.length ? parts.reduce((s, v) => s + v, 0) / parts.length : 0.5;
    });

    const thinkerTagRaw = members.map((m) => this.topicRatingAvg(m, this.THINKER_TAGS));
    const ratingRaw = members.map((m) => m.currentRating);
    const reachRaw = members.map((m) => this.computeReach(m));
    const nThinkerTag = normalizeValues(thinkerTagRaw);
    const nRating = normalizeValues(ratingRaw);
    const nReach = normalizeValues(reachRaw);
    const thinkerScore = members.map((_, i) => {
      const parts = [];
      if (thinkerTagRaw[i] != null) parts.push(nThinkerTag[i]);
      if (ratingRaw[i] != null) parts.push(nRating[i]);
      if (reachRaw[i] != null) parts.push(nReach[i]);
      return parts.length ? parts.reduce((s, v) => s + v, 0) / parts.length : 0.5;
    });

    return members.map((_, i) => [readerScore[i], coderScore[i], thinkerScore[i]]);
  },

  /** Raw (non-normalized) per-topic rating per domain — [domainIdx][memberIdx], null where a member lacks enough data. */
  rawDomainRatings(members) {
    return this.DOMAINS.map((d) => members.map((m) => this.topicRatingAvg(m, d.tags)));
  },

  /** Domain ownership from per-topic RATING (not solve-count ratio) — "whose problem is this, strength-wise." */
  scoreDomains(members) {
    const raw = this.rawDomainRatings(members);
    const byDomain = raw.map((col) => normalizeValues(col));
    return members.map((_, mi) => byDomain.map((col) => col[mi]));
  },

  /**
   * Best member-to-slot assignment by brute-force search over all 6 permutations of 3 slots —
   * NOT a greedy "assign the single highest score first" loop, which is provably non-optimal
   * even at 3x3 (locking in the best individual cell can foreclose a much better global
   * pairing — this is the classic assignment problem, generally solved by the Hungarian
   * algorithm; at n=3, exhaustive search over 3!=6 permutations is simpler and equally optimal).
   * Used for both the Reader/Coder/Thinker role assignment and the domain-ownership assignment.
   */
  bestAssignment(matrix) {
    let best = null;
    for (const perm of this.ASSIGNMENT_PERMS) {
      const total = perm.reduce((s, slotIdx, memberIdx) => s + matrix[memberIdx][slotIdx], 0);
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
  buildSummaryParagraph(member, roleLabel, domainLabel, domainRating, speedRankLabel) {
    const rank = this.rankTitle(member.currentRating);
    const ratingPart = member.currentRating != null ? `rated ${member.currentRating}${rank ? ` (${rank})` : ""}` : "unrated";
    const topTags = this.topTags(member, 2);
    const topTagsPart = topTags.length ? ` Strongest in ${topTags.map((t) => t.tag).join(" and ")}.` : "";
    const acc = member.overallAccuracy;
    const accPart = acc ? ` ${this.accuracyLabel(acc.accuracyPct)} accuracy (${acc.accuracyPct.toFixed(0)}%).` : " Not enough solves yet to measure accuracy.";
    const speedPart = speedRankLabel ? ` ${speedRankLabel}.` : member.speed.insufficientData ? " Not enough live-contest data to rank solving speed." : "";
    const domainPart = domainRating != null ? `${domainLabel}, ~${Math.round(domainRating)} rated` : domainLabel;
    return `${member.handle} is ${ratingPart}, ${member.totalSolved} solved.${topTagsPart}${accPart}${speedPart} Suggested role: ${roleLabel} (owns ${domainPart}).`;
  },

  /**
   * Validates and fetches all 3 handles ONE AT A TIME (with a short stagger between each), not
   * via Promise.all — firing all 3 handles' requests simultaneously (6 total: 2 endpoints x 3
   * handles) reliably triggered Codeforces' rate limiting, either failing the whole analysis or
   * silently dropping a single handle's rating fetch (see fetchWithRetry's doc comment). This is
   * slower (each handle now waits for the previous one) but far more reliable — combined with
   * fetchWithRetry, a single transient hiccup no longer surfaces as a bug.
   *
   * Returns { ok:true, members } on full success, or { ok:false, error } (a pre-fetch validation
   * problem, no fetch attempted) / { ok:false, error, members } (one or more handles failed even
   * after retries — error lists which ones) otherwise. On success, caches members for render().
   * `onProgress(message)`, if given, is called before each handle starts fetching.
   */
  async analyze(handles, { onProgress } = {}) {
    const trimmed = handles.map((h) => (h || "").trim());
    if (trimmed.some((h) => !h)) return { ok: false, error: "Enter all three Codeforces handles." };
    const lower = trimmed.map((h) => h.toLowerCase());
    if (new Set(lower).size !== lower.length) {
      return { ok: false, error: "Enter three different handles — you can't compare a handle with itself." };
    }
    const members = [];
    for (let i = 0; i < trimmed.length; i++) {
      if (onProgress) onProgress(`Fetching ${trimmed[i]}… (${i + 1}/${trimmed.length})`);
      members.push(await this.fetchMemberData(trimmed[i]));
      if (i < trimmed.length - 1) await this.sleep(this.HANDLE_STAGGER_MS);
    }
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
    const roleMatrix = this.scoreRoles(members);
    const roleAssignment = this.bestAssignment(roleMatrix);
    const domainMatrix = this.scoreDomains(members);
    const domainAssignment = this.bestAssignment(domainMatrix);
    const rawDomainRatings = this.rawDomainRatings(members);
    const speedLabels = this.rankSpeeds(members);
    const knowledgeGaps = this.computeKnowledgeGaps(members);
    const executionGaps = this.computeExecutionGaps(members);
    const teamStats = this.computeTeamStats(members);
    const totalUnique = new Set(members.flatMap((m) => m.problems.map((p) => p.key))).size;

    const statTile = (value, label) => `<div class="stat-tile"><div class="stat-value">${value}</div><div class="stat-label">${label}</div></div>`;
    const teamStatsHtml = [
      statTile(teamStats.avgRating ?? "—", "avg. team rating"),
      statTile(teamStats.ratingSpread != null ? teamStats.ratingSpread : "—", "rating spread"),
      statTile(teamStats.combinedAccuracy != null ? teamStats.combinedAccuracy.toFixed(0) + "%" : "—", "combined accuracy"),
      statTile(`${teamStats.tagsCovered}/${teamStats.totalCoreTags}`, "core tags covered"),
    ].join("");

    const rolesTableHtml = members
      .map((m, i) => {
        const role = this.ROLES[roleAssignment[i]];
        return `<div class="stat-tile" title="${escapeHtml(role.blurb)}"><div class="stat-value">${escapeHtml(role.label)}</div><div class="stat-label">${escapeHtml(m.handle)}</div></div>`;
      })
      .join("");
    const domainsTableHtml = members
      .map((m, i) => {
        const domainIdx = domainAssignment[i];
        const rating = rawDomainRatings[domainIdx][i];
        const ratingLabel = rating != null ? `~${Math.round(rating)} rated` : "not enough data yet";
        return `<div class="stat-tile" title="${escapeHtml(ratingLabel)}"><div class="stat-value">${escapeHtml(this.DOMAINS[domainIdx].label)}</div><div class="stat-label">${escapeHtml(m.handle)} &middot; ${escapeHtml(ratingLabel)}</div></div>`;
      })
      .join("");

    const knowledgeGapsHtml = knowledgeGaps.length
      ? `<p class="card-subtitle"><strong>Knowledge gaps</strong> &mdash; nobody on the team solves much of: ${knowledgeGaps.map((g) => `${escapeHtml(g.tag)} (best: ${Math.round(g.maxRatio * 100)}%)`).join(", ")}. Worth learning together.</p>`
      : `<p class="card-subtitle"><strong>Knowledge gaps</strong> &mdash; none found among common ICPC topics; solid shared coverage.</p>`;
    const executionGapsHtml = executionGaps.length
      ? `<p class="card-subtitle"><strong>Execution gaps</strong> &mdash; the team attempts these plenty but still gets them wrong a lot: ${executionGaps.map((g) => `${escapeHtml(g.tag)} (${g.accuracyPct.toFixed(0)}% on ${g.count} attempts)`).join(", ")}. Not a knowledge problem &mdash; worth extra care on the write-and-debug side.</p>`
      : `<p class="card-subtitle"><strong>Execution gaps</strong> &mdash; none found; accuracy holds up on the tags the team attempts often.</p>`;

    root.innerHTML = `
      <section class="card">
        <h2>Team insights</h2>
        <p class="card-subtitle">
          Suggested roles based on solve history &mdash; a starting point, not a verdict.
          ${members.length} handles compared, ${totalUnique} unique problems solved across the team.
        </p>
        <div class="report-windows">${teamStatsHtml}</div>
        <h3 class="card-section-label">Role (who does what during the contest)</h3>
        <div class="report-windows">${rolesTableHtml}</div>
        <h3 class="card-section-label">Domain (whose problem is it when it's clearly one topic)</h3>
        <div class="report-windows">${domainsTableHtml}</div>
        ${knowledgeGapsHtml}
        ${executionGapsHtml}
      </section>
      <div class="card-grid">
        ${members
          .map((m, i) => {
            const domainIdx = domainAssignment[i];
            return this.memberCardHtml(m, this.ROLES[roleAssignment[i]].label, this.DOMAINS[domainIdx].label, rawDomainRatings[domainIdx][i], speedLabels[i]);
          })
          .join("")}
      </div>
      <section class="card">
        <h2>Tag ratings</h2>
        <div id="team-tag-ratings-root"></div>
      </section>
      <section class="card">
        <h2>Tag mix comparison</h2>
        <p class="card-subtitle">
          Each percentage is the share of that person's <strong>solved problems that have this
          tag</strong> (e.g. "31%" means 31% of everything they've solved is tagged this way),
          with the raw solve count alongside it &mdash; not a head-to-head score. This is about
          *practice volume* per tag; see "Tag ratings" above for actual per-topic strength.
        </p>
        <div id="team-tag-comparison-root"></div>
      </section>
    `;
    this.renderTagRatings($("team-tag-ratings-root"), members);
    this.renderTagComparison($("team-tag-comparison-root"), members);
  },

  /** Small colored dot + handle + bar + value row, shared by the tag-ratings and tag-comparison charts. */
  fitLineHtml(member, color, pct, valueLabel) {
    return `
      <div class="bar-team-line">
        <span class="bar-team-dot" style="background:${color}"></span>
        <span class="bar-team-handle">${escapeHtml(member.handle)}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${color}"></div></div>
        <span class="bar-count">${escapeHtml(valueLabel)}</span>
      </div>`;
  },

  /** Bar-width position of `rating` on the fixed TAG_RATING_MIN..TAG_RATING_MAX scale, clamped 0..100. */
  ratingBarPct(rating) {
    const pct = ((rating - this.TAG_RATING_MIN) / (this.TAG_RATING_MAX - this.TAG_RATING_MIN)) * 100;
    return Math.max(0, Math.min(100, pct));
  },

  /**
   * Per-tag rating chart, one row per CORE_TAG each member has enough solves to rate, no
   * commentary — just each person's real per-topic Codeforces rating (see topicRatings), bar
   * width on a fixed absolute scale so tags stay comparable against each other, not just within
   * their own row. Sorted by the team's best rating in that tag, descending.
   */
  renderTagRatings(root, members) {
    if (!root) return;
    const colors = ["var(--accent)", "var(--secondary)", "var(--warn)"];
    const rows = this.CORE_TAGS.map((tag) => ({
      tag,
      ratings: members.map((m) => (m.topicRatings[tag] ? m.topicRatings[tag].avgRating : null)),
    })).filter((r) => r.ratings.some((v) => v != null));

    if (!rows.length) {
      root.innerHTML = `<p class="empty-note">Not enough rated solves yet to show per-tag ratings.</p>`;
      return;
    }
    rows.sort((a, b) => Math.max(...b.ratings.map((v) => v ?? 0)) - Math.max(...a.ratings.map((v) => v ?? 0)));

    root.innerHTML = rows
      .map((r) => {
        const lines = members
          .map((m, i) => {
            const rating = r.ratings[i];
            const pct = rating != null ? this.ratingBarPct(rating) : 0;
            const label = rating != null ? `~${Math.round(rating)}` : "n/a";
            return this.fitLineHtml(m, colors[i], pct, label);
          })
          .join("");
        return `<div class="bar-row-team"><span class="bar-label">${escapeHtml(r.tag)}</span>${lines}</div>`;
      })
      .join("");
  },

  memberCardHtml(member, roleLabel, domainLabel, domainRating, speedRankLabel) {
    const rank = this.rankTitle(member.currentRating);
    const acc = member.overallAccuracy;
    const accPct = acc ? acc.accuracyPct.toFixed(0) : null;
    const speedValue = speedRankLabel
      ? speedRankLabel.replace(" on the team", "").replace(" of the team", "")
      : member.speed.insufficientData
        ? "N/A"
        : `${Math.round(member.speed.medianMinutes)}m`;
    const implCallout = this.implementationCallout(member);
    const summary = this.buildSummaryParagraph(member, roleLabel, domainLabel, domainRating, speedRankLabel);
    const topTags = this.topTags(member, 4);
    const domainTitle = domainRating != null ? `~${Math.round(domainRating)} rated in this domain` : "not enough solves here to rate yet";

    return `
      <div class="card">
        <h3>${escapeHtml(member.handle)} <span class="role-badge">${escapeHtml(roleLabel)}</span><span class="role-badge domain-badge" title="${escapeHtml(domainTitle)}">${escapeHtml(domainLabel)}</span></h3>
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
              const count = m.tagStats.counts[r.tag] || 0;
              const pct = Math.round(ratio * 100);
              return this.fitLineHtml(m, colors[i], pct, `${pct}% (${count})`);
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

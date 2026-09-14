/**
 * Codeforces sync: try a direct client-side fetch to the CF API first (it
 * generally allows CORS), and fall back to a manual "open in new tab, paste
 * JSON here" flow if the fetch fails for any reason (network, CORS, rate
 * limit). Also exposes a single-problem manual log helper.
 */
const CFSync = {
  apiUrl(handle) {
    return `https://codeforces.com/api/user.status?handle=${encodeURIComponent(handle)}`;
  },

  /** Turn a CF API `result` array into our internal problem shape, OK verdicts only. */
  extractSolved(submissions) {
    const seen = new Set();
    const out = [];
    for (const sub of submissions) {
      if (sub.verdict !== "OK") continue;
      const p = sub.problem;
      const key = Gamification.problemKey(p.contestId, p.index);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        key,
        contestId: p.contestId ?? null,
        index: p.index ?? null,
        name: p.name || key,
        rating: p.rating ?? null,
        tags: p.tags || [],
        solvedDate: new Date(sub.creationTimeSeconds * 1000).toISOString(),
        source: "cf-sync",
      });
    }
    return out;
  },

  /** Attempt the live fetch. Resolves { ok: true, problems } or { ok: false, error }. */
  async fetchLive(handle) {
    try {
      const res = await fetch(this.apiUrl(handle));
      if (!res.ok) {
        return { ok: false, error: `HTTP ${res.status}` };
      }
      const json = await res.json();
      if (json.status !== "OK") {
        return { ok: false, error: json.comment || "Codeforces API returned an error" };
      }
      return { ok: true, problems: this.extractSolved(json.result) };
    } catch (e) {
      return { ok: false, error: e.message || "Network/CORS error" };
    }
  },

  /** Parse manually-pasted JSON (either the raw `result` array, or the full `{status, result}` envelope). */
  parseManual(jsonText) {
    const parsed = JSON.parse(jsonText);
    const submissions = Array.isArray(parsed) ? parsed : parsed.result;
    if (!Array.isArray(submissions)) {
      throw new Error("Couldn't find a submissions array in that JSON.");
    }
    return this.extractSolved(submissions);
  },

  /** Full sync pipeline given already-extracted problems: dedupe against the store and log the rest. */
  applyProblems(problems) {
    return Gamification.addSolves(problems);
  },

  /** Manual single-solve entry. */
  logSingle({ contestId, index, name, rating, tags, solvedDate }) {
    const key = Gamification.problemKey(contestId || "", index || name);
    return Gamification.addSolves([
      {
        key: contestId && index ? Gamification.problemKey(contestId, index) : `manual-${Date.now()}`,
        contestId: contestId || null,
        index: index || null,
        name: name || key,
        rating: rating || null,
        tags: tags || [],
        solvedDate,
        source: "manual",
      },
    ]);
  },
};

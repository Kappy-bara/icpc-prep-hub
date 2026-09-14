/**
 * Codeforces handle ownership verification, for linking a handle to a cloud
 * account. Codeforces has no OAuth, so we use the standard trick: ask the
 * user to submit a solution that fails to compile to a specific (old,
 * stable) problem within a time window, then check the submission history
 * for that exact compile-error submission.
 */
const CFVerify = {
  PROBLEM_POOL: [
    { contestId: 4, index: "A", name: "Watermelon" },
    { contestId: 1, index: "A", name: "Theatre Square" },
    { contestId: 71, index: "A", name: "Way Too Long Words" },
    { contestId: 158, index: "A", name: "Next Round" },
  ],

  GRACE_MS: 2 * 60 * 1000,
  WINDOW_MINUTES: 10,

  pickProblem() {
    return this.PROBLEM_POOL[Math.floor(Math.random() * this.PROBLEM_POOL.length)];
  },

  problemUrl(problem) {
    return `https://codeforces.com/problemset/problem/${problem.contestId}/${problem.index}`;
  },

  matchInSubmissions(submissions, handle, problem, startedAtMs) {
    return submissions.some(
      (sub) =>
        sub.problem &&
        sub.problem.contestId === problem.contestId &&
        sub.problem.index === problem.index &&
        sub.verdict === "COMPILATION_ERROR" &&
        sub.creationTimeSeconds * 1000 >= startedAtMs - this.GRACE_MS
    );
  },

  /** Live check. Resolves { ok: true, verified: boolean } or { ok: false, error }. */
  async checkLive(handle, problem, startedAtMs) {
    try {
      const res = await fetch(`https://codeforces.com/api/user.status?handle=${encodeURIComponent(handle)}&from=1&count=30`);
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
      const json = await res.json();
      if (json.status !== "OK") return { ok: false, error: json.comment || "Codeforces API returned an error" };
      return { ok: true, verified: this.matchInSubmissions(json.result, handle, problem, startedAtMs) };
    } catch (e) {
      return { ok: false, error: e.message || "Network/CORS error" };
    }
  },

  /** Manual fallback: parse pasted JSON the same shape as user.status. */
  checkManual(jsonText, problem, startedAtMs) {
    const parsed = JSON.parse(jsonText);
    const submissions = Array.isArray(parsed) ? parsed : parsed.result;
    if (!Array.isArray(submissions)) throw new Error("Couldn't find a submissions array in that JSON.");
    return this.matchInSubmissions(submissions, "", problem, startedAtMs);
  },
};

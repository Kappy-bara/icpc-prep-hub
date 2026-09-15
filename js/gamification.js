/**
 * Points formula and reward/log bookkeeping.
 *
 * base = round(rating / 100) for rated problems, flat 5 for unrated
 * x1.5 (rounded) if any of the problem's tags is in the user's focus-tags list
 * minimum 1 point, EXCEPT problems solved before the gamification start date,
 * which always score 0 (logged for stats only).
 */
function computePoints({ rating, tags, solvedDate }, { focusTags, gamificationStart }) {
  if (gamificationStart && solvedDate < gamificationStart) {
    return 0;
  }
  const base = rating ? Math.round(rating / 100) : 5;
  const isFocus = Array.isArray(tags) && tags.some((t) => focusTags.includes(t));
  const raw = isFocus ? Math.round(base * 1.5) : base;
  return Math.max(1, raw);
}

function problemKey(contestId, index) {
  return `${contestId}${index}`;
}

// The 3 starter rewards ship as `locked: true`, but a profile saved before that field
// existed won't have it on disk — match by id too so already-installed users are covered.
const LOCKED_REWARD_IDS = ["r-youtube", "r-treat", "r-afternoon"];
function isLockedReward(reward) {
  return Boolean(reward) && (reward.locked === true || LOCKED_REWARD_IDS.includes(reward.id));
}

const Gamification = {
  computePoints,
  problemKey,

  /** Add solved problems, skipping ones already logged (by key). Returns { added, pointsGained }. */
  addSolves(problems) {
    const d = Store.data;
    const existingKeys = new Set(d.solvedLog.map((p) => p.key));
    const { focusTags, gamificationStart } = d.profile;
    let added = 0;
    let pointsGained = 0;

    Store.update((data) => {
      for (const p of problems) {
        const key = p.key || problemKey(p.contestId, p.index);
        if (existingKeys.has(key)) continue;
        existingKeys.add(key);
        const points = computePoints(
          { rating: p.rating, tags: p.tags, solvedDate: p.solvedDate },
          { focusTags, gamificationStart }
        );
        data.solvedLog.push({
          key,
          contestId: p.contestId ?? null,
          index: p.index ?? null,
          name: p.name || key,
          rating: p.rating ?? null,
          tags: p.tags || [],
          solvedDate: p.solvedDate,
          points,
          source: p.source || "manual",
        });
        data.points.balance += points;
        added++;
        pointsGained += points;
      }
    });

    return { added, pointsGained };
  },

  redeemReward(rewardId) {
    const d = Store.data;
    const reward = d.rewards.find((r) => r.id === rewardId);
    if (!reward) return { ok: false, reason: "not-found" };
    if (d.points.balance < reward.cost) return { ok: false, reason: "insufficient-points" };

    Store.update((data) => {
      data.points.balance -= reward.cost;
      data.redemptions.unshift({
        id: `red-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        rewardId: reward.id,
        rewardName: reward.name,
        cost: reward.cost,
        date: new Date().toISOString(),
      });
    });
    document.dispatchEvent(new CustomEvent("icpc:points-changed"));
    return { ok: true };
  },

  addReward(name, cost) {
    Store.update((data) => {
      data.rewards.push({
        id: `r-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name,
        cost,
      });
    });
    document.dispatchEvent(new CustomEvent("icpc:points-changed"));
  },

  removeReward(rewardId) {
    const reward = Store.data.rewards.find((r) => r.id === rewardId);
    if (isLockedReward(reward)) return { ok: false, reason: "locked" };
    Store.update((data) => {
      data.rewards = data.rewards.filter((r) => r.id !== rewardId);
    });
    document.dispatchEvent(new CustomEvent("icpc:points-changed"));
    return { ok: true };
  },
};

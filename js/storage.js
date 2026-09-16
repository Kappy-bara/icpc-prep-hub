/**
 * Local-only data store. Everything lives in this browser's localStorage — no accounts, no
 * server, no cross-device sync. (An earlier version of this app had an optional Supabase-backed
 * cloud-sync mode with email/magic-link sign-in; removed by request in favor of keeping the app
 * fully local and backend-free, with Codeforces handle verification — see js/cf-verify.js — as
 * the only "prove who you are" step, gating points/rewards without needing any account system.)
 */
const LOCAL_KEY = "icpc-prep-hub:data:v1";

function defaultData() {
  return {
    version: 2,
    profile: {
      cfHandle: "",
      cfVerified: false,
      gamificationStart: null, // ISO date string, auto-set the day the CF handle is first verified
      focusTags: [], // at most one tag, chosen from the dropdown
      targetDate: "2026-10-03", // ISO date string, editable
    },
    theme: "system", // "system" | "light" | "dark"
    roadmapProgress: {}, // { [topicId]: true }
    points: {
      balance: 0,
    },
    solvedLog: [
      // { key: "1500A", contestId, index, name, rating, tags: [], solvedDate: ISO, points, source: "cf-sync"|"manual" }
    ],
    cf: {
      ratingHistory: [
        // { contestId, contestName, ratingUpdateTimeSeconds, oldRating, newRating }
      ],
      attemptStats: {
        // { [problemKey]: wrongAttemptCount } — only for problems that are also in solvedLog
      },
      unsolvedAttempted: [
        // { key, contestId, index, name, rating, tags, lastAttemptDate: ISO, attemptCount }
        // capped to the 100 most-recently-attempted, newest first
      ],
      lastRatingSyncAt: null, // ISO timestamp, informational only
    },
    rewards: [
      // Costs are roughly half the old 20/30/150 — the points formula dropped by a flat 5
      // per solve (see gamification.js), so the same "how many solves to afford this" feel
      // needs about half the old price tag at typical solving ratings.
      { id: "r-youtube", name: "15-minute YouTube break", cost: 10, locked: true },
      { id: "r-treat", name: "A small treat / snack", cost: 15, locked: true },
      { id: "r-afternoon", name: "A guilt-free lazy afternoon", cost: 75, locked: true },
    ],
    redemptions: [
      // { id, rewardId, rewardName, cost, date }
    ],
  };
}

// Type-checked at every level, not just "does incoming exist": a hand-edited or partially
// corrupted backup file can have the right keys with the wrong-typed values (e.g. `solvedLog`
// as a string instead of an array). Blindly trusting incoming's type there used to let a single
// bad import corrupt the store into a shape every array-iterating page throws on — and since
// save() persists before anything downstream can catch that, the corruption survived past the
// "Import failed" message. Now a type mismatch at any level just keeps base's value instead.
function deepMerge(base, incoming) {
  if (Array.isArray(base)) {
    return Array.isArray(incoming) ? incoming : base;
  }
  if (base !== null && typeof base === "object") {
    if (incoming === null || typeof incoming !== "object" || Array.isArray(incoming)) return base;
    const out = { ...base };
    for (const k of Object.keys(incoming)) {
      out[k] = k in base ? deepMerge(base[k], incoming[k]) : incoming[k];
    }
    return out;
  }
  return incoming !== undefined ? incoming : base;
}

/**
 * One-time migrations for data saved under an older schema `version`. Needed because deepMerge
 * only merges plain OBJECTS key-by-key — an array like `rewards` that's already on disk always
 * wins wholesale over a new default (see deepMerge above), so changing a shipped default value
 * (e.g. a starter reward's cost) only affects brand-new installs, never browsers that already
 * saved data under the old default. Each entry is a pure `(data) -> data` step keyed by the
 * version it upgrades TO; migrate() below runs every step between the stored version and current.
 */
const MIGRATIONS = {
  2: (data) => {
    // v1 -> v2: starter reward costs were halved (20/30/150 -> 10/15/75) when the points formula
    // dropped by a flat 5/solve (see gamification.js). Only touches the 3 known starter rewards,
    // and only when the cost still exactly matches the OLD default, so it can't clobber anything
    // else — there's no UI to edit a reward's cost today, so an exact match can only mean this
    // reward was never touched since it was created under the old default.
    const OLD_COSTS = { "r-youtube": 20, "r-treat": 30, "r-afternoon": 150 };
    const NEW_COSTS = { "r-youtube": 10, "r-treat": 15, "r-afternoon": 75 };
    for (const r of data.rewards) {
      if (r.id in OLD_COSTS && r.cost === OLD_COSTS[r.id]) r.cost = NEW_COSTS[r.id];
    }
    return data;
  },
};

function migrate(data) {
  let version = data.version || 1;
  while (MIGRATIONS[version + 1]) {
    version += 1;
    data = MIGRATIONS[version](data) || data;
  }
  data.version = version;
  return data;
}

const Store = {
  _data: null,

  get data() {
    if (!this._data) {
      try {
        const raw = localStorage.getItem(LOCAL_KEY);
        this._data = raw ? migrate(deepMerge(defaultData(), JSON.parse(raw))) : defaultData();
      } catch (e) {
        console.error("Failed to read local data, using defaults.", e);
        this._data = defaultData();
      }
    }
    return this._data;
  },

  update(mutator) {
    const d = this.data;
    mutator(d);
    this.save();
    return d;
  },

  save() {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(this._data));
    } catch (e) {
      console.error("Failed to write local data.", e);
    }
  },

  exportJSON() {
    return JSON.stringify(this.data, null, 2);
  },

  importJSON(jsonString) {
    const parsed = JSON.parse(jsonString);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("That file doesn't look like an icpc-prep-hub backup (expected a JSON object).");
    }
    this._data = migrate(deepMerge(defaultData(), parsed));
    this.save();
    return this._data;
  },

  resetAll() {
    this._data = defaultData();
    this.save();
    return this._data;
  },
};

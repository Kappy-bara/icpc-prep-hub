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
    version: 3,
    // Every verified handle this browser has ever logged in as, keyed by lowercased handle —
    // { [handle.toLowerCase()]: { profile, roadmapProgress, points, solvedLog, cf, rewards,
    // redemptions } }, the exact snapshot shape ACCOUNT_FIELDS below swaps in/out on login/
    // logout. Lets switching between two handles on the same browser (or logging out and back
    // in as the same one) restore each handle's own progress exactly as it was left, instead of
    // wiping to empty — see Store.login/logout.
    accounts: {},
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

// The fields that belong to "whoever is logged in" — swapped wholesale into/out of an
// `accounts[handle]` snapshot on login/logout (see Store.login/logout below). Everything else
// (accounts itself, theme) stays put across a login switch since it isn't identity-specific.
const ACCOUNT_FIELDS = ["profile", "roadmapProgress", "points", "solvedLog", "cf", "rewards", "redemptions"];

function snapshotFields(data) {
  const out = {};
  for (const f of ACCOUNT_FIELDS) out[f] = data[f];
  return out;
}

/**
 * Coerce a value back to a finite number, or `fallback` if it isn't one — used below to close a
 * real stored-XSS hole. `deepMerge` only checks that an incoming ARRAY is an array and an
 * incoming OBJECT is an object; it never checks an individual field's type. Several render
 * functions across the app (Recent Solves, the points-overview stat tiles, the rewards list, …)
 * interpolate fields like `solvedLog[].rating/points`, `points.balance`, and `rewards[].cost`
 * directly into `innerHTML` WITHOUT `escapeHtml`, because under every path the app itself writes
 * through (CF sync, the manual-log form, redeeming a reward) those fields are always genuinely
 * numbers. A hand-edited or malicious "backup" JSON file loaded via Import JSON breaks that
 * assumption — nothing stopped `solvedLog[0].rating` from being the *string*
 * `"<img src=x onerror=alert(1)>"`, which would then render unescaped and execute. Coercing every
 * known-numeric field back to an actual number right after every deepMerge (both the normal
 * localStorage load and an explicit import go through this) closes it for every render site at
 * once, and is a no-op for the 99.9% of data that was already a real number.
 */
function coerceNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function sanitizeSolvedLog(list) {
  if (!Array.isArray(list)) return list;
  for (const p of list) {
    if (!p || typeof p !== "object") continue;
    p.rating = p.rating == null ? null : coerceNumber(p.rating, null);
    p.points = coerceNumber(p.points, 0);
    p.bonus = coerceNumber(p.bonus, 0);
  }
  return list;
}

/** Sanitizes one ACCOUNT_FIELDS-shaped bundle in place — the top-level store, or one `accounts[handle]` snapshot. */
function sanitizeAccountFields(bundle) {
  if (!bundle || typeof bundle !== "object") return bundle;
  if (bundle.points) bundle.points.balance = coerceNumber(bundle.points.balance, 0);
  sanitizeSolvedLog(bundle.solvedLog);
  if (bundle.cf && Array.isArray(bundle.cf.unsolvedAttempted)) {
    for (const p of bundle.cf.unsolvedAttempted) {
      if (!p || typeof p !== "object") continue;
      p.rating = p.rating == null ? null : coerceNumber(p.rating, null);
      p.attemptCount = coerceNumber(p.attemptCount, 0);
    }
  }
  if (Array.isArray(bundle.rewards)) {
    for (const r of bundle.rewards) {
      if (r && typeof r === "object") r.cost = coerceNumber(r.cost, 1);
    }
  }
  if (Array.isArray(bundle.redemptions)) {
    for (const r of bundle.redemptions) {
      if (r && typeof r === "object") r.cost = coerceNumber(r.cost, 0);
    }
  }
  return bundle;
}

function sanitizeTypes(data) {
  sanitizeAccountFields(data);
  if (data.accounts && typeof data.accounts === "object") {
    for (const snapshot of Object.values(data.accounts)) sanitizeAccountFields(snapshot);
  }
  return data;
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
  3: (data) => {
    // v2 -> v3: the profile/verify model changed from "save a handle, then separately verify it"
    // (a single mutable slot anyone could overwrite, which also meant switching handles and
    // switching back reset gamificationStart to today on re-verification) to "log in BY
    // verifying," with each verified handle's progress preserved in its own `accounts[handle]`
    // slot. Migrate whatever was already active into that shape: an already-verified handle
    // becomes that handle's first account entry (same gamificationStart, same everything — no
    // re-verification needed), so this upgrade doesn't cost anyone their accumulated progress.
    // An unverified handle from the old model isn't a real login under the new one, so it's
    // dropped back to a logged-out state instead of being promoted into an account.
    data.accounts = data.accounts || {};
    if (data.profile.cfVerified && data.profile.cfHandle) {
      const key = data.profile.cfHandle.trim().toLowerCase();
      data.accounts[key] = snapshotFields(data);
    } else {
      const fresh = defaultData();
      for (const f of ACCOUNT_FIELDS) data[f] = fresh[f];
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
  // Runs on every load, not just a version bump — see sanitizeTypes' own comment for why.
  return sanitizeTypes(data);
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

  /**
   * Log in as `handle`, having already verified ownership (see js/cf-verify.js CFVerify) — call
   * this only after a successful check, never speculatively; it unconditionally marks the result
   * verified. A returning handle (one already in `accounts`) restores its saved snapshot exactly
   * as it was left — same gamificationStart, same solvedLog, same points — so logging in as a
   * handle you've already verified before never resets progress or the accumulation start date,
   * even if you'd switched away to a different handle in between. A brand-new handle gets a
   * fresh account with gamificationStart set to today (the existing "start counting from first
   * verification" rule, just moved here from the old markVerified()). Whatever was active before
   * this call (if anything) is saved into its own slot first, so logging in as a second handle
   * never loses the first one's in-progress session.
   */
  login(handle) {
    const d = this.data;
    d.accounts = d.accounts || {};
    const cleanHandle = handle.trim();
    const prevKey = (d.profile.cfHandle || "").trim().toLowerCase();
    if (prevKey) d.accounts[prevKey] = snapshotFields(d);

    const key = cleanHandle.toLowerCase();
    const existing = d.accounts[key];
    if (existing) {
      for (const f of ACCOUNT_FIELDS) d[f] = existing[f];
      d.profile.cfHandle = cleanHandle; // this login's casing, not whatever was saved before
    } else {
      const fresh = defaultData();
      for (const f of ACCOUNT_FIELDS) d[f] = fresh[f];
      d.profile.cfHandle = cleanHandle;
      d.profile.gamificationStart = new Date().toISOString().slice(0, 10);
    }
    d.profile.cfVerified = true;
    d.accounts[key] = snapshotFields(d);

    this.save();
    return d;
  },

  /**
   * Log out: save the active session into its own account slot first (nothing is lost — logging
   * back in as the same handle later restores it), then clear the active slots to an anonymous,
   * logged-out state.
   */
  logout() {
    const d = this.data;
    d.accounts = d.accounts || {};
    const prevKey = (d.profile.cfHandle || "").trim().toLowerCase();
    if (prevKey) d.accounts[prevKey] = snapshotFields(d);
    const fresh = defaultData();
    for (const f of ACCOUNT_FIELDS) d[f] = fresh[f];
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

/**
 * Data store with two backends behind one synchronous-looking API:
 *
 *  - "local" mode (default, signed out): reads/writes localStorage directly,
 *    exactly as before cloud sync existed.
 *  - "cloud" mode (signed in, Supabase configured): the in-memory `_data` is
 *    hydrated from the user's `profiles.app_data` row, mirrored into a
 *    per-user localStorage cache key for instant reloads/offline resilience,
 *    and pushed back to Supabase in the background (debounced) on every
 *    write. The rest of the app never needs to know which mode is active —
 *    it just calls Store.data / Store.update() as always.
 *
 * The two modes use different localStorage keys, so signing out cleanly
 * restores whatever local-only data existed before signing in.
 */
const LOCAL_KEY = "icpc-prep-hub:data:v1";
const CLOUD_SAVE_DEBOUNCE_MS = 900;

function defaultData() {
  return {
    version: 1,
    profile: {
      cfHandle: "",
      cfVerified: false, // mirrors profiles.cf_verified in cloud mode; unused in local mode
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

const Store = {
  _data: null,
  _mode: "local", // "local" | "cloud"
  _userId: null,
  _cloudSaveTimer: null,
  _cloudDirty: false,
  _statusListeners: [],

  onCloudStatus(fn) {
    this._statusListeners.push(fn);
  },

  _emitStatus(status, detail) {
    for (const fn of this._statusListeners) fn(status, detail);
  },

  cloudCacheKey(userId) {
    return `icpc-prep-hub:cloud-cache:${userId}`;
  },

  _readKey(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? deepMerge(defaultData(), JSON.parse(raw)) : defaultData();
    } catch (e) {
      console.error(`Failed to read ${key}, using defaults.`, e);
      return defaultData();
    }
  },

  _writeKey(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.error(`Failed to write ${key}.`, e);
    }
  },

  /** Local-only mode: the default at startup, and after sign-out. */
  loadLocal() {
    this._mode = "local";
    this._userId = null;
    this._data = this._readKey(LOCAL_KEY);
    return this._data;
  },

  /** Whether there's any non-default local data worth offering to import into a fresh cloud account. */
  hasMeaningfulLocalData() {
    const d = this._readKey(LOCAL_KEY);
    return d.solvedLog.length > 0 || Object.keys(d.roadmapProgress).length > 0 || Boolean(d.profile.cfHandle);
  },

  /** Enter cloud mode using a profile row already fetched from Supabase. Does not push back. */
  enterCloudMode(userId, row) {
    this._mode = "cloud";
    this._userId = userId;
    this._data = deepMerge(defaultData(), row?.app_data || {});
    this._data.profile.cfHandle = row?.cf_handle || this._data.profile.cfHandle || "";
    this._data.profile.cfVerified = Boolean(row?.cf_verified);
    this._writeKey(this.cloudCacheKey(userId), this._data);
    return this._data;
  },

  /** Seed a brand-new cloud account from this device's current local data, then push it up. */
  async seedCloudFromLocal(userId) {
    const local = this._readKey(LOCAL_KEY);
    this.enterCloudMode(userId, { app_data: local, cf_handle: null, cf_verified: false });
    await this.pushToCloudNow();
    return this._data;
  },

  /** Leave cloud mode, flushing any pending write first, and restore local-only data. */
  async exitCloudMode() {
    if (this._cloudDirty) {
      await this.pushToCloudNow();
    }
    return this.loadLocal();
  },

  get data() {
    if (!this._data) this.loadLocal();
    return this._data;
  },

  update(mutator) {
    const d = this.data;
    mutator(d);
    this.save();
    return d;
  },

  save() {
    if (this._mode === "cloud") {
      this._writeKey(this.cloudCacheKey(this._userId), this._data);
      this._cloudDirty = true;
      if (this._cloudSaveTimer) clearTimeout(this._cloudSaveTimer);
      this._cloudSaveTimer = setTimeout(() => this.pushToCloudNow(), CLOUD_SAVE_DEBOUNCE_MS);
    } else {
      this._writeKey(LOCAL_KEY, this._data);
    }
  },

  async pushToCloudNow() {
    if (this._cloudSaveTimer) {
      clearTimeout(this._cloudSaveTimer);
      this._cloudSaveTimer = null;
    }
    if (this._mode !== "cloud" || !CLOUD_ENABLED || !this._userId) {
      this._cloudDirty = false;
      return;
    }
    this._emitStatus("saving");
    try {
      const { error } = await supabaseClient.from("profiles").update({ app_data: this._data }).eq("id", this._userId);
      if (error) throw error;
      this._cloudDirty = false;
      this._emitStatus("saved");
    } catch (e) {
      console.error("Failed to push data to Supabase.", e);
      this._emitStatus("error", e.message);
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
    this._data = deepMerge(defaultData(), parsed);
    this.save();
    return this._data;
  },

  resetAll() {
    this._data = defaultData();
    this.save();
    return this._data;
  },
};

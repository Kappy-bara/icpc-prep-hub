/**
 * Single localStorage-backed data store. Everything lives under one namespaced
 * key so export/import is a straight JSON dump/restore.
 */
const STORAGE_KEY = "icpc-prep-hub:data:v1";

function defaultData() {
  return {
    version: 1,
    profile: {
      cfHandle: "",
      gamificationStart: null, // ISO date string, set once at onboarding
      focusTags: ["strings"],
      targetDate: null, // ISO date string, optional
    },
    theme: "system", // "system" | "light" | "dark"
    roadmapProgress: {}, // { [topicId]: true }
    points: {
      balance: 0,
    },
    solvedLog: [
      // { key: "1500A", contestId, index, name, rating, tags: [], solvedDate: ISO, points, source: "cf-sync"|"manual" }
    ],
    rewards: [
      { id: "r-youtube", name: "15-minute YouTube break", cost: 20 },
      { id: "r-treat", name: "A small treat / snack", cost: 30 },
      { id: "r-afternoon", name: "A guilt-free lazy afternoon", cost: 150 },
    ],
    redemptions: [
      // { id, rewardId, rewardName, cost, date }
    ],
  };
}

function deepMerge(base, incoming) {
  if (Array.isArray(base) || Array.isArray(incoming)) {
    return incoming !== undefined ? incoming : base;
  }
  if (typeof base === "object" && base !== null && typeof incoming === "object" && incoming !== null) {
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

  load() {
    if (this._data) return this._data;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        this._data = defaultData();
      } else {
        const parsed = JSON.parse(raw);
        this._data = deepMerge(defaultData(), parsed);
      }
    } catch (e) {
      console.error("Failed to load stored data, resetting to defaults.", e);
      this._data = defaultData();
    }
    return this._data;
  },

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._data));
    } catch (e) {
      console.error("Failed to save data to localStorage.", e);
    }
  },

  get data() {
    return this.load();
  },

  update(mutator) {
    const d = this.load();
    mutator(d);
    this.save();
    return d;
  },

  exportJSON() {
    return JSON.stringify(this.load(), null, 2);
  },

  importJSON(jsonString) {
    const parsed = JSON.parse(jsonString);
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

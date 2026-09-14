#!/usr/bin/env node
/**
 * Generates js/cf-baseline-data.js — real Codeforces peer data used by the
 * Codeforces Analysis page to normalize a user's own solve counts and
 * tag ratios against reality (e.g. "you solved 100 math and 30 trees" isn't
 * "trees is weak" if math is just naturally far more common; "you solved
 * 350 problems" isn't meaningful without knowing what's typical at your tier).
 *
 * Each tier (Top 500 / Top 10,000 / Average user) is a small SAMPLE of real
 * rated users whose current rating falls in that band — their actual solve
 * histories are fetched and averaged (solved count AND tag mix). This is
 * genuine player data, not a proxy derived from the problem set: an earlier
 * version of this script bucketed *problems* by rating instead, which
 * produced a "baseline pool size" that got misread as "how many an average
 * player solves" — a different, much larger number. Sampling real users
 * fixes that at the root. The Tourist tier is the same technique with a
 * sample size of exactly one specific, named player instead of an anonymous
 * average.
 *
 * Deliberately NOT a live per-visitor computation: sampled users' full
 * submission histories are fetched once here, not on every page load. Run
 * this occasionally (see README "Codeforces baseline data") and commit the
 * regenerated output — plain Node, no dependencies, Node >= 18 for built-in
 * fetch.
 *
 * Usage: node scripts/generate-cf-baseline.js
 */
const fs = require("fs");
const path = require("path");

const OUTPUT_PATH = path.join(__dirname, "..", "js", "cf-baseline-data.js");
const YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const AVERAGE_BAND = 200; // +/- this many rating points around the median for the "average user" pool
const SAMPLE_SIZE = 10; // real users sampled per tier
const REQUEST_DELAY_MS = 2000; // courtesy delay between CF API calls (CF asks for <= 1 req/2s)

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function cfGet(endpoint, params) {
  const url = `https://codeforces.com/api/${endpoint}${params ? `?${params}` : ""}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${endpoint}: HTTP ${res.status}`);
  const json = await res.json();
  if (json.status !== "OK") throw new Error(`${endpoint}: ${json.comment || "API returned an error"}`);
  return json.result;
}

function cleanTags(tags) {
  return (tags || []).filter((t) => !t.startsWith("*"));
}

/** A user's distinct OK-verdict solves, each tagged with when it happened (for last-year windowing). */
async function fetchUserSolves(handle) {
  const subs = await cfGet("user.status", `handle=${encodeURIComponent(handle)}`);
  const solvedMap = new Map();
  for (const sub of subs) {
    if (sub.verdict !== "OK") continue;
    const key = `${sub.problem.contestId}${sub.problem.index}`;
    if (solvedMap.has(key)) continue;
    solvedMap.set(key, { tags: sub.problem.tags || [], dateMs: sub.creationTimeSeconds * 1000 });
  }
  return [...solvedMap.values()];
}

/** { problemCount, tagRatios } for one user's (or one window's) solved list — problemCount here means solved count. */
function computeWindow(solves) {
  const problemCount = solves.length;
  const tagCounts = {};
  for (const p of solves) {
    for (const tag of cleanTags(p.tags)) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }
  }
  const tagRatios = {};
  for (const [tag, count] of Object.entries(tagCounts)) {
    tagRatios[tag] = problemCount ? Number((count / problemCount).toFixed(4)) : 0;
  }
  return { problemCount, tagRatios };
}

/** Averages several users' computeWindow() results: mean solved count, mean per-tag ratio. */
function aggregateWindows(perUserWindows) {
  const n = perUserWindows.length || 1;
  const avgSolvedCount = Number((perUserWindows.reduce((s, w) => s + w.problemCount, 0) / n).toFixed(1));
  const tagSums = {};
  for (const w of perUserWindows) {
    for (const [tag, ratio] of Object.entries(w.tagRatios)) {
      tagSums[tag] = (tagSums[tag] || 0) + ratio;
    }
  }
  const tagRatios = {};
  for (const [tag, sum] of Object.entries(tagSums)) tagRatios[tag] = Number((sum / n).toFixed(4));
  return { problemCount: avgSolvedCount, tagRatios, sampleSize: n };
}

function topTags(windowData, n) {
  return Object.entries(windowData.tagRatios)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([tag, ratio]) => `${tag} ${(ratio * 100).toFixed(0)}%`)
    .join(", ");
}

/** Evenly spread N picks across a pool (not just the top of it) for a representative sample. */
function spreadSample(pool, n) {
  if (pool.length <= n) return pool;
  const step = pool.length / n;
  const out = [];
  for (let i = 0; i < n; i++) out.push(pool[Math.floor(i * step)]);
  return out;
}

/** Fetches + windows one tier's sampled real users, with a courtesy delay between each. */
async function buildTierFromSample(label, ratingCutoff, handles, yearAgo) {
  const perUserAllTime = [];
  const perUserLastYear = [];
  let fetched = 0;
  for (const handle of handles) {
    await sleep(REQUEST_DELAY_MS);
    try {
      const solves = await fetchUserSolves(handle);
      perUserAllTime.push(computeWindow(solves));
      perUserLastYear.push(computeWindow(solves.filter((p) => p.dateMs >= yearAgo)));
      fetched++;
    } catch (e) {
      console.log(`    (skipping ${handle}: ${e.message})`);
    }
  }
  const tier = {
    label,
    ratingCutoff,
    windows: {
      allTime: aggregateWindows(perUserAllTime),
      lastYear: aggregateWindows(perUserLastYear),
    },
  };
  console.log(`  [${label}] sampled ${fetched}/${handles.length} users`);
  console.log(`  [${label}] all-time: avg ${tier.windows.allTime.problemCount} solved (${topTags(tier.windows.allTime, 5)})`);
  console.log(`  [${label}] last-year: avg ${tier.windows.lastYear.problemCount} solved (${topTags(tier.windows.lastYear, 5)})`);
  return tier;
}

async function main() {
  console.log("Fetching rated user list (for rank-based cutoffs and sampling pools)...");
  const ratedUsers = await cfGet("user.ratedList", "activeOnly=true");
  ratedUsers.sort((a, b) => b.rating - a.rating);
  const cutoff500 = ratedUsers[Math.min(499, ratedUsers.length - 1)].rating;
  const cutoff10000 = ratedUsers[Math.min(9999, ratedUsers.length - 1)].rating;
  const medianRating = ratedUsers[Math.floor(ratedUsers.length / 2)].rating;
  console.log(`  ${ratedUsers.length} active rated users. cutoff500=${cutoff500} cutoff10000=${cutoff10000} median=${medianRating}`);

  // Rating cutoff for "top p%" at each integer percentile, so the app can estimate a user's
  // percentile without shipping the full 40k+ row rating list.
  const percentiles = {};
  for (let p = 1; p <= 99; p++) {
    const idx = Math.min(ratedUsers.length - 1, Math.floor((ratedUsers.length * p) / 100));
    percentiles[p] = ratedUsers[idx].rating;
  }

  const notTourist = (u) => u.handle.toLowerCase() !== "tourist";
  const top500Pool = ratedUsers.filter((u) => u.rating >= cutoff500 && notTourist(u));
  const top10000Pool = ratedUsers.filter((u) => u.rating >= cutoff10000 && notTourist(u));
  const averagePool = ratedUsers.filter((u) => u.rating >= medianRating - AVERAGE_BAND && u.rating <= medianRating + AVERAGE_BAND && notTourist(u));

  const top500Handles = spreadSample(top500Pool, SAMPLE_SIZE).map((u) => u.handle);
  const top10000Handles = spreadSample(top10000Pool, SAMPLE_SIZE).map((u) => u.handle);
  const averageHandles = spreadSample(averagePool, SAMPLE_SIZE).map((u) => u.handle);

  const now = Date.now();
  const yearAgo = now - YEAR_MS;

  console.log(`\nFetching tourist's submission history (named-player benchmark tier)...`);
  await sleep(REQUEST_DELAY_MS);
  const touristSolves = await fetchUserSolves("tourist");
  const touristAllTime = computeWindow(touristSolves);
  const touristLastYear = computeWindow(touristSolves.filter((p) => p.dateMs >= yearAgo));
  console.log(`  tourist: ${touristAllTime.problemCount} solves all-time, ${touristLastYear.problemCount} in the last year.`);

  const tiers = {
    tourist: {
      label: "Tourist",
      ratingCutoff: null,
      windows: { allTime: { ...touristAllTime, sampleSize: 1 }, lastYear: { ...touristLastYear, sampleSize: 1 } },
    },
  };

  console.log(`\nSampling ${SAMPLE_SIZE} real Top 500 users...`);
  tiers.top500 = await buildTierFromSample("Top 500", cutoff500, top500Handles, yearAgo);

  console.log(`\nSampling ${SAMPLE_SIZE} real Top 10,000 users...`);
  tiers.top10000 = await buildTierFromSample("Top 10,000", cutoff10000, top10000Handles, yearAgo);

  console.log(`\nSampling ${SAMPLE_SIZE} real Average-user-band users...`);
  tiers.average = await buildTierFromSample("Average user", medianRating, averageHandles, yearAgo);

  const output = {
    generatedAt: new Date(now).toISOString(),
    source: { ratedUserCount: ratedUsers.length, sampleSize: SAMPLE_SIZE },
    tiers,
    percentiles,
  };

  const fileContent = `/**
 * Static Codeforces baseline data — real solved-count and tag-mix stats
 * sampled from real players at each skill tier, used to normalize a user's
 * own solve counts and tag ratios (e.g. "you solved 100 math and 30 trees"
 * isn't "trees is weak" if math is just naturally more common; a raw solve
 * count isn't meaningful without knowing what's typical at your tier).
 *
 * Each tier's numbers are averaged across a real sample of that tier's
 * players (see tiers.<id>.windows.<window>.sampleSize) — not derived from
 * the problem set. The Tourist tier is a sample of exactly one named player.
 *
 * Generated by scripts/generate-cf-baseline.js — do not hand-edit.
 * Regenerate periodically (recommended: quarterly, or whenever Codeforces'
 * rated population shifts noticeably) — see README "Codeforces baseline
 * data" for how.
 *
 * Generated at: ${output.generatedAt}
 */
const CF_BASELINE_DATA = ${JSON.stringify(output, null, 2)};
`;

  fs.writeFileSync(OUTPUT_PATH, fileContent);
  console.log(`\nWrote ${OUTPUT_PATH}`);
}

main().catch((e) => {
  console.error("Failed to generate CF baseline data:", e.message);
  process.exit(1);
});

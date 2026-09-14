#!/usr/bin/env node
/**
 * Generates js/cf-baseline-data.js — a static snapshot of "what tags are
 * naturally common at what skill level" on Codeforces, used by the
 * Codeforces Analysis page to normalize a user's own solved-tag ratios
 * against reality (e.g. math is naturally far more common than trees, so
 * raw solve counts alone are a misleading signal of topic weakness).
 *
 * Deliberately NOT a live per-visitor computation: this fetches every rated
 * user, every contest, and every problem from the Codeforces API once, which
 * is far too heavy to do on every page load. Run this occasionally (see
 * README "Codeforces baseline data") and commit the regenerated output —
 * plain Node, no dependencies, Node >= 18 for built-in fetch.
 *
 * Usage: node scripts/generate-cf-baseline.js
 */
const fs = require("fs");
const path = require("path");

const OUTPUT_PATH = path.join(__dirname, "..", "js", "cf-baseline-data.js");
const YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const AVERAGE_BAND = 200; // +/- this many rating points around the median for the "average user" bucket

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

function computeWindow(problems) {
  const problemCount = problems.length;
  const tagCounts = {};
  for (const p of problems) {
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

function topTags(windowData, n) {
  return Object.entries(windowData.tagRatios)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([tag, ratio]) => `${tag} ${(ratio * 100).toFixed(0)}%`)
    .join(", ");
}

async function main() {
  console.log("Fetching rated user list (for rank-based cutoffs)...");
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

  await sleep(2000);
  console.log("Fetching contest list (for last-year windowing)...");
  const contests = await cfGet("contest.list", "gym=false");
  const contestStart = new Map();
  for (const c of contests) {
    if (typeof c.startTimeSeconds === "number") contestStart.set(c.id, c.startTimeSeconds * 1000);
  }
  console.log(`  ${contests.length} contests, ${contestStart.size} with a known start time.`);

  await sleep(2000);
  console.log("Fetching full problemset...");
  const { problems } = await cfGet("problemset.problems", "");
  console.log(`  ${problems.length} problems total.`);

  const now = Date.now();
  const yearAgo = now - YEAR_MS;
  const rated = problems.filter((p) => typeof p.rating === "number");
  console.log(`  ${rated.length} problems have a rating (the rest are excluded from all tiers).`);

  await sleep(2000);
  console.log("Fetching tourist's submission history (real-player benchmark tier)...");
  const touristSubs = await cfGet("user.status", "handle=tourist");
  const touristSolvedMap = new Map();
  for (const sub of touristSubs) {
    if (sub.verdict !== "OK") continue;
    const key = `${sub.problem.contestId}${sub.problem.index}`;
    if (touristSolvedMap.has(key)) continue;
    touristSolvedMap.set(key, { tags: sub.problem.tags || [], dateMs: sub.creationTimeSeconds * 1000 });
  }
  const touristSolved = [...touristSolvedMap.values()];
  const touristLastYear = touristSolved.filter((p) => p.dateMs >= yearAgo);
  console.log(`  tourist: ${touristSolved.length} distinct solves all-time, ${touristLastYear.length} in the last year.`);

  const withDate = rated.map((p) => ({
    ...p,
    startMs: p.contestId !== undefined ? contestStart.get(p.contestId) : undefined,
  }));
  const undated = withDate.filter((p) => p.startMs === undefined).length;
  if (undated) console.log(`  ${undated} rated problems have no resolvable contest date — counted in "all time" only.`);

  const tierDefs = {
    top500: { label: "Top 500", ratingCutoff: cutoff500, filter: (p) => p.rating >= cutoff500 },
    top10000: { label: "Top 10,000", ratingCutoff: cutoff10000, filter: (p) => p.rating >= cutoff10000 },
    average: {
      label: "Average user",
      ratingCutoff: medianRating,
      filter: (p) => p.rating >= medianRating - AVERAGE_BAND && p.rating <= medianRating + AVERAGE_BAND,
    },
  };

  const tiers = {
    tourist: {
      label: "Tourist",
      ratingCutoff: null,
      windows: {
        allTime: computeWindow(touristSolved),
        lastYear: computeWindow(touristLastYear),
      },
    },
  };
  console.log(`  [Tourist] all-time: ${touristSolved.length} solves (${topTags(tiers.tourist.windows.allTime, 5)})`);
  console.log(`  [Tourist] last-year: ${touristLastYear.length} solves (${topTags(tiers.tourist.windows.lastYear, 5)})`);

  for (const [id, def] of Object.entries(tierDefs)) {
    const bucket = withDate.filter(def.filter);
    const lastYear = bucket.filter((p) => p.startMs !== undefined && p.startMs >= yearAgo);
    tiers[id] = {
      label: def.label,
      ratingCutoff: def.ratingCutoff,
      windows: {
        allTime: computeWindow(bucket),
        lastYear: computeWindow(lastYear),
      },
    };
    console.log(`  [${def.label}] all-time: ${bucket.length} problems (${topTags(tiers[id].windows.allTime, 5)})`);
    console.log(`  [${def.label}] last-year: ${lastYear.length} problems (${topTags(tiers[id].windows.lastYear, 5)})`);
  }

  const output = {
    generatedAt: new Date(now).toISOString(),
    source: { problemCount: rated.length, ratedUserCount: ratedUsers.length, contestCount: contests.length },
    tiers,
    percentiles,
  };

  const fileContent = `/**
 * Static Codeforces baseline data — what tag ratios are naturally common at
 * different skill tiers, used to normalize a user's own solved-tag ratios
 * (e.g. "you solved 100 math and 30 trees" is not "trees is weak" if math is
 * just naturally far more common at your rating level).
 *
 * Generated by scripts/generate-cf-baseline.js — do not hand-edit.
 * Regenerate periodically (recommended: quarterly, or whenever Codeforces'
 * problem count / rated population shifts noticeably) — see README
 * "Codeforces baseline data" for how.
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

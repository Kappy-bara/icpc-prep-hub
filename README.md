# ICPC Prep Hub

A free, open-source, **entirely client-side** companion for ICPC prep — regionals
through World Finals. No backend, no build step, no account. Clone it, open
`index.html`, or deploy it to GitHub Pages for free, and it just works.

Everything is stored in your browser's `localStorage`. Nothing you do in this
app is sent anywhere, except the Codeforces sync request you trigger
yourself, which goes straight from your browser to the public Codeforces API.

## Features

- **Multi-subject roadmap** — Math & Number Theory, Data Structures, Graphs,
  Dynamic Programming, Strings, Greedy & Sorting, Geometry, and Contest
  Meta-Skills, each split into Foundations → Core → Advanced. Every topic has
  a one-line "why it matters" note and a link to a real reference
  ([cp-algorithms.com](https://cp-algorithms.com), [usaco.guide](https://usaco.guide),
  [cses.fi](https://cses.fi), Codeforces EDU, the ICPC World Finals archive).
  Checkbox state persists locally.
- **Smart timeline** — set an optional target contest date and get a
  countdown plus a pacing plan that proportionally allocates remaining time
  across the roadmap's phases, with an ahead/behind indicator based on your
  actual checklist progress. No target date set? You get a sensible
  relative estimate instead of a hardcoded week-by-week table.
- **Gamification** — points for problems you solve (`round(rating / 100)`,
  flat 5 for unrated, ×1.5 for problems tagged with one of your focus areas,
  minimum 1 point). Problems solved *before* your gamification start date are
  logged for stats but score 0 points, so importing your whole CF history
  doesn't hand you a windfall. A user-editable reward catalog lets you spend
  points on things you define.
- **Codeforces sync** — enter your handle once and sync your solved
  problems directly from the CF API. If the live fetch fails (CORS, network,
  rate limiting), there's always a manual fallback: a link to open the same
  API URL yourself, and a textarea to paste the JSON back in. A quick manual
  "log one solve" form covers one-off additions.
- **Reports** — stats split cleanly into "since your gamification start
  date" (active, scoring) vs. "before it" (historical, imported, non-scoring)
  — never blended. Today/last-7-days summaries, plus a rating-bucket and
  top-tags breakdown for whichever period you're looking at.
- **Backup & restore** — export your entire local dataset as JSON, and
  import it back — on this browser or a different one.
- **Polish** — responsive down to ~400px, respects `prefers-color-scheme`
  with a manual light/dark/auto toggle, card-based layout.

## Running locally

No build step, no dependencies. Any static file server works:

```bash
git clone https://github.com/<your-username>/icpc-prep-hub.git
cd icpc-prep-hub
python -m http.server 8080
```

Then open `http://localhost:8080`. (Opening `index.html` directly via
`file://` also mostly works, but a local server avoids occasional
browser restrictions and is recommended.)

## Deploying to GitHub Pages

This repo ships a GitHub Actions workflow
([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)) that
deploys the site to GitHub Pages on every push to `main`. To enable it on
your own fork/copy:

1. Push the repo to GitHub.
2. In the repo's **Settings → Pages**, set **Source** to **GitHub Actions**.
3. Push to `main` (or re-run the workflow from the **Actions** tab).

Your site will be live at `https://<your-username>.github.io/icpc-prep-hub/`.

Prefer plain branch-based Pages instead? Delete the workflow file, set
**Settings → Pages → Source** to **Deploy from a branch**, and pick `main` /
`(root)`. There's no build step either way — it's static files.

## Contributing

Contributions are welcome — this is meant to be a community-maintained
resource, not a one-person project.

- The roadmap content lives in [`js/roadmap-data.js`](js/roadmap-data.js) as
  plain data (subjects → phases → topics). Fixing a stale link, tightening a
  "why it matters" note, or adding a missing topic is a small, easy PR.
  Please keep resource links pointed at real, freely-accessible pages
  (cp-algorithms.com, usaco.guide, cses.fi, Codeforces EDU, the ICPC World
  Finals archive, or similarly well-established references).
- App logic is split by concern into small, dependency-free modules under
  `js/` (`storage.js`, `roadmap.js`, `timeline.js`, `gamification.js`,
  `cf-sync.js`, `reports.js`, `theme.js`, `app.js`) — no build step, no
  bundler, no framework. Keep it that way; it's what makes this project
  approachable to clone and hack on.
- See [`TODO.md`](TODO.md) for planned features that are deliberately out of
  scope for now, including a Codeforces-driven team role-split suggestion
  feature (see below) — good first issues if you want to pick one up.
- Open a PR or an issue. No formal process beyond that.

### Note on the team-roles feature

An earlier single-file prototype of this app had a hardcoded 3-person "team
roles" card. That's intentionally *not* in this version — hardcoding people's
names and roles doesn't generalize to anyone else who clones this repo. The
planned real version (tracked in [`TODO.md`](TODO.md)) lets you add multiple
teammates' Codeforces handles, fetches each one's solved-problem tag
distribution, and suggests a role split (math/reasoning lead,
data-structures/greedy lead, implementation lead) based on where each
person's solves actually cluster. It's left as a future contribution rather
than rushed in.

## License

[MIT](LICENSE).

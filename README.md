# ICPC Prep Hub

A free, open-source companion for ICPC prep — regionals through World Finals.
No build step, works fully offline in local-only mode, and deploys to GitHub
Pages for free. Clone it, open `index.html`, and it just works.

The site is a handful of plain static pages behind a shared nav — Home,
Dashboard, Codeforces, Roadmap, and Self-rule — not a single long scroll. See
[Pages](#pages) below.

By default everything is stored in your browser's `localStorage` and nothing
is sent anywhere except the Codeforces sync request you trigger yourself. An
optional account layer (backed by [Supabase](https://supabase.com)) lets you
sign in with a magic link to sync your data across devices instead — see
[Cloud sync setup](#cloud-sync-setup-optional) below. It's entirely opt-in;
skip that section and the app is 100% local-only and backend-free.

## Features

- **Multi-subject roadmap** — 99 topics across 8 subjects (Math & Number
  Theory, Data Structures, Graphs, Dynamic Programming, Strings, Greedy &
  Sorting, Geometry, and Contest Meta-Skills), each split into
  Foundations → Core → Advanced and curated against established
  difficulty-ordered CP curricula (USACO Guide's own Bronze→Platinum
  progression, cp-algorithms) so the jump between phases stays gradual
  instead of leaping straight to World-Finals-tier material. Every topic has
  a one-line "why it matters" note and a link to a real reference
  ([cp-algorithms.com](https://cp-algorithms.com), [usaco.guide](https://usaco.guide),
  [cses.fi](https://cses.fi), Codeforces EDU, the ICPC World Finals archive).
  The page itself is a two-pane picker — subjects with a progress bar down
  the left, the selected subject's full checklist on the right — instead of
  one long accordion. Checkbox state persists locally.
- **Smart timeline** — set an optional target contest date and get a
  countdown plus a pacing plan that proportionally allocates remaining time
  across the roadmap's phases, with an ahead/behind indicator based on your
  actual checklist progress. No target date set? You get a sensible
  relative estimate instead of a hardcoded week-by-week table.
- **Gamification** — points for problems you solve (`round(rating / 100) - 5`
  for rated problems — 3 points at Codeforces' lowest rating, 800, 4 at 900,
  and so on — flat 5 for unrated, ×1.5 for one focus tag you pick from
  Codeforces' own tag list). Problems solved *before* your gamification
  start date are logged for stats but score 0 points, so importing your
  whole CF history doesn't hand you a windfall; that start date defaults to
  the day you verify your Codeforces handle, and a target contest date
  defaults to a sensible placeholder — both editable on the Dashboard.
  - **Streaks** — a day counts if it has at least one points-earning solve
    (so it naturally starts counting from your gamification start date with
    no separate cutoff). Shown on both the Dashboard and Self-rule; if
    today's still open it prompts *"Solve 1 Codeforces problem today to
    maintain the streak."*
  - **Streak bonus** — the first points-earning solve of each day adds a
    bonus equal to your incoming streak length, capped at +10, so staying
    consistent is worth more than cramming.
  - **Rewards** — a user-editable catalog you spend points on; the 3 starter
    rewards ship locked (can't be deleted, only redeemed) so there's always
    something to spend on, while anything you add yourself is fully
    removable.
  - **Points overview & activity** — current balance, lifetime earned,
    rewards redeemed, and progress toward the cheapest reward you can't
    afford yet, plus a daily/weekly/monthly earned-vs-spent breakdown and a
    cumulative "spent by reward" tally.
- **Codeforces sync** — enter your handle once and sync your solved
  problems directly from the CF API. If the live fetch fails (CORS, network,
  rate limiting), there's always a manual fallback: a link to open the same
  API URL yourself, and a textarea to paste the JSON back in. A quick manual
  "log one solve" form covers one-off additions. The same sync also derives
  (at zero extra API cost) how many wrong attempts preceded each of your ACs
  and which problems you've attempted but never solved, plus a rating
  trajectory from one extra cheap call.
- **Codeforces Analysis** — normalizes your solved-tag ratios against what's
  *naturally* common on Codeforces, so raw counts aren't misread ("you
  solved 100 math and 30 trees" isn't "trees is weak" if math is just far
  more common at your rating level). Compares you against three tiers (Top
  500 / Top 10,000 / Average user, using real, current rating cutoffs), each
  toggleable between the last year and all-time. See
  [Codeforces baseline data](#codeforces-baseline-data) for how the baseline
  numbers are generated. Also on this page:
  - **Accuracy per tag** — average wrong attempts before AC, by tag.
  - **Rating trajectory** — a chart of your rating across contests, plus
    your live percentile among active rated Codeforces users.
  - **Solve activity** — a GitHub-style heatmap of your solving consistency
    over the last year.
  - **Unsolved/attempted** — problems you've tried but not solved, as
    ready-made practice targets.
  - **Next problem recommendations** — unsolved problems in your weak tags,
    just above a target rating blended from your current CF rating *and*
    the typical rating of what you've actually been solving lately (these
    can diverge — a rusty high-rated account, or someone actively
    upskilling past their old rating).
- **Reports** — stats split cleanly into "since your gamification start
  date" (active, scoring) vs. "before it" (historical, imported, non-scoring)
  — never blended. Today/last-7-days summaries, plus a rating-bucket and
  top-tags breakdown for whichever period you're looking at.
- **Backup & restore** — export your entire local dataset as JSON, and
  import it back — on this browser or a different one.
- **Optional cloud sync** — sign in with a passwordless magic link to sync
  your roadmap, points, and logs across devices. Prove you own a Codeforces
  handle with a one-time verification (submit a compile-error solution to a
  specific problem within a time window — the standard trick, since
  Codeforces has no OAuth) before it's linked to your account. Entirely
  optional; local-only mode needs none of this.
- **Polish** — responsive down to ~400px, respects `prefers-color-scheme`
  with a manual light/dark/auto toggle, and a wide multi-column dashboard
  layout (side-by-side cards, a subject grid, a two-pane picker) rather than
  one long single-column scroll of stacked cards.

## Pages

| Page | What's there |
|---|---|
| `index.html` (Home) | A small progress teaser and links into the rest of the app |
| `dashboard.html` | Account & Cloud Sync, Profile, Timeline, your Streak, a compact roadmap-progress summary, your 5 most recent solves, Backup & Restore |
| `codeforces.html` | Sync, your full solved log, Reports, and the Codeforces Analysis card |
| `roadmap.html` | The full 99-topic, 8-subject checklist, as a subject picker + detail pane |
| `self-rule.html` | Points overview & streak, a daily/weekly/monthly activity breakdown, the points-formula explainer, the reward catalog, and redemption history |

A shared header/nav (`js/nav.js`) and a shared bootstrap (`js/shell.js`, which
owns theme init and the auth-session → data hydration flow) run on every page,
so sign-in state, theme, and your data are consistent no matter which page you
land on first.

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

## Cloud sync setup (optional)

Skip this entirely if you're happy with local-only mode — the app works
fully without it. To enable sign-in and cross-device sync:

1. Create a free project at [supabase.com](https://supabase.com).
2. Apply the schema in [`supabase/migrations/`](supabase/migrations). Two
   ways to do this — pick one:
   - **Supabase CLI (recommended, especially if you'll add more tables/functions
     later):**
     ```bash
     npx supabase login
     npx supabase link --project-ref <your-project-ref>   # found in your project's URL/Settings
     npx supabase db push
     ```
     From then on, every future schema change is just a new file in
     `supabase/migrations/` plus `npx supabase db push` again — no CLI
     install needed, `npx` fetches it on demand.
   - **Manual:** open the SQL editor (left sidebar) and paste/run the
     contents of the one file currently in `supabase/migrations/`.
   Either way, this creates one table (`profiles`) with row-level security
   so each user can only ever read or write their own row.
3. In **Project Settings → API**, copy the **Project URL** and **anon
   public** key into [`js/config.js`](js/config.js).
4. In **Authentication → URL Configuration**, add every URL you'll run the
   app from to **Redirect URLs** — e.g. `http://localhost:8080` for local
   dev and `https://<your-username>.github.io/icpc-prep-hub/` for
   production. Magic-link emails won't redirect back correctly without this.
5. Commit `js/config.js` (or fill it in on your deployment) and reload the
   app — the Account card will show a sign-in form instead of the "not
   configured" message.

The `anon` key is Supabase's public client key, meant to be shipped in
frontend code — it's not a secret, and it's safe to commit. Your data's
protection comes entirely from the row-level security policies defined in
the migrations (each signed-in user can only touch their own row), not from
keeping this key hidden.

### Growing the backend later

`supabase/` is a real [Supabase CLI](https://supabase.com/docs/guides/local-development)
project, not just a one-off SQL file:

- **New tables / schema changes** → add a new file to
  `supabase/migrations/` (e.g. `npx supabase migration new <name>` to
  scaffold one with the right timestamped filename), then
  `npx supabase db push`. Keep old migration files — they're the history of
  how the schema got here, not something to edit after the fact.
- **Server-side logic** (e.g. a scheduled job, or moving Codeforces-handle
  verification server-side — see Known limitations below) → Edge Functions,
  via `npx supabase functions new <name>`, which creates
  `supabase/functions/<name>/index.ts`. Deploy with
  `npx supabase functions deploy <name>`.
- **Actual secrets** used *inside* a function (a service-role key, a
  third-party API key) → `npx supabase secrets set KEY=value` for the
  deployed function, and a local `supabase/functions/.env` for testing with
  `supabase functions serve` — that `.env` file is gitignored
  (`supabase/.gitignore`) and must never be committed. This is different
  from the anon key in `js/config.js`, which is meant to be public.

This isn't hypothetical — `supabase/functions/sync-cf-baseline` (see
[Codeforces baseline data](#codeforces-baseline-data) below) is exactly this
pattern in real use: a migration added its tables, and it's a real deployed
Edge Function, not just a template. Adding the next table or function is
"write a migration / function file and push," not "improvise in the SQL
editor with no history of what changed."

**Known limitations**, honestly stated rather than hidden:

- Codeforces-handle verification is enforced client-side (there's no server
  function double-checking it), because this app has no multi-user-visible
  features (no leaderboards, no public profiles) — verifying against
  yourself only, the stakes of bypassing your own app's UX gate are nil. If
  a future feature ever shows one user's data to another, that verification
  needs to move server-side (a Supabase Edge Function) before it can be
  trusted for that purpose.
- Syncing itself never requires a verified handle — Codeforces solve history
  is public data, so there's nothing to gate. You can point the app at any
  handle (including someone else's) and it'll happily sync and score it.
  Verification only exists so *you* can tell, at a glance, whether the
  handle currently configured has actually been proven to be yours — a
  clear badge on both the Dashboard's Profile card and the Codeforces page
  shows unverified handles rather than silently treating them the same as
  a verified one.
- Cross-device sync is last-write-wins on the whole data blob, not merged —
  don't actively edit on two devices at the same moment.
- There's no in-app account deletion flow yet; delete a user from the
  Supabase dashboard's Authentication tab if needed (their `profiles` row is
  removed automatically via `on delete cascade`).

## Codeforces baseline data

The Codeforces Analysis page compares your solve count and tag mix against
four tiers: **Tourist** (one specific named player), **Top 500**, **Top
10,000**, and **Average user** (a rating band). This is **not** derived from
the problem set — an earlier version bucketed *problems* by rating as a
proxy for "what a typical player at this tier solves," which produced
numbers that got misread as real solve counts (a "baseline pool" of 1,662
problems is not "the average user solves 1,662 problems"). Every tier's
numbers now come from real players: a large sample (500 by default) of real
rated users whose *current rating* falls in that band gets its solve
history fetched and averaged — both the overall solved count and the tag
mix. Tourist is the same technique with a sample size of exactly one, by
name.

**This requires cloud sync to be configured** (see [Cloud sync
setup](#cloud-sync-setup-optional) above) — there's no local-only fallback
for this specific feature, since the data genuinely can't be computed
client-side. Every other feature on the Codeforces page (accuracy per tag,
rating trajectory, solve activity, unsolved list, next-problem
recommendations) still works fully in local-only mode; only the "your tag
mix vs. the baseline" comparison itself needs an account.

### How it's computed: a daily background job, not a one-off script

Sampling 500 real users × 3 tiers means ~1,500 Codeforces API calls, and
Codeforces asks for no more than ~1 request/2s — that's a lot of sequential
waiting, far more than a single Supabase Edge Function invocation is allowed
to run (150s wall-clock time on the free tier, 400s on paid). So this isn't
a script you run once — it's [`supabase/functions/sync-cf-baseline`](supabase/functions/sync-cf-baseline),
an Edge Function that a `pg_cron` job invokes every few minutes. Each
invocation does one small batch (~40 users, well under the time limit) and
saves its progress to a `cf_baseline_sync_state` table; the next invocation
picks up where the last one left off. A full daily cycle (refresh rating
cutoffs/percentiles + Tourist, then Top 500, then Top 10,000, then Average
user) takes roughly 2 hours of these short invocations, then the job goes
idle until the next day. The app reads the finished result from a
`cf_baseline_data` table (public read, write-only via the service role) —
never the in-progress state.

### Deploying it

1. Push the schema (adds `cf_baseline_data`, `cf_percentiles`,
   `cf_baseline_sync_state` — included in
   [`supabase/migrations/`](supabase/migrations)):
   ```bash
   npx supabase db push
   ```
2. Deploy the Edge Function:
   ```bash
   npx supabase functions deploy sync-cf-baseline
   ```
   (`supabase/config.toml` already sets `verify_jwt = false` for it — it's
   invoked only by your own cron job below, never by a browser, so there's
   no user session to verify.)
3. Schedule it to run every 3 minutes, in the SQL editor (or via
   `npx supabase db push` if you add this as a migration yourself):
   ```sql
   create extension if not exists pg_cron with schema extensions;
   create extension if not exists pg_net with schema extensions;

   select cron.schedule(
     'sync-cf-baseline-every-3-min',
     '*/3 * * * *',
     $$
     select net.http_post(
       url := 'https://<your-project-ref>.supabase.co/functions/v1/sync-cf-baseline',
       headers := '{"Content-Type": "application/json"}'::jsonb,
       body := '{}'::jsonb
     );
     $$
   );
   ```
   Replace `<your-project-ref>` with your actual project ref (from your
   project URL / Settings → General).
4. Trigger it once manually to confirm it works before waiting on cron —
   either `npx supabase functions invoke sync-cf-baseline`, or open
   `https://<your-project-ref>.supabase.co/functions/v1/sync-cf-baseline` in
   a browser. Check the response (`{"status": "started new cycle", ...}`)
   and the `cf_baseline_data` table in the Table Editor — invoke it a
   handful more times manually (each call processes one more batch) if you
   don't want to wait for cron to advance it, or just let cron take over
   from here.

Sanity-check once a full cycle completes: the `avgSolvedCount`-equivalent
number in each tier's `windows.allTime` should increase monotonically —
Average user < Top 10,000 < Top 500 < Tourist. If it doesn't, something's
wrong with the sampling.

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
  `js/` — no build step, no bundler, no homegrown framework (Supabase's
  client SDK, loaded from its CDN build, is the one exception):
  - Cross-cutting, loaded on every page: `storage.js`, `dom-utils.js`,
    `theme.js`, `auth.js`, `supabase-client.js`, `config.js`, `nav.js`,
    `shell.js` (the shared bootstrap).
  - Feature modules, loaded only where needed: `roadmap.js` (+
    `roadmap-data.js`), `timeline.js`, `gamification.js`, `cf-sync.js`,
    `cf-verify.js`, `cf-baseline.js` (fetches synced data from Supabase —
    see [Codeforces baseline data](#codeforces-baseline-data)),
    `cf-recommend.js`, `cf-analysis.js`, `reports.js`, `solved-log-ui.js`,
    `rewards-ui.js`.
  - `js/pages/*.js` — one thin file per page (`home.js`, `dashboard.js`,
    `codeforces.js`, `roadmap.js`, `self-rule.js`) wiring that page's forms
    and handlers.
  - `supabase/functions/sync-cf-baseline` — the one piece of actual
    server-side code in this project (a Deno Edge Function, cron-triggered;
    see [Codeforces baseline data](#codeforces-baseline-data)). Everything
    else genuinely runs client-side.
  Keep it that way; it's what makes this project approachable to clone and
  hack on.
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

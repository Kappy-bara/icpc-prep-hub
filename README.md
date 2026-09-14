# ICPC Prep Hub

A free, open-source companion for ICPC prep — regionals through World Finals.
No build step, works fully offline in local-only mode, and deploys to GitHub
Pages for free. Clone it, open `index.html`, and it just works.

By default everything is stored in your browser's `localStorage` and nothing
is sent anywhere except the Codeforces sync request you trigger yourself. An
optional account layer (backed by [Supabase](https://supabase.com)) lets you
sign in with a magic link to sync your data across devices instead — see
[Cloud sync setup](#cloud-sync-setup-optional) below. It's entirely opt-in;
skip that section and the app is 100% local-only and backend-free.

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
- **Optional cloud sync** — sign in with a passwordless magic link to sync
  your roadmap, points, and logs across devices. Prove you own a Codeforces
  handle with a one-time verification (submit a compile-error solution to a
  specific problem within a time window — the standard trick, since
  Codeforces has no OAuth) before it's linked to your account. Entirely
  optional; local-only mode needs none of this.
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

None of this is needed for the app as it stands today — it's here so that
adding a table or a function later is "write a migration / function file
and push," not "improvise in the SQL editor with no history of what
changed."

**Known limitations**, honestly stated rather than hidden:

- Codeforces-handle verification is enforced client-side (there's no server
  function double-checking it), because this app has no multi-user-visible
  features (no leaderboards, no public profiles) — verifying against
  yourself only, the stakes of bypassing your own app's UX gate are nil. If
  a future feature ever shows one user's data to another, that verification
  needs to move server-side (a Supabase Edge Function) before it can be
  trusted for that purpose.
- Cross-device sync is last-write-wins on the whole data blob, not merged —
  don't actively edit on two devices at the same moment.
- There's no in-app account deletion flow yet; delete a user from the
  Supabase dashboard's Authentication tab if needed (their `profiles` row is
  removed automatically via `on delete cascade`).

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
  `cf-sync.js`, `cf-verify.js`, `reports.js`, `theme.js`, `auth.js`,
  `supabase-client.js`, `app.js`) — no build step, no bundler, no
  homegrown framework (Supabase's client SDK, loaded from its CDN build, is
  the one exception). Keep it that way; it's what makes this project
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

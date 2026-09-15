# Planned features

Ideas that are deliberately out of scope for the current version, tracked here
(and/or as GitHub issues) rather than built half-finished.

## Team role-split suggestions

The original prototype had a hardcoded 3-person "team roles" card. That's
gone — it was never going to generalize. The real version of this feature:

- Let a user add multiple Codeforces handles (their teammates).
- Fetch each handle's solved-problem history and compute a tag distribution
  per person (e.g. via `user.status`, same endpoint this app already uses).
- Cluster/compare the distributions and suggest a role split, e.g.:
  - **Math/reasoning lead** — heavy on `math`, `number theory`, `combinatorics`,
    `probabilities`, `games`.
  - **Data structures/greedy lead** — heavy on `data structures`, `greedy`,
    `binary search`, `two pointers`, `sortings`.
  - **Implementation lead** — heavy on `implementation`, `brute force`,
    `strings`, `geometry`.
- Surface it as a "Team" card that's entirely optional and only appears once
  more than one handle is configured — no hardcoded names, roles, or people.

This needs some real thought about clustering (simple tag-frequency scoring
vs. something smarter) and about rate-limiting multiple CF API calls
client-side, which is why it's being tracked instead of rushed in.

## Cloud sync hardening

Account sign-in + Supabase sync (see [README § Cloud sync
setup](README.md#cloud-sync-setup-optional)) is in, but a few things are
deliberately left for later rather than over-built now:

- Codeforces-handle verification is currently enforced client-side only —
  fine while every user only ever sees their own data (no leaderboards, no
  public profiles), but it would need to move into a server-side Supabase
  Edge Function before any feature shows one user's claimed handle to
  another (e.g. the team-roles feature below, if it ever gains a
  shared/visible view).
- Multi-device sync is last-write-wins on the whole data blob — no
  merge/conflict resolution if you edit on two devices at once.
- No in-app account deletion flow (delete the user from the Supabase
  dashboard directly; their data is removed via `on delete cascade`).
- No password-based login option — magic link only, by design (simpler,
  fewer footguns), but worth an issue if there's demand for it.

## Codeforces baseline sync hardening

The baseline data (see [README § Codeforces baseline
data](README.md#codeforces-baseline-data)) is now a real daily background
job — `supabase/functions/sync-cf-baseline`, cron-triggered every few
minutes, sampling 1,500 real users per tier — not a manually-regenerated
static file. A few things are deliberately left for later rather than
over-built now:

- No monitoring/alerting if the cron job silently stops advancing (e.g. CF
  changes their API shape, or the function starts erroring every
  invocation) — you'd only notice by seeing `cf_baseline_data.updated_at`
  go stale. Worth a scheduled check that alerts if it hasn't updated in,
  say, 36 hours.
- Failed per-user fetches within a batch are silently skipped (logged, not
  retried) — if Codeforces has a bad moment during a run, that batch's
  sample is just slightly smaller, not wrong, but there's no backfill.
- The sampling pool is rebuilt from a fresh `user.ratedList` call at every
  phase transition (4 times per cycle) rather than cached once — simple and
  self-correcting, but slightly wasteful.
- This is also the natural place to build the real top-CF-users leaderboard
  idea (see Team role-split suggestions above) if that's ever picked up,
  since it needs the same kind of scheduled server-side job.

## Other ideas

- Contest-type breakdown (Div1/Div2/Div3/Educational/Global performance
  shown separately) — some people do well in practice but underperform live,
  or vice versa.
- 1:1 rival comparison — pick a friend's handle and see tag/rating profiles
  side by side; a lighter, immediate version of the team-roles idea above.
- Rating milestone projection — a rough trend-line extrapolation, clearly
  caveated as a rough estimate, not a guarantee.
- PWA/offline support (service worker + manifest) so the app installs and
  works without a network connection at all.
- Per-subject custom pacing weights (e.g. let the user say "I already know
  most of Math, weight it lower") instead of pure topic-count proportionality.
- Configurable point-formula constants (base divisor, focus multiplier,
  minimum) via the profile card instead of fixed constants in code.
- Solve-velocity-aware fallback timeline estimate (use actual recent pace
  instead of the fixed default-topics/week assumption) once checklist changes
  are timestamped.
- Optional CSV export of the solved log for spreadsheet users.

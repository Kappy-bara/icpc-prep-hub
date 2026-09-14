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

## Other ideas

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

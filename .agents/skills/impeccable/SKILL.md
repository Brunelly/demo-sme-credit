---
name: impeccable
description: Design rules for this app's screens and the detector that catches AI-default UI ("slop"). Read before building, polishing, auditing or hardening a screen, and whenever `npm run check:design` or the pipeline's rendered scan reports a finding.
---

# Impeccable, as used in this repository

This file was written for this repository; it is not Impeccable's own `SKILL.md` (see `README.md`). Every file in
`reference/` is Impeccable's, unchanged, from version 4.8.0.

This app is an **Operate** surface: people come to get a job done (tables, dashboards, forms, an assistant). Ambition
shows as precision and restraint, familiar patterns earn their place, and the brand lives in the tokens and the
details.

## Read before you change a screen

1. [`reference/craft-floor.md`](reference/craft-floor.md): the quality floor and the bans. Read it immediately
   before any UI edit, however small.
2. [`reference/operate.md`](reference/operate.md): depth for app UI (type, colour, layout, components).

Then, as the work needs:

| When | Read |
|---|---|
| a screen is built and needs its final pass | [`reference/polish.md`](reference/polish.md) |
| accessibility, responsive behaviour, theming, performance | [`reference/audit.md`](reference/audit.md) |
| errors, loading, long or missing text, edge cases | [`reference/harden.md`](reference/harden.md) |
| empty states and first-run screens | [`reference/onboard.md`](reference/onboard.md) |
| type hierarchy | [`reference/typeset.md`](reference/typeset.md) |
| spacing and rhythm | [`reference/layout.md`](reference/layout.md) |
| colour | [`reference/colorize.md`](reference/colorize.md) |
| phone and other sizes | [`reference/adapt.md`](reference/adapt.md) |
| labels, buttons, error messages | [`reference/clarify.md`](reference/clarify.md) |

## The detector

- `npm run check:design` scans the UI source (`apps/web/src`, `packages/ui/src`) with the pinned `impeccable`
  devDependency, offline. `npm test` runs it, and it must stay clean.
- Source scans see patterns only. The pipeline also renders every route in `poc.json` `ui.routes` at each declared
  viewport and scans the rendered page, which catches contrast, tiny text and overflow. A finding there is fixed
  like a failing test.
- One rule family: `npx impeccable detect --json --scope type apps/web/src` (or `--scope layout`). Every rule:
  `npx impeccable detect --list-rules`.
- **Fix the design, never the detector.** No `impeccable-disable` comments and no ignores in `.impeccable/config.json`
  to get green. The one exception is a value the brand mandates, such as the brand font:
  `npx impeccable ignores add-value overused-font "<Font>" --reason "Brand font"`.

## What the references mention but this repository doesn't have

- **No launcher.** Where a reference says `.agents/skills/impeccable/scripts/impeccable detect …`, run
  `npx impeccable detect …`. Its other verbs (`context`, `critique-storage`, `pin`, …) aren't available: skip them.
- `$impeccable <command>` hand-offs mean "read that command's reference" when it is in `reference/`; otherwise carry on.
- **No PRODUCT.md or DESIGN.md.** The product context is the story, the project's documents (`doc-search`,
  `doc-get`), `AGENTS.md`, and `packages/ui` with its tokens.
- **Never live mode.** Never run `impeccable live` (it is not vendored, and its Apply step runs a coding agent with
  its sandbox switched off); `IMPECCABLE_LIVE_COPY_AGENT` stays `off`.

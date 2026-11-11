# impeccable

A pinned, offline subset of Impeccable's design guidance, plus how its detector runs here.

| | |
|---|---|
| Source | https://github.com/pbakaus/impeccable |
| Version | skill 4.8.0, engine 0.1.18, commit `83dc1bbe4c37636632e72a7752e9cc433e9a9901` (2026-11-05) |
| Licence | Apache-2.0, in `LICENSE`; upstream's third-party notice in `NOTICE` |
| Files from upstream | `reference/*.md`, unchanged, from the repository's generated `.agents/skills/impeccable/reference/` |
| Written for this repository | this `README.md` and `SKILL.md` (Impeccable's own SKILL.md is not vendored: it drives a launcher this repository doesn't ship) |

## Included

`craft-floor`, `operate`, `polish`, `audit`, `harden`, `onboard`, `typeset`, `layout`, `colorize`, `adapt` and
`clarify`: the floor and the references for building and finishing app screens.

## Left out, and why

- **Live mode** (`live.md`, `live-setup.md`, `generate.md`, `live-browser*.js`, `modern-screenshot.umd.js`): it injects
  an overlay into a running dev server, and its Apply step runs a coding agent with approvals and the sandbox
  switched off. Never used here; `IMPECCABLE_LIVE_COPY_AGENT` stays `off`.
- **The launcher and engine downloads** (`scripts/impeccable`, `scripts/impeccable.cmd`, `engine-checksums.txt`):
  the detector comes from the npm package instead (below), so nothing downloads at run time.
- **Hooks, plugins and sub-agents** (`hooks.md`, the Hermes plugin, `agents/`): the pipeline runs the detector
  itself; nothing here edits a harness's settings.
- **Product and design-system setup** (`init`, `document`, `extract`, `shape`, `new-work`, `doctor`, `routing`,
  `mode-*`, `region-map`, `component-review`) and **expressive commands** (`bolder`, `quieter`, `distill`, `delight`,
  `animate`, `overdrive`, `optimize`, `critique`, `craft`, `visualize`): they need PRODUCT.md/DESIGN.md and the
  launcher, or they serve marketing surfaces rather than app UI.
- **Native-platform references** (`ios.md`, `android.md`, `*.native.md`): this is a web app. The mobile template
  carries them.

## The detector

`impeccable` is a devDependency pinned at exactly `4.8.0`. Its optional dependencies install the engine binary for
the platform (`@impeccable/cli-<os>-<arch>@0.1.18`, recorded for every platform in `package-lock.json`; the
linux-x64 binary's SHA-256 is `736ed785e74ae2344d3036127f614ddde5ab520a527d8bc82a891612ef71f648`, the digest
upstream's `engine-checksums.txt` records). The npm shim runs that installed binary first, so after `npm ci` the
detector works offline.

- `npm run check:design`: `impeccable detect apps/web/src packages/ui/src`, part of `npm test`. Exit 0 is clean,
  2 means findings, 1 means a target could not be scanned.
- Rendered pages: `npx impeccable detect --json --viewport 390x844 http://localhost:3000/` scans a running app in an
  installed Chromium (`IMPECCABLE_BROWSER` names one). The pipeline does this for every `poc.json` `ui.routes` entry.
- Telemetry is off: `.impeccable/config.json` sets `"telemetry": false` (and `"updateCheck": false`). `detect` makes
  no network requests in any case; telemetry and update checks belong to verbs not used here.

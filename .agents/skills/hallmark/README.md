# hallmark

Hallmark's floor and its no-invented-facts rule, for app screens.

| | |
|---|---|
| Source | https://github.com/Nutlope/hallmark, path `skills/hallmark/` |
| Version | 2.0.0, commit `de4999e0cd7a7a41df0b4e6903fa02fe9f1492a8` (2026-11-04) |
| Licence | MIT, in `LICENSE` (Copyright (c) 2026 Hallmark contributors) |
| Files from upstream | `references/gates.md`, `brand-truth.md`, `interaction-and-states.md`, `responsive.md` and `data-viz.md`, unchanged |
| Written for this repository | this `README.md` and `SKILL.md` (Hallmark's own SKILL.md is a whole-page build workflow and is not vendored) |

## Left out, and why

- **Hallmark's `SKILL.md` and the page-building workflow** (themes, the theme deal, anatomy, macrostructures, genres,
  direction, redesign, review prompts): Hallmark builds self-contained marketing pages; this app is product UI built
  from `packages/ui`.
- **Scripts** (`sloplint.mjs`, `capture.mjs`, `theme.mjs`, the installers and hooks): not run here. The pipeline's
  rendered checks (the Impeccable detector, a horizontal-overflow check at phone width, and a scan for
  metric- and testimonial-shaped claims modelled on gate 46a) stand in for the floor's mechanical half.
- **The photo library and imagery references** (`photos.json`, `imagery.md`, `picture.mjs`): no stock photography in a
  bid demo; images come from the project or the prospect.

# frontend-design

Anthropic's `frontend-design` skill: how to make deliberate visual choices (palette, type, layout, copy) instead of
the templated defaults generated UIs drift into.

| | |
|---|---|
| Source | https://github.com/anthropics/skills, path `skills/frontend-design/` |
| Version | commit `ca45fc496a3436251f191354091d557da31c15b5` (2026-10-28) |
| Licence | Apache-2.0, in `LICENSE.txt` (upstream ships no NOTICE file for this skill) |
| Changes | none: `SKILL.md` and `LICENSE.txt` are byte-for-byte the upstream files |

This README is not part of the upstream skill.

## How it applies here

Read `SKILL.md` before you build a new screen or reshape an existing one. In this app it works inside two limits:

- **The kit and its tokens come first.** Palette, type, spacing and radii are decided in
  `packages/ui/src/tokens.css` (the brand arrives there). The skill's "brainstorm a token system" step means
  choosing *among* those tokens and composing from `packages/ui`, or adding a token there, never writing colour
  literals into a page.
- **This is product UI, not a landing page.** The advice on heroes and page-load moments matters little; the
  advice on hierarchy, restraint, structure that encodes information, states and plain, active copy matters most.
  The skill's "write the copy" guidance never licenses invented facts: see `../hallmark/SKILL.md`.

---
name: hallmark-floor
description: The floor no screen ships below (contrast, visible focus, reduced motion, a phone layout that never scrolls sideways) and the no-invented-facts rule. Read before building any screen, and always before one that shows figures, claims, customers, quotes or logos.
---

# The floor, and no invented facts (from Hallmark)

This file was written for this repository; it is not Hallmark's own `SKILL.md` (see `README.md`). Everything in
`references/` is Hallmark's, unchanged, from version 2.0.0. [`references/gates.md`](references/gates.md) is the full
list of what Hallmark refuses; this page is the part of it every screen here must meet.

## The floor: nothing ships below it

- **Contrast.** Text 4.5:1 against what it actually sits on; large text, icons, focus rings and field edges 3:1. No
  grey text on a coloured surface; button text has its paired ink token (gates 40, 41).
- **Visible focus.** Every interactive element shows a `:focus-visible` ring at 3:1 or better, at once (no fade-in),
  and an outline is never removed with nothing in its place (15, 26a). The keyboard reaches everything.
- **Reduced motion.** Every keyframe or transform transition has a `prefers-reduced-motion: reduce` fallback (27);
  nothing auto-rotates without pausing on hover and focus (18); never `transition: all` (10a).
- **A phone layout that holds.** No horizontal scroll at any width from 320 to 1920 (34); button labels and primary
  navigation never wrap (49a); content a phone never gets is a fault (F25 in `gates.md` § 5). The pipeline captures
  every `poc.json` `ui.routes` page at phone width and checks this.
- **Honest controls.** Inputs keep their border width across states and their focus ring is an outline, disabled
  is more than opacity (39a, and the states in [`references/interaction-and-states.md`](references/interaction-and-states.md));
  a form never says "Sent", "Saved" or "Thanks" without a request behind it (70).
- **Honest structure.** No card inside a card (4); no emoji standing in for an icon (30a); decorative SVG is
  `aria-hidden` or labelled (33); no broken images (76); no content hidden until a script reveals it (62).

## No invented facts

This app is the working demo of a real bid. **Every figure, name and claim it shows comes from somewhere real:**

- the story, or the project's documents (`doc-search`, `doc-get`);
- the app's own data, through its API; or
- sample data that says it is sample, in the screen and in the seed migration that loads it.

**Never** (gates 46a and 19): made-up metrics ("3× faster", "99.9% uptime", "10,000+ teams", "saves 5 hours a week"),
testimonials or quotes, client or partner logos, "Trusted by" walls, case-study counts, awards or certifications,
the names of real companies, and placeholder people or companies (Jane Doe, Acme). Brand colours and fonts come
from the tokens, never from memory ([`references/brand-truth.md`](references/brand-truth.md)).

The pipeline flags metric- and testimonial-shaped text in the rendered pages. Each flag must trace to the story,
the documents or the data; otherwise remove it or label it as sample.

## Charts and dashboards

Before drawing a chart, a KPI row or a dashboard, read [`references/data-viz.md`](references/data-viz.md): form first,
one series that argues, no decorative gauges or donut walls.

## What doesn't apply here

Hallmark builds whole marketing pages; this app is product UI composed from `packages/ui`. These parts of `gates.md`
don't apply: the CSS stamp (20) and the pre-emit critique stamp, waivers recorded in a CSS stamp, themes and the theme
deal, hero and first-viewport gates (6a, 6b, 44b, 44d), the screen word budget (58), photo-library credits (76's
library half), and `sloplint` (not vendored: the pipeline's detector and floor checks stand in for it). The token
gates (24a, 48) are this repository's own rule already: tokens only. Links in the references to files that are not
vendored here (`craft.md`, `imagery.md`, `layout.md`, `themes/`, `scripts/`) won't resolve; the gate's own line is
enough. [`references/responsive.md`](references/responsive.md) has the widths to check by eye.

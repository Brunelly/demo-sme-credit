---
name: product-ui
description: Designing product screens for the people who will use them, so an app looks built for its users and its domain rather than like another generated app. Read before building or reshaping any screen, and before calling UI work done.
---

# Product UI for the people who use it

This app is shown to the people who would use it: a bank's operations team, a consultancy's bid managers, an
insurer's claims handlers. They judge it in seconds, by whether it looks like their work. A screen that looks like
every other generated app loses them, however well it works. So the UI is part of done, never polish to leave out.

This skill is the product half of the design guidance. `frontend-design` sets a distinctive direction, Impeccable's
craft floor and Hallmark's floor set the quality bar, and this skill makes each screen fit its users and their job.
Where they differ for an app screen, this one wins: **an app screen has no hero; it opens on the work.**

## Before you build a screen

1. **Write the use-case brief** (`references/use-case-brief.md`): who, situation, job, what they must see first, the
   real data, density, risk, what makes them trust it. Read `docs/design-brief.md` when it exists: it holds the
   look and feel the client chose, and it wins over your taste.
2. **Name the archetype** (`references/screen-archetypes.md`): workbench, queue, record, dashboard, form, review or
   assistant. Build that shape, not a stack of equal cards.
3. **Pick the one memorable thing**: the element people would describe afterwards. Spend boldness there and keep the
   rest quiet.
4. **Take the direction from the tokens.** `packages/ui/src/tokens.css` carries the brand and the chosen look. Use
   them consistently; add a token rather than a literal. Never fall back on the generated-app defaults
   (`references/generic-tells.md`).

## While you build

- Real-feeling content from the domain: identifiers, amounts, dates, names and volumes in the users' formats.
  Never lorem, never `John Doe`, never invented facts about the client.
- The credibility details (`references/enterprise-credibility.md`): tabular, right-aligned numbers with units;
  statuses as words plus tones; dates in their format; who did what, when; density chosen for the users.
- Every state designed: loading in the shape of the content, empty states that say what to do, errors in the
  domain's terms.
- Copy in the users' words: the screen's job as its heading ("Payments awaiting approval"), actions named for what
  they do ("Release payment"), never buzzwords.

## Before you call it done

Review your own screenshots (`references/screenshot-review.md`): run the UI check, open the desktop and phone shots
of every screen you changed, answer the ten questions as the user, fix what fails, look once more, and stop.

## In this app

- Screens come from `@app/ui` (`packages/ui`): `AppShell`, `PageHeader`, `DataTable`, `Kpi`, `Layout`, `States`,
  `Badge`, `FilterChips`, `Field`, `Dialog`, `Skeleton` and the rest; `/kit` shows them all. A missing pattern goes
  into the kit with a test.
- Icons from `lucide-react`, never emoji. Styles in CSS Modules from tokens only (`npm run check:tokens`).
- The design detector (`npm run check:design`) and the pipeline's UI check catch some tells; passing them is the
  floor, not the goal.

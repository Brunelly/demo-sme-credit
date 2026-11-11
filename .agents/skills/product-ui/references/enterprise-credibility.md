# Enterprise credibility

What makes a bank's, an insurer's or a consultancy's people believe a screen was built for them. Check these on
every screen that shows data.

## Numbers

- Tabular figures in any column or stack of numbers (`font-variant-numeric: tabular-nums`), right-aligned, with
  the same number of decimals down a column.
- Units and currency on every figure, in the users' locale (`Intl.NumberFormat`): `€12,400.00`, `1.2 m`, `4 h 20 m`.
- Negative values shown the way the domain shows them (a minus sign or brackets), not by colour alone.
- Precision that matches the decision: an exposure in millions, a fee to the cent.

## Time

- Absolute dates where people compare or file them, relative ("3 h ago") where they judge freshness, the other on
  hover or in the detail. Time zones named when people work across them.
- "Last updated" on anything that can go stale, so nobody acts on old data.

## Status and risk

- Every status is a word plus a tone (the kit's badge), never colour alone; the same status reads the same
  everywhere (one map from machine value to label and tone).
- Red means something must be done. Do not spend it on decoration, brand or charts.
- Show why a record is in its state: the rule that fired, the reason given, the person who set it.

## Provenance and audit

- Who did what, when: on records, decisions and AI output. People in regulated work look for it first.
- Identifiers people can copy (monospace, a copy action) and search for.
- Destructive or irreversible actions name exactly what they will do and to how many records, and ask once.

## Density and tables

- Compact rows for experts who scan; comfortable for occasional users. Choose from the use-case brief, not by habit.
- Tables: a sticky header, sort on the columns people sort by, filters that show what is filtered, row actions at
  the row's end, the empty and loading states the kit provides. Text left, numbers right, never centred.
- Truncate long text with the full value on hover or in the detail, never by breaking the layout.

## Restraint

- One accent colour for the primary action and the current place. Everything else is neutral.
- Hierarchy from size, weight and position, not from boxes: not every group needs a card, a border or a shadow.
- Calm by default: no motion that is not feedback, no illustrations in working screens, no celebration for routine
  actions.

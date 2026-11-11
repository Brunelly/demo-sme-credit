# The use-case brief

Write this before you touch a screen. It takes two minutes and decides most of what follows. Keep it in your head or
your notes; it is not a file you commit. Fill each line from the story, `docs/design-brief.md`, the project's
documents (`doc-search`, `doc-get`) and the screens already built, in that order. Where nothing says, choose the most
likely answer for this domain and say which you chose in your final message.

| Line | Ask | Example (a payments operations team) |
|---|---|---|
| **Who** | Which role, how expert, how often they are here | Payments operations analysts, experts, all day |
| **Situation** | Where they are and what just happened | At a desk on two monitors, working a queue of flagged payments |
| **Job** | The one thing this screen helps them do | Decide, payment by payment, whether to release, hold or escalate |
| **First look** | What they must see without scrolling or clicking | Which payments are oldest, largest and closest to cut-off |
| **Data** | The real fields, units and volumes | Reference, counterparty, amount and currency, value date, reason flagged, age; 40–200 rows |
| **Density** | Compact, comfortable or spacious, and why | Compact: experts scanning many rows beat white space |
| **Risk** | What goes wrong if they misread the screen | Releasing a fraudulent payment; missing a cut-off |
| **Proof** | What makes them trust what they see | Who flagged it and when, the rule that fired, the audit trail |
| **Done** | What "this worked" looks like for them | The queue is empty before cut-off with every decision recorded |

Then name the screen's archetype (`screen-archetypes.md`) and the one memorable thing on it: the element a person
would describe afterwards ("the ageing bar beside each payment").

## Sample data that feels real

The screen is demoed to the people who do this job; generic data breaks the spell at once.

- Use the domain's own nouns, identifiers and formats: `REF-20931`, `GB33 BUKB 2020 1555 5555 55`, `€12,400.00`,
  `T+2`, `Claim #CL-4471`, `SLA 4h`. Copy the formats from the project's documents when they show them.
- Plausible, varied names for people and organisations of the client's region, never famous companies, never
  `John Doe` or `Acme`. Vary lengths: a 34-character counterparty name is how you find the truncation bug.
- Realistic distributions: most rows ordinary, a few outliers, one or two in an error state. Not every status
  green, not every figure round.
- Dates relative to today, in the users' locale and time zone.
- Mark it as sample where the app's rules say so. Never present a made-up figure as a fact about the client
  (Hallmark's no-invented-facts rule).

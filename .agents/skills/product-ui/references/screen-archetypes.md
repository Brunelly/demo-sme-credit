# Screen archetypes

Most enterprise screens are one of these. Name the archetype first, then build its shape; it keeps a screen from
becoming a page of equal cards. Each recipe says what the screen is for, its layout, and what makes it credible.

## Workbench (list and detail)

For working through records one at a time: cases, payments, claims, tenders, tickets.
- A list on the left or top (the kit's data table), the selected record beside or below it. Selection survives
  filtering and refresh.
- The list shows the few columns that decide the order of work; everything else lives in the detail.
- Keyboard: up and down to move, Enter to open, a shortcut for the main action. The next record opens after an action.

## Queue (triage)

For deciding what to do next with incoming work.
- Sorted by urgency the users recognise (age, SLA, value, cut-off), with the sort shown.
- Counts per state in the filter chips ("Flagged 23, Held 4"), not in decorative KPI cards.
- Bulk actions for the common decision, with a confirmation that names the count.

## Record

Everything about one thing: a client, a contract, a bid.
- A header with the identity (name, identifier, status, owner) and the two or three actions that matter.
- Sections in the order people read them, often tabs for the long tail. Facts as label and value pairs, aligned.
- History and provenance at hand: who changed what, when.

## Dashboard (work remaining)

For a lead who needs the state of the work at a glance.
- Lead with what needs attention ("7 bids due this week, 2 missing pricing"), then trends. Every number links to
  the records behind it.
- Few figures, each with its unit, period and comparison ("vs last month"). No vanity totals, no sparkline for
  decoration, no fake "+12%".
- A chart only where the shape of the data is the point; otherwise a table.

## Form and flow

For entering or changing something that matters.
- One column, labels above fields, grouped in the order of the paperwork people already know.
- Validation at the field, in the domain's terms ("IBAN is 22 characters for the UK"). Defaults from what is known.
- A multi-step flow shows the steps, keeps entries when stepping back, and ends on a review of everything entered.

## Review and approve

For a second person checking someone else's work.
- What changed, side by side or highlighted, with who proposed it and why.
- The decision is explicit (Approve, Reject with a reason, Ask a question) and recorded with the reviewer's name.

## Assistant (AI in the work)

For an AI that helps with the job, not a chat page for its own sake.
- Put the AI where the work is: a panel beside the record, a "draft this" action on the field, a summary at the top
  of a long document.
- Say what it is based on (sources, the record it read) and mark its output as AI-written. Let people edit or reject
  it before it counts.

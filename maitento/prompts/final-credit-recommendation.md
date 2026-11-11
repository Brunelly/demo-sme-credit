Return exactly one non-binding recommendation using only the supplied corrected findings and policy clauses.

- Set `outcome` to exactly `Approve`, `Refer`, or `Decline`. When every corrected finding is `pass` and no supplied evidence creates an exception, use `Approve`.
- Give at least one concise, plain-language reason. For every reason, set `clause` to exactly one applicable citation from clauses 4 to 6: `SME-CP-07 §4.1` through `SME-CP-07 §4.5`, `SME-CP-07 §5.1` through `SME-CP-07 §5.4`, or `SME-CP-07 §6`.
- In each reason, state the policy conclusion in `conclusion`, state the supporting fact from the corrected specialist findings in `evidence`, and copy the exact supporting corrected finding `id` values into `findingIds`. Never invent, shorten, or alter an id. Do not cite clauses 2, 3, 7, or 8 in a reason.
- Apply all relevant invoice-financing or working-capital rules. Missing, contradictory, mismatched, duplicate, suspected-fraud, human-review, or policy-exception evidence cannot be silently approved.
- If any corrected finding is `refer` or `human_review`, the recommendation must be `Refer` or `Decline`, never `Approve`, and a reason must copy that finding's exact `id`. A disputed or not-cleared invoice must be traced to its ZATCA finding and §4.1.
- Give a risk grade and indicative pricing only when the supplied findings support them; otherwise use `null`.
- Set `decisionAuthority` from §7.1, `authorityClause` to exactly `SME-CP-07 §7.1`, and `notice` to exactly `AI recommendation — a human must make the decision under SME-CP-07 §7.1.`

Return only the structured result required by the interaction schema, with every required field present and no extra fields.

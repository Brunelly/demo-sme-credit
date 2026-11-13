import type { Db } from "mongodb";

/**
 * Seeds one complete, stage-appropriate assessment trail for every sample application past New.
 * The trail mirrors what the live assessment workflow records: four specialist findings, an independent
 * reviewer pass (with one reworked finding), and a validated final recommendation.
 *
 * Idempotent: a fixed run id plus $setOnInsert; an existing sample run is never duplicated, and an
 * assessment a person actually ran (no sampleData flag) means the application is left untouched.
 */

const SAMPLE_START = "2026-11-12T07:30:00.000Z";
const NOTICE = "AI recommendation — a human must make the decision under SME-CP-07 §7.1.";
const AUTHORITY_CLAUSE = "SME-CP-07 §7.1";

type Product = "invoice_financing" | "working_capital";
type SpecialistKey = "simah" | "wathq" | "zatca" | "openBanking";
type Grade = "A" | "B" | "C" | "D";
type MissingGradeInput = "commercial_credit_report" | "owner_credit_reports" | "debt_service_coverage" | "buyer_quality";

interface ApplicationDoc {
  _id: string;
  businessName: string;
  product: Product;
  amountSar: number;
  stage: string;
  commercialRegistration: string;
  annualRevenueSar?: number;
  riskGrade?: Grade;
  invoice?: { number: string; buyerName: string; buyerCategory: string; amountSar: number };
}

interface PlannedFinding {
  outcome: "pass" | "refer";
  plainLanguageFinding: string;
  evidence: [fact: string, sourceReference: string][];
  policyCitations: string[];
}

interface PlannedReview {
  status: "accepted" | "challenge";
  conclusion: string;
  evidenceGap: string | null;
  reasoningDefect: string | null;
  policyCitation: string | null;
}

interface PlannedRecommendation {
  outcome: "Approve" | "Refer" | "Decline";
  riskGrade: Grade | null;
  indicativeProfitRate: string | null;
  missingGradeInputs: MissingGradeInput[];
  decisionAuthority:
    | "Credit analyst confirms"
    | "Senior credit officer"
    | "Credit analyst reviews the flagged checks"
    | "Credit analyst, then a second analyst (four eyes)"
    | "Credit committee";
  reasons: { clause: string; conclusion: string; evidence: string; link: SpecialistKey | "revision" }[];
}

interface TrailPlan {
  scenarioId: "clean" | "disputed_invoice" | "low_bureau" | "returned_cheques";
  findings: Record<SpecialistKey, PlannedFinding>;
  challenge: { specialist: SpecialistKey; review: PlannedReview; revision: PlannedFinding; revisionSummary: string };
  recommendation: PlannedRecommendation;
}

const SPECIALISTS: { key: SpecialistKey; label: string; sourceLabel: string }[] = [
  { key: "simah", label: "SIMAH credit bureau", sourceLabel: "Simulated SIMAH commercial and qualifying-owner reports" },
  { key: "wathq", label: "Wathq company verification", sourceLabel: "Simulated Wathq CR record" },
  { key: "zatca", label: "ZATCA e-invoice verification", sourceLabel: "Simulated ZATCA clearance record" },
  { key: "openBanking", label: "Open banking cash flow", sourceLabel: "Simulated 12-month bank statements" },
];

function finding(outcome: PlannedFinding["outcome"], text: string, evidence: [string, string][], citations: string[]): PlannedFinding {
  return { outcome, plainLanguageFinding: text, evidence, policyCitations: citations };
}

function accepted(): PlannedReview {
  return { status: "accepted", conclusion: "Reviewer tested the conclusion and found it supported by the cited evidence.", evidenceGap: null, reasoningDefect: null, policyCitation: null };
}

function passedSimah(score: number, tenure: string): PlannedFinding {
  return finding("pass", `Commercial score ${score} is within the acceptable band, no defaults or restructures are recorded in the last 24 months, and qualifying owners are clear.`, [[`Commercial score ${score}`, "SIMAH commercial report · score"], ["0 defaults, write-offs or restructures in 24 months", "SIMAH commercial report · payment history"], ["Qualifying owners checked at 25% and above", "SIMAH owner reports · ownership"], [tenure, "SIMAH commercial report · history"]], ["SME-CP-07 §3.1"]);
}

function passedWathq(cr: string, months: number, activity: string): PlannedFinding {
  return finding("pass", `CR ${cr} is active, its registered activity covers ${activity}, and the signatory on the application is authorised.`, [[`CR ${cr} active for ${months} months`, "Wathq record · status and tenure"], [`Registered activity covers ${activity}`, "Wathq record · activity"], ["Authorised signatory confirmed", "Wathq record · signatories"]], ["SME-CP-07 §3.2"]);
}

function noInvoiceCheck(): PlannedFinding {
  return finding("pass", "No invoice verification applies to a working-capital facility.", [["Working-capital product", "Source assignment · invoice check not applicable"]], ["SME-CP-07 §3.3"]);
}

function passedCashFlow(inflow: number, dscr: string, cheques: number): PlannedFinding {
  return finding("pass", `Twelve months of statements show average monthly inflow SAR ${inflow.toLocaleString("en-US")} and DSCR of ${dscr} after existing obligations.`, [["12 months analysed", "Open banking · statement period"], [`Average monthly inflow SAR ${inflow.toLocaleString("en-US")}`, "Open banking · inflows"], [`DSCR after existing obligations ${dscr}`, "Open banking · obligations"], [`${cheques} returned cheque${cheques === 1 ? "" : "s"} in 12 months`, "Open banking · payment record"]], ["SME-CP-07 §3.4"]);
}

const TRAILS: Record<string, TrailPlan> = {
  "app-1007": {
    scenarioId: "returned_cheques",
    findings: {
      simah: passedSimah(714, "Active bureau file for 41 months"),
      wathq: passedWathq("1010842763", 41, "packaging supplies and equipment"),
      zatca: noInvoiceCheck(),
      openBanking: finding("pass", "Twelve months of statements show average monthly inflow SAR 1,260,000 and DSCR of 1.12× after existing obligations; five returned cheques are listed but were not tested against the policy threshold.", [["12 months analysed", "Open banking · statement period"], ["Average monthly inflow SAR 1,260,000", "Open banking · inflows"], ["DSCR after existing obligations 1.12×", "Open banking · obligations"], ["5 returned cheques in 12 months", "Open banking · payment record"]], ["SME-CP-07 §3.4"]),
    },
    challenge: {
      specialist: "openBanking",
      review: { status: "challenge", conclusion: "Five returned cheques is above the three-cheque limit, so the finding must state the policy consequence and support the decline.", evidenceGap: "Apply §5.3 to the five returned cheques and connect it to the decline recommendation.", reasoningDefect: "The policy threshold was recorded but not applied.", policyCitation: "SME-CP-07 §5.3" },
      revision: finding("refer", "Five returned cheques in 12 months exceed the three-cheque threshold in §5.3, and DSCR after existing obligations is 1.12× against the 1.25× minimum in §5.2. The file cannot be approved and supports a decline recommendation.", [["5 returned cheques in 12 months", "Open banking · payment record"], ["DSCR after existing obligations 1.12×", "Open banking · obligations"], ["Threshold is more than 3 returned cheques", "SME-CP-07 §5.3"]], ["SME-CP-07 §3.4", "SME-CP-07 §5.2", "SME-CP-07 §5.3"]),
      revisionSummary: "Applied the returned-cheque threshold and the DSCR minimum to the statement evidence.",
    },
    recommendation: {
      outcome: "Decline", riskGrade: "C", indicativeProfitRate: "SAIBOR + 4.0%", missingGradeInputs: [], decisionAuthority: "Credit analyst, then a second analyst (four eyes)",
      reasons: [
        { clause: "SME-CP-07 §5.1", conclusion: "The requested limit is within the policy cap, so the decline rests on the payment record rather than affordability.", evidence: "Annual revenue is SAR 9,400,000 and average monthly inflow SAR 1,260,000 against a SAR 1,850,000 facility.", link: "revision" },
        { clause: "SME-CP-07 §5.2", conclusion: "DSCR of 1.12× is below the 1.25× minimum.", evidence: "Existing obligations reduce coverage to 1.12× over the last 12 months.", link: "revision" },
        { clause: "SME-CP-07 §5.3", conclusion: "Five returned cheques exceed the three-cheque referral threshold and support a decline.", evidence: "The statement record lists five returned cheques in the last 12 months.", link: "revision" },
        { clause: "SME-CP-07 §6", conclusion: "The assessed grade is C; the decline is driven by the payment record, not a grade D exception.", evidence: "Moderate bureau risk and 1.12× DSCR place the file in grade C.", link: "simah" },
      ],
    },
  },
  "app-1002": {
    scenarioId: "clean",
    findings: {
      simah: passedSimah(648, "Active bureau file for 29 months"),
      wathq: passedWathq("1010763428", 29, "industrial supplies and procurement"),
      zatca: finding("pass", "The presented invoice is cleared and undisputed, but the buyer is classified Other and the single-buyer share is 46% of the facility; the policy limits were recorded but not applied.", [["Invoice cleared and undisputed", "ZATCA · clearance"], ["Buyer category Other", "ZATCA · buyer record"], ["Single-buyer share 46% of the facility", "ZATCA · concentration"]], ["SME-CP-07 §3.3"]),
      openBanking: passedCashFlow(2480000, "1.38×", 1),
    },
    challenge: {
      specialist: "zatca",
      review: { status: "challenge", conclusion: "The finding conflates buyer quality with concentration and does not state the referral consequence for either rule.", evidenceGap: "Cite §4.2 and §4.3 separately and state that both require referral.", reasoningDefect: "Two policy rules were merged without consequences.", policyCitation: "SME-CP-07 §4.2" },
      revision: finding("refer", "The Other buyer category requires referral under §4.2 regardless of clearance, and the 46% single-buyer share also breaches the §4.3 40% concentration limit. Both rules need analyst review before an advance rate is set.", [["Buyer category Other", "ZATCA · buyer record"], ["Single-buyer share 46%", "ZATCA · concentration"], ["Other buyers are referred", "SME-CP-07 §4.2"], ["Single buyer limit is 40%", "SME-CP-07 §4.3"]], ["SME-CP-07 §3.3", "SME-CP-07 §4.2", "SME-CP-07 §4.3"]),
      revisionSummary: "Separated the buyer-quality and concentration rules and stated the referral consequence.",
    },
    recommendation: {
      outcome: "Refer", riskGrade: "C", indicativeProfitRate: "SAIBOR + 4.0%", missingGradeInputs: [], decisionAuthority: "Credit analyst reviews the flagged checks",
      reasons: [
        { clause: "SME-CP-07 §4.1", conclusion: "The invoice itself is cleared, undisputed and within tenor.", evidence: "ZATCA clearance and the presented due date meet §4.1.", link: "revision" },
        { clause: "SME-CP-07 §4.2", conclusion: "An Other buyer cannot receive an advance without analyst referral.", evidence: "The buyer record classifies the obligor as Other.", link: "revision" },
        { clause: "SME-CP-07 §4.3", conclusion: "Single-buyer concentration of 46% breaches the 40% limit.", evidence: "One buyer represents 46% of the SAR 3,200,000 facility.", link: "revision" },
        { clause: "SME-CP-07 §6", conclusion: "Grade C sets the indicative pricing basis.", evidence: "Moderate bureau risk and 1.38× DSCR support grade C.", link: "simah" },
      ],
    },
  },
  "app-1011": {
    scenarioId: "clean",
    findings: {
      simah: passedSimah(733, "Active bureau file for 52 months"),
      wathq: passedWathq("1010925184", 52, "facilities management and maintenance services"),
      zatca: noInvoiceCheck(),
      openBanking: finding("pass", "Twelve months of statements show average monthly inflow SAR 1,240,000 and DSCR of 1.62× after existing obligations; the limit calculation is not shown.", [["12 months analysed", "Open banking · statement period"], ["Average monthly inflow SAR 1,240,000", "Open banking · inflows"], ["DSCR after existing obligations 1.62×", "Open banking · obligations"], ["1 returned cheque in 12 months", "Open banking · payment record"]], ["SME-CP-07 §3.4"]),
    },
    challenge: {
      specialist: "openBanking",
      review: { status: "challenge", conclusion: "The DSCR is stated but the limit calculation is missing, so the reader cannot see that the facility fits §5.1.", evidenceGap: "Show the 25% revenue and three-month inflow tests against SAR 950,000.", reasoningDefect: null, policyCitation: "SME-CP-07 §5.1" },
      revision: finding("pass", "Average monthly inflow SAR 1,240,000 supports a three-month capacity of SAR 3,720,000, and 25% of annual revenue is SAR 2,225,000. The SAR 950,000 facility sits below both caps, and DSCR of 1.62× clears the 1.25× minimum.", [["Average monthly inflow SAR 1,240,000", "Open banking · inflows"], ["Annual revenue SAR 8,900,000", "Open banking · revenue"], ["DSCR after existing obligations 1.62×", "Open banking · obligations"], ["Requested facility SAR 950,000", "Application · amount"]], ["SME-CP-07 §3.4", "SME-CP-07 §5.1", "SME-CP-07 §5.2"]),
      revisionSummary: "Added the §5.1 limit calculation and the DSCR comparison.",
    },
    recommendation: {
      outcome: "Approve", riskGrade: "B", indicativeProfitRate: "SAIBOR + 3.0%", missingGradeInputs: [], decisionAuthority: "Credit analyst confirms",
      reasons: [
        { clause: "SME-CP-07 §5.1", conclusion: "The SAR 950,000 limit is below both the revenue and inflow caps.", evidence: "25% of SAR 8,900,000 revenue is SAR 2,225,000; three months of inflow is SAR 3,720,000.", link: "revision" },
        { clause: "SME-CP-07 §5.2", conclusion: "DSCR of 1.62× clears the 1.25× minimum.", evidence: "Existing obligations are included in the 12-month statement analysis.", link: "revision" },
        { clause: "SME-CP-07 §5.4", conclusion: "A 12-month tenor fits the product limit and renewal will require a fresh assessment.", evidence: "Facility tenor is 12 months.", link: "wathq" },
        { clause: "SME-CP-07 §6", conclusion: "Grade B sets the indicative pricing basis.", evidence: "Low bureau risk and 1.62× DSCR support grade B.", link: "simah" },
      ],
    },
  },
  "app-1014": {
    scenarioId: "clean",
    findings: {
      simah: passedSimah(690, "Active bureau file for 66 months"),
      wathq: passedWathq("4030426719", 66, "food distribution and wholesale trade"),
      zatca: finding("pass", "No invoice record is attached to the application, so the invoice cannot be tested; the finding does not state which eligibility condition fails.", [["Invoice record not attached", "Application · invoice documents"], ["Facility SAR 4,750,000", "Application · amount"], ["Buyer category not recorded", "Application · invoice"]], ["SME-CP-07 §3.3"]),
      openBanking: passedCashFlow(2480000, "1.31×", 2),
    },
    challenge: {
      specialist: "zatca",
      review: { status: "challenge", conclusion: "A missing invoice is not a mismatched invoice; the finding must cite the eligibility condition that cannot be evidenced.", evidenceGap: "State which invoice eligibility condition fails and why that requires referral.", reasoningDefect: "The policy consequence was not linked to a specific condition.", policyCitation: "SME-CP-07 §4.1" },
      revision: finding("refer", "Without an invoice record, the §4.1 conditions cannot be evidenced: due date, delivered status and whether the buyer has disputed the invoice are all unknown. The case is referred for eligibility review before an advance rate is considered.", [["Invoice record not attached", "Application · invoice documents"], ["Due date, delivery and dispute status unverified", "ZATCA · no clearance record"], ["Eligibility conditions cannot be evidenced", "SME-CP-07 §4.1"]], ["SME-CP-07 §3.3", "SME-CP-07 §4.1", "SME-CP-07 §4.5"]),
      revisionSummary: "Tied the missing invoice record to the §4.1 eligibility conditions and the referral consequence.",
    },
    recommendation: {
      outcome: "Refer", riskGrade: null, indicativeProfitRate: null, missingGradeInputs: ["buyer_quality"], decisionAuthority: "Credit analyst reviews the flagged checks",
      reasons: [
        { clause: "SME-CP-07 §4.1", conclusion: "Invoice eligibility cannot be evidenced without the invoice record.", evidence: "Due date, delivery and dispute status are unknown for the SAR 4,750,000 facility.", link: "revision" },
        { clause: "SME-CP-07 §4.5", conclusion: "A missing or mismatched invoice requires referral.", evidence: "No invoice is attached, so the duplicate and mismatch checks cannot run.", link: "revision" },
        { clause: "SME-CP-07 §6", conclusion: "No risk grade can be assigned until buyer quality is evidenced.", evidence: "Buyer category is not recorded on the application.", link: "simah" },
      ],
    },
  },
  "app-1018": {
    scenarioId: "clean",
    findings: {
      simah: passedSimah(762, "Active bureau file for 74 months"),
      wathq: passedWathq("2050184736", 74, "medical equipment and clinical supplies trading"),
      zatca: finding("pass", "The presented invoice is cleared, undisputed and due in 84 days; the buyer-quality band is recorded but not tied to an advance rate.", [["INV-2026-2318 cleared", "ZATCA · clearance"], ["Buyer category Listed", "ZATCA · buyer record"], ["Due in 84 days", "ZATCA · invoice date"]], ["SME-CP-07 §3.3"]),
      openBanking: passedCashFlow(2480000, "1.84×", 0),
    },
    challenge: {
      specialist: "zatca",
      review: { status: "challenge", conclusion: "The buyer-quality band is stated but the advance rate it supports is missing.", evidenceGap: "Name the buyer category and the maximum advance rate under §4.2.", reasoningDefect: null, policyCitation: "SME-CP-07 §4.2" },
      revision: finding("pass", "Invoice INV-2026-2318 is cleared, undisputed and due in 84 days. The buyer is Listed, supporting an advance rate up to 80% under §4.2, above the SAR 2,100,000 requested facility.", [["INV-2026-2318 cleared", "ZATCA · clearance"], ["Buyer category Listed", "ZATCA · buyer record"], ["Advance rate up to 80% for Listed buyers", "SME-CP-07 §4.2"]], ["SME-CP-07 §3.3", "SME-CP-07 §4.1", "SME-CP-07 §4.2"]),
      revisionSummary: "Applied the Listed-buyer advance rate and linked it to the requested facility.",
    },
    recommendation: {
      outcome: "Approve", riskGrade: "A", indicativeProfitRate: "SAIBOR + 2.25%", missingGradeInputs: [], decisionAuthority: "Senior credit officer",
      reasons: [
        { clause: "SME-CP-07 §4.1", conclusion: "The invoice is due in 84 days, undisputed and for delivered clinical supplies.", evidence: "ZATCA clearance and the presented due date meet §4.1.", link: "revision" },
        { clause: "SME-CP-07 §4.2", conclusion: "The Listed buyer supports an advance rate up to 80%.", evidence: "The buyer record classifies the obligor as Listed.", link: "revision" },
        { clause: "SME-CP-07 §4.3", conclusion: "Single-buyer concentration of 32% is within the 40% limit.", evidence: "The buyer represents 32% of the SAR 2,100,000 facility.", link: "revision" },
        { clause: "SME-CP-07 §6", conclusion: "Grade A sets the indicative pricing basis.", evidence: "Low bureau risk and 1.84× DSCR support grade A.", link: "simah" },
      ],
    },
  },
  "app-1025": {
    scenarioId: "clean",
    findings: {
      simah: passedSimah(714, "Active bureau file for 38 months"),
      wathq: passedWathq("1010864297", 38, "food distribution and wholesale trade"),
      zatca: finding("pass", "Invoice INV-2026-1842 is cleared, undisputed and due in 74 days for a Government buyer; the advance rate is not applied to the requested amount.", [["INV-2026-1842 cleared", "ZATCA · clearance"], ["Government buyer", "ZATCA · buyer record"], ["Due in 74 days", "ZATCA · invoice date"]], ["SME-CP-07 §3.3"]),
      openBanking: passedCashFlow(2480000, "1.48×", 1),
    },
    challenge: {
      specialist: "zatca",
      review: { status: "challenge", conclusion: "The Government buyer is identified but the 85% advance rate is not tested against the requested facility.", evidenceGap: "Show the 85% Government advance rate against SAR 2,400,000.", reasoningDefect: null, policyCitation: "SME-CP-07 §4.2" },
      revision: finding("pass", "Invoice INV-2026-1842 is cleared, undisputed and due in 74 days. The Government buyer supports an advance rate up to 85%, which covers the SAR 2,400,000 requested facility.", [["INV-2026-1842 cleared", "ZATCA · clearance"], ["Government buyer", "ZATCA · buyer record"], ["Advance rate up to 85% for Government buyers", "SME-CP-07 §4.2"]], ["SME-CP-07 §3.3", "SME-CP-07 §4.1", "SME-CP-07 §4.2"]),
      revisionSummary: "Applied the Government advance rate and tested it against the requested facility.",
    },
    recommendation: {
      outcome: "Approve", riskGrade: "B", indicativeProfitRate: "SAIBOR + 3.0%", missingGradeInputs: [], decisionAuthority: "Senior credit officer",
      reasons: [
        { clause: "SME-CP-07 §4.1", conclusion: "The invoice is due in 74 days, undisputed and for delivered food supplies.", evidence: "ZATCA clearance and the presented due date meet §4.1.", link: "revision" },
        { clause: "SME-CP-07 §4.2", conclusion: "The Government buyer supports an advance rate up to 85%.", evidence: "The buyer record classifies the obligor as Government.", link: "revision" },
        { clause: "SME-CP-07 §4.3", conclusion: "Largest-buyer concentration of 36% is within the 40% limit.", evidence: "The buyer represents 36% of the SAR 2,400,000 facility.", link: "revision" },
        { clause: "SME-CP-07 §6", conclusion: "Grade B sets the indicative pricing basis.", evidence: "Low bureau risk and 1.48× DSCR support grade B.", link: "simah" },
      ],
    },
  },
  "app-1026": {
    scenarioId: "clean",
    findings: {
      simah: passedSimah(721, "Active bureau file for 61 months"),
      wathq: passedWathq("4030462185", 61, "logistics and freight services"),
      zatca: noInvoiceCheck(),
      openBanking: finding("pass", "Twelve months of statements show average monthly inflow SAR 4,200,000 and DSCR of 1.34× after the obligations disclosed on the application.", [["12 months analysed", "Open banking · statement period"], ["Average monthly inflow SAR 4,200,000", "Open banking · inflows"], ["DSCR after disclosed obligations 1.34×", "Open banking · obligations"], ["2 returned cheques in 12 months", "Open banking · payment record"]], ["SME-CP-07 §3.4"]),
    },
    challenge: {
      specialist: "openBanking",
      review: { status: "challenge", conclusion: "Two facility instalments visible in the statements are absent from the disclosed obligations, so DSCR is overstated.", evidenceGap: "Recalculate DSCR including every instalment in the 12-month statements.", reasoningDefect: "Obligations were taken from the application without reconciling them to the statements.", policyCitation: "SME-CP-07 §5.2" },
      revision: finding("refer", "Including the two omitted facility instalments, DSCR falls to 1.19×, below the 1.25× minimum in §5.2. The SAR 3,100,000 limit is within the §5.1 cap, but the file cannot be approved on the statement evidence.", [["Two omitted instalments", "Open banking · obligations"], ["DSCR after all obligations 1.19×", "Open banking · obligations"], ["DSCR minimum is 1.25×", "SME-CP-07 §5.2"]], ["SME-CP-07 §3.4", "SME-CP-07 §5.1", "SME-CP-07 §5.2"]),
      revisionSummary: "Reconciled every instalment in the statements and recalculated DSCR at 1.19×.",
    },
    recommendation: {
      outcome: "Refer", riskGrade: "C", indicativeProfitRate: "SAIBOR + 4.0%", missingGradeInputs: [], decisionAuthority: "Credit analyst reviews the flagged checks",
      reasons: [
        { clause: "SME-CP-07 §5.1", conclusion: "The SAR 3,100,000 limit is within the revenue and inflow caps.", evidence: "25% of SAR 41,800,000 revenue is SAR 10,450,000; three months of SAR 4,200,000 inflow is SAR 12,600,000.", link: "revision" },
        { clause: "SME-CP-07 §5.2", conclusion: "DSCR of 1.19× after all instalments is below the 1.25× minimum.", evidence: "Two facility instalments were omitted from the disclosed obligations.", link: "revision" },
        { clause: "SME-CP-07 §5.4", conclusion: "A 12-month tenor is within the product limit, subject to resolving the DSCR gap.", evidence: "Facility tenor is 12 months.", link: "wathq" },
        { clause: "SME-CP-07 §6", conclusion: "Grade C sets the indicative pricing basis.", evidence: "Moderate bureau risk and the recalculated DSCR support grade C.", link: "simah" },
      ],
    },
  },
  "app-1028": {
    scenarioId: "clean",
    findings: {
      simah: passedSimah(726, "Active bureau file for 47 months"),
      wathq: passedWathq("1130129476", 47, "date packing and agricultural processing"),
      zatca: noInvoiceCheck(),
      openBanking: finding("pass", "Twelve months of statements show average monthly inflow SAR 1,080,000 and DSCR of 1.71× after existing obligations; the limit cap test is not shown.", [["12 months analysed", "Open banking · statement period"], ["Average monthly inflow SAR 1,080,000", "Open banking · inflows"], ["DSCR after existing obligations 1.71×", "Open banking · obligations"], ["1 returned cheque in 12 months", "Open banking · payment record"]], ["SME-CP-07 §3.4"]),
    },
    challenge: {
      specialist: "openBanking",
      review: { status: "challenge", conclusion: "The DSCR is shown but the limit calculation is missing, so the facility cap is not evidenced.", evidenceGap: "Show 25% of revenue and three months of inflow against SAR 1,200,000.", reasoningDefect: null, policyCitation: "SME-CP-07 §5.1" },
      revision: finding("pass", "Average monthly inflow SAR 1,080,000 supports three-month capacity of SAR 3,240,000, and 25% of SAR 12,400,000 revenue is SAR 3,100,000. The SAR 1,200,000 facility sits below both caps, and DSCR of 1.71× clears the 1.25× minimum.", [["Average monthly inflow SAR 1,080,000", "Open banking · inflows"], ["Annual revenue SAR 12,400,000", "Open banking · revenue"], ["DSCR after existing obligations 1.71×", "Open banking · obligations"], ["Requested facility SAR 1,200,000", "Application · amount"]], ["SME-CP-07 §3.4", "SME-CP-07 §5.1", "SME-CP-07 §5.2"]),
      revisionSummary: "Added the §5.1 limit calculation and the DSCR comparison.",
    },
    recommendation: {
      outcome: "Approve", riskGrade: "B", indicativeProfitRate: "SAIBOR + 3.0%", missingGradeInputs: [], decisionAuthority: "Credit analyst confirms",
      reasons: [
        { clause: "SME-CP-07 §5.1", conclusion: "The SAR 1,200,000 limit is below both the revenue and inflow caps.", evidence: "25% of SAR 12,400,000 revenue is SAR 3,100,000; three months of inflow is SAR 3,240,000.", link: "revision" },
        { clause: "SME-CP-07 §5.2", conclusion: "DSCR of 1.71× clears the 1.25× minimum.", evidence: "Existing obligations are included in the 12-month statement analysis.", link: "revision" },
        { clause: "SME-CP-07 §5.4", conclusion: "A 12-month tenor fits the product limit and renewal will require a fresh assessment.", evidence: "Facility tenor is 12 months.", link: "wathq" },
        { clause: "SME-CP-07 §6", conclusion: "Grade B sets the indicative pricing basis.", evidence: "Low bureau risk and 1.71× DSCR support grade B.", link: "simah" },
      ],
    },
  },
  "app-1029": {
    scenarioId: "clean",
    findings: {
      simah: passedSimah(705, "Active bureau file for 44 months"),
      wathq: passedWathq("4650093182", 44, "medical supplies and clinical distribution"),
      zatca: finding("pass", "Invoice INV-2026-2217 is cleared, undisputed and due in 96 days for an Established private buyer; the lower advance rate is recorded but not applied.", [["INV-2026-2217 cleared", "ZATCA · clearance"], ["Established private buyer", "ZATCA · buyer record"], ["Due in 96 days", "ZATCA · invoice date"]], ["SME-CP-07 §3.3"]),
      openBanking: passedCashFlow(2480000, "1.55×", 1),
    },
    challenge: {
      specialist: "zatca",
      review: { status: "challenge", conclusion: "The buyer is Established private, but the finding does not state the lower advance rate or test it against the facility.", evidenceGap: "Apply the 70% Established private advance rate to SAR 2,250,000.", reasoningDefect: null, policyCitation: "SME-CP-07 §4.2" },
      revision: finding("pass", "Invoice INV-2026-2217 is cleared, undisputed and due in 96 days. The Established private buyer supports an advance rate up to 70%, which covers the SAR 2,250,000 requested facility.", [["INV-2026-2217 cleared", "ZATCA · clearance"], ["Established private buyer", "ZATCA · buyer record"], ["Advance rate up to 70% for Established private buyers", "SME-CP-07 §4.2"]], ["SME-CP-07 §3.3", "SME-CP-07 §4.1", "SME-CP-07 §4.2"]),
      revisionSummary: "Applied the Established private advance rate and tested it against the requested facility.",
    },
    recommendation: {
      outcome: "Approve", riskGrade: "B", indicativeProfitRate: "SAIBOR + 3.0%", missingGradeInputs: [], decisionAuthority: "Senior credit officer",
      reasons: [
        { clause: "SME-CP-07 §4.1", conclusion: "The invoice is due in 96 days, undisputed and for delivered clinical supplies.", evidence: "ZATCA clearance and the presented due date meet §4.1.", link: "revision" },
        { clause: "SME-CP-07 §4.2", conclusion: "The Established private buyer supports an advance rate up to 70%.", evidence: "The buyer record classifies the obligor as Established private.", link: "revision" },
        { clause: "SME-CP-07 §4.3", conclusion: "Single-buyer concentration of 34% is within the 40% limit.", evidence: "The buyer represents 34% of the SAR 2,250,000 facility.", link: "revision" },
        { clause: "SME-CP-07 §6", conclusion: "Grade B sets the indicative pricing basis.", evidence: "Low bureau risk and 1.55× DSCR support grade B.", link: "simah" },
      ],
    },
  },
};

/** A valid trail for any future seeded application that has no tailored copy yet. */
function fallbackPlan(application: ApplicationDoc): TrailPlan {
  const invoice = application.product === "invoice_financing";
  const referred = application.stage === "referred" || application.stage === "eligibility_review";
  const key: SpecialistKey = invoice ? "zatca" : "openBanking";
  const supporting = invoice
    ? finding("pass", "Twelve months of statements support the requested facility with DSCR above the 1.25× minimum.", [["12 months analysed", "Open banking · statement period"]], ["SME-CP-07 §3.4"])
    : finding("pass", "The invoice on file is cleared, undisputed and within tenor.", [["Invoice cleared", "ZATCA · clearance"]], ["SME-CP-07 §3.3"]);
  const primary = invoice
    ? finding(referred ? "refer" : "pass", "The invoice and buyer-quality evidence were tested against the invoice-financing rules.", [["Invoice cleared", "ZATCA · clearance"], ["Buyer category recorded", "ZATCA · buyer record"]], ["SME-CP-07 §3.3"])
    : finding(referred ? "refer" : "pass", "Statement inflows and obligations were tested against the working-capital rules.", [["12 months analysed", "Open banking · statement period"], ["DSCR after obligations recorded", "Open banking · obligations"]], ["SME-CP-07 §3.4"]);
  return {
    scenarioId: "clean",
    findings: { simah: passedSimah(700, "Active bureau file"), wathq: passedWathq(application.commercialRegistration, 36, "the registered activity"), zatca: invoice ? primary : supporting, openBanking: invoice ? supporting : primary },
    challenge: {
      specialist: key,
      review: { status: "challenge", conclusion: "The finding records the evidence but does not state the policy consequence.", evidenceGap: "State the policy consequence and link it to the recommendation.", reasoningDefect: "The policy consequence is missing.", policyCitation: invoice ? "SME-CP-07 §4.1" : "SME-CP-07 §5.1" },
      revision: finding(referred ? "refer" : "pass", `The reworked ${invoice ? "invoice" : "cash-flow"} finding applies the product policy to the recorded evidence.`, [["Policy test applied", "Assessment record"]], [invoice ? "SME-CP-07 §4.1" : "SME-CP-07 §5.1"]),
      revisionSummary: "Applied the product policy consequence to the recorded evidence.",
    },
    recommendation: {
      outcome: referred ? "Refer" : "Approve",
      riskGrade: referred ? (application.riskGrade ?? "C") : (application.riskGrade ?? "B"),
      indicativeProfitRate: referred ? "SAIBOR + 4.0%" : "SAIBOR + 3.0%",
      missingGradeInputs: [],
      decisionAuthority: referred ? "Credit analyst reviews the flagged checks" : application.amountSar <= 2000000 ? "Credit analyst confirms" : "Senior credit officer",
      reasons: [
        { clause: invoice ? "SME-CP-07 §4.1" : "SME-CP-07 §5.1", conclusion: "The product eligibility conditions were tested against the recorded evidence.", evidence: "The reworked finding records the policy test.", link: "revision" },
        { clause: "SME-CP-07 §6", conclusion: "The assessed grade sets the indicative pricing basis.", evidence: "Bureau and financial evidence support the assessed grade.", link: "simah" },
      ],
    },
  };
}

function addMinutes(startedAt: string, minutes: number): string {
  return new Date(new Date(startedAt).getTime() + minutes * 60_000).toISOString();
}

function buildRun(application: ApplicationDoc, plan: TrailPlan, startedAt: string) {
  const prefix = `sample-trail-${application._id}`;
  const ids: Record<SpecialistKey, string> = { simah: `${prefix}-simah`, wathq: `${prefix}-wathq`, zatca: `${prefix}-zatca`, openBanking: `${prefix}-open-banking` };
  const revisionId = `${prefix}-${plan.challenge.specialist === "openBanking" ? "open-banking" : "zatca"}-r2`;
  const revisedLabel = SPECIALISTS.find((item) => item.key === plan.challenge.specialist)!;
  const revisedFinding = {
    id: revisionId,
    specialistType: revisedLabel.label,
    round: 2 as const,
    outcome: plan.challenge.revision.outcome,
    plainLanguageFinding: plan.challenge.revision.plainLanguageFinding,
    sourceLabel: revisedLabel.sourceLabel,
    evidence: plan.challenge.revision.evidence.map(([fact, sourceReference]) => ({ fact, sourceReference })),
    policyCitations: plan.challenge.revision.policyCitations,
    createdAt: addMinutes(startedAt, 9),
    revisionSummary: plan.challenge.revisionSummary,
  };
  const specialistFindings = SPECIALISTS.map((specialist, index) => {
    const planned = plan.findings[specialist.key];
    return {
      id: ids[specialist.key],
      specialistType: specialist.label,
      round: 1 as const,
      outcome: planned.outcome,
      plainLanguageFinding: planned.plainLanguageFinding,
      sourceLabel: specialist.sourceLabel,
      evidence: planned.evidence.map(([fact, sourceReference]) => ({ fact, sourceReference })),
      policyCitations: planned.policyCitations,
      createdAt: addMinutes(startedAt, 1 + index),
      revisionSummary: null,
    };
  });
  const reviewerChallenges = SPECIALISTS.map((specialist, index) => {
    const challenged = specialist.key === plan.challenge.specialist;
    const review = challenged ? plan.challenge.review : accepted();
    return {
      id: `${prefix}-review-${specialist.key}`,
      findingId: ids[specialist.key],
      specialistType: specialist.label,
      status: review.status,
      conclusion: review.conclusion,
      evidenceGap: review.evidenceGap,
      reasoningDefect: review.reasoningDefect,
      policyCitation: review.policyCitation,
      createdAt: addMinutes(startedAt, 5 + index),
    };
  });
  const finalRecommendation = {
    outcome: plan.recommendation.outcome,
    riskGrade: plan.recommendation.riskGrade,
    indicativeProfitRate: plan.recommendation.indicativeProfitRate,
    missingGradeInputs: plan.recommendation.missingGradeInputs,
    decisionAuthority: plan.recommendation.decisionAuthority,
    authorityClause: AUTHORITY_CLAUSE,
    reasons: plan.recommendation.reasons.map((reason) => ({
      clause: reason.clause,
      conclusion: reason.conclusion,
      evidence: reason.evidence,
      findingIds: [reason.link === "revision" ? revisionId : ids[reason.link]],
    })),
    notice: NOTICE,
    createdAt: addMinutes(startedAt, 10),
  };
  return {
    applicationId: application._id,
    scenarioId: plan.scenarioId,
    status: "completed" as const,
    startedAt,
    completedAt: addMinutes(startedAt, 11),
    createdBy: "Credit analyst" as const,
    sampleData: true,
    failureReason: null,
    specialistFindings,
    reviewerChallenges,
    revisedFindings: [revisedFinding],
    finalRecommendation,
  };
}

export async function up(db: Db): Promise<void> {
  const applications = await db.collection<ApplicationDoc>("applications")
    .find({ sampleData: true, stage: { $ne: "new" } })
    .sort({ _id: 1 })
    .limit(100)
    .toArray();
  const runs = db.collection<{ _id: string; startedAt?: string; [key: string]: unknown }>("applicationCheckRuns");

  for (const application of applications) {
    const plan = TRAILS[application._id] ?? fallbackPlan(application);

    // Never add a sample trail beside an assessment a person actually ran.
    if (await runs.findOne({ applicationId: application._id, sampleData: { $ne: true } })) continue;

    // A complete sample trail already exists: re-running the migration changes nothing.
    if (await runs.findOne({ applicationId: application._id, sampleData: true, legacy: { $ne: true }, specialistFindings: { $exists: true } })) continue;

    // A recommendation-only sample run from an earlier seed is completed in place, keeping its id and links.
    const placeholder = await runs.findOne(
      { applicationId: application._id, sampleData: true, legacy: { $ne: true }, specialistFindings: { $exists: false } },
      { sort: { startedAt: -1 } },
    );
    if (placeholder) {
      const startedAt = typeof placeholder.startedAt === "string" && !Number.isNaN(new Date(placeholder.startedAt).getTime())
        ? placeholder.startedAt
        : SAMPLE_START;
      const run = buildRun(application, plan, startedAt);
      const { startedAt: _startedAt, ...fields } = run;
      await runs.updateOne(
        { _id: placeholder._id, specialistFindings: { $exists: false } },
        { $set: fields },
      );
      continue;
    }

    const run = buildRun(application, plan, SAMPLE_START);
    await runs.updateOne(
      { _id: `sample-trail-${application._id}` },
      { $setOnInsert: { _id: `sample-trail-${application._id}`, ...run } },
      { upsert: true },
    );
  }
}

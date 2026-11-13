import type { Db } from "mongodb";

/**
 * Rebuilds the seeded assessment trails from the simulated source pack stored for each application, so the
 * figures in a trail cannot contradict its source. app-1029 gets its own sample round; the recommendation-only
 * historical run `sample-assessment-app-1029-throughput` is restored rather than overwritten.
 *
 * Idempotent: a fixed `sample-trail-<applicationId>` id with $set of the same values.
 */

const SAMPLE_START = "2026-11-12T07:30:00.000Z";
const NOTICE = "AI recommendation — a human must make the decision under SME-CP-07 §7.1.";
const AUTHORITY_CLAUSE = "SME-CP-07 §7.1";

type Product = "invoice_financing" | "working_capital";
type Grade = "A" | "B" | "C" | "D";
type SpecialistKey = "simah" | "wathq" | "zatca" | "openBanking";
type FindingOutcome = "pass" | "refer";

interface ApplicationDoc {
  _id: string;
  businessName: string;
  product: Product;
  amountSar: number;
  stage: string;
  commercialRegistration: string;
  riskGrade?: Grade;
}

interface SimahSource {
  commercialScore: number;
  ownerReportsCheckedAtOrAbovePercent: number;
  defaultsWriteOffsOrRestructuresLast24Months: number;
}

interface WathqSource {
  commercialRegistration: string;
  status: string;
  activeMonths: number;
  registeredActivityMatchesPurpose: boolean;
  signatoryAuthorised: boolean;
}

interface ZatcaSource {
  applicable?: boolean;
  reason?: string;
  invoiceNumber?: string | null;
  buyerName?: string | null;
  amountSar?: number | null;
  clearanceStatus?: string;
  fieldsMatch?: boolean;
  previouslyFinancedOrPledged?: boolean;
  buyerDispute?: boolean;
  buyerCategory?: string | null;
}

interface OpenBankingSource {
  statementMonths: number;
  averageMonthlyInflowSar: number;
  inflowVolatilityPercent: number;
  returnedCheques: number;
  monthlyExistingObligationsSar: number;
  dscr: number;
  annualRevenueSar?: number;
}

interface SourcePack {
  applicationId: string;
  scenarioId: "clean" | "disputed_invoice" | "low_bureau" | "returned_cheques";
  sources: {
    "SIMAH credit bureau": SimahSource;
    "Wathq company verification": WathqSource;
    "ZATCA e-invoice verification": ZatcaSource;
    "Open banking cash flow": OpenBankingSource;
  };
}

interface PlannedFinding {
  outcome: FindingOutcome;
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
  missingGradeInputs: ("commercial_credit_report" | "owner_credit_reports" | "debt_service_coverage" | "buyer_quality")[];
  decisionAuthority: "Credit analyst confirms" | "Senior credit officer" | "Credit analyst reviews the flagged checks" | "Credit analyst, then a second analyst (four eyes)" | "Credit committee";
  reasons: { clause: string; conclusion: string; evidence: string; link: SpecialistKey | "revision" }[];
}

const SPECIALISTS: { key: SpecialistKey; label: string; sourceLabel: string }[] = [
  { key: "simah", label: "SIMAH credit bureau", sourceLabel: "Simulated SIMAH commercial and qualifying-owner reports" },
  { key: "wathq", label: "Wathq company verification", sourceLabel: "Simulated Wathq CR record" },
  { key: "zatca", label: "ZATCA e-invoice verification", sourceLabel: "Simulated ZATCA clearance record" },
  { key: "openBanking", label: "Open banking cash flow", sourceLabel: "Simulated 12-month bank statements" },
];

function money(value: number): string {
  return value.toLocaleString("en-US");
}

function finding(outcome: FindingOutcome, text: string, evidence: [string, string][], citations: string[]): PlannedFinding {
  return { outcome, plainLanguageFinding: text, evidence, policyCitations: citations };
}

function accepted(): PlannedReview {
  return { status: "accepted", conclusion: "Reviewer tested the conclusion and found it supported by the cited evidence.", evidenceGap: null, reasoningDefect: null, policyCitation: null };
}

function addMinutes(startedAt: string, minutes: number): string {
  return new Date(new Date(startedAt).getTime() + minutes * 60_000).toISOString();
}

function advanceRate(category: string | null | undefined): number | null {
  if (category === "Government") return 85;
  if (category === "Listed") return 80;
  if (category === "Established private") return 70;
  return null;
}

function gradeFor(outcome: PlannedRecommendation["outcome"], app: ApplicationDoc, missingInvoice: boolean, dscr: number): Grade | null {
  if (missingInvoice) return null;
  if (outcome === "Decline" || outcome === "Refer") return "C";
  if (app.riskGrade) return app.riskGrade;
  return dscr >= 1.75 ? "A" : dscr >= 1.4 ? "B" : "C";
}

function priceFor(grade: Grade | null): string | null {
  if (grade === "A") return "SAIBOR + 2.25%";
  if (grade === "B") return "SAIBOR + 3.0%";
  if (grade === "C") return "SAIBOR + 4.0%";
  return null;
}

function authorityFor(outcome: PlannedRecommendation["outcome"], amountSar: number): PlannedRecommendation["decisionAuthority"] {
  if (outcome === "Decline") return "Credit analyst, then a second analyst (four eyes)";
  if (outcome === "Refer") return "Credit analyst reviews the flagged checks";
  if (amountSar <= 2_000_000) return "Credit analyst confirms";
  if (amountSar <= 5_000_000) return "Senior credit officer";
  return "Credit committee";
}

function buildRun(application: ApplicationDoc, pack: SourcePack, startedAt: string) {
  const simah = pack.sources["SIMAH credit bureau"];
  const wathq = pack.sources["Wathq company verification"];
  const zatca = pack.sources["ZATCA e-invoice verification"];
  const openBanking = pack.sources["Open banking cash flow"];
  const invoiceFinancing = application.product === "invoice_financing";
  const inflow = openBanking.averageMonthlyInflowSar;
  const dscr = openBanking.dscr;
  const cheques = openBanking.returnedCheques;
  const revenue = openBanking.annualRevenueSar;
  const invoiceAmount = typeof zatca.amountSar === "number" ? zatca.amountSar : null;
  const invoiceNumber = zatca.invoiceNumber ?? null;
  const buyerCategory = zatca.buyerCategory ?? null;
  const missingInvoice = invoiceFinancing && (invoiceNumber === null || invoiceAmount === null);
  const disputedInvoice = invoiceFinancing && zatca.buyerDispute === true;
  const rate = advanceRate(buyerCategory);
  const advanceCapacity = invoiceAmount !== null && rate !== null ? Math.floor(invoiceAmount * rate / 100) : null;

  const simahFinding = finding(
    simah.commercialScore >= 600 && simah.defaultsWriteOffsOrRestructuresLast24Months === 0 ? "pass" : "refer",
    `Commercial score ${simah.commercialScore} is recorded with ${simah.defaultsWriteOffsOrRestructuresLast24Months} defaults, write-offs or restructures in the last 24 months. Qualifying owners at ${simah.ownerReportsCheckedAtOrAbovePercent}% and above were checked.`,
    [
      [`Commercial score ${simah.commercialScore}`, "SIMAH commercial report · score"],
      [`${simah.defaultsWriteOffsOrRestructuresLast24Months} defaults, write-offs or restructures in 24 months`, "SIMAH commercial report · payment history"],
      [`Qualifying owners checked at ${simah.ownerReportsCheckedAtOrAbovePercent}% and above`, "SIMAH owner reports · ownership"],
    ],
    ["SME-CP-07 §3.1"],
  );

  const wathqFinding = finding(
    wathq.status === "active" && wathq.registeredActivityMatchesPurpose && wathq.signatoryAuthorised ? "pass" : "refer",
    `CR ${wathq.commercialRegistration} is ${wathq.status} for ${wathq.activeMonths} months, its registered activity matches the stated purpose, and the signatory on the application is authorised.`,
    [
      [`CR ${wathq.commercialRegistration} ${wathq.status} for ${wathq.activeMonths} months`, "Wathq record · status and tenure"],
      [`Registered activity matches the stated purpose: ${wathq.registeredActivityMatchesPurpose}`, "Wathq record · activity"],
      [`Authorised signatory confirmed: ${wathq.signatoryAuthorised}`, "Wathq record · signatories"],
    ],
    ["SME-CP-07 §3.2"],
  );

  let zatcaFinding: PlannedFinding;
  if (!invoiceFinancing || zatca.applicable === false) {
    zatcaFinding = finding("pass", "No invoice verification applies to a working-capital facility; the simulated ZATCA source records the invoice check as not applicable.", [["Working-capital product", "ZATCA source · applicability"], [zatca.reason ?? "Invoice check not applicable", "ZATCA source · reason"]], ["SME-CP-07 §3.3"]);
  } else if (missingInvoice) {
    zatcaFinding = finding("refer", "No invoice record is attached to the application: the invoice number, buyer and amount are not recorded, so the §4.1 eligibility conditions cannot be evidenced.", [["Invoice record not attached", "ZATCA source · invoice"], ["Invoice number, buyer and amount not recorded", "ZATCA source · invoice"], ["Eligibility cannot be evidenced", "SME-CP-07 §4.1"]], ["SME-CP-07 §3.3", "SME-CP-07 §4.1", "SME-CP-07 §4.5"]);
  } else if (disputedInvoice) {
    zatcaFinding = finding("refer", `Invoice ${invoiceNumber} for SAR ${money(invoiceAmount!)} is recorded as ${zatca.clearanceStatus ?? "not cleared"} for a ${buyerCategory ?? "recorded"} buyer; the dispute makes the invoice ineligible until it is resolved.`, [[`Invoice ${invoiceNumber}`, "ZATCA · invoice"], [`Amount SAR ${money(invoiceAmount!)}`, "ZATCA · amount"], [`Clearance status ${zatca.clearanceStatus ?? "not cleared"}`, "ZATCA · clearance"], [`Buyer dispute ${zatca.buyerDispute === true}`, "ZATCA · dispute"]], ["SME-CP-07 §3.3", "SME-CP-07 §4.1"]);
  } else {
    zatcaFinding = finding("pass", `Invoice ${invoiceNumber} for SAR ${money(invoiceAmount!)} is recorded as ${(zatca.clearanceStatus ?? "cleared").toLowerCase()} and undisputed for a ${buyerCategory ?? "recorded"} buyer; the recorded fields match the application and the invoice was not previously financed or pledged.`, [[`Invoice ${invoiceNumber} for SAR ${money(invoiceAmount!)}`, "ZATCA · invoice"], [`Clearance ${zatca.clearanceStatus ?? "Cleared"}`, "ZATCA · clearance"], [`Buyer category ${buyerCategory ?? "not recorded"}`, "ZATCA · buyer record"], [`Fields match the application: ${zatca.fieldsMatch === true}`, "ZATCA · field matching"], [`Previously financed or pledged: ${zatca.previouslyFinancedOrPledged === true}`, "ZATCA · financing history"]], ["SME-CP-07 §3.3", "SME-CP-07 §4.1", "SME-CP-07 §4.2"]);
  }

  const chequesAboveLimit = cheques > 3;
  const dscrBelowMinimum = dscr < 1.25;
  const openBankingFinding = finding(
    chequesAboveLimit || dscrBelowMinimum ? "refer" : "pass",
    `Twelve months of statements show average monthly inflow SAR ${money(inflow)} and DSCR of ${dscr}× after SAR ${money(openBanking.monthlyExistingObligationsSar)} of monthly existing obligations, with ${cheques} returned cheque${cheques === 1 ? "" : "s"} in 12 months.${chequesAboveLimit ? " The returned cheques exceed the three-cheque referral threshold in §5.3." : ""}${dscrBelowMinimum ? " DSCR is below the 1.25× minimum in §5.2." : ""}`,
    [
      [`${openBanking.statementMonths} months analysed`, "Open banking · statement period"],
      [`Average monthly inflow SAR ${money(inflow)}`, "Open banking · inflows"],
      [`DSCR after existing obligations ${dscr}×`, "Open banking · obligations"],
      [`${cheques} returned cheque${cheques === 1 ? "" : "s"} in 12 months`, "Open banking · payment record"],
      ...(revenue === undefined ? [] : [[`Annual revenue SAR ${money(revenue)}`, "Open banking · revenue"] as [string, string]]),
    ],
    ["SME-CP-07 §3.4", ...(chequesAboveLimit ? ["SME-CP-07 §5.3"] : []), ...(dscrBelowMinimum ? ["SME-CP-07 §5.2"] : [])],
  );

  const findings = { simah: simahFinding, wathq: wathqFinding, zatca: zatcaFinding, openBanking: openBankingFinding };
  const flagged = Object.values(findings).filter((item) => item.outcome !== "pass");
  const stageRefer = application.stage === "referred" || application.stage === "eligibility_review";
  const shortfall = invoiceFinancing && advanceCapacity !== null && advanceCapacity < application.amountSar;
  const blockedByInvoice = missingInvoice || disputedInvoice || (invoiceFinancing && rate === null);
  const outcome: PlannedRecommendation["outcome"] =
    !invoiceFinancing && chequesAboveLimit ? "Decline"
      : flagged.length > 0 ? "Refer"
        : stageRefer || shortfall || (invoiceFinancing && blockedByInvoice) ? "Refer"
          : "Approve";
  const riskGrade = gradeFor(outcome, application, missingInvoice, dscr);
  const authority = authorityFor(outcome, application.amountSar);

  const challenged: SpecialistKey = invoiceFinancing ? "zatca" : "openBanking";
  const challengedFinding = findings[challenged];
  const revisionId = `sample-trail-${application._id}-${challenged === "openBanking" ? "open-banking" : "zatca"}-r2`;
  let review: PlannedReview;
  let revision: PlannedFinding;
  let revisionSummary: string;
  if (challengedFinding.outcome === "refer") {
    if (invoiceFinancing && missingInvoice) {
      review = { status: "challenge", conclusion: "The missing invoice is recorded, but the finding does not name the §4.1 eligibility conditions that cannot be evidenced or the referral consequence.", evidenceGap: "State which invoice conditions fail and that §4.5 requires referral.", reasoningDefect: "The policy consequence was not linked to a specific condition.", policyCitation: "SME-CP-07 §4.1" };
      revision = finding("refer", "Without an invoice record, the §4.1 due-date, delivery and dispute conditions cannot be evidenced. The case is referred for eligibility review before an advance rate is set.", [["Invoice record not attached", "ZATCA source · invoice"], ["Due date, delivery and dispute status unverified", "ZATCA · no clearance record"], ["Eligibility conditions cannot be evidenced", "SME-CP-07 §4.1"]], ["SME-CP-07 §3.3", "SME-CP-07 §4.1", "SME-CP-07 §4.5"]);
      revisionSummary = "Tied the missing invoice record to the §4.1 eligibility conditions and the referral consequence.";
    } else if (invoiceFinancing) {
      review = { status: "challenge", conclusion: "The dispute is recorded, but the finding does not state that the invoice is ineligible until the dispute is resolved.", evidenceGap: "Apply §4.1 to the disputed invoice and state the referral consequence.", reasoningDefect: "The policy consequence was not applied to the dispute.", policyCitation: "SME-CP-07 §4.1" };
      revision = finding("refer", `Invoice ${invoiceNumber} is disputed, so the §4.1 eligibility conditions are not met. The case is referred until the dispute is resolved.`, [[`Invoice ${invoiceNumber}`, "ZATCA · invoice"], [`Buyer dispute ${zatca.buyerDispute === true}`, "ZATCA · dispute"], ["Disputed invoices are ineligible", "SME-CP-07 §4.1"]], ["SME-CP-07 §3.3", "SME-CP-07 §4.1"]);
      revisionSummary = "Applied the §4.1 dispute rule and stated the referral consequence.";
    } else {
      review = { status: "challenge", conclusion: `The ${cheques} returned cheques are recorded, but the finding does not apply the §5.3 threshold or connect it to the recommendation.`, evidenceGap: "Apply §5.3 to the returned cheques and connect it to the recommendation.", reasoningDefect: "The policy threshold was recorded but not applied.", policyCitation: "SME-CP-07 §5.3" };
      revision = finding("refer", `${cheques} returned cheques in 12 months exceed the three-cheque threshold in §5.3, and DSCR after existing obligations is ${dscr}×. The file cannot be approved on the payment record.`, [[`${cheques} returned cheques in 12 months`, "Open banking · payment record"], [`DSCR after existing obligations ${dscr}×`, "Open banking · obligations"], ["Threshold is more than 3 returned cheques", "SME-CP-07 §5.3"]], ["SME-CP-07 §3.4", "SME-CP-07 §5.2", "SME-CP-07 §5.3"]);
      revisionSummary = "Applied the returned-cheque threshold to the statement evidence.";
    }
  } else if (invoiceFinancing) {
    review = { status: "challenge", conclusion: "The invoice eligibility is supported, but the finding does not apply the buyer's §4.2 advance rate to the requested facility.", evidenceGap: `Apply the ${rate}% ${buyerCategory} advance rate to the SAR ${money(application.amountSar)} facility.`, reasoningDefect: null, policyCitation: "SME-CP-07 §4.2" };
    const capacityText = advanceCapacity === null ? "The advance rate is not recorded." : `The advance capacity is SAR ${money(advanceCapacity)} against the requested SAR ${money(application.amountSar)} facility.`;
    revision = finding("pass", `Invoice ${invoiceNumber} for SAR ${money(invoiceAmount!)} is eligible for a ${buyerCategory} buyer at an advance rate up to ${rate}%. ${capacityText}`, [[`Invoice ${invoiceNumber} for SAR ${money(invoiceAmount!)}`, "ZATCA · invoice"], [`${buyerCategory} advance rate up to ${rate}%`, "SME-CP-07 §4.2"], [`Advance capacity SAR ${money(advanceCapacity ?? 0)}`, "Assessment · limit calculation"]], ["SME-CP-07 §3.3", "SME-CP-07 §4.1", "SME-CP-07 §4.2"]);
    revisionSummary = "Applied the §4.2 advance rate to the requested facility.";
  } else {
    review = { status: "challenge", conclusion: "The statement evidence is recorded, but the finding does not show the §5.1 limit calculation.", evidenceGap: `Show the three-month inflow cap and 25% revenue cap against SAR ${money(application.amountSar)}.`, reasoningDefect: null, policyCitation: "SME-CP-07 §5.1" };
    const revenueText = revenue === undefined ? "Annual revenue is not recorded in the source pack." : `25% of annual revenue SAR ${money(revenue)} is SAR ${money(Math.floor(revenue * 0.25))}.`;
    revision = finding("pass", `Average monthly inflow SAR ${money(inflow)} supports three-month capacity of SAR ${money(inflow * 3)}. ${revenueText} The SAR ${money(application.amountSar)} facility is within the inflow cap, and DSCR of ${dscr}× clears the 1.25× minimum.`, [[`Average monthly inflow SAR ${money(inflow)}`, "Open banking · inflows"], [`Three-month capacity SAR ${money(inflow * 3)}`, "Open banking · limit calculation"], [revenue === undefined ? "Annual revenue not recorded" : `Annual revenue SAR ${money(revenue)}`, "Open banking · revenue"], [`DSCR after existing obligations ${dscr}×`, "Open banking · obligations"]], ["SME-CP-07 §3.4", "SME-CP-07 §5.1", "SME-CP-07 §5.2"]);
    revisionSummary = "Added the §5.1 limit calculation and the DSCR comparison.";
  }

  const reasons: PlannedRecommendation["reasons"] = [];
  if (invoiceFinancing) {
    const invoiceEvidence = missingInvoice
      ? "No invoice record is attached; due date, delivery and dispute status are unknown."
      : disputedInvoice
        ? `Invoice ${invoiceNumber} is recorded as ${zatca.clearanceStatus ?? "not cleared"}.`
        : `Invoice ${invoiceNumber} for SAR ${money(invoiceAmount!)} is cleared, undisputed and matches the application.`;
    reasons.push({ clause: "SME-CP-07 §4.1", conclusion: missingInvoice ? "Invoice eligibility cannot be evidenced without the invoice record." : disputedInvoice ? "The disputed invoice does not meet the eligibility conditions." : "The invoice meets the eligibility conditions.", evidence: invoiceEvidence, link: "revision" });
    if (missingInvoice) {
      reasons.push({ clause: "SME-CP-07 §4.2", conclusion: "Buyer quality and the advance rate cannot be tested without the invoice.", evidence: "The buyer category and invoice amount are not recorded.", link: "revision" });
      reasons.push({ clause: "SME-CP-07 §4.5", conclusion: "A missing invoice requires referral.", evidence: "No invoice is attached, so the duplicate and mismatch checks cannot run.", link: "revision" });
    } else if (rate === null) {
      reasons.push({ clause: "SME-CP-07 §4.2", conclusion: "An Other buyer cannot receive an advance without analyst referral.", evidence: `The buyer record classifies the obligor as ${buyerCategory ?? "Other"}.`, link: "revision" });
    } else {
      reasons.push({ clause: "SME-CP-07 §4.2", conclusion: `The ${buyerCategory} buyer supports an advance rate up to ${rate}%.`, evidence: `Advance capacity is SAR ${money(advanceCapacity ?? 0)} against the SAR ${money(application.amountSar)} facility.`, link: "revision" });
    }
    if (disputedInvoice) reasons.push({ clause: "SME-CP-07 §4.5", conclusion: "A disputed invoice requires referral.", evidence: `Invoice ${invoiceNumber} is disputed.`, link: "revision" });
  } else {
    const revenueQuarter = revenue === undefined ? null : Math.floor(revenue * 0.25);
    reasons.push({
      clause: "SME-CP-07 §5.1",
      conclusion: revenueQuarter === null ? "The facility is within the three-month inflow cap; annual revenue is not recorded." : "The facility is within the revenue and inflow caps.",
      evidence: revenueQuarter === null
        ? `Three months of SAR ${money(inflow)} inflow is SAR ${money(inflow * 3)}; annual revenue is not recorded in the source pack.`
        : `25% of SAR ${money(revenue!)} revenue is SAR ${money(revenueQuarter)}; three months of SAR ${money(inflow)} inflow is SAR ${money(inflow * 3)}.`,
      link: "revision",
    });
    reasons.push({ clause: "SME-CP-07 §5.2", conclusion: `DSCR of ${dscr}× ${dscr >= 1.25 ? "clears" : "is below"} the 1.25× minimum.`, evidence: `DSCR after SAR ${money(openBanking.monthlyExistingObligationsSar)} of monthly existing obligations is ${dscr}×.`, link: "revision" });
    reasons.push({ clause: "SME-CP-07 §5.3", conclusion: `${cheques} returned cheque${cheques === 1 ? "" : "s"} in 12 months ${chequesAboveLimit ? "exceed" : "are within"} the three-cheque threshold.`, evidence: `The statement record lists ${cheques} returned cheque${cheques === 1 ? "" : "s"} in the last 12 months.`, link: "revision" });
  }
  reasons.push({ clause: "SME-CP-07 §6", conclusion: riskGrade === null ? "No risk grade can be assigned until buyer quality is evidenced." : `Grade ${riskGrade} sets the indicative pricing basis.`, evidence: riskGrade === null ? "Buyer category is not recorded on the invoice." : `Bureau score ${simah.commercialScore} and DSCR ${dscr}× support grade ${riskGrade}.`, link: "simah" });

  const plan: PlannedRecommendation = {
    outcome,
    riskGrade,
    indicativeProfitRate: priceFor(riskGrade),
    missingGradeInputs: riskGrade === null ? ["buyer_quality"] : [],
    decisionAuthority: authority,
    reasons,
  };

  const prefix = `sample-trail-${application._id}`;
  const ids: Record<SpecialistKey, string> = { simah: `${prefix}-simah`, wathq: `${prefix}-wathq`, zatca: `${prefix}-zatca`, openBanking: `${prefix}-open-banking` };
  const revisedLabel = SPECIALISTS.find((item) => item.key === challenged)!;
  const revisedFinding = {
    id: revisionId,
    specialistType: revisedLabel.label,
    round: 2 as const,
    outcome: revision.outcome,
    plainLanguageFinding: revision.plainLanguageFinding,
    sourceLabel: revisedLabel.sourceLabel,
    evidence: revision.evidence.map(([fact, sourceReference]) => ({ fact, sourceReference })),
    policyCitations: revision.policyCitations,
    createdAt: addMinutes(startedAt, 9),
    revisionSummary,
  };
  const specialistFindings = SPECIALISTS.map((specialist, index) => {
    const planned = findings[specialist.key];
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
    const reviewPlan = specialist.key === challenged ? review : accepted();
    return {
      id: `${prefix}-review-${specialist.key}`,
      findingId: ids[specialist.key],
      specialistType: specialist.label,
      status: reviewPlan.status,
      conclusion: reviewPlan.conclusion,
      evidenceGap: reviewPlan.evidenceGap,
      reasoningDefect: reviewPlan.reasoningDefect,
      policyCitation: reviewPlan.policyCitation,
      createdAt: addMinutes(startedAt, 5 + index),
    };
  });
  const finalRecommendation = {
    outcome: plan.outcome,
    riskGrade: plan.riskGrade,
    indicativeProfitRate: plan.indicativeProfitRate,
    missingGradeInputs: plan.missingGradeInputs,
    decisionAuthority: plan.decisionAuthority,
    authorityClause: AUTHORITY_CLAUSE,
    reasons: plan.reasons.map((reason) => ({
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
    scenarioId: pack.scenarioId,
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

/** The pre-0014 recommendation-only round, kept for the historical audit trail. */
const ORIGINAL_THROUGHPUT_RUN = {
  applicationId: "app-1029",
  status: "completed",
  startedAt: "2026-11-10T11:00:00.000Z",
  sampleData: true,
  finalRecommendation: {
    outcome: "Approve",
    riskGrade: "B",
    indicativeProfitRate: "SAIBOR + 3.0%",
    decisionAuthority: "Senior credit officer",
    authorityClause: AUTHORITY_CLAUSE,
    reasons: [],
    notice: NOTICE,
    createdAt: "2026-11-10T14:00:00.000Z",
  },
};

function validStartedAt(value: unknown): string {
  return typeof value === "string" && !Number.isNaN(new Date(value).getTime()) ? value : SAMPLE_START;
}

export async function up(db: Db): Promise<void> {
  const applications = await db.collection<ApplicationDoc>("applications")
    .find({ sampleData: true, stage: { $ne: "new" } })
    .sort({ _id: 1 })
    .limit(100)
    .toArray();
  const runs = db.collection<{ _id: string; startedAt?: string; scenarioId?: SourcePack["scenarioId"]; [key: string]: unknown }>("applicationCheckRuns");
  const sources = db.collection<SourcePack>("simulatedAssessmentSources");

  for (const application of applications) {
    // Never touch an application a person actually assessed.
    if (await runs.findOne({ applicationId: application._id, sampleData: { $ne: true }, legacy: { $ne: true } })) continue;

    const existing = await runs.findOne(
      {
        applicationId: application._id,
        sampleData: true,
        legacy: { $ne: true },
        specialistFindings: { $exists: true },
        _id: { $ne: "sample-assessment-app-1029-throughput" },
      },
      { sort: { startedAt: -1, _id: -1 } },
    );
    const scenarioId = existing?.scenarioId ?? "clean";
    const pack = await sources.findOne({ applicationId: application._id, scenarioId });
    if (!pack) continue;
    const run = buildRun(application, pack, validStartedAt(existing?.startedAt));
    const { startedAt: _startedAt, ...fields } = run;
    await runs.updateOne(
      { _id: `sample-trail-${application._id}` },
      { $set: { startedAt: run.startedAt, ...fields } },
      { upsert: true },
    );
  }

  // 0014 completed this recommendation-only round in place. Restore its original shape now that the trail is
  // its own round, so the historical record is no longer rewritten.
  await runs.updateOne(
    { _id: "sample-assessment-app-1029-throughput", specialistFindings: { $exists: true } },
    {
      $set: ORIGINAL_THROUGHPUT_RUN,
      $unset: { scenarioId: "", completedAt: "", createdBy: "", failureReason: "", specialistFindings: "", reviewerChallenges: "", revisedFindings: "", legacy: "", legacyReason: "" },
    },
  );
}

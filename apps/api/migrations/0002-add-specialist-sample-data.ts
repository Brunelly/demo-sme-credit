import type { Db } from "mongodb";

const businesses = [
  { _id: "app-1025", businessName: "Najd Food Distribution", businessNameArabic: "نجد لتوزيع الأغذية", commercialRegistration: "1010864297", product: "invoice_financing", amountSar: 2400000, stage: "credit_assessment", receivedAt: new Date("2026-11-03T08:30:00Z"), city: "Riyadh", annualRevenueSar: 28600000, invoice: { number: "INV-2026-1842", buyerName: "Riyadh Municipal Supplies Directorate", buyerCategory: "Government", amountSar: 3000000 } },
  { _id: "app-1026", businessName: "Red Sea Logistics Services", businessNameArabic: "خدمات لوجستيات البحر الأحمر", commercialRegistration: "4030462185", product: "working_capital", amountSar: 3100000, stage: "eligibility_review", receivedAt: new Date("2026-11-07T09:40:00Z"), city: "Jeddah", annualRevenueSar: 41800000 },
  { _id: "app-1027", businessName: "Dammam Construction Supplies", businessNameArabic: "الدمام لمستلزمات البناء", commercialRegistration: "2050216843", product: "invoice_financing", amountSar: 1750000, stage: "new", receivedAt: new Date("2026-11-09T06:55:00Z"), city: "Dammam", annualRevenueSar: 19300000, invoice: { number: "INV-2026-2094", buyerName: "Gulf Horizon Contracting", buyerCategory: "Established private", amountSar: 2500000 } },
  { _id: "app-1028", businessName: "Qassim Date Packaging", businessNameArabic: "القصيم لتعبئة التمور", commercialRegistration: "1130129476", product: "working_capital", amountSar: 1200000, stage: "credit_assessment", receivedAt: new Date("2026-11-10T07:25:00Z"), city: "Buraidah", annualRevenueSar: 12400000 },
  { _id: "app-1029", businessName: "Madinah Clinical Supplies", businessNameArabic: "المدينة للمستلزمات السريرية", commercialRegistration: "4650093182", product: "invoice_financing", amountSar: 2250000, stage: "decision_required", receivedAt: new Date("2026-11-10T10:10:00Z"), city: "Madinah", annualRevenueSar: 33700000, invoice: { number: "INV-2026-2217", buyerName: "Western Care Hospitals", buyerCategory: "Established private", amountSar: 2900000 } },
] as const;

export async function up(db: Db): Promise<void> {
  const collection = db.collection<{ _id: string; [key: string]: unknown }>("applications");
  for (const business of businesses) {
    await collection.updateOne({ _id: business._id }, { $setOnInsert: { ...business, sampleData: true } }, { upsert: true });
  }
}

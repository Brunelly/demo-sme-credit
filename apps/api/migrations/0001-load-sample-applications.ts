import type { Db } from "mongodb";

const applications = [
  { _id: "app-1007", businessName: "Al Nakhil Packaging", businessNameArabic: "تغليف النخيل", commercialRegistration: "1010842763", product: "working_capital", amountSar: 1850000, stage: "decision_required", receivedAt: new Date("2026-11-04T08:20:00Z"), city: "Riyadh", riskGrade: "B" },
  { _id: "app-1002", businessName: "Rawafid Industrial Supplies", businessNameArabic: "روافد للتوريدات الصناعية", commercialRegistration: "1010763428", product: "invoice_financing", amountSar: 3200000, stage: "referred", receivedAt: new Date("2026-11-05T10:45:00Z"), city: "Riyadh", riskGrade: "C" },
  { _id: "app-1011", businessName: "Bunyan Facilities Services", businessNameArabic: "بنيان لخدمات المرافق", commercialRegistration: "1010925184", product: "working_capital", amountSar: 950000, stage: "credit_assessment", receivedAt: new Date("2026-11-07T07:10:00Z"), city: "Riyadh", riskGrade: "B" },
  { _id: "app-1014", businessName: "Masarat Food Distribution", businessNameArabic: "مسارات لتوزيع الأغذية", commercialRegistration: "4030426719", product: "invoice_financing", amountSar: 4750000, stage: "eligibility_review", receivedAt: new Date("2026-11-08T12:35:00Z"), city: "Jeddah" },
  { _id: "app-1018", businessName: "Thimar Medical Trading", businessNameArabic: "ثمار للتجارة الطبية", commercialRegistration: "2050184736", product: "invoice_financing", amountSar: 2100000, stage: "credit_assessment", receivedAt: new Date("2026-11-09T09:15:00Z"), city: "Dammam", riskGrade: "A" },
  { _id: "app-1021", businessName: "Afaq Business Solutions", businessNameArabic: "آفاق لحلول الأعمال", commercialRegistration: "1010986247", product: "working_capital", amountSar: 1250000, stage: "new", receivedAt: new Date("2026-11-10T11:50:00Z"), city: "Riyadh" },
] as const;

export async function up(db: Db): Promise<void> {
  const collection = db.collection<{ _id: string }>("applications");
  for (const application of applications) {
    await collection.updateOne(
      { _id: application._id },
      { $setOnInsert: { ...application, sampleData: true } },
      { upsert: true },
    );
  }
}

import type { CreditApplication } from "@app/contracts";
import type { Db, IndexDescription } from "mongodb";

export const APPLICATIONS_COLLECTION = "applications";

interface ApplicationDocument extends Omit<CreditApplication, "id" | "receivedAt"> {
  _id: string;
  receivedAt: Date;
  sampleData: boolean;
}

export const applicationIndexes: IndexDescription[] = [
  { key: { receivedAt: 1, _id: 1 }, name: "applications_queue_age" },
];

export class ApplicationsRepository {
  private readonly db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  async list(): Promise<{ items: CreditApplication[]; sampleData: boolean }> {
    const documents = await this.db
      .collection<ApplicationDocument>(APPLICATIONS_COLLECTION)
      .find({})
      .sort({ receivedAt: 1, _id: 1 })
      .limit(50)
      .toArray();

    return {
      items: documents.map(({ _id, receivedAt, sampleData: _sampleData, ...application }) => ({
        id: _id,
        ...application,
        receivedAt: receivedAt.toISOString(),
      })),
      sampleData: documents.length > 0 && documents.every((item) => item.sampleData),
    };
  }

  async find(id: string): Promise<CreditApplication | null> {
    const document = await this.db.collection<ApplicationDocument>(APPLICATIONS_COLLECTION).findOne({ _id: id });
    if (!document) return null;
    const { _id, receivedAt, sampleData: _sampleData, ...application } = document;
    return { id: _id, ...application, receivedAt: receivedAt.toISOString() };
  }
}

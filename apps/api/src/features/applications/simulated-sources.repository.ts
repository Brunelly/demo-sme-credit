import type { SimulatedScenario, SpecialistType } from "@app/contracts";
import type { Db, IndexDescription } from "mongodb";

export const SIMULATED_SOURCES_COLLECTION = "simulatedAssessmentSources";
export const simulatedSourceIndexes: IndexDescription[] = [
  { key: { applicationId: 1, scenarioId: 1 }, name: "simulated_source_application_scenario", unique: true },
];

interface SourceDocument {
  _id: string;
  applicationId: string;
  scenarioId: SimulatedScenario;
  sampleData: true;
  sources: Record<SpecialistType, unknown>;
}

export class SimulatedSourcesRepository {
  private readonly db: Db;
  constructor(db: Db) { this.db = db; }
  async get(applicationId: string, scenarioId: SimulatedScenario): Promise<SourceDocument | null> {
    return this.db.collection<SourceDocument>(SIMULATED_SOURCES_COLLECTION).findOne({ applicationId, scenarioId });
  }
}

import type { SimulatedScenario, SimulatedScenarioSetting } from "@app/contracts";
import type { Db, IndexDescription } from "mongodb";
export const SIMULATED_SCENARIO_SETTINGS_COLLECTION = "simulatedScenarioSettings";
const ACTIVE_ID = "active";
interface SettingDocument { _id: string; activeScenarioId: SimulatedScenario; version: number; updatedAt: string; updatedBy: "Credit analyst" }
export const simulatedScenarioIndexes: IndexDescription[] = [{ key: { updatedAt: -1 }, name: "scenario_setting_updated" }];
export class SimulatedScenarioRepository {
  private readonly db: Db; private readonly fallback: SimulatedScenario;
  constructor(db: Db, fallback: SimulatedScenario) { this.db = db; this.fallback = fallback; }
  async get(): Promise<SimulatedScenarioSetting> {
    const found = await this.db.collection<SettingDocument>(SIMULATED_SCENARIO_SETTINGS_COLLECTION).findOne({ _id: ACTIVE_ID });
    return found ?? { activeScenarioId: this.fallback, version: 1, updatedAt: new Date(0).toISOString(), updatedBy: "Credit analyst" };
  }
  async update(activeScenarioId: SimulatedScenario): Promise<SimulatedScenarioSetting> {
    const updatedAt = new Date().toISOString();
    const found = await this.db.collection<SettingDocument>(SIMULATED_SCENARIO_SETTINGS_COLLECTION).findOneAndUpdate(
      { _id: ACTIVE_ID }, { $set: { activeScenarioId, updatedAt, updatedBy: "Credit analyst" }, $inc: { version: 1 }, $setOnInsert: { _id: ACTIVE_ID } },
      { upsert: true, returnDocument: "after" });
    return found!;
  }
}

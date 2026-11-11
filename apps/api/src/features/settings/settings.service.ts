import type { SimulatedScenario } from "@app/contracts";
import type { SimulatedScenarioRepository } from "../applications/simulated-scenario.repository.ts";
export class SettingsService {
  private readonly scenarios: SimulatedScenarioRepository;
  constructor(scenarios: SimulatedScenarioRepository) { this.scenarios = scenarios; }
  getScenario() { return this.scenarios.get(); }
  updateScenario(activeScenarioId: SimulatedScenario) { return this.scenarios.update(activeScenarioId); }
}

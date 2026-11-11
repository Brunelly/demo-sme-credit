import type { ApplicationCheckRun, AssessmentRunsResponse, ListApplicationsResponse, OverrideReason, RecommendationOutcome, SimulatedScenario, SimulatedScenarioSetting } from "@app/contracts";
import { api } from "../../lib/api.ts";
export const listApplications = (signal?: AbortSignal): Promise<ListApplicationsResponse> => api.get("/api/applications", signal);
export const getAssessmentRuns = (id: string, signal?: AbortSignal): Promise<AssessmentRunsResponse> => api.get(`/api/applications/${id}/assessment-runs`, signal);
export const runApplicationAssessment = (id: string): Promise<ApplicationCheckRun> => api.post(`/api/applications/${id}/assessment-runs`, {});
export const recordRecommendationOverride = (id: string, runId: string, input: { outcome: RecommendationOutcome; reason: OverrideReason; rationale: string }): Promise<ApplicationCheckRun> => api.post(`/api/applications/${id}/checks/${runId}/override`, input);
export const getSimulatedScenario = (signal?: AbortSignal): Promise<SimulatedScenarioSetting> => api.get("/api/settings/simulated-scenario", signal);
export const updateSimulatedScenario = (activeScenarioId: SimulatedScenario): Promise<SimulatedScenarioSetting> => api.put("/api/settings/simulated-scenario", { activeScenarioId });

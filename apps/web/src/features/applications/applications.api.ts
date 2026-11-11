import type { ApplicationCheckRun, AssessmentRunsResponse, ListApplicationsResponse } from "@app/contracts";
import { api } from "../../lib/api.ts";
export const listApplications = (signal?: AbortSignal): Promise<ListApplicationsResponse> => api.get("/api/applications", signal);
export const getAssessmentRuns = (id: string, signal?: AbortSignal): Promise<AssessmentRunsResponse> => api.get(`/api/applications/${id}/assessment-runs`, signal);
export const runApplicationAssessment = (id: string): Promise<ApplicationCheckRun> => api.post(`/api/applications/${id}/assessment-runs`, {});

import type { ApplicationCheckRun, ApplicationChecksResponse, ListApplicationsResponse } from "@app/contracts";
import { api } from "../../lib/api.ts";

/** Loads the analyst application queue. */
export function listApplications(signal?: AbortSignal): Promise<ListApplicationsResponse> {
  return api.get("/api/applications", signal);
}

export function getApplicationChecks(applicationId: string, signal?: AbortSignal): Promise<ApplicationChecksResponse> {
  return api.get(`/api/applications/${applicationId}/checks`, signal);
}

export function runApplicationChecks(applicationId: string): Promise<ApplicationCheckRun> {
  return api.post(`/api/applications/${applicationId}/checks`);
}

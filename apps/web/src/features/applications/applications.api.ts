import type { ListApplicationsResponse } from "@app/contracts";
import { api } from "../../lib/api.ts";

/** Loads the analyst application queue. */
export function listApplications(signal?: AbortSignal): Promise<ListApplicationsResponse> {
  return api.get("/api/applications", signal);
}

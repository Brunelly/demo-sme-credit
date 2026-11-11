import type { ThroughputDashboardResponse } from "@app/contracts";
import { api } from "../../lib/api.ts";

export const getThroughputDashboard = (signal?: AbortSignal) => api.get<ThroughputDashboardResponse>("/api/dashboard/throughput", signal);

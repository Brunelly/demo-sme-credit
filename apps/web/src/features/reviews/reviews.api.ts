import type { DecisionRecord, ReviewQueueResponse } from "@app/contracts";
import { api } from "../../lib/api.ts";
export const getReviewQueue = (signal?: AbortSignal) => api.get<ReviewQueueResponse>("/api/reviews", signal);
export const getDecisionLedgerFile = (signal?: AbortSignal) => api.getFile("/api/reviews/decisions.csv", signal);
export const recordDecision = (applicationId: string, input: object) => api.post<DecisionRecord>(`/api/reviews/${applicationId}/decisions`, input);

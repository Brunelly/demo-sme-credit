import type { DecisionRecord, ReviewQueueResponse } from "@app/contracts";
import { api } from "../../lib/api.ts";
export const getReviewQueue = (signal?: AbortSignal) => api.get<ReviewQueueResponse>("/api/reviews", signal);
export const recordDecision = (applicationId: string, input: object) => api.post<DecisionRecord>(`/api/reviews/${applicationId}/decisions`, input);

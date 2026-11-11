/** GET /api/health. 200 when the database answers, 503 when it doesn't. */
export interface HealthResponse {
  status: "ok" | "degraded";
  checks: {
    database: "up" | "down";
    ai: "connected" | "not-connected";
  };
  uptimeSeconds: number;
}

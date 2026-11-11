import type { ApiErrorBody, ErrorCode, ValidationIssue } from "@app/contracts";

// The one way the web app calls the API. Paths are relative to the site root ("/api/orders"): the API serves the
// app on the same origin, so there is no base URL to configure. Every call is typed with @app/contracts.

/** An error response from the API, with its stable code. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode | "network_error";
  readonly details: ValidationIssue[];

  constructor(status: number, code: ApiError["code"], message: string, details: ValidationIssue[] = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** The message for one field, for <Field error={…}>. */
  fieldError(path: string): string | undefined {
    return this.details.find((issue) => issue.path === path)?.message;
  }
}

async function request<T>(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers: body === undefined ? { Accept: "application/json" } : { Accept: "application/json", "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(0, "network_error", "Can't reach the server. Check your connection and try again.");
  }
  if (response.status === 204) return undefined as T;
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = (payload as Partial<ApiErrorBody> | null)?.error;
    throw new ApiError(response.status, error?.code ?? "internal_error", error?.message ?? `The server answered ${response.status}.`, error?.details);
  }
  return payload as T;
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>("GET", path, undefined, signal),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body ?? {}),
  patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, body),
  put: <T>(path: string, body: unknown) => request<T>("PUT", path, body),
  delete: (path: string) => request<void>("DELETE", path),
};

/** A query string from the values that are set: query({ status: "open", limit: 20 }) → "?status=open&limit=20". */
export function query(values: object): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

/** A message to show for any error. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

import { useCallback, useEffect, useRef, useState, type DependencyList } from "react";
import { ApiError, errorMessage } from "./api.ts";

/** A failure that means what is on screen must go: the session was rejected or the record no longer exists. */
const clearsData = (status: number | null): boolean => status === 401 || status === 403 || status === 404;

export interface Resource<T> {
  data: T | undefined;
  /** A message to show, or null. */
  error: string | null;
  /**
   * The HTTP status of the failure (0 for a network error), or null. Use it to tell a rejected session or a
   * missing record apart from a transient failure worth retrying.
   */
  errorStatus: number | null;
  /** True during the first load and every reload. */
  loading: boolean;
  /** Loads again, e.g. after a change or from an error state's "Try again". */
  reload: () => void;
}

/**
 * Loads data for a component and keeps loading, error and data in step. Reloads when `deps` change, and ignores
 * the answer to a request that a newer one has replaced.
 *
 *   const orders = useResource((signal) => listOrders({ status }, signal), [status]);
 */
export function useResource<T>(load: (signal: AbortSignal) => Promise<T>, deps: DependencyList): Resource<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [generation, setGeneration] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setErrorStatus(null);
    loadRef
      .current(controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setData(value);
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        const status = reason instanceof ApiError ? reason.status : null;
        setError(errorMessage(reason));
        setErrorStatus(status);
        // Never leave previously loaded content on screen when the request was rejected: a 401/403 means the
        // person may no longer see it, and a 404 means it is gone. Transient failures keep it for a retry.
        if (clearsData(status)) setData(undefined);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
    // The caller's deps decide when to load again; `load` itself is read from a ref.
  }, [...deps, generation]);

  const reload = useCallback(() => setGeneration((value) => value + 1), []);
  return { data, error, errorStatus, loading, reload };
}

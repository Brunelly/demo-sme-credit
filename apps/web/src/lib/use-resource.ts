import { useCallback, useEffect, useRef, useState, type DependencyList } from "react";
import { errorMessage } from "./api.ts";

export interface Resource<T> {
  data: T | undefined;
  /** A message to show, or null. */
  error: string | null;
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
  const [loading, setLoading] = useState(true);
  const [generation, setGeneration] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    loadRef
      .current(controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setData(value);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(reason));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
    // The caller's deps decide when to load again; `load` itself is read from a ref.
  }, [...deps, generation]);

  const reload = useCallback(() => setGeneration((value) => value + 1), []);
  return { data, error, loading, reload };
}

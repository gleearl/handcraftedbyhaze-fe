import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, GENERIC_ERROR } from "../lib/api/http";

interface AsyncState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

/* Load-once-with-retry, which is all three admin list screens need. The abort
   on unmount matters here: navigating away mid-request would otherwise set
   state on a gone component, and worse, overwrite the next screen's error. */
export function useAsync<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  deps: unknown[] = [],
): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);

    fnRef.current(ctrl.signal)
      .then((result) => { if (!ctrl.signal.aborted) setData(result); })
      .catch((err) => {
        if (ctrl.signal.aborted) return;
        // A 401 is already being handled globally by redirecting to login;
        // showing "session expired" underneath that is just noise.
        if (err instanceof ApiError && err.status === 401) return;
        setError(err instanceof ApiError ? err.message : GENERIC_ERROR);
      })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });

    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, ...deps]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  return { data, error, loading, reload };
}

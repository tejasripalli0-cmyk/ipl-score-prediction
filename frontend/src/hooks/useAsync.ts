import { useCallback, useEffect, useRef, useState } from "react";
import { toApiError } from "../services/api";
import type { ApiErrorInfo } from "../types";

/** Runs an async loader whenever `deps` change; ignores stale responses. `enabled=false` skips the call. */
export function useAsync<T>(loader: () => Promise<T>, deps: unknown[], enabled = true) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiErrorInfo | null>(null);
  const [loading, setLoading] = useState(enabled);
  const tick = useRef(0);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    const id = ++tick.current;
    setLoading(true);
    setError(null);
    loader()
      .then((d) => { if (id === tick.current) setData(d); })
      .catch((e) => { if (id === tick.current) { setError(toApiError(e)); setData(null); } })
      .finally(() => { if (id === tick.current) setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data, error, loading, reload };
}

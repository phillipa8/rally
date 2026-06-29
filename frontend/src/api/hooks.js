// hooks.js — the two hooks that guarantee loading + error state on EVERY API call.
// Components must use these (or AuthContext) instead of calling apiClient directly.
import { useState, useEffect, useCallback, useRef } from 'react';
import apiClient, { errorMessage } from './client';

/**
 * Declarative GET. Fetches on mount and whenever `path` or `deps` change.
 * @param {string} path API path (relative to the axios baseURL)
 * @param {Array} deps  re-fetch triggers — pass ONLY JSON-serializable values
 *                      (strings/numbers/bools), never new objects/functions each render.
 * @param {{enabled?: boolean}} options set enabled:false to skip fetching.
 * @returns {{ data, loading, error, refetch }}
 *
 * Usage:
 *   const { data, loading, error, refetch } = useApi('/feed');
 *   if (loading) return <LoadingState />;
 *   if (error)   return <ErrorState message={error} onRetry={refetch} />;
 */
export function useApi(path, deps = [], { enabled = true } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);
  // Monotonic request id: only the latest request is allowed to write state, which
  // ignores out-of-order responses and prevents setState after unmount.
  const latest = useRef(0);

  const run = useCallback(async () => {
    const requestId = ++latest.current;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(path);
      if (latest.current === requestId) setData(res.data);
      return res.data;
    } catch (err) {
      if (latest.current === requestId) setError(errorMessage(err));
    } finally {
      if (latest.current === requestId) setLoading(false);
    }
  }, [path]);

  // Stable dependency key so passing an inline array literal doesn't loop forever.
  const depsKey = JSON.stringify(deps);
  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return undefined;
    }
    run();
    return () => {
      latest.current += 1; // invalidate any in-flight request on unmount / deps change
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, enabled, depsKey]);

  return { data, loading, error, refetch: run };
}

/**
 * Imperative mutation for POST/PUT/DELETE.
 * @param mutationFn async (...args) => result  (uses apiClient)
 * @returns {{ mutate, loading, error, reset }}
 *
 * Usage:
 *   const { mutate, loading, error } = useMutation((body) => apiClient.post('/posts', body));
 *   await mutate({ content });
 */
export function useMutation(mutationFn) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const mutate = useCallback(
    async (...args) => {
      setLoading(true);
      setError(null);
      try {
        return await mutationFn(...args);
      } catch (err) {
        setError(errorMessage(err));
        throw err; // let callers handle/await failures too
      } finally {
        setLoading(false);
      }
    },
    [mutationFn]
  );

  const reset = useCallback(() => {
    setError(null);
    setLoading(false);
  }, []);

  return { mutate, loading, error, reset };
}

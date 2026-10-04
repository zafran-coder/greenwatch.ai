import { useState, useEffect, useRef, useCallback } from "react";

/**
 * Lightweight, high-performance query hook with cancellation, polling,
 * and loading/error states. Works seamlessly with React 19.
 */
export function useQuery(key, fetcher, options = {}) {
  const {
    enabled = true,
    refetchInterval = null,
    initialData = null,
    onSuccess,
    onError,
  } = options;

  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(enabled && initialData === null);
  const [error, setError] = useState(null);
  const [isFetching, setIsFetching] = useState(false);

  const abortControllerRef = useRef(null);
  const isMountedRef = useRef(true);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const serializedKey = typeof key === "string" ? key : JSON.stringify(key);

  const execute = useCallback(
    async (isBackground = false) => {
      if (!enabled) return;

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      if (!isBackground) {
        setLoading((prev) => (data === null ? true : prev));
      }
      setIsFetching(true);
      setError(null);

      try {
        const result = await fetcherRef.current(controller.signal);
        if (isMountedRef.current && !controller.signal.aborted) {
          setData(result);
          setLoading(false);
          setIsFetching(false);
          onSuccess?.(result);
        }
        return result;
      } catch (err) {
        if (err.name === "AbortError" || controller.signal.aborted) {
          return;
        }
        if (isMountedRef.current) {
          setError(err);
          setLoading(false);
          setIsFetching(false);
          onError?.(err);
        }
        throw err;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [serializedKey, enabled]
  );

  useEffect(() => {
    isMountedRef.current = true;
    if (enabled) {
      execute();
    }
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [execute, enabled]);

  // Polling interval support
  useEffect(() => {
    if (!enabled || !refetchInterval) return;

    const intervalId = setInterval(() => {
      execute(true).catch(() => {});
    }, refetchInterval);

    return () => clearInterval(intervalId);
  }, [enabled, refetchInterval, execute]);

  const refetch = useCallback(() => execute(false), [execute]);

  return {
    data,
    setData,
    loading,
    error,
    isFetching,
    refetch,
  };
}

/**
 * Mutation hook for POST/PATCH/DELETE actions
 */
export function useMutation(mutationFn, options = {}) {
  const { onSuccess, onError } = options;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);

  const mutateAsync = useCallback(
    async (variables) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setLoading(true);
      setError(null);

      try {
        const result = await mutationFn(variables, { signal: controller.signal });
        setData(result);
        setLoading(false);
        onSuccess?.(result, variables);
        return result;
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err);
          setLoading(false);
          onError?.(err, variables);
        }
        throw err;
      }
    },
    [mutationFn, onSuccess, onError]
  );

  const mutate = useCallback(
    (variables) => {
      mutateAsync(variables).catch(() => {});
    },
    [mutateAsync]
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return {
    mutate,
    mutateAsync,
    data,
    loading,
    error,
    reset,
  };
}

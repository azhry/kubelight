import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface ResourceItem {
  name: string;
  namespace?: string;
  kind: string;
  status?: string;
  age?: string;
  created_at?: string;
}

const AUTO_REFRESH_MS = 30_000;

const cache = new Map<string, ResourceItem[]>();

export function useResources(kind: string, namespace: string | undefined) {
  const cacheKey = `${kind}:${namespace || "all"}`;
  const cached = cache.get(cacheKey);

  const [resources, setResources] = useState<ResourceItem[]>(cached ?? []);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const mountedRef = useRef(true);

  const fetchResources = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      setError(null);
      try {
        const result = await invoke<ResourceItem[]>("get_resources", {
          kind,
          namespace: namespace === "all" ? null : namespace || null,
        });
        if (mountedRef.current) {
          setResources(result);
          cache.set(cacheKey, result);
        }
      } catch (e) {
        if (mountedRef.current) {
          setError(String(e));
          setResources([]);
          cache.delete(cacheKey);
        }
      } finally {
        if (mountedRef.current && !opts?.silent) {
          setLoading(false);
        }
      }
    },
    [kind, namespace, cacheKey]
  );

  useEffect(() => {
    mountedRef.current = true;
    const current = cache.get(cacheKey);
    if (current) {
      setResources(current);
      setLoading(false);
      fetchResources({ silent: true });
    } else {
      setLoading(true);
      fetchResources();
    }
    return () => {
      mountedRef.current = false;
    };
  }, [cacheKey, fetchResources]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => fetchResources({ silent: true }), AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, [autoRefresh, fetchResources]);

  return {
    resources,
    loading,
    error,
    refresh: () => fetchResources({ silent: true }),
    refetch: () => fetchResources({ silent: true }),
    autoRefresh,
    setAutoRefresh,
  };
}

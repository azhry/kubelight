import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface ResourceItem {
  name: string;
  namespace?: string;
  kind: string;
  status?: string;
  age?: string;
}

export function useResources(kind: string, namespace: string | undefined) {
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchResources = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<ResourceItem[]>("get_resources", {
        kind,
        namespace: namespace === "all" ? null : namespace || null,
      });
      setResources(result);
    } catch (e) {
      setError(String(e));
      setResources([]);
    } finally {
      setLoading(false);
    }
  }, [kind, namespace]);

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  return { resources, loading, error, refresh: fetchResources };
}

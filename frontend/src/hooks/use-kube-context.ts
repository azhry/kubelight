import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface KubeContext {
  name: string;
  cluster: string;
  user: string;
  active: boolean;
}

export function useKubeContext() {
  const [contexts, setContexts] = useState<KubeContext[]>([]);
  const [activeContext, setActiveContext] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const fetchContexts = useCallback(async () => {
    try {
      const ctxs = await invoke<KubeContext[]>("get_contexts");
      setContexts(ctxs);
      const active = await invoke<string>("get_active_context");
      setActiveContext(active);
    } catch (e) {
      console.error("Failed to fetch contexts:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContexts();
  }, [fetchContexts]);

  const switchContext = useCallback(async (name: string) => {
    try {
      await invoke("switch_context", { contextName: name });
      setActiveContext(name);
    } catch (e) {
      console.error("Failed to switch context:", e);
    }
  }, []);

  return { contexts, activeContext, loading, switchContext, refresh: fetchContexts };
}

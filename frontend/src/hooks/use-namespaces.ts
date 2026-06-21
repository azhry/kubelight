import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

export function useNamespaces() {
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const fetchNamespaces = useCallback(async () => {
    try {
      const result = await invoke<any[]>("get_resources", {
        kind: "namespaces",
        namespace: null as string | null,
      });
      const names = result.map((n) => n.name || n.metadata?.name || String(n));
      setNamespaces(names);
    } catch (e) {
      console.error("Failed to fetch namespaces:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNamespaces();
  }, [fetchNamespaces]);

  return { namespaces, selected, setSelected, loading, refresh: fetchNamespaces };
}

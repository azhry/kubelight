import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

export function useYamlEditor(kind: string, namespace: string | undefined, name: string | undefined) {
  const [yamlStr, setYamlStr] = useState<string>("");
  const [originalYaml, setOriginalYaml] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchYaml = useCallback(async () => {
    if (!name) return;
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<string>("get_resource_yaml", {
        kind,
        namespace: namespace === "-" ? null : namespace || null,
        name,
      });
      setYamlStr(result);
      setOriginalYaml(result);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [kind, namespace, name]);

  useEffect(() => {
    fetchYaml();
  }, [fetchYaml]);

  const apply = useCallback(async () => {
    if (!name) return;
    setSaving(true);
    setError(null);
    try {
      await invoke("apply_resource", {
        kind,
        namespace: namespace === "-" ? null : namespace || null,
        name,
        yaml: yamlStr,
      });
      setOriginalYaml(yamlStr);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }, [kind, namespace, name, yamlStr]);

  const resetYaml = useCallback(() => {
    setYamlStr(originalYaml);
    setError(null);
  }, [originalYaml]);

  const hasChanges = yamlStr !== originalYaml;

  return {
    yamlStr,
    setYamlStr,
    originalYaml,
    loading,
    saving,
    error,
    hasChanges,
    fetchYaml,
    apply,
    resetYaml,
  };
}

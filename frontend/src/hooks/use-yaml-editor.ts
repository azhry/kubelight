import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import yaml from "js-yaml";
import { useResources } from "./use-resources";
import type { ResourceItem } from "./use-resources";

export function useYamlEditor(kind: string, namespace: string | undefined) {
  const [yamlStr, setYamlStr] = useState<string>("");
  const [originalYaml, setOriginalYaml] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { resources } = useResources(kind, namespace);

  const fetchYaml = useCallback(async (name: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<string>("get_resource_yaml", {
        kind,
        namespace: namespace || null,
        name,
      });
      setYamlStr(result);
      setOriginalYaml(result);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [kind, namespace]);

  const applyPatch = useCallback(async (name: string) => {
    setSaving(true);
    setError(null);
    try {
      const parsed = yaml.load(yamlStr);
      await invoke("patch_resource", {
        kind,
        namespace: namespace || null,
        name,
        patchBody: parsed,
      });
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }, [kind, namespace, yamlStr]);

  const resetYaml = useCallback(() => {
    setYamlStr(originalYaml);
    setError(null);
  }, [originalYaml]);

  const hasChanges = yamlStr !== originalYaml;

  return {
    resources,
    yamlStr,
    setYamlStr,
    loading,
    saving,
    error,
    hasChanges,
    fetchYaml,
    applyPatch,
    resetYaml,
  };
}

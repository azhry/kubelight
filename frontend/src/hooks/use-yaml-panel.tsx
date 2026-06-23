import { createContext, useContext, useState, useCallback } from "react";

export interface YamlPanelResource {
  kind: string;
  namespace: string;
  name: string;
}

interface YamlPanelContextValue {
  resource: YamlPanelResource | null;
  openYamlPanel: (kind: string, namespace: string, name: string) => void;
  closeYamlPanel: () => void;
}

const YamlPanelContext = createContext<YamlPanelContextValue | null>(null);

export function YamlPanelProvider({ children }: { children: React.ReactNode }) {
  const [resource, setResource] = useState<YamlPanelResource | null>(null);

  const openYamlPanel = useCallback((kind: string, namespace: string, name: string) => {
    setResource({ kind, namespace, name });
  }, []);

  const closeYamlPanel = useCallback(() => {
    setResource(null);
  }, []);

  return (
    <YamlPanelContext.Provider value={{ resource, openYamlPanel, closeYamlPanel }}>
      {children}
    </YamlPanelContext.Provider>
  );
}

export function useYamlPanel() {
  const ctx = useContext(YamlPanelContext);
  if (!ctx) {
    throw new Error("useYamlPanel must be used within YamlPanelProvider");
  }
  return ctx;
}

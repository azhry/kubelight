import { createContext, useContext, useState, useCallback } from "react";
import type { ResourceItem } from "./use-resources";

interface DetailPanelContextValue {
  resource: ResourceItem | null;
  openDetailPanel: (resource: ResourceItem) => void;
  closeDetailPanel: () => void;
}

const DetailPanelContext = createContext<DetailPanelContextValue | null>(null);

export function DetailPanelProvider({ children }: { children: React.ReactNode }) {
  const [resource, setResource] = useState<ResourceItem | null>(null);

  const openDetailPanel = useCallback((resource: ResourceItem) => {
    setResource(resource);
  }, []);

  const closeDetailPanel = useCallback(() => {
    setResource(null);
  }, []);

  return (
    <DetailPanelContext.Provider value={{ resource, openDetailPanel, closeDetailPanel }}>
      {children}
    </DetailPanelContext.Provider>
  );
}

export function useDetailPanel() {
  const ctx = useContext(DetailPanelContext);
  if (!ctx) {
    throw new Error("useDetailPanel must be used within DetailPanelProvider");
  }
  return ctx;
}

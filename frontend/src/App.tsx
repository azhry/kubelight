import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Container } from "lucide-react";
import { ContextSelector } from "./components/context-selector";
import { NamespaceFilter } from "./components/namespace-filter";
import { Sidebar } from "./components/sidebar";
import { ToastContainer } from "./components/toast";
import { KubeConfigSetup } from "./components/kube-config-setup";
import { YamlEditorPanel } from "./components/yaml-editor-panel";
import { ResourceDetailPanel } from "./components/resource-detail-panel";
import { ResourceListPage } from "./pages/resource-list-page";
import { YamlPanelProvider } from "./hooks/use-yaml-panel";
import { DetailPanelProvider } from "./hooks/use-detail-panel";

export function AppLayout() {
  return (
    <YamlPanelProvider>
      <DetailPanelProvider>
        <div className="dark h-screen overflow-hidden bg-background text-foreground flex flex-col">
          <ToastContainer />
          <header className="h-16 border-b border-outline-variant bg-surface-container px-6 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <Container className="h-5 w-5 text-primary" />
              <h1 className="font-headline-md text-headline-md text-primary font-bold">KubeLight</h1>
            </div>
            <div className="flex items-center gap-4 min-w-0">
              <ContextSelector />
              <NamespaceFilter />
            </div>
          </header>

          <div className="flex flex-1 overflow-hidden">
            <Sidebar />
            <main className="flex-1 overflow-hidden flex flex-col">
              <div className="flex-1 overflow-hidden">
                <Routes>
                  <Route path="/:kind" element={<ResourceListPage />} />
                  <Route path="*" element={<Navigate to="/pods" replace />} />
                </Routes>
              </div>
              <YamlEditorPanel />
            </main>
            <ResourceDetailPanel />
          </div>
        </div>
      </DetailPanelProvider>
    </YamlPanelProvider>
  );
}

function App() {
  const [configured, setConfigured] = useState(false);

  if (!configured) {
    return (
      <>
        <ToastContainer />
        <KubeConfigSetup onConfigured={() => setConfigured(true)} />
      </>
    );
  }

  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  );
}

export default App;

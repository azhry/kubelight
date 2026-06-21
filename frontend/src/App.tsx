import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Container } from "lucide-react";
import { ContextSelector } from "./components/context-selector";
import { NamespaceFilter } from "./components/namespace-filter";
import { Sidebar } from "./components/sidebar";
import { ResourceListPage } from "./pages/resource-list-page";
import { PodDetailPage } from "./pages/pod-detail-page";
import { YamlEditorPage } from "./pages/yaml-editor-page";

function AppLayout() {
  return (
    <div className="dark min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b border-border px-6 py-3 flex items-center gap-4 shrink-0">
        <Container className="h-5 w-5 text-primary" />
        <h1 className="text-lg font-semibold">KubeLight</h1>
        <div className="ml-auto flex items-center gap-4 min-w-0">
          <div className="w-56">
            <ContextSelector />
          </div>
          <div className="w-48">
            <NamespaceFilter />
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/:kind" element={<ResourceListPage />} />
            <Route path="/pods/:namespace/:name" element={<PodDetailPage />} />
            <Route path="/yaml/:kind" element={<YamlEditorPage />} />
            <Route path="*" element={<Navigate to="/pods" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  );
}

export default App;

import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { Container, Server, Loader2, RefreshCw, FolderOpen } from "lucide-react";
import { ContextSelector } from "./components/context-selector";
import { NamespaceFilter } from "./components/namespace-filter";
import { Sidebar } from "./components/sidebar";
import { ToastContainer } from "./components/toast";
import { ResourceListPage } from "./pages/resource-list-page";
import { PodDetailPage } from "./pages/pod-detail-page";
import { YamlEditorPage } from "./pages/yaml-editor-page";

function KubeConfigSetup({ onConfigured }: { onConfigured: () => void }) {
  const [status, setStatus] = useState<{ configured: boolean; error: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [path, setPath] = useState("");

  const check = async () => {
    setLoading(true);
    try {
      const s = await invoke<{ configured: boolean; error: string | null }>("get_kubeconfig_status");
      setStatus(s);
      if (s.configured) onConfigured();
    } catch {
      setStatus({ configured: false, error: "Failed to check kubeconfig status" });
    } finally {
      setLoading(false);
    }
  };

  const browseFile = async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: "Kubeconfig", extensions: ["config", "yaml", "yml"] }],
    });
    if (selected) setPath(selected);
  };

  const reload = async () => {
    setLoading(true);
    try {
      const s = await invoke<{ configured: boolean; error: string | null }>("reload_kubeconfig", {
        path: path || null,
      });
      setStatus(s);
      if (s.configured) onConfigured();
    } catch {
      setStatus({ configured: false, error: "Failed to reload kubeconfig" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { check() }, []);

  if (loading && !status) {
    return (
      <div className="dark min-h-screen bg-background text-foreground flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="dark min-h-screen bg-background text-foreground flex items-center justify-center p-8">
      <ToastContainer />
      <div className="max-w-md w-full space-y-6">
        <div className="flex items-center gap-3 justify-center">
          <Server className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold">KubeLight</h1>
        </div>

        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-semibold text-center">Kubernetes Cluster Setup</h2>
          <p className="text-sm text-muted-foreground text-center">
            No kubeconfig found. KubeLight needs access to a Kubernetes cluster to operate.
          </p>

          {status?.error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-md px-4 py-3 text-sm text-red-500">
              {status.error}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs text-muted-foreground font-medium">
              Kubeconfig path
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="~/.kube/config"
                className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-xs outline-none focus:ring-1 focus:ring-ring"
              />
              <button
                onClick={browseFile}
                className="h-9 px-3 rounded-md border border-input bg-background text-xs text-muted-foreground hover:text-foreground hover:bg-accent flex items-center gap-1"
              >
                <FolderOpen className="h-3 w-3" />
                Browse
              </button>
            </div>
          </div>

          <button
            onClick={reload}
            disabled={loading}
            className="w-full h-9 rounded-md bg-primary text-primary-foreground text-xs font-medium flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            {loading ? "Connecting..." : "Connect"}
          </button>

          <p className="text-xs text-muted-foreground text-center">
            Select your kubeconfig file and click Connect.
          </p>
        </div>
      </div>
    </div>
  );
}

function AppLayout() {
  return (
    <div className="dark min-h-screen bg-background text-foreground flex flex-col">
      <ToastContainer />
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
  const [configured, setConfigured] = useState(false);

  if (!configured) {
    return <KubeConfigSetup onConfigured={() => setConfigured(true)} />;
  }

  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  );
}

export default App;

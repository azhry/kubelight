import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { Server, Loader2, RefreshCw, FolderOpen, AlertCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Skeleton } from "./ui/skeleton";

interface KubeConfigSetupProps {
  onConfigured: () => void;
}

interface KubeconfigStatus {
  configured: boolean;
  error: string | null;
}

export function KubeConfigSetup({ onConfigured }: KubeConfigSetupProps) {
  const [status, setStatus] = useState<KubeconfigStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [path, setPath] = useState("");

  const check = async () => {
    setLoading(true);
    try {
      const s = await invoke<KubeconfigStatus>("get_kubeconfig_status");
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
      const s = await invoke<KubeconfigStatus>("reload_kubeconfig", {
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

  useEffect(() => {
    check();
  }, []);

  if (loading && !status) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-8">
      <Card className="w-full max-w-md border-border bg-card">
        <CardHeader className="space-y-4 text-center">
          <div className="flex items-center justify-center gap-3">
            <Server className="h-8 w-8 text-primary" />
            <CardTitle className="text-2xl font-semibold text-card-foreground">
              KubeLight
            </CardTitle>
          </div>
          <CardDescription className="text-base text-muted-foreground">
            Kubernetes Cluster Setup
          </CardDescription>
          <p className="text-sm text-muted-foreground">
            No kubeconfig found. Select a kubeconfig file to connect to your cluster.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {status?.error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{status.error}</span>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Kubeconfig path
            </label>
            <div className="flex gap-2">
              <Input
                type="text"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="~/.kube/config"
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={browseFile}
                disabled={loading}
                className="shrink-0"
              >
                <FolderOpen className="mr-2 h-4 w-4" />
                Browse
              </Button>
            </div>
          </div>

          <Button
            onClick={reload}
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            {loading ? "Connecting..." : "Connect"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

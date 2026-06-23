import { useState } from "react";
import { Activity, Play, Trash2 } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { toast } from "./toast";
import { invoke } from "@tauri-apps/api/core";

interface NetworkDiagnosticResult {
  stdout: string;
  stderr: string;
}

interface NetworkDiagnosticsProps {
  namespace: string;
  podName: string;
}

export function NetworkDiagnostics({ namespace, podName }: NetworkDiagnosticsProps) {
  const [target, setTarget] = useState("");
  const [result, setResult] = useState<NetworkDiagnosticResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRun = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = target.trim();
    if (!trimmed) return;

    setLoading(true);
    setResult(null);
    try {
      const diagnostic = await invoke<NetworkDiagnosticResult>("diagnose_pod_network", {
        source_namespace: namespace,
        source_pod: podName,
        target: trimmed,
      });
      setResult(diagnostic);
    } catch (e) {
      toast(String(e), "error");
      setResult({ stdout: "", stderr: String(e) });
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setTarget("");
    setResult(null);
  };

  return (
    <div className="h-full flex flex-col min-h-0">
      <form
        onSubmit={handleRun}
        className="border-b border-outline-variant p-3 flex items-center gap-2 bg-surface-container shrink-0"
      >
        <Activity className="h-4 w-4 text-on-surface-variant shrink-0" />
        <Input
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder={`Target pod, service, or URL from ${podName}...`}
          disabled={loading}
          className="flex-1 h-9 bg-surface-container border-outline-variant text-on-surface"
        />
        <Button
          type="submit"
          size="sm"
          disabled={loading || !target.trim()}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Play className="h-4 w-4 mr-1" />
          Run
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleClear}
          disabled={loading}
          className="border-outline-variant text-on-surface hover:bg-surface-container-high"
        >
          <Trash2 className="h-4 w-4 mr-1" />
          Clear
        </Button>
      </form>

      <div className="flex-1 overflow-auto p-4 font-mono text-code-md whitespace-pre-wrap bg-[#0a0e17]">
        {loading ? (
          <div className="flex items-center justify-center h-full text-on-surface-variant">
            <p className="text-sm">Running curl from {podName} to {target || "target"}...</p>
          </div>
        ) : result ? (
          <div className="space-y-3">
            {result.stdout && (
              <div>
                <p className="text-xs uppercase tracking-wider text-on-surface-variant mb-1">stdout</p>
                <span className="terminal-text text-on-surface">{result.stdout}</span>
              </div>
            )}
            {result.stderr && (
              <div>
                <p className="text-xs uppercase tracking-wider text-destructive mb-1">stderr</p>
                <span className="text-destructive">{result.stderr}</span>
              </div>
            )}
            {!result.stdout && !result.stderr && (
              <div className="flex items-center justify-center h-full text-on-surface-variant">
                <p className="text-sm">No output returned.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-on-surface-variant gap-2">
            <Activity className="h-8 w-8 opacity-50" />
            <p className="text-sm text-center">
              Enter a target pod, service, or URL to run a curl from {podName}.
            </p>
            <p className="text-xs text-center opacity-70">
              Examples: my-service, pod/nginx, service/other-ns/my-svc, https://example.com
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { ScrollText, Terminal, Activity, Code, Info } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { StatusBadge } from "./status-badge";
import { LogViewer } from "./log-viewer";
import { NetworkDiagnostics } from "./network-diagnostics";
import { useLogStream } from "../hooks/use-log-stream";
import { useExec } from "../hooks/use-exec";
import { useYamlEditor } from "../hooks/use-yaml-editor";
import { CodeMirror } from "./codemirror";
import { Skeleton } from "./ui/skeleton";
import type { ResourceItem } from "../hooks/use-resources";

interface PodDetailTabsProps {
  resource: ResourceItem;
  onClose?: () => void;
}

export function PodDetailTabs({ resource }: PodDetailTabsProps) {
  const namespace = resource.namespace || "default";
  const podName = resource.name;

  const [activeTab, setActiveTab] = useState<"details" | "logs" | "terminal" | "diagnostics" | "yaml">("details");
  const { logs, streaming, startStream, stopStream, clearLogs } = useLogStream(namespace, podName);
  const { output, running: execRunning, exec, execShell, clearOutput } = useExec(namespace, podName);
  const { yamlStr, loading: yamlLoading, error: yamlError } = useYamlEditor("pods", namespace, podName);
  const [command, setCommand] = useState("");
  const [shellStarted, setShellStarted] = useState(false);

  useEffect(() => {
    if (activeTab === "terminal" && !shellStarted && !execRunning) {
      setShellStarted(true);
      execShell();
    }
  }, [activeTab, shellStarted, execRunning, execShell]);

  const handleExecSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim()) return;
    exec(["/bin/sh", "-c", command.trim()]);
    setCommand("");
  };

  const TabButton = ({
    tab,
    label,
    icon: Icon,
  }: {
    tab: typeof activeTab;
    label: string;
    icon: React.ElementType;
  }) => {
    const isActive = activeTab === tab;
    return (
      <button
        onClick={() => setActiveTab(tab)}
        className={`h-full flex items-center gap-2 font-label-sm text-label-sm transition-colors border-b-2 px-1 ${
          isActive
            ? "text-primary border-primary"
            : "text-on-surface-variant border-transparent hover:text-on-surface"
        }`}
      >
        <Icon className="h-4 w-4" />
        {label}
      </button>
    );
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-4 h-10 px-4 border-b border-outline-variant bg-surface-container-low shrink-0">
        <TabButton tab="details" label="Details" icon={Info} />
        <TabButton tab="logs" label="Logs" icon={ScrollText} />
        <TabButton tab="terminal" label="Terminal" icon={Terminal} />
        <TabButton tab="diagnostics" label="Diagnostics" icon={Activity} />
        <TabButton tab="yaml" label="YAML" icon={Code} />
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === "details" && (
          <div className="p-4 space-y-4 overflow-auto h-full">
            <div className="space-y-1">
              <h3 className="font-headline-sm text-headline-sm text-on-surface">{podName}</h3>
              <p className="font-label-sm text-label-sm text-on-surface-variant">
                Pod · {namespace}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <Card className="border-outline-variant bg-surface-container rounded-lg shadow-none">
                <CardHeader className="p-4 pb-0">
                  <CardTitle className="text-primary font-label-sm uppercase tracking-wider">
                    Resource Info
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  <div className="flex justify-between text-body-md">
                    <span className="text-on-surface-variant">Name</span>
                    <span className="text-on-surface">{podName}</span>
                  </div>
                  <div className="flex justify-between text-body-md">
                    <span className="text-on-surface-variant">Namespace</span>
                    <span className="text-on-surface">{namespace}</span>
                  </div>
                  <div className="flex justify-between text-body-md">
                    <span className="text-on-surface-variant">Kind</span>
                    <span className="text-on-surface">Pod</span>
                  </div>
                  <div className="flex justify-between text-body-md">
                    <span className="text-on-surface-variant">Age</span>
                    <span className="text-on-surface">{resource.age || "-"}</span>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-outline-variant bg-surface-container rounded-lg shadow-none">
                <CardHeader className="p-4 pb-0">
                  <CardTitle className="text-primary font-label-sm uppercase tracking-wider">
                    Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  <div className="flex justify-between text-body-md">
                    <span className="text-on-surface-variant">Phase</span>
                    <StatusBadge status={resource.status} />
                  </div>
                  <div className="flex justify-between text-body-md">
                    <span className="text-on-surface-variant">IP</span>
                    <span className="text-on-surface">-</span>
                  </div>
                  <div className="flex justify-between text-body-md">
                    <span className="text-on-surface-variant">Node</span>
                    <span className="text-on-surface">-</span>
                  </div>
                  <div className="flex justify-between text-body-md">
                    <span className="text-on-surface-variant">Restarts</span>
                    <span className="text-on-surface">-</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {activeTab === "logs" && (
          <div className="h-full flex flex-col">
            <LogViewer
              logs={logs}
              streaming={streaming}
              onStart={startStream}
              onStop={stopStream}
              onClear={clearLogs}
              namespace={namespace}
              podName={podName}
            />
          </div>
        )}

        {activeTab === "terminal" && (
          <div className="h-full flex flex-col min-h-0 bg-[#0a0e17]">
            <div className="flex-1 overflow-auto p-4 font-mono text-code-md whitespace-pre-wrap">
              {output ? (
                <span className="terminal-text">{output}</span>
              ) : (
                <div className="flex items-center justify-center h-full text-on-surface-variant">
                  <p className="text-sm">Connecting to {podName} with /bin/sh...</p>
                </div>
              )}
            </div>
            <form
              onSubmit={handleExecSubmit}
              className="border-t border-outline-variant p-2 flex items-center gap-2 bg-surface-container"
            >
              <span className="text-on-surface-variant font-mono text-sm shrink-0">#</span>
              <Input
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder={`Run a command in ${podName}...`}
                disabled={execRunning}
                className="flex-1 h-9 bg-surface-container border-outline-variant text-on-surface"
              />
              <Button
                type="submit"
                size="sm"
                disabled={execRunning || !command.trim()}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Run
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={clearOutput}
                className="border-outline-variant text-on-surface hover:bg-surface-container-high"
              >
                Clear
              </Button>
            </form>
          </div>
        )}

        {activeTab === "diagnostics" && (
          <NetworkDiagnostics namespace={namespace} podName={podName} />
        )}

        {activeTab === "yaml" && (
          <div className="h-full p-4">
            {yamlLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-6 w-1/3 rounded" />
                <Skeleton className="h-64 rounded" />
              </div>
            ) : yamlError ? (
              <div className="text-sm text-destructive">Failed to load YAML: {yamlError}</div>
            ) : (
              <div className="h-full rounded-lg overflow-hidden border border-outline-variant bg-surface-container">
                <CodeMirror value={yamlStr} onChange={() => {}} readOnly />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

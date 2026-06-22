import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Container, ArrowLeftRight } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { StatusBadge } from "../components/status-badge";
import { LogViewer } from "../components/log-viewer";
import { useLogStream } from "../hooks/use-log-stream";
import { useResources } from "../hooks/use-resources";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../components/ui/dialog";
import { toast } from "../components/toast";
import { useState } from "react";

export function PodDetailPage() {
  const { name, namespace } = useParams();
  const navigate = useNavigate();
  const { logs, streaming, startStream, stopStream, clearLogs } = useLogStream(
    namespace || "default",
    name || ""
  );
  const { resources, loading } = useResources("pods", namespace);
  const pod = resources.find((r) => r.name === name);

  const [pfOpen, setPfOpen] = useState(false);
  const [localPort, setLocalPort] = useState("");
  const [podPort, setPodPort] = useState("");
  const [pfRunning, setPfRunning] = useState(false);

  const startPortForward = async () => {
    const local = Number(localPort);
    const remote = Number(podPort);
    if (!local || !remote) {
      toast("Please enter valid port numbers", "error");
      return;
    }
    setPfRunning(true);
    try {
      await invoke("port_forward", {
        namespace: namespace || "default",
        pod_name: name || "",
        local_port: local,
        pod_port: remote,
      });
      toast(`Port forward started: localhost:${local} -> ${name}:${remote}`, "success");
      setPfOpen(false);
    } catch (e) {
      toast(String(e), "error");
    } finally {
      setPfRunning(false);
    }
  };

  return (
    <div className="h-full overflow-hidden flex flex-col bg-surface-dim">
      <header className="h-16 border-b border-outline-variant bg-surface-container px-6 flex items-center gap-4 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="text-on-surface-variant hover:text-on-surface"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Container className="h-5 w-5 text-outline" />
        <div>
          <h1 className="font-headline-md text-headline-md text-on-surface">{name}</h1>
          <p className="font-label-sm text-label-sm text-on-surface-variant">{namespace}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPfOpen(true)}
            className="border-outline-variant text-on-surface hover:bg-surface-container-high"
          >
            <ArrowLeftRight className="h-4 w-4 mr-1" />
            Port Forward
          </Button>
          <StatusBadge status={pod?.status || "Running"} />
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Skeleton className="h-48 rounded-lg" />
              <Skeleton className="h-48 rounded-lg" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="border-outline-variant bg-surface-container rounded-lg shadow-none">
                <CardHeader className="p-4 pb-0">
                  <CardTitle className="text-primary font-label-sm uppercase tracking-wider">
                    Resource Info
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  <div className="flex justify-between text-body-md">
                    <span className="text-on-surface-variant">Name</span>
                    <span className="text-on-surface">{name}</span>
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
                    <span className="text-on-surface-variant">Created</span>
                    <span className="text-on-surface">{pod?.age || "-"}</span>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-outline-variant bg-surface-container rounded-lg shadow-none">
                <CardHeader className="p-4 pb-0">
                  <CardTitle className="text-primary font-label-sm uppercase tracking-wider">
                    Status Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  <div className="flex justify-between text-body-md">
                    <span className="text-on-surface-variant">Phase</span>
                    <span className="text-primary">{pod?.status || "Running"}</span>
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
          )}
        </div>
      </div>

      <div className="h-[45%] max-h-[50vh] min-h-[200px] border-t border-outline-variant flex flex-col bg-surface shrink-0">
        <LogViewer
          logs={logs}
          streaming={streaming}
          onStart={startStream}
          onStop={stopStream}
          onClear={clearLogs}
          namespace={namespace}
          podName={name}
          onYamlClick={() => {
            if (namespace && name) {
              navigate(`/edit/pods/${namespace}/${name}`);
            }
          }}
        />
      </div>

      <Dialog open={pfOpen} onOpenChange={setPfOpen}>
        <DialogHeader>
          <DialogTitle>Port Forward</DialogTitle>
          <DialogDescription>
            Forward a local port to {name} in namespace {namespace}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 space-y-4">
          <div className="space-y-1">
            <label className="text-sm text-on-surface-variant">Local Port</label>
            <Input
              type="number"
              value={localPort}
              onChange={(e) => setLocalPort(e.target.value)}
              placeholder="8080"
              className="bg-surface-container border-outline-variant text-on-surface"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-on-surface-variant">Pod Port</label>
            <Input
              type="number"
              value={podPort}
              onChange={(e) => setPodPort(e.target.value)}
              placeholder="80"
              className="bg-surface-container border-outline-variant text-on-surface"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPfOpen(false)}
            disabled={pfRunning}
            className="border-outline-variant text-on-surface hover:bg-surface-container-high"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={startPortForward}
            disabled={pfRunning || !localPort || !podPort}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {pfRunning ? "Starting..." : "Start Forward"}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}

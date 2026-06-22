import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Container } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { StatusBadge } from "../components/status-badge";
import { LogViewer } from "../components/log-viewer";
import { useLogStream } from "../hooks/use-log-stream";
import { useResources } from "../hooks/use-resources";

export function PodDetailPage() {
  const { name, namespace } = useParams();
  const navigate = useNavigate();
  const { logs, streaming, startStream, stopStream, clearLogs } = useLogStream(
    namespace || "default",
    name || ""
  );
  const { resources, loading } = useResources("pods", namespace);
  const pod = resources.find((r) => r.name === name);

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
        <div className="ml-auto">
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
        />
      </div>
    </div>
  );
}

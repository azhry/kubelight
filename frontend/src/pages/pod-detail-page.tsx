import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Container } from "lucide-react";
import { Button } from "../components/ui/button";
import { StatusBadge } from "../components/status-badge";
import { LogViewer } from "../components/log-viewer";
import { useLogStream } from "../hooks/use-log-stream";

export function PodDetailPage() {
  const { name, namespace } = useParams();
  const navigate = useNavigate();
  const { logs, streaming, startStream, stopStream } = useLogStream(
    namespace || "default",
    name || ""
  );

  return (
    <div className="flex-1 flex flex-col">
      <div className="border-b border-border px-6 py-3 flex items-center gap-3 shrink-0">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Container className="h-4 w-4 text-muted-foreground" />
        <div>
          <h1 className="text-sm font-semibold">{name}</h1>
          <p className="text-xs text-muted-foreground">{namespace}</p>
        </div>
        <div className="ml-auto">
          <StatusBadge status="Running" />
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        <LogViewer
          logs={logs}
          streaming={streaming}
          onStart={startStream}
          onStop={stopStream}
        />
      </div>
    </div>
  );
}

import { useState } from "react";
import { X, Container } from "lucide-react";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";
import { StatusBadge } from "./status-badge";
import { PodDetailTabs } from "./pod-detail-tabs";
import { useDetailPanel } from "../hooks/use-detail-panel";
import { useYamlEditor } from "../hooks/use-yaml-editor";
import { CodeMirror } from "./codemirror";

function YamlView({ kind, namespace, name }: { kind: string; namespace: string; name: string }) {
  const { yamlStr, loading, error } = useYamlEditor(kind, namespace, name);

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        <p className="text-sm text-on-surface-variant">Loading YAML...</p>
        <Skeleton className="h-6 w-1/3 rounded" />
        <Skeleton className="h-64 rounded" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-destructive">
        Failed to load YAML: {error}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-hidden p-4">
      <div className="h-full rounded-lg overflow-hidden border border-outline-variant bg-surface-container">
        <CodeMirror value={yamlStr} onChange={() => {}} readOnly />
      </div>
    </div>
  );
}

function ResourceMetadata({ resource }: { resource: NonNullable<ReturnType<typeof useDetailPanel>["resource"]> }) {
  return (
    <div className="p-4 space-y-4">
      <div className="space-y-1">
        <h3 className="font-headline-sm text-headline-sm text-on-surface">{resource.name}</h3>
        <p className="font-label-sm text-label-sm text-on-surface-variant capitalize">
          {resource.kind} · {resource.namespace || "(cluster-scoped)"}
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between text-body-md">
          <span className="text-on-surface-variant">Kind</span>
          <span className="text-on-surface capitalize">{resource.kind}</span>
        </div>
        <div className="flex justify-between text-body-md">
          <span className="text-on-surface-variant">Namespace</span>
          <span className="text-on-surface">{resource.namespace || "-"}</span>
        </div>
        <div className="flex justify-between text-body-md">
          <span className="text-on-surface-variant">Status</span>
          <StatusBadge status={resource.status} />
        </div>
        <div className="flex justify-between text-body-md">
          <span className="text-on-surface-variant">Age</span>
          <span className="text-on-surface">{resource.age || "-"}</span>
        </div>
      </div>
    </div>
  );
}

export function ResourceDetailPanel() {
  const { resource, closeDetailPanel } = useDetailPanel();
  const [activeTab, setActiveTab] = useState<"details" | "yaml">("details");

  if (!resource) return null;

  const isPod = resource.kind === "pods";
  const displayNamespace = resource.namespace || "-";

  return (
    <aside data-testid="resource-detail-panel" className="w-96 border-l border-outline-variant bg-surface flex flex-col h-full shrink-0">
      <header className="h-14 border-b border-outline-variant bg-surface-container px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Container className="h-4 w-4 text-outline shrink-0" />
          <div className="min-w-0">
            <h2 className="font-label-lg text-label-lg text-on-surface truncate">{resource.name}</h2>
            <p className="font-label-sm text-label-sm text-on-surface-variant truncate capitalize">
              {resource.kind}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={closeDetailPanel}
          aria-label="Close detail panel"
          className="h-8 w-8 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high shrink-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </header>

      {isPod ? (
        <PodDetailTabs resource={resource} onClose={closeDetailPanel} />
      ) : (
        <>
          <div className="flex items-center gap-4 h-10 px-4 border-b border-outline-variant bg-surface-container-low shrink-0">
            <button
              onClick={() => setActiveTab("details")}
              className={`h-full font-label-sm text-label-sm border-b-2 transition-colors ${
                activeTab === "details"
                  ? "text-primary border-primary"
                  : "text-on-surface-variant border-transparent hover:text-on-surface"
              }`}
            >
              Details
            </button>
            <button
              onClick={() => setActiveTab("yaml")}
              className={`h-full font-label-sm text-label-sm border-b-2 transition-colors ${
                activeTab === "yaml"
                  ? "text-primary border-primary"
                  : "text-on-surface-variant border-transparent hover:text-on-surface"
              }`}
            >
              YAML
            </button>
          </div>
          <div className="flex-1 overflow-hidden flex flex-col">
            {activeTab === "details" ? (
              <ResourceMetadata resource={resource} />
            ) : (
              <YamlView kind={resource.kind} namespace={displayNamespace} name={resource.name} />
            )}
          </div>
        </>
      )}
    </aside>
  );
}

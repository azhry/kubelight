import { useParams } from "react-router-dom";
import { ResourceTable } from "../components/resource-table";
import { useResources } from "../hooks/use-resources";
import { resourceKinds } from "../lib/resource-kinds";

export function ResourceListPage() {
  const { kind = "pods" } = useParams();
  const { resources, loading, error } = useResources(kind, undefined);

  const kindInfo = resourceKinds.find((k) => k.kind === kind);
  const title = kindInfo?.label || kind.charAt(0).toUpperCase() + kind.slice(1);

  return (
    <div className="flex-1 flex flex-col">
      <div className="border-b border-border px-6 py-4">
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {loading ? "Loading..." : `${resources.length} ${kind}`}
        </p>
      </div>
      <div className="flex-1 overflow-auto">
        <ResourceTable
          resources={resources}
          loading={loading}
          error={error}
          kind={kind}
        />
      </div>
    </div>
  );
}

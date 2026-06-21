import { useParams } from "react-router-dom";
import { Box } from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { ResourceTable } from "../components/resource-table";
import { useResources } from "../hooks/use-resources";
import { resourceKinds } from "../lib/resource-kinds";

export function ResourceListPage() {
  const { kind = "pods" } = useParams();
  const { resources, loading, error } = useResources(kind, undefined);

  const kindInfo = resourceKinds.find((k) => k.kind === kind);
  const title = kindInfo?.label || kind.charAt(0).toUpperCase() + kind.slice(1);

  return (
    <div className="flex-1 flex flex-col bg-surface-dim">
      <div className="h-16 border-b border-outline-variant bg-surface-container px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Box className="h-5 w-5 text-outline" />
          <h1 className="font-headline-md text-headline-md text-on-surface">{title}</h1>
        </div>
        <span className="font-code-md text-code-md text-on-surface-variant">
          {loading ? "Loading..." : `${resources.length} total`}
        </span>
      </div>
      <div className="flex-1 overflow-auto p-4 md:p-6">
        <Card className="border-outline-variant bg-surface-container rounded-lg overflow-hidden shadow-none">
          <CardContent className="p-0">
            <ResourceTable
              resources={resources}
              loading={loading}
              error={error}
              kind={kind}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

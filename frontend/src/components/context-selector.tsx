import { Database } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Skeleton } from "../components/ui/skeleton";
import { useKubeContext } from "../hooks/use-kube-context";

export function ContextSelector() {
  const { contexts, activeContext, loading, switchContext } = useKubeContext();

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <Database className="h-4 w-4 text-on-surface-variant" />
        <Skeleton className="h-9 w-56 rounded" />
      </div>
    );
  }

  return (
    <Select value={activeContext} onValueChange={switchContext}>
      <SelectTrigger className="h-9 w-56 gap-2 rounded border-outline-variant bg-surface-container-low px-3 py-1.5 font-code-md text-sm text-on-surface hover:border-primary focus:ring-1 focus:ring-primary focus:ring-offset-0">
        <Database className="h-4 w-4 text-on-surface-variant" />
        <SelectValue placeholder="Select context" />
      </SelectTrigger>
      <SelectContent className="border-outline-variant bg-surface-container text-on-surface">
        {contexts.map((ctx) => (
          <SelectItem
            key={ctx.name}
            value={ctx.name}
            className="focus:bg-surface-container-high focus:text-on-surface"
          >
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${
                  ctx.active ? "bg-primary" : "bg-on-surface-variant"
                }`}
              />
              <span>{ctx.name}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

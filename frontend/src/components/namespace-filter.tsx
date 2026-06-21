import { LayoutGrid } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Skeleton } from "../components/ui/skeleton";
import { useNamespaces } from "../hooks/use-namespaces";

export function NamespaceFilter() {
  const { namespaces, selected, setSelected, loading } = useNamespaces();

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <LayoutGrid className="h-4 w-4 text-on-surface-variant" />
        <Skeleton className="h-9 w-48 rounded" />
      </div>
    );
  }

  return (
    <Select value={selected} onValueChange={setSelected}>
      <SelectTrigger className="h-9 w-48 gap-2 rounded border-outline-variant bg-surface-container-low px-3 py-1.5 font-code-md text-sm text-on-surface hover:border-primary focus:ring-1 focus:ring-primary focus:ring-offset-0">
        <LayoutGrid className="h-4 w-4 text-on-surface-variant" />
        <SelectValue placeholder="Select namespace" />
      </SelectTrigger>
      <SelectContent className="border-outline-variant bg-surface-container text-on-surface">
        <SelectItem value="all" className="focus:bg-surface-container-high focus:text-on-surface">
          <span className="text-on-surface-variant">All namespaces</span>
        </SelectItem>
        {namespaces.map((ns) => (
          <SelectItem
            key={ns}
            value={ns}
            className="focus:bg-surface-container-high focus:text-on-surface"
          >
            {ns}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

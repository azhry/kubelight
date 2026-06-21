import { useState } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "../lib/utils";
import { StatusBadge } from "./status-badge";
import type { ResourceItem } from "../hooks/use-resources";

interface Column {
  key: string;
  label: string;
  sortable?: boolean;
  width?: string;
}

const columns: Column[] = [
  { key: "name", label: "Name", sortable: true },
  { key: "namespace", label: "Namespace", sortable: true },
  { key: "status", label: "Status", sortable: true, width: "w-32" },
  { key: "age", label: "Age", sortable: true, width: "w-24" },
];

type SortDir = "asc" | "desc" | null;

export function ResourceTable({
  resources,
  loading,
  error,
  kind,
}: {
  resources: ResourceItem[];
  loading: boolean;
  error: string | null;
  kind: string;
}) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : prev === "desc" ? null : "asc"));
      if (sortDir === "desc") setSortKey(null);
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sorted = [...resources].sort((a, b) => {
    if (!sortKey || !sortDir) return 0;
    const aVal = String((a as any)[sortKey] || "");
    const bVal = String((b as any)[sortKey] || "");
    const cmp = aVal.localeCompare(bVal);
    return sortDir === "asc" ? cmp : -cmp;
  });

  const SortIcon = ({ column }: { column: string }) => {
    if (sortKey !== column) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />;
    return sortDir === "asc"
      ? <ArrowUp className="h-3 w-3 ml-1" />
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-md bg-muted" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <p className="text-sm text-red-500 mb-2">Failed to load {kind}</p>
        <p className="text-xs">{error}</p>
      </div>
    );
  }

  if (resources.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <p className="text-sm">No {kind} found</p>
        <p className="text-xs mt-1">No resources match the current filter.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  "text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3",
                  col.width,
                  col.sortable && "cursor-pointer hover:text-foreground select-none"
                )}
                onClick={() => col.sortable && handleSort(col.key)}
              >
                <span className="inline-flex items-center">
                  {col.label}
                  {col.sortable && <SortIcon column={col.key} />}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((item) => (
            <tr
              key={item.name}
              className="border-b border-border/50 hover:bg-accent/30 transition-colors cursor-pointer"
            >
              <td className="px-4 py-3 font-medium">{item.name}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {item.namespace || "-"}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={item.status} />
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {item.age || "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

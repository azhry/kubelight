import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
  const navigate = useNavigate();
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
          <div key={i} className="flex items-center gap-4">
            <div className="flex-1 h-10"><div className="h-full animate-pulse rounded bg-surface-container-high" /></div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant">
        <p className="text-sm text-error mb-2">Failed to load {kind}</p>
        <p className="text-xs">{error}</p>
      </div>
    );
  }

  if (resources.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant">
        <p className="text-sm">No {kind} found</p>
        <p className="text-xs mt-1">No resources match the current filter.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-surface-container-high border-b border-outline-variant font-label-sm text-label-sm text-outline uppercase tracking-wider">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  "text-left font-medium px-4 py-3",
                  col.width,
                  col.sortable && "cursor-pointer hover:text-on-surface select-none"
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
        <tbody className="font-code-md text-code-md divide-y divide-outline-variant/50">
          {sorted.map((item) => {
            const statusLower = (item.status || "").toLowerCase();
            const rowHover = statusLower.includes("running") || statusLower.includes("ready") || statusLower.includes("healthy")
              ? "hover:bg-primary/5"
              : statusLower.includes("pending")
              ? "hover:bg-yellow-400/5"
              : statusLower.includes("failed") || statusLower.includes("crash") || statusLower.includes("unhealthy")
              ? "hover:bg-error/5"
              : "hover:bg-surface-container-high/50";
            return (
              <tr
                key={item.name}
                className={cn(
                  "cursor-pointer transition-colors group",
                  rowHover
                )}
                onClick={() => {
                  if (kind === "pods") {
                    navigate(`/pods/${item.namespace || "default"}/${item.name}`);
                  }
                }}
              >
                <td className="px-4 py-2.5 text-on-surface whitespace-nowrap">{item.name}</td>
                <td className="px-4 py-2.5 text-on-surface-variant">
                  {item.namespace || "-"}
                </td>
                <td className="px-4 py-2.5">
                  <StatusBadge status={item.status} />
                </td>
                <td className="px-4 py-2.5 text-on-surface-variant text-right">
                  {item.age || "-"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

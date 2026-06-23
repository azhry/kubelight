import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpDown, ArrowUp, ArrowDown, Pencil } from "lucide-react";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
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
  { key: "actions", label: "", sortable: false, width: "w-16" },
];

const readOnlyKinds = new Set(["nodes", "events", "ingressclasses"]);

type SortDir = "asc" | "desc" | null;

function parseAgeSeconds(age?: string): number {
  if (!age || age === "-") return Number.MAX_SAFE_INTEGER;
  const match = age.trim().toLowerCase().match(/^(?:(\d+)y)?\s*(?:(\d+)d)?\s*(?:(\d+)h)?\s*(?:(\d+)m)?\s*(?:(\d+)s)?$/);
  if (!match) return Number.MAX_SAFE_INTEGER;
  const [, years, days, hours, minutes, seconds] = match.map((v) => Number(v) || 0);
  return (
    years * 365 * 24 * 60 * 60 +
    days * 24 * 60 * 60 +
    hours * 60 * 60 +
    minutes * 60 +
    seconds
  );
}

export function ResourceTable({
  resources,
  loading,
  error,
  kind,
  onEdit,
}: {
  resources: ResourceItem[];
  loading: boolean;
  error: string | null;
  kind: string;
  onEdit?: (item: ResourceItem) => void;
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
    let cmp = 0;
    if (sortKey === "age") {
      cmp = parseAgeSeconds(a.age) - parseAgeSeconds(b.age);
    } else {
      const aVal = String((a as any)[sortKey] || "");
      const bVal = String((b as any)[sortKey] || "");
      cmp = aVal.localeCompare(bVal);
    }
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
                <td className="px-4 py-2.5 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit?.(item);
                    }}
                    className="h-7 px-2 text-on-surface-variant hover:text-primary hover:bg-surface-container-high"
                    title={readOnlyKinds.has(kind) ? "View YAML (read-only)" : "Edit YAML"}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

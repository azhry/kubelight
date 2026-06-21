import { cn } from "../lib/utils";

const statusColors: Record<string, string> = {
  Running: "bg-green-500/20 text-green-500 border-green-500/30",
  Pending: "bg-yellow-500/20 text-yellow-500 border-yellow-500/30",
  Succeeded: "bg-green-500/20 text-green-500 border-green-500/30",
  Failed: "bg-red-500/20 text-red-500 border-red-500/30",
  CrashLoopBackOff: "bg-red-500/20 text-red-500 border-red-500/30",
  Terminating: "bg-orange-500/20 text-orange-500 border-orange-500/30",
  Unknown: "bg-muted text-muted-foreground border-muted",
  Active: "bg-green-500/20 text-green-500 border-green-500/30",
  Ready: "bg-green-500/20 text-green-500 border-green-500/30",
  NotReady: "bg-yellow-500/20 text-yellow-500 border-yellow-500/30",
  Healthy: "bg-green-500/20 text-green-500 border-green-500/30",
  Unhealthy: "bg-red-500/20 text-red-500 border-red-500/30",
};

export function StatusBadge({ status }: { status?: string }) {
  if (!status) return null;

  const colorClass = Object.entries(statusColors).find(([key]) =>
    status.toLowerCase().includes(key.toLowerCase())
  )?.[1] || "bg-muted text-muted-foreground border-muted";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        colorClass
      )}
    >
      {status}
    </span>
  );
}

import { cn } from "../lib/utils";

const statusColors: Record<string, string> = {
  Running: "bg-primary/10 text-primary border-primary/20",
  Pending: "bg-yellow-400/10 text-yellow-400 border-yellow-400/20",
  Succeeded: "bg-primary/10 text-primary border-primary/20",
  Failed: "bg-error/10 text-error border-error/20",
  CrashLoopBackOff: "bg-error/10 text-error border-error/20",
  Terminating: "bg-orange-400/10 text-orange-400 border-orange-400/20",
  Unknown: "bg-surface-variant text-on-surface-variant border-outline-variant",
  Active: "bg-primary/10 text-primary border-primary/20",
  Ready: "bg-primary/10 text-primary border-primary/20",
  NotReady: "bg-yellow-400/10 text-yellow-400 border-yellow-400/20",
  Healthy: "bg-primary/10 text-primary border-primary/20",
  Unhealthy: "bg-error/10 text-error border-error/20",
};

export function StatusBadge({ status }: { status?: string }) {
  if (!status) return null;

  const colorClass = Object.entries(statusColors).find(([key]) =>
    status.toLowerCase().includes(key.toLowerCase())
  )?.[1] || "bg-surface-variant text-on-surface-variant border-outline-variant";

  const isRunning = /running|ready|healthy|active/i.test(status);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono text-status-badge uppercase tracking-wider",
        colorClass
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          isRunning ? "bg-primary" : "bg-current"
        )}
      />
      {status}
    </span>
  );
}

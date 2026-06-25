import { useState } from "react";
import { ArrowRightLeft, Play, Square } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { toast } from "./toast";
import { invoke } from "@tauri-apps/api/core";

interface PortForwardProps {
  namespace: string;
  podName: string;
}

export function PortForward({ namespace, podName }: PortForwardProps) {
  const [localPort, setLocalPort] = useState("");
  const [podPort, setPodPort] = useState("");
  const [forwarding, setForwarding] = useState(false);
  const [activeForward, setActiveForward] = useState<{ local: string; pod: string } | null>(null);

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    const lp = parseInt(localPort, 10);
    const pp = parseInt(podPort, 10);
    if (isNaN(lp) || isNaN(pp)) {
      toast("Enter valid port numbers", "error");
      return;
    }
    if (lp < 1 || lp > 65535 || pp < 1 || pp > 65535) {
      toast("Ports must be between 1 and 65535", "error");
      return;
    }

    setForwarding(true);
    try {
      await invoke("port_forward", {
        namespace,
        pod_name: podName,
        localPort: lp,
        podPort: pp,
      });
      setActiveForward({ local: String(lp), pod: String(pp) });
      toast(`Port forwarding ${lp}:${pp} started`, "success");
    } catch (e) {
      toast(String(e), "error");
    } finally {
      setForwarding(false);
    }
  };

  const handleStop = () => {
    setActiveForward(null);
    setLocalPort("");
    setPodPort("");
  };

  return (
    <div className="h-full flex flex-col min-h-0">
      <form
        onSubmit={handleStart}
        className="border-b border-outline-variant p-3 flex items-center gap-2 bg-surface-container shrink-0"
      >
        <ArrowRightLeft className="h-4 w-4 text-on-surface-variant shrink-0" />
        <Input
          value={localPort}
          onChange={(e) => setLocalPort(e.target.value)}
          placeholder="Local port"
          disabled={forwarding || !!activeForward}
          className="w-28 h-9 bg-surface-container border-outline-variant text-on-surface"
        />
        <span className="text-on-surface-variant text-sm">:</span>
        <Input
          value={podPort}
          onChange={(e) => setPodPort(e.target.value)}
          placeholder="Pod port"
          disabled={forwarding || !!activeForward}
          className="w-28 h-9 bg-surface-container border-outline-variant text-on-surface"
        />

        {activeForward ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleStop}
            className="border-destructive text-destructive hover:bg-destructive/10"
          >
            <Square className="h-4 w-4 mr-1" />
            Stop
          </Button>
        ) : (
          <Button
            type="submit"
            size="sm"
            disabled={forwarding || !localPort.trim() || !podPort.trim()}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {forwarding ? (
              <span className="h-3 w-3 mr-1 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <Play className="h-4 w-4 mr-1" />
            )}
            Forward
          </Button>
        )}
      </form>

      <div className="flex-1 overflow-auto p-4">
        {activeForward ? (
          <div className="space-y-3">
            <div className="rounded-lg bg-surface-container-high border border-outline-variant p-4">
              <p className="font-label-sm text-label-sm text-primary mb-1">Active Port Forward</p>
              <p className="font-code-md text-code-md text-on-surface">
                127.0.0.1:{activeForward.local} → {podName}:{activeForward.pod}
              </p>
              <p className="text-xs text-on-surface-variant mt-2">
                127.0.0.1:{activeForward.local} forwards to port {activeForward.pod} on {podName}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-on-surface-variant gap-2">
            <ArrowRightLeft className="h-8 w-8 opacity-50" />
            <p className="text-sm text-center">
              Forward a local port to a port on {podName}.
            </p>
            <p className="text-xs text-center opacity-70">
              Example: local 8080 → pod 80
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
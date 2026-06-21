import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { toast } from "../components/toast";

const MAX_ROWS = 1500;

export interface LogLine {
  line: string;
  timestamp: string;
}

export function useLogStream(namespace: string, podName: string, container?: string) {
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [streaming, setStreaming] = useState(false);
  const unlistenRef = useRef<UnlistenFn | null>(null);

  const startStream = useCallback(async () => {
    if (streaming) return;
    setLogs([]);
    setStreaming(true);

    const unlisten = await listen<LogLine>("log-line", (event) => {
      setLogs((prev) => {
        const next = [...prev, event.payload];
        if (next.length > MAX_ROWS) {
          return next.slice(next.length - MAX_ROWS);
        }
        return next;
      });
    });
    unlistenRef.current = unlisten;

    try {
      await invoke("stream_pod_logs", {
        namespace,
        podName,
        container: container || null,
      });
    } catch (e) {
      toast(String(e), "error");
    }
  }, [namespace, podName, container, streaming]);

  const stopStream = useCallback(() => {
    if (unlistenRef.current) {
      unlistenRef.current();
      unlistenRef.current = null;
    }
    setStreaming(false);
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  useEffect(() => {
    return () => {
      if (unlistenRef.current) {
        unlistenRef.current();
      }
    };
  }, []);

  return { logs, streaming, startStream, stopStream, clearLogs };
}

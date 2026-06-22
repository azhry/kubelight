import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { toast } from "../components/toast";

export interface ExecOutput {
  data: string;
}

export function useExec(namespace: string, podName: string, container?: string) {
  const [output, setOutput] = useState<string>("");
  const [running, setRunning] = useState(false);
  const unlistenRef = useRef<UnlistenFn | null>(null);
  const mountedRef = useRef(true);

  const exec = useCallback(
    async (command: string) => {
      if (!command.trim()) return;
      setRunning(true);
      try {
        await invoke("exec_pod", {
          namespace,
          pod_name: podName,
          container: container || null,
          command: command.trim(),
        });
      } catch (e) {
        if (mountedRef.current) {
          toast(String(e), "error");
          setOutput((prev) => prev + `\n[error] ${e}`);
        }
      } finally {
        if (mountedRef.current) setRunning(false);
      }
    },
    [namespace, podName, container]
  );

  useEffect(() => {
    mountedRef.current = true;
    listen<ExecOutput>("exec-output", (event) => {
      if (mountedRef.current) {
        setOutput((prev) => prev + event.payload.data);
      }
    }).then((unlisten) => {
      unlistenRef.current = unlisten;
    });
    return () => {
      mountedRef.current = false;
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
    };
  }, [namespace, podName, container]);

  const clearOutput = useCallback(() => setOutput(""), []);

  return { output, running, exec, clearOutput };
}

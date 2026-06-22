import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useKubeContext } from "../hooks/use-kube-context";
import { useNamespaces } from "../hooks/use-namespaces";
import { useResources } from "../hooks/use-resources";
import { useLogStream } from "../hooks/use-log-stream";
import { useYamlEditor } from "../hooks/use-yaml-editor";
import { setMockInvoke, emitMockEvent } from "../test-utils/tauri-mocks";
import * as toastModule from "../components/toast";

describe("IPC wiring integration", () => {
  beforeEach(() => {
    setMockInvoke("get_contexts", () => [
      { name: "minikube", cluster: "minikube", user: "minikube", active: true },
    ]);
    setMockInvoke("get_active_context", () => "minikube");
    setMockInvoke("switch_context", () => {});
    setMockInvoke("get_resources", (args: any) => {
      if (args.kind === "namespaces") {
        return [{ name: "default" }, { name: "app" }];
      }
      return [{ name: "nginx", namespace: "default", kind: args.kind, status: "Running", age: "3d" }];
    });
    setMockInvoke("stream_pod_logs", () => {});
    setMockInvoke("get_resource_yaml", () => "apiVersion: v1\nkind: Pod");
    setMockInvoke("apply_resource", () => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("useKubeContext loads contexts and exposes the active context", async () => {
    const { result } = renderHook(() => useKubeContext());

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.contexts).toHaveLength(1);
    expect(result.current.activeContext).toBe("minikube");
  });

  it("useKubeContext invokes switch_context", async () => {
    const { result } = renderHook(() => useKubeContext());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.switchContext("prod");
    });

    expect(result.current.activeContext).toBe("prod");
  });

  it("useNamespaces loads namespaces", async () => {
    const { result } = renderHook(() => useNamespaces());

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.namespaces).toContain("default");
    expect(result.current.namespaces).toContain("app");
  });

  it("useResources loads resources and handles errors", async () => {
    setMockInvoke("get_resources", () => {
      throw new Error("cluster unreachable");
    });

    const { result } = renderHook(() => useResources("pods", undefined));

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toContain("cluster unreachable");
    expect(result.current.resources).toHaveLength(0);
  });

  it("useLogStream listens for log lines and caps rows", async () => {
    const { result } = renderHook(() => useLogStream("default", "nginx"));

    await act(async () => {
      await result.current.startStream();
    });

    act(() => {
      for (let i = 0; i < 1501; i += 1) {
        emitMockEvent("log-line", { line: `line ${i}`, timestamp: "2024-01-01T00:00:00.000Z" });
      }
    });

    await waitFor(() => expect(result.current.logs).toHaveLength(1500));
    expect(result.current.streaming).toBe(true);

    act(() => {
      result.current.stopStream();
    });

    expect(result.current.streaming).toBe(false);
  });

  it("useYamlEditor fetches and applies YAML", async () => {
    const { result } = renderHook(() => useYamlEditor("pods", undefined, "nginx"));

    await waitFor(() => expect(result.current.yamlStr).toBe("apiVersion: v1\nkind: Pod"));
    expect(result.current.originalYaml).toBe("apiVersion: v1\nkind: Pod");

    act(() => {
      result.current.setYamlStr("modified");
    });

    await waitFor(() => expect(result.current.hasChanges).toBe(true));

    await act(async () => {
      await result.current.apply();
    });
  });

  it("shows a toast when an IPC command fails", async () => {
    setMockInvoke("get_contexts", () => {
      throw new Error("auth failed");
    });
    const toastSpy = vi.spyOn(toastModule, "toast");

    renderHook(() => useKubeContext());

    await waitFor(() => expect(toastSpy).toHaveBeenCalledWith("Error: auth failed", "error"));
  });
});

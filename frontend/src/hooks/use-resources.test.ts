import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useResources } from "./use-resources";
import { setMockInvoke } from "../test-utils/tauri-mocks";

describe("useResources", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("fetches resources for the given kind and namespace", async () => {
    setMockInvoke("get_resources", () => [
      { name: "nginx", namespace: "default", kind: "pods", status: "Running", age: "3d" },
    ]);

    const { result } = renderHook(() => useResources("pods", "default"));

    expect(result.current.loading).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.resources).toHaveLength(1);
    expect(result.current.resources[0].name).toBe("nginx");
  });

  it("returns cached resources immediately and refreshes in the background", async () => {
    let callCount = 0;
    setMockInvoke("get_resources", () => {
      callCount += 1;
      return [
        { name: "nginx", namespace: "default", kind: "pods", status: "Running", age: "3d" },
      ];
    });

    const { result, unmount } = renderHook(() => useResources("pods", "default"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(callCount).toBe(1);

    unmount();

    const { result: nextResult } = renderHook(() => useResources("pods", "default"));
    expect(nextResult.current.loading).toBe(false);
    expect(nextResult.current.resources).toHaveLength(1);
    await waitFor(() => expect(callCount).toBe(2));
  });

  it("caches resources separately per kind and namespace", async () => {
    setMockInvoke("get_resources", (args: any) => {
      if (args.kind === "pods" && args.namespace === "default") {
        return [{ name: "nginx", namespace: "default", kind: "pods", status: "Running", age: "3d" }];
      }
      return [{ name: "redis", namespace: "app", kind: "pods", status: "Running", age: "1h" }];
    });

    const { result, rerender } = renderHook(
      ({ namespace }: { namespace: string }) => useResources("pods", namespace),
      { initialProps: { namespace: "default" } }
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await waitFor(() => expect(result.current.resources[0]?.name).toBe("nginx"));

    rerender({ namespace: "app" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await waitFor(() => expect(result.current.resources[0]?.name).toBe("redis"));

    rerender({ namespace: "default" });
    expect(result.current.resources[0]?.name).toBe("nginx");
  });

  it("auto-refreshes resources on the configured interval", async () => {
    let callCount = 0;
    setMockInvoke("get_resources", () => {
      callCount += 1;
      return [{ name: `pod-${callCount}`, namespace: "default", kind: "pods", status: "Running", age: "3d" }];
    });

    const { result } = renderHook(() => useResources("pods", "default"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(callCount).toBe(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    await waitFor(() => expect(callCount).toBe(2));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    await waitFor(() => expect(callCount).toBe(3));
  });

  it("stops auto-refresh when autoRefresh is disabled", async () => {
    let callCount = 0;
    setMockInvoke("get_resources", () => {
      callCount += 1;
      return [{ name: "nginx", namespace: "default", kind: "pods", status: "Running", age: "3d" }];
    });

    const { result } = renderHook(() => useResources("pods", "default"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(callCount).toBe(1);

    act(() => {
      result.current.setAutoRefresh(false);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(callCount).toBe(1);
  });

  it("clears the cache and shows an error when the fetch fails", async () => {
    setMockInvoke("get_resources", () => {
      throw new Error("cluster unreachable");
    });

    const { result } = renderHook(() => useResources("pods", "default"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("Error: cluster unreachable");
    expect(result.current.resources).toEqual([]);
  });
});

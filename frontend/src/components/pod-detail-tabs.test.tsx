import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PodDetailTabs } from "./pod-detail-tabs";
import { setMockInvoke, mockInvoke, emitMockEvent } from "../test-utils/tauri-mocks";

vi.mock("./codemirror", () => ({
  CodeMirror: ({
    value,
    onChange,
  }: {
    value: string;
    onChange?: (v: string) => void;
  }) => (
    <textarea
      data-testid="yaml-editor"
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
    />
  ),
}));

const podResource = {
  name: "nginx",
  namespace: "default",
  kind: "pods",
  status: "Running",
  age: "3d",
};

describe("PodDetailTabs", () => {
  beforeEach(() => {
    setMockInvoke("stream_pod_logs", () => {});
    setMockInvoke("exec_pod", () => {});
    setMockInvoke("get_resource_yaml", () => "apiVersion: v1\nkind: Pod");
  });

  it("auto-connects to /bin/sh when the Terminal tab is opened", async () => {
    render(<PodDetailTabs resource={podResource} />);

    fireEvent.click(screen.getByText("Terminal"));

    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith(
        "exec_pod",
        expect.objectContaining({
          namespace: "default",
          pod_name: "nginx",
          command: ["/bin/sh"],
        })
      )
    );
  });

  it("runs additional commands via /bin/sh -c", async () => {
    render(<PodDetailTabs resource={podResource} />);

    fireEvent.click(screen.getByText("Terminal"));
    await waitFor(() => expect(screen.getByPlaceholderText("Run a command in nginx...")).toBeInTheDocument());

    const input = screen.getByPlaceholderText("Run a command in nginx...");
    fireEvent.change(input, { target: { value: "ls -la" } });
    fireEvent.click(screen.getByRole("button", { name: "Run" }));

    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith(
        "exec_pod",
        expect.objectContaining({
          command: ["/bin/sh", "-c", "ls -la"],
        })
      )
    );
  });

  it("renders the Diagnostics tab placeholder", () => {
    render(<PodDetailTabs resource={podResource} />);

    fireEvent.click(screen.getByText("Diagnostics"));

    expect(screen.getByText(/pod network diagnostics/i)).toBeInTheDocument();
  });
});

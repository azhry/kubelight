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

  it("renders the Diagnostics tab UI", () => {
    render(<PodDetailTabs resource={podResource} />);

    fireEvent.click(screen.getByText("Diagnostics"));

    expect(screen.getByPlaceholderText(/target pod, service, or url/i)).toBeInTheDocument();
  });

  it("shows connecting message when terminal tab is first opened", async () => {
    render(<PodDetailTabs resource={podResource} />);

    fireEvent.click(screen.getByText("Terminal"));

    await waitFor(() => expect(screen.getByText(/Connecting to nginx/i)).toBeInTheDocument());
  });

  it("renders exec output from events in the terminal tab", async () => {
    render(<PodDetailTabs resource={podResource} />);

    fireEvent.click(screen.getByText("Terminal"));
    await waitFor(() => expect(screen.getByPlaceholderText("Run a command in nginx...")).toBeInTheDocument());

    emitMockEvent("exec-output", { data: "total 42\n-rw-r--r-- 1 root root 1234 main.js\n" });

    await waitFor(() => expect(screen.getByText(/total 42/)).toBeInTheDocument());
    expect(screen.getByText(/main.js/)).toBeInTheDocument();
  });

  it("shows pod details by default", () => {
    render(<PodDetailTabs resource={podResource} />);

    expect(screen.getAllByText("nginx")[0]).toBeInTheDocument();
    expect(screen.getByText("Pod · default")).toBeInTheDocument();
    expect(screen.getByText("Resource Info")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
  });

  it("renders the YAML tab with editor content", async () => {
    render(<PodDetailTabs resource={podResource} />);

    fireEvent.click(screen.getByText("YAML"));

    await waitFor(() => expect(screen.getByTestId("yaml-editor")).toHaveValue("apiVersion: v1\nkind: Pod"));
  });
});

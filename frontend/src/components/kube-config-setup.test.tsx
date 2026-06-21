import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { KubeConfigSetup } from "./kube-config-setup";
import { setMockInvoke, mockOpen } from "../test-utils/tauri-mocks";

describe("KubeConfigSetup", () => {
  beforeEach(() => {
    setMockInvoke("get_kubeconfig_status", () => ({ configured: false, error: null }));
  });

  it("shows the setup form and calls onConfigured when already configured", async () => {
    setMockInvoke("get_kubeconfig_status", () => ({ configured: true, error: null }));
    const onConfigured = vi.fn();
    render(<KubeConfigSetup onConfigured={onConfigured} />);

    await waitFor(() => expect(screen.getByText("Kubernetes Cluster Setup")).toBeInTheDocument());
    await waitFor(() => expect(onConfigured).toHaveBeenCalledTimes(1));
  });

  it("displays an error message when kubeconfig status reports an error", async () => {
    setMockInvoke("get_kubeconfig_status", () => ({ configured: false, error: "No kubeconfig found" }));
    render(<KubeConfigSetup onConfigured={vi.fn()} />);

    await waitFor(() => expect(screen.getByText("No kubeconfig found")).toBeInTheDocument());
  });

  it("reloads kubeconfig and calls onConfigured on success", async () => {
    const user = userEvent.setup();
    setMockInvoke("reload_kubeconfig", () => ({ configured: true, error: null }));
    const onConfigured = vi.fn();
    render(<KubeConfigSetup onConfigured={onConfigured} />);

    await waitFor(() => expect(screen.getByPlaceholderText("~/.kube/config")).toBeInTheDocument());

    const input = screen.getByPlaceholderText("~/.kube/config");
    await user.type(input, "/custom/config");

    await user.click(screen.getByRole("button", { name: /Connect/i }));

    await waitFor(() => expect(onConfigured).toHaveBeenCalledTimes(1));
  });

  it("displays an error when reload fails", async () => {
    const user = userEvent.setup();
    setMockInvoke("reload_kubeconfig", () => {
      throw new Error("invalid config");
    });
    const onConfigured = vi.fn();
    render(<KubeConfigSetup onConfigured={onConfigured} />);

    await waitFor(() => expect(screen.getByRole("button", { name: /Connect/i })).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /Connect/i }));

    await waitFor(() => expect(screen.getByText("Failed to reload kubeconfig")).toBeInTheDocument());
    expect(onConfigured).not.toHaveBeenCalled();
  });

  it("opens the file dialog and fills the selected path when browsing", async () => {
    const user = userEvent.setup();
    mockOpen.mockResolvedValue("/home/user/.kube/config");
    render(<KubeConfigSetup onConfigured={vi.fn()} />);

    await waitFor(() => expect(screen.getByRole("button", { name: /Browse/i })).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /Browse/i }));

    await waitFor(() => {
      expect(mockOpen).toHaveBeenCalledWith({
        multiple: false,
        filters: [{ name: "Kubeconfig", extensions: ["config", "yaml", "yml"] }],
      });
    });
    expect(screen.getByDisplayValue("/home/user/.kube/config")).toBeInTheDocument();
  });
});

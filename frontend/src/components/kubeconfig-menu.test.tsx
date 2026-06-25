import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { KubeconfigMenu } from "./kubeconfig-menu";
import { setMockInvoke, mockInvoke } from "../test-utils/tauri-mocks";

vi.mock("./toast", () => ({
  toast: vi.fn(),
}));

describe("KubeconfigMenu", () => {
  beforeEach(() => {
    setMockInvoke("list_kubeconfigs", () => [
      { id: "session-a", label: "config-a", path: "/home/user/.kube/config-a", active: true },
      { id: "session-b", label: "config-b", path: "/home/user/.kube/config-b", active: false },
    ]);
    setMockInvoke("switch_kubeconfig", () => {});
    setMockInvoke("remove_kubeconfig", () => {});
    setMockInvoke("add_kubeconfig", () => "session-c");
  });

  it("lists kubeconfig sessions with active indicator", async () => {
    render(<KubeconfigMenu />);

    await waitFor(() => expect(screen.getByText("config-a")).toBeInTheDocument());
    expect(screen.getByText("config-b")).toBeInTheDocument();
  });

  it("switches kubeconfig when a session is clicked", async () => {
    render(<KubeconfigMenu />);

    await waitFor(() => expect(screen.getByText("config-b")).toBeInTheDocument());
    fireEvent.click(screen.getByText("config-b"));

    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith("switch_kubeconfig", { id: "session-b" })
    );
  });

  it("removes a kubeconfig session", async () => {
    render(<KubeconfigMenu />);

    await waitFor(() => expect(screen.getByText("config-a")).toBeInTheDocument());

    const removeButtons = screen.getAllByTitle("Remove kubeconfig");
    fireEvent.click(removeButtons[0]);

    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith("remove_kubeconfig", { id: "session-a" })
    );
  });

  it("adds a kubeconfig from the path input", async () => {
    render(<KubeconfigMenu />);

    await waitFor(() => expect(screen.getByText("config-a")).toBeInTheDocument());

    const input = screen.getByPlaceholderText("Path...");
    fireEvent.change(input, { target: { value: "/home/user/.kube/config-c" } });
    fireEvent.click(screen.getByRole("button", { name: "Add kubeconfig" }));

    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith(
        "add_kubeconfig",
        expect.objectContaining({ path: "/home/user/.kube/config-c", label: null })
      )
    );
  });

  it("shows a loading spinner while sessions are being fetched", async () => {
    setMockInvoke("list_kubeconfigs", () => new Promise(() => {}));
    render(<KubeconfigMenu />);

    const spinner = document.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
    expect(screen.queryByText("config-a")).not.toBeInTheDocument();
  });

  it("shows an error toast when list_kubeconfigs fails", async () => {
    setMockInvoke("list_kubeconfigs", () => { throw new Error("failed to list"); });
    const { toast } = await import("./toast");

    render(<KubeconfigMenu />);

    await waitFor(() => expect(toast).toHaveBeenCalledWith("Error: failed to list", "error"));
  });

  it("shows an error toast when add_kubeconfig fails", async () => {
    setMockInvoke("add_kubeconfig", () => { throw new Error("add failed"); });
    const { toast } = await import("./toast");

    render(<KubeconfigMenu />);

    await waitFor(() => expect(screen.getByText("config-a")).toBeInTheDocument());

    const input = screen.getByPlaceholderText("Path...");
    fireEvent.change(input, { target: { value: "/bad/path" } });
    fireEvent.click(screen.getByRole("button", { name: "Add kubeconfig" }));

    await waitFor(() => expect(toast).toHaveBeenCalledWith("Error: add failed", "error"));
  });

  it("shows an error toast when remove_kubeconfig fails", async () => {
    setMockInvoke("remove_kubeconfig", () => { throw new Error("remove failed"); });
    const { toast } = await import("./toast");

    render(<KubeconfigMenu />);

    await waitFor(() => expect(screen.getByText("config-a")).toBeInTheDocument());

    const removeButtons = screen.getAllByTitle("Remove kubeconfig");
    fireEvent.click(removeButtons[0]);

    await waitFor(() => expect(toast).toHaveBeenCalledWith("Error: remove failed", "error"));
  });
});

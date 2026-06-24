import { render, screen, waitFor, fireEvent } from "@testing-library/react";
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
    fireEvent.click(screen.getByRole("button", { name: "" }));

    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith(
        "add_kubeconfig",
        expect.objectContaining({ path: "/home/user/.kube/config-c", label: null })
      )
    );
  });
});

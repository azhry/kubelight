import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NetworkDiagnostics } from "./network-diagnostics";
import { setMockInvoke, mockInvoke } from "../test-utils/tauri-mocks";

vi.mock("./toast", () => ({
  toast: vi.fn(),
}));

describe("NetworkDiagnostics", () => {
  beforeEach(() => {
    setMockInvoke("diagnose_pod_network", () => ({
      stdout: "HTTP/1.1 200 OK",
      stderr: "",
    }));
  });

  it("invokes diagnose_pod_network with the entered target", async () => {
    render(<NetworkDiagnostics namespace="default" podName="nginx" />);

    const input = screen.getByPlaceholderText(/target pod, service, or url/i);
    fireEvent.change(input, { target: { value: "my-service" } });
    fireEvent.click(screen.getByRole("button", { name: /run/i }));

    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith(
        "diagnose_pod_network",
        expect.objectContaining({
          source_namespace: "default",
          source_pod: "nginx",
          target: "my-service",
        })
      )
    );

    expect(screen.getByText("HTTP/1.1 200 OK")).toBeInTheDocument();
  });

  it("renders stderr when the diagnostic fails", async () => {
    setMockInvoke("diagnose_pod_network", () => {
      throw new Error("connection refused");
    });

    render(<NetworkDiagnostics namespace="default" podName="nginx" />);

    const input = screen.getByPlaceholderText(/target pod, service, or url/i);
    fireEvent.change(input, { target: { value: "bad-target" } });
    fireEvent.click(screen.getByRole("button", { name: /run/i }));

    await waitFor(() =>
      expect(screen.getByText(/connection refused/i)).toBeInTheDocument()
    );
  });
});

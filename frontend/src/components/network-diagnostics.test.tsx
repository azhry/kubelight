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

  it("shows the empty state before any diagnostic is run", () => {
    render(<NetworkDiagnostics namespace="default" podName="nginx" />);

    expect(screen.getByText(/Enter a target pod, service, or URL/i)).toBeInTheDocument();
  });

  it("clears the result when the Clear button is clicked", async () => {
    render(<NetworkDiagnostics namespace="default" podName="nginx" />);

    const input = screen.getByPlaceholderText(/target pod, service, or url/i);
    fireEvent.change(input, { target: { value: "my-service" } });
    fireEvent.click(screen.getByRole("button", { name: /run/i }));

    await waitFor(() => expect(screen.getByText("HTTP/1.1 200 OK")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /clear/i }));

    await waitFor(() => expect(screen.getByText(/Enter a target pod, service, or URL/i)).toBeInTheDocument());
  });

  it("shows a loading message while running the diagnostic", async () => {
    setMockInvoke("diagnose_pod_network", () => new Promise(() => {}));

    render(<NetworkDiagnostics namespace="default" podName="nginx" />);

    const input = screen.getByPlaceholderText(/target pod, service, or url/i);
    fireEvent.change(input, { target: { value: "my-service" } });
    fireEvent.click(screen.getByRole("button", { name: /run/i }));

    await waitFor(() => expect(screen.getByText(/Running curl from nginx/i)).toBeInTheDocument());
  });

  it("shows no output message when both stdout and stderr are empty", async () => {
    setMockInvoke("diagnose_pod_network", () => ({
      stdout: "",
      stderr: "",
    }));

    render(<NetworkDiagnostics namespace="default" podName="nginx" />);

    const input = screen.getByPlaceholderText(/target pod, service, or url/i);
    fireEvent.change(input, { target: { value: "silent-service" } });
    fireEvent.click(screen.getByRole("button", { name: /run/i }));

    await waitFor(() => expect(screen.getByText("No output returned.")).toBeInTheDocument());
  });
});

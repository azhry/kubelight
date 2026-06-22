import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach } from "vitest";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { PodDetailPage } from "./pod-detail-page";
import { setMockInvoke, emitMockEvent } from "../test-utils/tauri-mocks";

function LocationDisplay() {
  return <div data-testid="location">{useLocation().pathname}</div>;
}

describe("PodDetailPage", () => {
  beforeEach(() => {
    setMockInvoke("get_resources", () => [
      { name: "nginx", namespace: "default", kind: "pods", status: "Running", age: "3d" },
    ]);
    setMockInvoke("stream_pod_logs", () => {});
    setMockInvoke("exec_pod", () => {});
    setMockInvoke("port_forward", () => {});
  });

  function renderPage() {
    return render(
      <MemoryRouter initialEntries={["/pods/default/nginx"]}>
        <Routes>
          <Route path="/pods/:namespace/:name" element={<PodDetailPage />} />
          <Route path="/edit/:kind/:namespace/:name" element={<LocationDisplay />} />
        </Routes>
      </MemoryRouter>
    );
  }

  it("renders pod metadata", async () => {
    renderPage();

    await waitFor(() => expect(screen.getByRole("heading", { name: "nginx" })).toBeInTheDocument());

    const nameRow = screen.getByText("Name").closest("div")!;
    expect(within(nameRow).getByText("nginx")).toBeInTheDocument();

    const namespaceRow = screen.getByText("Namespace").closest("div")!;
    expect(within(namespaceRow).getByText("default")).toBeInTheDocument();

    const kindRow = screen.getByText("Kind").closest("div")!;
    expect(within(kindRow).getByText("Pod")).toBeInTheDocument();

    expect(screen.getAllByText("Running").length).toBeGreaterThanOrEqual(2);
  });

  it("renders the log viewer", async () => {
    renderPage();

    await waitFor(() => expect(screen.getByText("Logs")).toBeInTheDocument());
    expect(screen.getByPlaceholderText("Filter logs...")).toBeInTheDocument();
  });

  it("streams log lines into the viewer", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(screen.getByTitle("Resume streaming")).toBeInTheDocument());
    await user.click(screen.getByTitle("Resume streaming"));

    emitMockEvent("log-line", { line: "[INFO] log one", timestamp: "2024-01-01T00:00:00.000Z" });
    emitMockEvent("log-line", { line: "[INFO] log two", timestamp: "2024-01-01T00:00:01.000Z" });

    await waitFor(() => expect(screen.getByText("log one")).toBeInTheDocument());
    expect(screen.getByText("log two")).toBeInTheDocument();
  });

  it("caps the rendered log lines at the DOM row limit", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(screen.getByTitle("Resume streaming")).toBeInTheDocument());
    await user.click(screen.getByTitle("Resume streaming"));

    for (let i = 0; i < 1600; i += 1) {
      emitMockEvent("log-line", { line: `line ${i}`, timestamp: "2024-01-01T00:00:00.000Z" });
    }

    await waitFor(() => expect(screen.getByText("1500 lines")).toBeInTheDocument());
  });

  it("switches to the Terminal tab and shows the exec prompt", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(screen.getByText("Logs")).toBeInTheDocument());
    await user.click(screen.getByText("Terminal"));

    expect(screen.getByPlaceholderText("exec in nginx...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run" })).toBeInTheDocument();
  });

  it("executes a command in the terminal and displays output", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(screen.getByText("Terminal")).toBeInTheDocument());
    await user.click(screen.getByText("Terminal"));

    const input = screen.getByPlaceholderText("exec in nginx...");
    await user.type(input, "ls -la");
    await user.click(screen.getByRole("button", { name: "Run" }));

    emitMockEvent("exec-output", { data: "total 0\n" });
    await waitFor(() => expect(screen.getByText("total 0")).toBeInTheDocument());
  });

  it("navigates to the YAML editor when the YAML tab is clicked", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(screen.getByText("YAML")).toBeInTheDocument());
    await user.click(screen.getByText("YAML"));

    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/edit/pods/default/nginx"));
  });

  it("opens the port-forward dialog and starts a forward", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(screen.getByRole("button", { name: "Port Forward" })).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Port Forward" }));

    await waitFor(() => expect(screen.getByRole("heading", { name: "Port Forward" })).toBeInTheDocument());

    const localInput = screen.getByPlaceholderText("8080");
    const podInput = screen.getByPlaceholderText("80");

    await user.type(localInput, "8080");
    await user.type(podInput, "80");

    await user.click(screen.getByRole("button", { name: "Start Forward" }));

    await waitFor(() => expect(screen.queryByRole("heading", { name: "Port Forward" })).not.toBeInTheDocument());
  });
});

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { PodDetailPage } from "./pod-detail-page";
import { setMockInvoke, emitMockEvent } from "../test-utils/tauri-mocks";

describe("PodDetailPage", () => {
  beforeEach(() => {
    setMockInvoke("get_resources", () => [
      { name: "nginx", namespace: "default", kind: "pods", status: "Running", age: "3d" },
    ]);
    setMockInvoke("stream_pod_logs", () => {});
  });

  function renderPage() {
    return render(
      <MemoryRouter initialEntries={["/pods/default/nginx"]}>
        <Routes>
          <Route path="/pods/:namespace/:name" element={<PodDetailPage />} />
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
});

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach } from "vitest";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { AppLayout } from "./App";
import { setMockInvoke } from "./test-utils/tauri-mocks";

vi.mock("./components/codemirror", () => ({
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

function LocationDisplay() {
  return <div data-testid="location">{useLocation().pathname}</div>;
}

describe("App routing", () => {
  beforeEach(() => {
    setMockInvoke("get_contexts", () => [
      { name: "minikube", cluster: "minikube", user: "minikube", active: true },
    ]);
    setMockInvoke("get_active_context", () => "minikube");
    setMockInvoke("get_resources", (args: any) => {
      if (args.kind === "namespaces") {
        return [{ name: "default" }, { name: "app" }];
      }
      return [
        { name: "nginx", namespace: "default", kind: args.kind, status: "Running", age: "3d" },
      ];
    });
    setMockInvoke("stream_pod_logs", () => {});
    setMockInvoke("get_resource_yaml", () => "apiVersion: v1\nkind: Pod");
    setMockInvoke("patch_resource", () => {});
  });

  function renderApp(initialEntries: string[]) {
    return render(
      <MemoryRouter initialEntries={initialEntries}>
        <AppLayout />
        <LocationDisplay />
      </MemoryRouter>
    );
  }

  it("redirects unknown routes to /pods", async () => {
    renderApp(["/foo/bar"]);

    await waitFor(() => expect(screen.getByRole("heading", { name: "Pods" })).toBeInTheDocument());
    expect(screen.getByTestId("location")).toHaveTextContent("/pods");
  });

  it("renders the resource list for the current route", async () => {
    renderApp(["/pods"]);

    await waitFor(() => expect(screen.getByRole("heading", { name: "Pods" })).toBeInTheDocument());
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("nginx")).toBeInTheDocument();
  });

  it("navigates between resource kinds via the sidebar", async () => {
    const user = userEvent.setup();
    renderApp(["/pods"]);

    await waitFor(() => expect(screen.getByRole("heading", { name: "Pods" })).toBeInTheDocument());

    await user.click(screen.getByText("Deployments"));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Deployments" })).toBeInTheDocument());

    await user.click(screen.getByText("Services"));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Services" })).toBeInTheDocument());
  });

  it("navigates to pod detail from the resource list", async () => {
    const user = userEvent.setup();
    renderApp(["/pods"]);

    await waitFor(() => expect(screen.getByText("nginx")).toBeInTheDocument());
    await user.click(screen.getByText("nginx").closest("tr")!);

    await waitFor(() => expect(screen.getByRole("heading", { name: "nginx" })).toBeInTheDocument());
    expect(screen.getByPlaceholderText("Filter logs...")).toBeInTheDocument();
  });

  it("uses a full-viewport root container that hides overflow", () => {
    renderApp(["/pods"]);

    const main = screen.getByRole("main");
    const flexRow = main.parentElement;
    const root = flexRow?.parentElement;

    expect(root).toHaveClass("h-screen", "overflow-hidden", "flex", "flex-col");
  });

  it("wraps sidebar and main content in a non-scrolling flex row", () => {
    renderApp(["/pods"]);

    const main = screen.getByRole("main");
    const flexRow = main.parentElement;

    expect(flexRow).toHaveClass("flex", "flex-1", "overflow-hidden");
  });

  it("keeps the main content area clipped so only internal panes scroll", () => {
    renderApp(["/pods"]);

    const main = screen.getByRole("main");

    expect(main).toHaveClass("flex-1", "overflow-hidden");
  });
});

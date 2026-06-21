import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";
import { ResourceTable } from "./resource-table";
import type { ResourceItem } from "../hooks/use-resources";

function LocationDisplay() {
  return <div data-testid="location">{useLocation().pathname}</div>;
}

const resources: ResourceItem[] = [
  { name: "nginx", namespace: "default", kind: "pods", status: "Running", age: "3d" },
  { name: "redis", namespace: "app", kind: "pods", status: "Pending", age: "1h" },
  { name: "postgres", namespace: "db", kind: "pods", status: "Failed", age: "5m" },
];

describe("ResourceTable", () => {
  it("renders column headers", () => {
    render(
      <MemoryRouter>
        <ResourceTable resources={resources} loading={false} error={null} kind="pods" />
      </MemoryRouter>
    );

    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Namespace")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Age")).toBeInTheDocument();
  });

  it("renders resource rows with status badges", () => {
    render(
      <MemoryRouter>
        <ResourceTable resources={resources} loading={false} error={null} kind="pods" />
      </MemoryRouter>
    );

    expect(screen.getByText("nginx")).toBeInTheDocument();
    expect(screen.getByText("redis")).toBeInTheDocument();
    expect(screen.getByText("postgres")).toBeInTheDocument();
    expect(screen.getByText("Running")).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
  });

  it("sorts rows when a column header is clicked", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ResourceTable resources={resources} loading={false} error={null} kind="pods" />
      </MemoryRouter>
    );

    const nameHeader = screen.getByText("Name").closest("th")!;
    const rows = () => screen.getAllByRole("row").slice(1);

    expect(rows()[0]).toHaveTextContent("nginx");
    expect(rows()[1]).toHaveTextContent("redis");
    expect(rows()[2]).toHaveTextContent("postgres");

    await user.click(nameHeader);
    expect(rows()[0]).toHaveTextContent("nginx");
    expect(rows()[1]).toHaveTextContent("postgres");
    expect(rows()[2]).toHaveTextContent("redis");

    await user.click(nameHeader);
    expect(rows()[0]).toHaveTextContent("redis");
    expect(rows()[1]).toHaveTextContent("postgres");
    expect(rows()[2]).toHaveTextContent("nginx");
  });

  it("navigates to pod detail when a pod row is clicked", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/pods"]}>
        <ResourceTable resources={resources} loading={false} error={null} kind="pods" />
        <LocationDisplay />
      </MemoryRouter>
    );

    await user.click(screen.getByText("nginx").closest("tr")!);
    expect(screen.getByTestId("location")).toHaveTextContent("/pods/default/nginx");
  });

  it("does not navigate when kind is not pods", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/deployments"]}>
        <ResourceTable resources={resources} loading={false} error={null} kind="deployments" />
        <LocationDisplay />
      </MemoryRouter>
    );

    await user.click(screen.getByText("nginx").closest("tr")!);
    expect(screen.getByTestId("location")).toHaveTextContent("/deployments");
  });

  it("renders an error message", () => {
    render(
      <MemoryRouter>
        <ResourceTable resources={[]} loading={false} error="connection refused" kind="pods" />
      </MemoryRouter>
    );

    expect(screen.getByText("Failed to load pods")).toBeInTheDocument();
    expect(screen.getByText("connection refused")).toBeInTheDocument();
  });

  it("renders an empty state", () => {
    render(
      <MemoryRouter>
        <ResourceTable resources={[]} loading={false} error={null} kind="pods" />
      </MemoryRouter>
    );

    expect(screen.getByText("No pods found")).toBeInTheDocument();
  });

  it("renders a loading skeleton", () => {
    render(
      <MemoryRouter>
        <ResourceTable resources={[]} loading={true} error={null} kind="pods" />
      </MemoryRouter>
    );

    expect(document.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });
});

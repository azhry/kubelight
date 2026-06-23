import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
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

  it("sorts rows by parsed age in ascending and descending order", async () => {
    const ageResources: ResourceItem[] = [
      { name: "old", namespace: "default", kind: "pods", status: "Running", age: "2d" },
      { name: "newest", namespace: "default", kind: "pods", status: "Running", age: "5m" },
      { name: "young", namespace: "default", kind: "pods", status: "Running", age: "1h" },
    ];
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ResourceTable resources={ageResources} loading={false} error={null} kind="pods" />
      </MemoryRouter>
    );

    const ageHeader = screen.getByText("Age").closest("th")!;
    const rows = () => screen.getAllByRole("row").slice(1);

    await user.click(ageHeader);
    expect(rows()[0]).toHaveTextContent("newest");
    expect(rows()[1]).toHaveTextContent("young");
    expect(rows()[2]).toHaveTextContent("old");

    await user.click(ageHeader);
    expect(rows()[0]).toHaveTextContent("old");
    expect(rows()[1]).toHaveTextContent("young");
    expect(rows()[2]).toHaveTextContent("newest");
  });

  it("treats missing or unparsable age as oldest when sorting", async () => {
    const ageResources: ResourceItem[] = [
      { name: "missing", namespace: "default", kind: "pods", status: "Running", age: undefined },
      { name: "fresh", namespace: "default", kind: "pods", status: "Running", age: "1h" },
      { name: "weird", namespace: "default", kind: "pods", status: "Running", age: "unknown" },
    ];
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ResourceTable resources={ageResources} loading={false} error={null} kind="pods" />
      </MemoryRouter>
    );

    const ageHeader = screen.getByText("Age").closest("th")!;
    const rows = () => screen.getAllByRole("row").slice(1);

    await user.click(ageHeader);
    expect(rows()[0]).toHaveTextContent("fresh");
    expect(rows()[1]).toHaveTextContent("missing");
    expect(rows()[2]).toHaveTextContent("weird");
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

  it("renders ingress resources with status badges", () => {
    const ingresses: ResourceItem[] = [
      { name: "public", namespace: "default", kind: "ingresses", status: "Active", age: "1d" },
    ];

    render(
      <MemoryRouter>
        <ResourceTable resources={ingresses} loading={false} error={null} kind="ingresses" />
      </MemoryRouter>
    );

    expect(screen.getByText("public")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("calls onEdit when the edit button is clicked", async () => {
    const user = userEvent.setup();
    const editables: ResourceItem[] = [
      { name: "my-ingress", namespace: "default", kind: "ingresses", status: "Active", age: "1d" },
    ];
    const onEdit = vi.fn();

    render(
      <MemoryRouter initialEntries={["/ingresses"]}>
        <ResourceTable resources={editables} loading={false} error={null} kind="ingresses" onEdit={onEdit} />
      </MemoryRouter>
    );

    await user.click(screen.getByTitle("Edit YAML"));
    expect(onEdit).toHaveBeenCalledWith(editables[0]);
  });

  it("renders a read-only edit button for cluster-scoped kinds", () => {
    const items: ResourceItem[] = [
      { name: "nginx", namespace: "-", kind: "ingressclasses", status: "Active", age: "1d" },
    ];

    render(
      <MemoryRouter>
        <ResourceTable resources={items} loading={false} error={null} kind="ingressclasses" />
      </MemoryRouter>
    );

    expect(screen.getByTitle("View YAML (read-only)")).toBeInTheDocument();
  });
});

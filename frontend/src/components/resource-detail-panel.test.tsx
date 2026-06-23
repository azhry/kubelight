import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ResourceDetailPanel } from "./resource-detail-panel";
import { DetailPanelProvider, useDetailPanel } from "../hooks/use-detail-panel";
import { setMockInvoke } from "../test-utils/tauri-mocks";
import type { ResourceItem } from "../hooks/use-resources";

vi.mock("./codemirror", () => ({
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

vi.mock("./pod-detail-tabs", () => ({
  PodDetailTabs: ({ resource }: { resource: ResourceItem }) => (
    <div data-testid="pod-detail-tabs">Pod tabs for {resource.name}</div>
  ),
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  return <DetailPanelProvider>{children}</DetailPanelProvider>;
}

function OpenButton({ resource }: { resource: ResourceItem }) {
  const { openDetailPanel } = useDetailPanel();
  return <button onClick={() => openDetailPanel(resource)}>Open</button>;
}

describe("ResourceDetailPanel", () => {
  beforeEach(() => {
    setMockInvoke("get_resource_yaml", () => "apiVersion: v1\nkind: Deployment");
  });

  it("is hidden when no resource is selected", () => {
    render(
      <Wrapper>
        <ResourceDetailPanel />
      </Wrapper>
    );

    expect(screen.queryByTestId("resource-detail-panel")).not.toBeInTheDocument();
  });

  it("opens as a right sidebar showing metadata", async () => {
    const resource: ResourceItem = {
      name: "my-deploy",
      namespace: "default",
      kind: "deployments",
      status: "Active",
      age: "1d",
    };

    render(
      <Wrapper>
        <ResourceDetailPanel />
        <OpenButton resource={resource} />
      </Wrapper>
    );

    await userEvent.click(screen.getByText("Open"));

    await waitFor(() => expect(screen.getByTestId("resource-detail-panel")).toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "my-deploy", level: 2 })).toBeInTheDocument();
    const panel = screen.getByTestId("resource-detail-panel");
    expect(panel).toHaveTextContent("deployments");
  });

  it("switches to the YAML tab", async () => {
    const user = userEvent.setup();
    const resource: ResourceItem = {
      name: "my-deploy",
      namespace: "default",
      kind: "deployments",
      status: "Active",
      age: "1d",
    };

    render(
      <Wrapper>
        <ResourceDetailPanel />
        <OpenButton resource={resource} />
      </Wrapper>
    );

    await user.click(screen.getByText("Open"));
    await waitFor(() => expect(screen.getByTestId("resource-detail-panel")).toBeInTheDocument());

    await user.click(screen.getByText("YAML"));

    await waitFor(() => expect(screen.getByTestId("yaml-editor")).toHaveValue("apiVersion: v1\nkind: Deployment"));
  });

  it("closes the panel when the close button is clicked", async () => {
    const user = userEvent.setup();
    const resource: ResourceItem = {
      name: "my-deploy",
      namespace: "default",
      kind: "deployments",
      status: "Active",
      age: "1d",
    };

    render(
      <Wrapper>
        <ResourceDetailPanel />
        <OpenButton resource={resource} />
      </Wrapper>
    );

    await user.click(screen.getByText("Open"));
    await waitFor(() => expect(screen.getByTestId("resource-detail-panel")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /close/i }));

    await waitFor(() => expect(screen.queryByTestId("resource-detail-panel")).not.toBeInTheDocument());
  });
});

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { YamlEditorPanel } from "./yaml-editor-panel";
import { YamlPanelProvider, useYamlPanel } from "../hooks/use-yaml-panel";
import { setMockInvoke, mockInvoke } from "../test-utils/tauri-mocks";

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

function Wrapper({ children }: { children: React.ReactNode }) {
  return <YamlPanelProvider>{children}</YamlPanelProvider>;
}

function OpenButton({ kind, namespace, name }: { kind: string; namespace: string; name: string }) {
  const { openYamlPanel } = useYamlPanel();
  return <button onClick={() => openYamlPanel(kind, namespace, name)}>Open</button>;
}

describe("YamlEditorPanel", () => {
  beforeEach(() => {
    setMockInvoke("get_resource_yaml", () => "apiVersion: v1\nkind: Pod\nmetadata:\n  name: nginx");
    setMockInvoke("apply_resource", () => {});
  });

  it("is hidden when no resource is selected", () => {
    render(
      <Wrapper>
        <YamlEditorPanel />
      </Wrapper>
    );

    expect(screen.queryByText("Edit YAML")).not.toBeInTheDocument();
  });

  it("opens as a bottom panel when a resource is selected", async () => {
    render(
      <Wrapper>
        <YamlEditorPanel />
        <OpenButton kind="pods" namespace="default" name="nginx" />
      </Wrapper>
    );

    await userEvent.click(screen.getByText("Open"));

    await waitFor(() => expect(screen.getByTestId("yaml-editor")).toBeInTheDocument());
    expect(screen.getByText("pods / default / nginx")).toBeInTheDocument();
  });

  it("calls apply_resource when Apply is clicked", async () => {
    const user = userEvent.setup();
    render(
      <Wrapper>
        <YamlEditorPanel />
        <OpenButton kind="pods" namespace="default" name="nginx" />
      </Wrapper>
    );

    await user.click(screen.getByText("Open"));

    await waitFor(() => expect(screen.getByTestId("yaml-editor")).toBeInTheDocument());

    const editor = screen.getByTestId("yaml-editor");
    await user.clear(editor);
    await user.type(editor, "apiVersion: v1\nkind: Pod\nmetadata:\n  name: nginx-2");

    await waitFor(() => expect(screen.getByText("Apply")).toBeInTheDocument());
    await user.click(screen.getByText("Apply"));

    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith(
        "apply_resource",
        expect.objectContaining({
          kind: "pods",
          namespace: "default",
          name: "nginx",
        })
      )
    );
  });

  it("closes the panel when the close button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <Wrapper>
        <YamlEditorPanel />
        <OpenButton kind="pods" namespace="default" name="nginx" />
      </Wrapper>
    );

    await user.click(screen.getByText("Open"));
    await waitFor(() => expect(screen.getByTestId("yaml-editor")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /close/i }));

    await waitFor(() => expect(screen.queryByTestId("yaml-editor")).not.toBeInTheDocument());
  });
});

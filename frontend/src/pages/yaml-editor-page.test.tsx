import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { YamlEditorPage } from "./yaml-editor-page";
import { setMockInvoke, mockInvoke } from "../test-utils/tauri-mocks";

vi.mock("../components/codemirror", () => ({
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

describe("YamlEditorPage", () => {
  beforeEach(() => {
    setMockInvoke("get_resources", () => [
      { name: "nginx", namespace: "default", kind: "pods" },
      { name: "redis", namespace: "app", kind: "pods" },
    ]);
    setMockInvoke("get_resource_yaml", () => "apiVersion: v1\nkind: Pod\nmetadata:\n  name: nginx");
    setMockInvoke("patch_resource", () => {});
  });

  function renderPage() {
    return render(
      <MemoryRouter initialEntries={["/yaml/pods"]}>
        <Routes>
          <Route path="/yaml/:kind" element={<YamlEditorPage />} />
        </Routes>
      </MemoryRouter>
    );
  }

  it("renders the resource selector", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByRole("combobox")).toBeInTheDocument());
  });

  it("loads YAML when a resource is selected", async () => {
    const user = userEvent.setup();
    renderPage();

    const trigger = await waitFor(() => screen.getByRole("combobox"));
    await user.click(trigger);

    const option = await screen.findByRole("option", { name: "nginx" });
    await user.click(option);

    await waitFor(() =>
      expect(screen.getByTestId("yaml-editor")).toHaveValue("apiVersion: v1\nkind: Pod\nmetadata:\n  name: nginx")
    );
    expect(mockInvoke).toHaveBeenCalledWith("get_resource_yaml", {
      kind: "pods",
      namespace: null,
      name: "nginx",
    });
  });

  it("shows the diff preview after editing", async () => {
    const user = userEvent.setup();
    renderPage();

    const trigger = await waitFor(() => screen.getByRole("combobox"));
    await user.click(trigger);
    await user.click(await screen.findByRole("option", { name: "nginx" }));

    await waitFor(() => expect(screen.getByTestId("yaml-editor")).toBeInTheDocument());

    const editor = screen.getByTestId("yaml-editor");
    await user.clear(editor);
    await user.type(editor, "apiVersion: v1\nkind: Pod\nmetadata:\n  name: nginx-2");

    await waitFor(() => expect(screen.getByText("Diff Preview")).toBeInTheDocument());
  });

  it("calls patch_resource when Apply is clicked", async () => {
    const user = userEvent.setup();
    renderPage();

    const trigger = await waitFor(() => screen.getByRole("combobox"));
    await user.click(trigger);
    await user.click(await screen.findByRole("option", { name: "nginx" }));

    await waitFor(() => expect(screen.getByTestId("yaml-editor")).toBeInTheDocument());

    const editor = screen.getByTestId("yaml-editor");
    await user.clear(editor);
    await user.type(editor, "apiVersion: v1\nkind: Pod\nmetadata:\n  name: nginx-2");

    await waitFor(() => expect(screen.getByText("Apply")).toBeInTheDocument());
    await user.click(screen.getByText("Apply"));

    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith(
        "patch_resource",
        expect.objectContaining({
          kind: "pods",
          namespace: null,
          name: "nginx",
        })
      )
    );
  });

  it("resets YAML to the original when Reset is clicked", async () => {
    const user = userEvent.setup();
    renderPage();

    const trigger = await waitFor(() => screen.getByRole("combobox"));
    await user.click(trigger);
    await user.click(await screen.findByRole("option", { name: "nginx" }));

    await waitFor(() => expect(screen.getByTestId("yaml-editor")).toBeInTheDocument());

    const editor = screen.getByTestId("yaml-editor");
    await user.clear(editor);
    await user.type(editor, "modified");

    await waitFor(() => expect(screen.getByText("Reset")).toBeInTheDocument());
    await user.click(screen.getByText("Reset"));

    await waitFor(() =>
      expect(editor).toHaveValue("apiVersion: v1\nkind: Pod\nmetadata:\n  name: nginx")
    );
  });

  it("displays an error when YAML fetch fails", async () => {
    setMockInvoke("get_resource_yaml", () => {
      throw new Error("cannot fetch yaml");
    });
    const user = userEvent.setup();
    renderPage();

    const trigger = await waitFor(() => screen.getByRole("combobox"));
    await user.click(trigger);
    await user.click(await screen.findByRole("option", { name: "nginx" }));

    await waitFor(() => expect(screen.getByText(/cannot fetch yaml/i)).toBeInTheDocument());
  });
});

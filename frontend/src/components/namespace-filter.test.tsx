import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach } from "vitest";
import { NamespaceFilter } from "./namespace-filter";
import { setMockInvoke, mockInvoke } from "../test-utils/tauri-mocks";

describe("NamespaceFilter", () => {
  beforeEach(() => {
    setMockInvoke("get_resources", () => [
      { name: "default", namespace: "", kind: "namespaces" },
      { name: "kube-system", namespace: "", kind: "namespaces" },
      { name: "app", namespace: "", kind: "namespaces" },
    ]);
  });

  it("shows a skeleton while loading namespaces", () => {
    setMockInvoke("get_resources", () => new Promise(() => {}));
    render(<NamespaceFilter />);
    expect(screen.getByTestId("skeleton")).toBeInTheDocument();
  });

  it("renders all namespaces option and namespace items", async () => {
    const user = userEvent.setup();
    render(<NamespaceFilter />);

    const trigger = await waitFor(() => screen.getByRole("combobox"));
    expect(trigger).toHaveTextContent(/Select namespace/i);

    await user.click(trigger);

    expect(await screen.findByRole("option", { name: /All namespaces/i })).toBeInTheDocument();
    expect(await screen.findByRole("option", { name: "default" })).toBeInTheDocument();
    expect(await screen.findByRole("option", { name: "kube-system" })).toBeInTheDocument();
    expect(await screen.findByRole("option", { name: "app" })).toBeInTheDocument();
  });

  it("updates the selected namespace when an item is chosen", async () => {
    const user = userEvent.setup();
    render(<NamespaceFilter />);

    const trigger = await waitFor(() => screen.getByRole("combobox"));
    await user.click(trigger);

    const option = await screen.findByRole("option", { name: "app" });
    await user.click(option);

    await waitFor(() => expect(trigger).toHaveTextContent("app"));
    expect(mockInvoke).toHaveBeenCalledWith("get_resources", {
      kind: "namespaces",
      namespace: null,
    });
  });
});

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach } from "vitest";
import { ContextSelector } from "./context-selector";
import { setMockInvoke, mockInvoke } from "../test-utils/tauri-mocks";

describe("ContextSelector", () => {
  beforeEach(() => {
    setMockInvoke("get_contexts", () => [
      { name: "minikube", cluster: "minikube", user: "minikube", active: true },
      { name: "prod", cluster: "prod", user: "admin", active: false },
    ]);
    setMockInvoke("get_active_context", () => "minikube");
  });

  it("shows a skeleton while loading contexts", () => {
    setMockInvoke("get_contexts", () => new Promise(() => {}));
    render(<ContextSelector />);
    expect(screen.getByTestId("skeleton")).toBeInTheDocument();
  });

  it("renders the active context and list of contexts", async () => {
    render(<ContextSelector />);

    const trigger = await waitFor(() => screen.getByRole("combobox"));
    expect(trigger).toHaveTextContent("minikube");

    const user = userEvent.setup();
    await user.click(trigger);

    expect(await screen.findByRole("option", { name: /minikube/i })).toBeInTheDocument();
    expect(await screen.findByRole("option", { name: /prod/i })).toBeInTheDocument();
  });

  it("highlights the active context with a primary indicator", async () => {
    const user = userEvent.setup();
    render(<ContextSelector />);

    const trigger = await waitFor(() => screen.getByRole("combobox"));
    await user.click(trigger);

    const activeOption = await screen.findByRole("option", { name: /minikube/i });
    const activeDot = activeOption.querySelector(".bg-primary");
    expect(activeDot).toBeInTheDocument();

    const prodOption = await screen.findByRole("option", { name: /prod/i });
    const inactiveDot = prodOption.querySelector(".bg-on-surface-variant");
    expect(inactiveDot).toBeInTheDocument();
  });

  it("invokes switch_context when a different context is selected", async () => {
    const user = userEvent.setup();
    render(<ContextSelector />);

    const trigger = await waitFor(() => screen.getByRole("combobox"));
    await user.click(trigger);

    const option = await screen.findByRole("option", { name: /prod/i });
    await user.click(option);

    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith("switch_context", { contextName: "prod" })
    );
  });
});

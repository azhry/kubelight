import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";
import { Sidebar } from "./sidebar";

function LocationDisplay() {
  return <div data-testid="location">{useLocation().pathname}</div>;
}

describe("Sidebar", () => {
  it("renders all resource sections and navigation items", () => {
    render(
      <MemoryRouter initialEntries={["/pods"]}>
        <Sidebar />
        <LocationDisplay />
      </MemoryRouter>
    );

    expect(screen.getByText("Workloads")).toBeInTheDocument();
    expect(screen.getByText("Pods")).toBeInTheDocument();
    expect(screen.getByText("Deployments")).toBeInTheDocument();
    expect(screen.getByText("Network")).toBeInTheDocument();
    expect(screen.getByText("Services")).toBeInTheDocument();
    expect(screen.getByText("Cluster")).toBeInTheDocument();
    expect(screen.getByText("Config")).toBeInTheDocument();
  });

  it("navigates to the selected resource kind", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/pods"]}>
        <Sidebar />
        <LocationDisplay />
      </MemoryRouter>
    );

    await user.click(screen.getByText("Deployments"));
    expect(screen.getByTestId("location")).toHaveTextContent("/deployments");

    await user.click(screen.getByText("Services"));
    expect(screen.getByTestId("location")).toHaveTextContent("/services");
  });

  it("marks the active resource kind", () => {
    render(
      <MemoryRouter initialEntries={["/deployments"]}>
        <Sidebar />
        <LocationDisplay />
      </MemoryRouter>
    );

    const activeButton = screen.getByText("Deployments").closest("button");
    expect(activeButton).toHaveClass("text-primary");
    expect(activeButton).toHaveClass("border-primary");
  });

  it("renders a full-height sidebar that stays above main content", () => {
    render(
      <MemoryRouter initialEntries={["/pods"]}>
        <Sidebar />
      </MemoryRouter>
    );

    const aside = screen.getByText("Pods").closest("aside");
    expect(aside).toHaveClass("h-full", "flex-shrink-0", "z-40");
  });

  it("scrolls navigation independently without losing the header", () => {
    render(
      <MemoryRouter initialEntries={["/pods"]}>
        <Sidebar />
      </MemoryRouter>
    );

    const nav = screen.getByText("Workloads").closest("nav");
    expect(nav).toHaveClass("overflow-y-auto");

    nav!.scrollTop = 100;
    fireEvent.scroll(nav!);

    expect(screen.getByText("KubeLight")).toBeVisible();
    expect(screen.getByText("Pods")).toBeVisible();
  });
});

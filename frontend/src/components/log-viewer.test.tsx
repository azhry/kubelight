import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { LogViewer } from "./log-viewer";
import type { LogLine } from "../hooks/use-log-stream";

const logs: LogLine[] = [
  { line: "[INFO] started", timestamp: "2024-01-01T00:00:00.000Z" },
  { line: "[ERROR] something failed", timestamp: "2024-01-01T00:00:01.000Z" },
  { line: "[WARN] retrying", timestamp: "2024-01-01T00:00:02.000Z" },
];

describe("LogViewer", () => {
  it("renders log lines", () => {
    render(<LogViewer logs={logs} streaming={false} onStart={vi.fn()} onStop={vi.fn()} />);

    expect(screen.getByText("started")).toBeInTheDocument();
    expect(screen.getByText("something failed")).toBeInTheDocument();
    expect(screen.getByText("retrying")).toBeInTheDocument();
  });

  it("filters log lines by keyword", async () => {
    const user = userEvent.setup();
    render(<LogViewer logs={logs} streaming={false} onStart={vi.fn()} onStop={vi.fn()} />);

    const input = screen.getByPlaceholderText("Filter logs...");
    await user.type(input, "failed");

    await waitFor(() => {
      expect(screen.queryByText("started")).not.toBeInTheDocument();
      expect(screen.getByText("something failed")).toBeInTheDocument();
      expect(screen.queryByText("retrying")).not.toBeInTheDocument();
    });
  });

  it("calls onStart when play is clicked", async () => {
    const user = userEvent.setup();
    const onStart = vi.fn();
    render(<LogViewer logs={[]} streaming={false} onStart={onStart} onStop={vi.fn()} />);

    await user.click(screen.getByTitle("Resume streaming"));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("calls onStop when pause is clicked", async () => {
    const user = userEvent.setup();
    const onStop = vi.fn();
    render(<LogViewer logs={[]} streaming={true} onStart={vi.fn()} onStop={onStop} />);

    await user.click(screen.getByTitle("Pause streaming"));
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it("calls onClear when clear is clicked", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    render(<LogViewer logs={logs} streaming={false} onStart={vi.fn()} onStop={vi.fn()} onClear={onClear} />);

    await user.click(screen.getByTitle("Clear logs"));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("shows the streaming indicator while streaming", () => {
    render(<LogViewer logs={logs} streaming={true} onStart={vi.fn()} onStop={vi.fn()} />);

    expect(screen.getByText("streaming")).toBeInTheDocument();
    expect(screen.getByText("3 lines")).toBeInTheDocument();
  });

  it("toggles auto-scroll via checkbox", async () => {
    const user = userEvent.setup();
    render(<LogViewer logs={logs} streaming={false} onStart={vi.fn()} onStop={vi.fn()} />);

    const checkbox = screen.getByRole("checkbox", { name: /Auto-scroll/i });
    expect(checkbox).toBeChecked();

    await user.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });
});

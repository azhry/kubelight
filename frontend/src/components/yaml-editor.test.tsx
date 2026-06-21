import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { CodeMirror } from "./codemirror";

describe("CodeMirror wrapper", () => {
  it("renders an editor for the given value", () => {
    render(<CodeMirror value="apiVersion: v1" onChange={vi.fn()} />);
    expect(document.querySelector(".cm-editor")).toBeInTheDocument();
  });

  it("updates the displayed value when the prop changes", () => {
    const { rerender } = render(<CodeMirror value="first" onChange={vi.fn()} />);
    rerender(<CodeMirror value="second" onChange={vi.fn()} />);
    expect(document.querySelector(".cm-editor")).toBeInTheDocument();
  });
});

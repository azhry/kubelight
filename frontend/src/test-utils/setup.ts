import { cleanup } from "@testing-library/react";
import { afterEach, vi, beforeAll } from "vitest";
import "@testing-library/jest-dom/vitest";
import { mockInvoke, mockListen, mockOpen, resetTauriMocks } from "./tauri-mocks";

beforeAll(() => {
  window.HTMLElement.prototype.setPointerCapture = window.HTMLElement.prototype.setPointerCapture || (() => {});
  window.HTMLElement.prototype.releasePointerCapture = window.HTMLElement.prototype.releasePointerCapture || (() => {});
  window.HTMLElement.prototype.hasPointerCapture = window.HTMLElement.prototype.hasPointerCapture || (() => false);
  window.HTMLElement.prototype.scrollIntoView = window.HTMLElement.prototype.scrollIntoView || (() => {});
});

afterEach(() => {
  cleanup();
  resetTauriMocks();
});

vi.mock("@tauri-apps/api/core", () => ({ invoke: mockInvoke }));
vi.mock("@tauri-apps/api/event", () => ({ listen: mockListen }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: mockOpen }));

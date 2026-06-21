import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { mockInvoke, mockListen, mockOpen, resetTauriMocks } from "./tauri-mocks";

afterEach(() => {
  cleanup();
  resetTauriMocks();
});

vi.mock("@tauri-apps/api/core", () => ({ invoke: mockInvoke }));
vi.mock("@tauri-apps/api/event", () => ({ listen: mockListen }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: mockOpen }));

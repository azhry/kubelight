import { vi } from "vitest";

const invokeHandlers = new Map<string, (args?: unknown) => unknown>();
const eventHandlers = new Map<string, Array<(event: { payload: unknown }) => void>>();

export const mockInvoke = vi.fn(async (cmd: string, args?: unknown) => {
  const handler = invokeHandlers.get(cmd);
  if (!handler) return undefined;
  return handler(args);
});

export const mockListen = vi.fn(async (event: string, handler: (event: { payload: unknown }) => void) => {
  if (!eventHandlers.has(event)) eventHandlers.set(event, []);
  eventHandlers.get(event)!.push(handler);
  return () => {
    const arr = eventHandlers.get(event) || [];
    const idx = arr.indexOf(handler);
    if (idx >= 0) arr.splice(idx, 1);
  };
});

export function emitMockEvent(event: string, payload: unknown) {
  (eventHandlers.get(event) || []).forEach((h) => h({ payload }));
}

export const mockOpen = vi.fn(async () => undefined);

export function setMockInvoke(command: string, handler: (args?: unknown) => unknown) {
  invokeHandlers.set(command, handler);
}

export function clearMockInvoke() {
  invokeHandlers.clear();
  mockInvoke.mockClear();
}

export function clearMockListen() {
  eventHandlers.clear();
  mockListen.mockClear();
}

export function resetTauriMocks() {
  clearMockInvoke();
  clearMockListen();
  mockOpen.mockReset();
}

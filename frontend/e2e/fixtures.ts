import { test as base, expect } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mockScriptPath = path.join(__dirname, "mocks", "tauri.js");

export interface TauriMock {
  setResponse(cmd: string, response: unknown): Promise<void>;
  setHandler(cmd: string, handler: Function | string): Promise<void>;
  emitEvent(event: string, payload: unknown): Promise<void>;
  reset(): Promise<void>;
}

export const test = base.extend<{ tauriMock: TauriMock }>({
  page: async ({ page, context }, use) => {
    await context.addInitScript({ path: mockScriptPath });
    await page.goto("about:blank");
    await use(page);
  },
  tauriMock: async ({ page }, use) => {
    const mock: TauriMock = {
      setResponse: (cmd, response) =>
        page.evaluate(
          ({ cmd, response }: { cmd: string; response: unknown }) =>
            window.__TAURI_MOCK__.setResponse(cmd, response),
          { cmd, response }
        ),
      setHandler: (cmd, handler: Function | string) =>
        page.evaluate(
          ({ cmd, handlerStr }: { cmd: string; handlerStr: string }) =>
            window.__TAURI_MOCK__.setHandler(cmd, new Function("args", handlerStr)),
          { cmd, handlerStr: typeof handler === "function" ? handler.toString() : handler }
        ),
      emitEvent: (event, payload) =>
        page.evaluate(
          ({ event, payload }: { event: string; payload: unknown }) =>
            window.__TAURI_MOCK__.emitEvent(event, payload),
          { event, payload }
        ),
      reset: () => page.evaluate(() => window.__TAURI_MOCK__.reset()),
    };
    await use(mock);
  },
});

export { expect } from "@playwright/test";

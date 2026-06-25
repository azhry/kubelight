import { test as base, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mockCode = fs.readFileSync(path.join(__dirname, "mocks", "tauri.js"), "utf-8");

export interface TauriMock {
  setResponse(cmd: string, response: unknown): Promise<void>;
  setHandler(cmd: string, handler: Function): Promise<void>;
  emitEvent(event: string, payload: unknown): Promise<void>;
  reset(): Promise<void>;
  navigate(url?: string): Promise<void>;
}

export const test = base.extend<{ tauriMock: TauriMock }>({
  page: async ({ page }, use) => {
    await use(page);
  },
  tauriMock: async ({ page }, use) => {
    const handlers: Record<string, unknown> = {};

    const mock: TauriMock = {
      setResponse: async (cmd, response) => {
        handlers[cmd] = response;
        await page.evaluate(
          ({ cmd, response }: { cmd: string; response: unknown }) =>
            window.__TAURI_MOCK__?.setResponse(cmd, response),
          { cmd, response }
        ).catch(() => {});
      },
      setHandler: async (cmd, handler) => {
        handlers[cmd] = { __fn: true, body: handler.toString() };
        await page.evaluate(
          ({ cmd, handlerStr }: { cmd: string; handlerStr: string }) =>
            window.__TAURI_MOCK__?.setHandler(
              cmd,
              new Function("args", "return (" + handlerStr + ")(args)")
            ),
          { cmd, handlerStr: handler.toString() }
        ).catch(() => {});
      },
      emitEvent: (event, payload) =>
        page.evaluate(
          ({ event, payload }: { event: string; payload: unknown }) =>
            window.__TAURI_MOCK__.emitEvent(event, payload),
          { event, payload }
        ),
      reset: async () => {
        Object.keys(handlers).forEach((k) => delete handlers[k]);
        await page.evaluate(() => window.__TAURI_MOCK__?.reset()).catch(() => {});
      },
      navigate: async (url = "/") => {
        const stateJson = JSON.stringify({ handlers });
        await page.addInitScript(`
          window.__TAURI_MOCK_STATE__ = ${stateJson};
          ${mockCode}
        `);
        await page.goto(url);
        await page.waitForLoadState("networkidle");
      },
    };
    await use(mock);
  },
});

export { expect } from "@playwright/test";

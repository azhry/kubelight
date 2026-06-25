import { test, expect } from "../fixtures";

test.describe("Kubeconfig Setup", () => {
  test("shows main UI when kubeconfig is already configured", async ({ page, tauriMock }) => {
    await page.goto("/");
    await expect(page.getByText("KubeLight")).toBeVisible();
    await expect(page.getByText("Cluster connected")).toBeVisible();
  });

  test("shows setup screen when no kubeconfig is configured", async ({ page, tauriMock }) => {
    await tauriMock.setResponse("get_kubeconfig_status", {
      configured: false,
      error: "No kubeconfig found",
    });
    await tauriMock.setResponse("get_last_kubeconfig_path", null);

    await page.goto("/");
    await expect(page.getByText("KubeLight")).toBeVisible();
  });

  test("shows reconnecting spinner when checking last kubeconfig", async ({ page, tauriMock }) => {
    await tauriMock.setHandler("get_kubeconfig_status", () => new Promise(() => {}));

    await page.goto("/");
    await expect(page.getByText("Reconnecting to last cluster...")).toBeVisible();
  });
});

import { test, expect } from "../fixtures";

test.describe("Kubeconfig Setup", () => {
  test("shows main UI when kubeconfig is already configured", async ({ page, tauriMock }) => {
    await tauriMock.navigate("/");
    await expect(page.getByText("KubeLight").first()).toBeVisible();
    await expect(page.getByText("Cluster connected")).toBeVisible();
  });

  test("shows setup screen when no kubeconfig is configured", async ({ page, tauriMock }) => {
    await tauriMock.setResponse("get_kubeconfig_status", {
      configured: false,
      error: "No kubeconfig found",
    });
    await tauriMock.setResponse("get_last_kubeconfig_path", null);

    await tauriMock.navigate("/");
    await expect(page.getByText("KubeLight").first()).toBeVisible();
  });

  test("shows reconnecting spinner when checking last kubeconfig", async ({ page, tauriMock }) => {
    await tauriMock.setHandler("get_kubeconfig_status", () => new Promise(() => {}));

    await tauriMock.navigate("/");
    await expect(page.getByText("Reconnecting to last cluster...")).toBeVisible();
  });
});

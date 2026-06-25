import { test, expect } from "../fixtures";
import { sampleKubeconfigSessions } from "../data/resources";

test.describe("Multi-Kubeconfig", () => {
  test.beforeEach(async ({ tauriMock }) => {
    await tauriMock.setResponse("get_kubeconfig_status", {
      configured: true,
      error: null,
    });
    await tauriMock.setResponse("get_last_kubeconfig_path", null);
    await tauriMock.setResponse("get_active_context", "minikube");
    await tauriMock.setResponse("get_contexts", [
      { name: "minikube", cluster: "minikube", is_active: true },
    ]);
  });

  test("kubeconfig menu shows session list", async ({ page, tauriMock }) => {
    await tauriMock.setResponse("list_kubeconfigs", sampleKubeconfigSessions);

    await page.goto("/pods");
    await expect(page.getByText("KubeLight").first()).toBeVisible();

    await expect(page.getByText("minikube").first()).toBeVisible();
  });

  test("add kubeconfig form is accessible", async ({ page, tauriMock }) => {
    await tauriMock.setResponse("list_kubeconfigs", sampleKubeconfigSessions);

    await page.goto("/pods");

    await expect(page.getByPlaceholder("Path...")).toBeVisible();
  });

  test("add kubeconfig creates a new session", async ({ page, tauriMock }) => {
    await tauriMock.setResponse("list_kubeconfigs", sampleKubeconfigSessions);
    await tauriMock.setResponse("add_kubeconfig", "new-session-id");
    await tauriMock.setResponse("remove_kubeconfig", null);
    await tauriMock.setResponse("switch_kubeconfig", null);

    await page.goto("/pods");
    await expect(page.getByText("KubeLight").first()).toBeVisible();

    await page.getByPlaceholder("Path...").fill("C:\\Users\\dev\\.kube\\prod-config");
    await page.getByRole("button", { name: /add/i }).click();
  });
});

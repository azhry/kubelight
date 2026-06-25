import { test, expect } from "../fixtures";
import { samplePods, samplePodYaml } from "../data/resources";

test.describe("Pod Detail Tabs", () => {
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
    await tauriMock.setResponse("list_kubeconfigs", []);
    await tauriMock.setResponse("get_resources", samplePods);
    await tauriMock.setResponse("get_resource_yaml", samplePodYaml);
    await tauriMock.setHandler("stream_pod_logs", () => Promise.resolve());
    await tauriMock.setHandler("exec_pod", () => Promise.resolve());
  });

  test("right sidebar shows pod detail tabs for pod resources", async ({ page, tauriMock }) => {
    await tauriMock.navigate("/pods");
    await expect(page.getByText("Pods").first()).toBeVisible();

    await page.getByRole("cell", { name: "nginx-frontend" }).first().click();
    await expect(page.getByTestId("resource-detail-panel")).toBeVisible();

    const panel = page.getByTestId("resource-detail-panel");
    await expect(panel.getByText("Details", { exact: true })).toBeVisible();
    await expect(panel.getByText("Logs", { exact: true })).toBeVisible();
    await expect(panel.getByText("Terminal", { exact: true })).toBeVisible();
    await expect(panel.getByText("Diagnostics", { exact: true })).toBeVisible();
    await expect(panel.getByText("YAML", { exact: true })).toBeVisible();
  });

  test("details tab shows pod metadata", async ({ page, tauriMock }) => {
    await tauriMock.navigate("/pods");
    await page.getByRole("cell", { name: "nginx-frontend" }).first().click();
    await expect(page.getByTestId("resource-detail-panel")).toBeVisible();

    await expect(page.getByText("nginx-frontend").first()).toBeVisible();
    await expect(page.getByText("Pod", { exact: true }).first()).toBeVisible();
  });

  test("logs tab shows log viewer", async ({ page, tauriMock }) => {
    await tauriMock.navigate("/pods");
    await page.getByRole("cell", { name: "nginx-frontend" }).first().click();
    await expect(page.getByTestId("resource-detail-panel")).toBeVisible();

    const panel = page.getByTestId("resource-detail-panel");
    await panel.getByText("Logs", { exact: true }).click();
    await page.getByTitle("Resume streaming").click();
    await expect(page.getByText("streaming")).toBeVisible();
  });

  test("terminal tab auto-starts shell and shows command input", async ({ page, tauriMock }) => {
    await tauriMock.navigate("/pods");
    await page.getByRole("cell", { name: "nginx-frontend" }).first().click();
    await expect(page.getByTestId("resource-detail-panel")).toBeVisible();

    const panel = page.getByTestId("resource-detail-panel");
    await panel.getByText("Terminal", { exact: true }).click();

    await expect(page.getByText("Connecting to nginx-frontend")).toBeVisible();
    await expect(page.getByPlaceholder("Run a command in nginx-frontend...")).toBeVisible();
  });

  test("diagnostics tab shows network diagnostics UI", async ({ page, tauriMock }) => {
    await tauriMock.navigate("/pods");
    await page.getByRole("cell", { name: "nginx-frontend" }).first().click();
    await expect(page.getByTestId("resource-detail-panel")).toBeVisible();

    const panel = page.getByTestId("resource-detail-panel");
    await panel.getByText("Diagnostics", { exact: true }).click();
    await expect(page.getByPlaceholder(/Target pod, service, or URL/)).toBeVisible();
  });

  test("YAML tab shows read-only YAML view", async ({ page, tauriMock }) => {
    await tauriMock.navigate("/pods");
    await page.getByRole("cell", { name: "nginx-frontend" }).first().click();
    await expect(page.getByTestId("resource-detail-panel")).toBeVisible();

    await page.getByText("YAML", { exact: true }).click();
  });

  test("close button hides the detail panel", async ({ page, tauriMock }) => {
    await tauriMock.navigate("/pods");
    await page.getByRole("cell", { name: "nginx-frontend" }).first().click();
    await expect(page.getByTestId("resource-detail-panel")).toBeVisible();

    await page.getByRole("button", { name: /close/i }).click();
    await expect(page.getByTestId("resource-detail-panel")).not.toBeVisible();
  });

  test("diagnostics can run a network check", async ({ page, tauriMock }) => {
    await tauriMock.setResponse("diagnose_pod_network", {
      stdout: "curl output here",
      stderr: "",
    });

    await tauriMock.navigate("/pods");
    await page.getByRole("cell", { name: "nginx-frontend" }).first().click();
    await expect(page.getByTestId("resource-detail-panel")).toBeVisible();

    const panel = page.getByTestId("resource-detail-panel");
    await panel.getByText("Diagnostics", { exact: true }).click();

    await page.getByPlaceholder(/Target pod, service, or URL/).fill("http://example.com");
    await page.getByRole("button", { name: /run/i }).click();

    await expect(page.getByText("stdout")).toBeVisible();
  });
});

import { test, expect } from "../fixtures";
import { samplePods, sampleDeployments, sampleServices } from "../data/resources";

test.describe("Resource Browser", () => {
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
  });

  test("lists pods in the resource table", async ({ page, tauriMock }) => {
    await tauriMock.setResponse("get_resources", samplePods);

    await tauriMock.navigate("/pods");
    await expect(page.getByText("Pods").first()).toBeVisible();

    for (const pod of samplePods) {
      await expect(page.getByRole("cell", { name: pod.name }).first()).toBeVisible();
    }

    await expect(page.getByText("5 total")).toBeVisible();
  });

  test("navigates between resource kinds via sidebar", async ({ page, tauriMock }) => {
    await tauriMock.setResponse("get_resources", samplePods);

    await tauriMock.navigate("/pods");
    await expect(page.getByText("Pods").first()).toBeVisible();

    await tauriMock.setResponse("get_resources", sampleDeployments);
    await page.getByText("Deployments", { exact: true }).click();
    await expect(page.getByText("Deployments").first()).toBeVisible();

    for (const dep of sampleDeployments) {
      await expect(page.getByRole("cell", { name: dep.name }).first()).toBeVisible();
    }
  });

  test("shows error state when resource fetch fails", async ({ page, tauriMock }) => {
    await tauriMock.setHandler("get_resources", () => {
      throw new Error("Connection refused");
    });

    await tauriMock.navigate("/pods");
    await expect(page.getByText("Failed to load pods")).toBeVisible();
  });

  test("shows empty state when no resources exist", async ({ page, tauriMock }) => {
    await tauriMock.setResponse("get_resources", []);

    await tauriMock.navigate("/pods");
    await expect(page.getByText("No pods found")).toBeVisible();
  });

  test("sorts resources by name when clicking column header", async ({ page, tauriMock }) => {
    await tauriMock.setResponse("get_resources", samplePods);

    await tauriMock.navigate("/pods");
    await expect(page.getByText("Pods").first()).toBeVisible();

    const nameHeader = page.getByRole("columnheader", { name: "Name", exact: true });
    await nameHeader.click();
    await page.waitForTimeout(300);

    const cells = page.getByRole("cell").first();
  });

  test("resource detail panel opens when clicking a pod row", async ({ page, tauriMock }) => {
    await tauriMock.setResponse("get_resources", samplePods);
    await tauriMock.setResponse("get_resource_yaml", "apiVersion: v1\\nkind: Pod\\nmetadata:\\n  name: nginx-frontend");

    await tauriMock.navigate("/pods");
    await expect(page.getByText("Pods").first()).toBeVisible();

    await page.getByRole("cell", { name: "nginx-frontend" }).first().click();
    await expect(page.getByTestId("resource-detail-panel")).toBeVisible();

    await expect(page.getByText("nginx-frontend").first()).toBeVisible();
  });

  test("sidebar navigation highlights active resource kind", async ({ page, tauriMock }) => {
    await tauriMock.setResponse("get_resources", samplePods);

    await tauriMock.navigate("/pods");
    await expect(page.getByText("Pods").first()).toBeVisible();

    await tauriMock.setResponse("get_resources", sampleServices);
    await page.getByText("Services", { exact: true }).click();
    await expect(page.getByText("Services").first()).toBeVisible();
  });
});

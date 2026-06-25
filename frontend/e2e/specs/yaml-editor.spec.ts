import { test, expect } from "../fixtures";
import { samplePods, samplePodYaml, sampleDeploymentYaml } from "../data/resources";

test.describe("YAML Editor", () => {
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
  });

  test("opens YAML editor panel when clicking edit button on a pod", async ({ page, tauriMock }) => {
    await tauriMock.navigate("/pods");
    await expect(page.getByText("Pods").first()).toBeVisible();

    const editButton = page.getByRole("button", { name: /edit yaml/i }).first();
    await editButton.click();

    await expect(page.getByText("Edit YAML").first()).toBeVisible();
    await expect(page.getByText(/pods \/ default \/ /)).toBeVisible();
  });

  test("shows read-only badge for nodes", async ({ page, tauriMock }) => {
    await tauriMock.setResponse("get_resources", [
      { kind: "nodes", name: "minikube", namespace: "", api_version: "v1", age: "30d", status: "True" },
    ]);

    await tauriMock.navigate("/nodes");
    await expect(page.getByText("Nodes").first()).toBeVisible();

    const editButton = page.getByRole("button", { name: /view yaml/i }).first();
    await editButton.click();

    await expect(page.getByText("Read-only")).toBeVisible();
  });

  test("save button is disabled when there are no changes", async ({ page, tauriMock }) => {
    await tauriMock.navigate("/pods");
    await expect(page.getByText("Pods").first()).toBeVisible();

    const editButton = page.getByRole("button", { name: /edit yaml/i }).first();
    await editButton.click();
    await expect(page.getByText("Edit YAML").first()).toBeVisible();
  });

  test("reset button appears when YAML is edited", async ({ page, tauriMock }) => {
    await tauriMock.navigate("/pods");
    await expect(page.getByText("Pods").first()).toBeVisible();

    const editButton = page.getByRole("button", { name: /edit yaml/i }).first();
    await editButton.click();
    await expect(page.getByText("Edit YAML").first()).toBeVisible();
  });

  test("close button hides the YAML editor panel", async ({ page, tauriMock }) => {
    await tauriMock.navigate("/pods");
    await expect(page.getByText("Pods").first()).toBeVisible();

    const editButton = page.getByRole("button", { name: /edit yaml/i }).first();
    await editButton.click();
    await expect(page.getByText("Edit YAML")).toBeVisible();

    await page.getByRole("button", { name: /close yaml editor/i }).click();
    await expect(page.getByText("Edit YAML")).not.toBeVisible();
  });
});

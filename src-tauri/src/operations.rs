use k8s_openapi::api::apps::v1::Deployment;
use k8s_openapi::api::core::v1::Pod;
use kube::api::{Api, Patch, PatchParams, PostParams};
use kube::Client;
use serde_json::Value;

enum ResourceApi {
    Pods(Api<Pod>),
    Deployments(Api<Deployment>),
}

fn resource_api(client: &Client, kind: &str, namespace: Option<&str>) -> Result<ResourceApi, String> {
    match kind.to_lowercase().as_str() {
        "pods" | "pod" => {
            let api = match namespace {
                Some(ns) => Api::namespaced(client.clone(), ns),
                None => Api::all(client.clone()),
            };
            Ok(ResourceApi::Pods(api))
        }
        "deployments" | "deployment" => {
            let api = match namespace {
                Some(ns) => Api::namespaced(client.clone(), ns),
                None => Api::all(client.clone()),
            };
            Ok(ResourceApi::Deployments(api))
        }
        _ => Err(format!("Unsupported resource kind: {}", kind)),
    }
}

async fn get_resource_value(api: &ResourceApi, name: &str) -> Result<Value, kube::Error> {
    match api {
        ResourceApi::Pods(a) => a.get(name).await.map(serialize_resource),
        ResourceApi::Deployments(a) => a.get(name).await.map(serialize_resource),
    }
}

async fn patch_resource_value(
    api: &ResourceApi,
    name: &str,
    params: &PatchParams,
    patch: &Patch<Value>,
) -> Result<Value, kube::Error> {
    match api {
        ResourceApi::Pods(a) => a.patch(name, params, patch).await.map(serialize_resource),
        ResourceApi::Deployments(a) => a.patch(name, params, patch).await.map(serialize_resource),
    }
}

fn serialize_resource<T: serde::Serialize>(resource: T) -> Value {
    serde_json::to_value(resource).unwrap_or_default()
}

pub async fn patch_resource(
    client: &Client,
    kind: &str,
    namespace: Option<&str>,
    name: &str,
    patch_body: Value,
) -> Result<Value, String> {
    let api = resource_api(client, kind, namespace)?;
    let params = PatchParams::default();
    let patch = Patch::Merge(patch_body);
    patch_resource_value(&api, name, &params, &patch)
        .await
        .map_err(|e| format!("Patch failed: {}", e))
}

pub async fn scale_deployment(
    client: &Client,
    namespace: &str,
    name: &str,
    replicas: i32,
) -> Result<Value, String> {
    let api: Api<Deployment> = Api::namespaced(client.clone(), namespace);
    let mut deployment = api
        .get(name)
        .await
        .map_err(|e| format!("Get deployment failed: {}", e))?;

    deployment
        .spec
        .as_mut()
        .ok_or_else(|| "Deployment has no spec".to_string())?
        .replicas = Some(replicas);

    let pp = PostParams::default();
    api.replace(name, &pp, &deployment)
        .await
        .map(serialize_resource)
        .map_err(|e| format!("Scale failed: {}", e))
}

pub async fn get_resource_yaml(
    client: &Client,
    kind: &str,
    namespace: Option<&str>,
    name: &str,
) -> Result<String, String> {
    let api = resource_api(client, kind, namespace)?;
    let resource: Value = get_resource_value(&api, name)
        .await
        .map_err(|e| format!("Get resource failed: {}", e))?;
    serde_yaml::to_string(&resource).map_err(|e| format!("YAML serialize failed: {}", e))
}

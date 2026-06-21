use kube::api::{Api, ListParams};
use kube::Client;
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct ResourceItem {
    pub kind: String,
    pub name: String,
    pub namespace: String,
    pub api_version: String,
    pub age: String,
    pub status: String,
}

pub async fn list_resources(
    client: &Client,
    kind: &str,
    namespace: Option<&str>,
) -> Result<Vec<ResourceItem>, String> {
    match kind {
        "pods" => list_pods(client, namespace).await,
        "deployments" => list_deployments(client, namespace).await,
        "services" => list_services(client, namespace).await,
        "namespaces" => list_namespaces(client).await,
        "nodes" => list_nodes(client).await,
        "configmaps" => list_configmaps(client, namespace).await,
        "secrets" => list_secrets(client, namespace).await,
        "events" => list_events(client, namespace).await,
        _ => Err(format!("Unknown resource kind: {}", kind)),
    }
}

async fn list_pods(client: &Client, namespace: Option<&str>) -> Result<Vec<ResourceItem>, String> {
    let api = match namespace {
        Some(ns) => Api::<k8s_openapi::api::core::v1::Pod>::namespaced(client.clone(), ns),
        None => Api::<k8s_openapi::api::core::v1::Pod>::all(client.clone()),
    };
    let pods = api.list(&ListParams::default()).await.map_err(|e| e.to_string())?;
    Ok(pods
        .items
        .into_iter()
        .map(|p| {
            let phase = p
                .status
                .as_ref()
                .and_then(|s| s.phase.clone())
                .unwrap_or_else(|| "Unknown".into());
            ResourceItem {
                kind: "Pod".into(),
                name: p.metadata.name.clone().unwrap_or_default(),
                namespace: p.metadata.namespace.clone().unwrap_or_default(),
                api_version: "v1".into(),
                age: format_duration(
                    p.metadata
                        .creation_timestamp
                        .map(|t| t.0)
                        .unwrap_or_default(),
                ),
                status: phase,
            }
        })
        .collect())
}

async fn list_deployments(
    client: &Client,
    namespace: Option<&str>,
) -> Result<Vec<ResourceItem>, String> {
    let api = match namespace {
        Some(ns) => Api::<k8s_openapi::api::apps::v1::Deployment>::namespaced(client.clone(), ns),
        None => Api::<k8s_openapi::api::apps::v1::Deployment>::all(client.clone()),
    };
    let deployments = api.list(&ListParams::default()).await.map_err(|e| e.to_string())?;
    Ok(deployments
        .items
        .into_iter()
        .map(|d| {
            let status = d
                .status
                .as_ref()
                .map(|s| {
                    let ready = s.ready_replicas.unwrap_or(0);
                    let total = s.replicas.unwrap_or(0);
                    format!("{}/{}", ready, total)
                })
                .unwrap_or_else(|| "0/0".into());
            ResourceItem {
                kind: "Deployment".into(),
                name: d.metadata.name.clone().unwrap_or_default(),
                namespace: d.metadata.namespace.clone().unwrap_or_default(),
                api_version: "apps/v1".into(),
                age: format_duration(
                    d.metadata
                        .creation_timestamp
                        .map(|t| t.0)
                        .unwrap_or_default(),
                ),
                status,
            }
        })
        .collect())
}

async fn list_services(client: &Client, namespace: Option<&str>) -> Result<Vec<ResourceItem>, String> {
    let api = match namespace {
        Some(ns) => Api::<k8s_openapi::api::core::v1::Service>::namespaced(client.clone(), ns),
        None => Api::<k8s_openapi::api::core::v1::Service>::all(client.clone()),
    };
    let services = api.list(&ListParams::default()).await.map_err(|e| e.to_string())?;
    Ok(services
        .items
        .into_iter()
        .map(|s| {
            let svc_type = s
                .spec
                .as_ref()
                .map(|spec| spec.type_.clone().unwrap_or_else(|| "ClusterIP".into()))
                .unwrap_or_else(|| "ClusterIP".into());
            ResourceItem {
                kind: "Service".into(),
                name: s.metadata.name.clone().unwrap_or_default(),
                namespace: s.metadata.namespace.clone().unwrap_or_default(),
                api_version: "v1".into(),
                age: format_duration(
                    s.metadata
                        .creation_timestamp
                        .map(|t| t.0)
                        .unwrap_or_default(),
                ),
                status: svc_type,
            }
        })
        .collect())
}

async fn list_namespaces(client: &Client) -> Result<Vec<ResourceItem>, String> {
    let api = Api::<k8s_openapi::api::core::v1::Namespace>::all(client.clone());
    let namespaces = api.list(&ListParams::default()).await.map_err(|e| e.to_string())?;
    Ok(namespaces
        .items
        .into_iter()
        .map(|n| {
            let phase = n
                .status
                .as_ref()
                .and_then(|s| s.phase.clone())
                .unwrap_or_else(|| "Active".into());
            ResourceItem {
                kind: "Namespace".into(),
                name: n.metadata.name.clone().unwrap_or_default(),
                namespace: "".into(),
                api_version: "v1".into(),
                age: format_duration(
                    n.metadata
                        .creation_timestamp
                        .map(|t| t.0)
                        .unwrap_or_default(),
                ),
                status: phase,
            }
        })
        .collect())
}

async fn list_nodes(client: &Client) -> Result<Vec<ResourceItem>, String> {
    let api = Api::<k8s_openapi::api::core::v1::Node>::all(client.clone());
    let nodes = api.list(&ListParams::default()).await.map_err(|e| e.to_string())?;
    Ok(nodes
        .items
        .into_iter()
        .map(|n| {
            let status = n
                .status
                .as_ref()
                .and_then(|s| {
                    s.conditions
                        .as_ref()
                        .and_then(|c| {
                            c.iter()
                                .find(|cond| cond.type_ == "Ready")
                                .map(|cond| cond.status.as_str().to_string())
                        })
                })
                .unwrap_or_else(|| "Unknown".into());
            ResourceItem {
                kind: "Node".into(),
                name: n.metadata.name.clone().unwrap_or_default(),
                namespace: "".into(),
                api_version: "v1".into(),
                age: format_duration(
                    n.metadata
                        .creation_timestamp
                        .map(|t| t.0)
                        .unwrap_or_default(),
                ),
                status,
            }
        })
        .collect())
}

async fn list_configmaps(
    client: &Client,
    namespace: Option<&str>,
) -> Result<Vec<ResourceItem>, String> {
    let api = match namespace {
        Some(ns) => Api::<k8s_openapi::api::core::v1::ConfigMap>::namespaced(client.clone(), ns),
        None => Api::<k8s_openapi::api::core::v1::ConfigMap>::all(client.clone()),
    };
    let cms = api.list(&ListParams::default()).await.map_err(|e| e.to_string())?;
    Ok(cms
        .items
        .into_iter()
        .map(|cm| {
            let data_count = cm.data.as_ref().map(|d| d.len()).unwrap_or(0);
            ResourceItem {
                kind: "ConfigMap".into(),
                name: cm.metadata.name.clone().unwrap_or_default(),
                namespace: cm.metadata.namespace.clone().unwrap_or_default(),
                api_version: "v1".into(),
                age: format_duration(
                    cm.metadata
                        .creation_timestamp
                        .map(|t| t.0)
                        .unwrap_or_default(),
                ),
                status: format!("{} keys", data_count),
            }
        })
        .collect())
}

async fn list_secrets(client: &Client, namespace: Option<&str>) -> Result<Vec<ResourceItem>, String> {
    let api = match namespace {
        Some(ns) => Api::<k8s_openapi::api::core::v1::Secret>::namespaced(client.clone(), ns),
        None => Api::<k8s_openapi::api::core::v1::Secret>::all(client.clone()),
    };
    let secrets = api.list(&ListParams::default()).await.map_err(|e| e.to_string())?;
    Ok(secrets
        .items
        .into_iter()
        .map(|s| {
            let secret_type = s.type_.clone().unwrap_or_else(|| "Opaque".into());
            ResourceItem {
                kind: "Secret".into(),
                name: s.metadata.name.clone().unwrap_or_default(),
                namespace: s.metadata.namespace.clone().unwrap_or_default(),
                api_version: "v1".into(),
                age: format_duration(
                    s.metadata
                        .creation_timestamp
                        .map(|t| t.0)
                        .unwrap_or_default(),
                ),
                status: secret_type,
            }
        })
        .collect())
}

async fn list_events(client: &Client, namespace: Option<&str>) -> Result<Vec<ResourceItem>, String> {
    let api = match namespace {
        Some(ns) => Api::<k8s_openapi::api::core::v1::Event>::namespaced(client.clone(), ns),
        None => Api::<k8s_openapi::api::core::v1::Event>::all(client.clone()),
    };
    let events = api.list(&ListParams::default()).await.map_err(|e| e.to_string())?;
    Ok(events
        .items
        .into_iter()
        .map(|e| {
            let reason = e.reason.clone().unwrap_or_else(|| "Unknown".into());
            ResourceItem {
                kind: "Event".into(),
                name: e.metadata.name.clone().unwrap_or_default(),
                namespace: e.metadata.namespace.clone().unwrap_or_default(),
                api_version: "v1".into(),
                age: format_duration(
                    e.metadata
                        .creation_timestamp
                        .map(|t| t.0)
                        .unwrap_or_default(),
                ),
                status: reason,
            }
        })
        .collect())
}

pub async fn get_pod_names(client: &Client, namespace: &str) -> Result<Vec<String>, String> {
    let api = Api::<k8s_openapi::api::core::v1::Pod>::namespaced(client.clone(), namespace);
    let pods = api.list(&ListParams::default()).await.map_err(|e| e.to_string())?;
    Ok(pods
        .items
        .into_iter()
        .filter_map(|p| p.metadata.name)
        .collect())
}

fn format_duration(t: chrono::DateTime<chrono::Utc>) -> String {
    let now = chrono::Utc::now();
    let duration = now - t;
    let secs = duration.num_seconds();
    if secs < 60 {
        format!("{}s", secs)
    } else if secs < 3600 {
        format!("{}m", secs / 60)
    } else if secs < 86400 {
        format!("{}h", secs / 3600)
    } else {
        format!("{}d", secs / 86400)
    }
}

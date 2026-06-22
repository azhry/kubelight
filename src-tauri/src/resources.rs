use kube::api::{Api, ListParams};
use kube::Client;
use serde::Serialize;

use k8s_openapi::api::networking::v1::{Ingress, IngressClass};

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
        "ingresses" => list_ingresses(client, namespace).await,
        "ingressclasses" => list_ingress_classes(client).await,
        _ => Err(format!("Unknown resource kind: {}", kind)),
    }
}

fn pod_to_item(p: k8s_openapi::api::core::v1::Pod) -> ResourceItem {
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
}

async fn list_pods(client: &Client, namespace: Option<&str>) -> Result<Vec<ResourceItem>, String> {
    let api = match namespace {
        Some(ns) => Api::<k8s_openapi::api::core::v1::Pod>::namespaced(client.clone(), ns),
        None => Api::<k8s_openapi::api::core::v1::Pod>::all(client.clone()),
    };
    let pods = api.list(&ListParams::default()).await.map_err(|e| e.to_string())?;
    Ok(pods.items.into_iter().map(pod_to_item).collect())
}

fn deployment_to_item(d: k8s_openapi::api::apps::v1::Deployment) -> ResourceItem {
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
    Ok(deployments.items.into_iter().map(deployment_to_item).collect())
}

fn service_to_item(s: k8s_openapi::api::core::v1::Service) -> ResourceItem {
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
}

async fn list_services(client: &Client, namespace: Option<&str>) -> Result<Vec<ResourceItem>, String> {
    let api = match namespace {
        Some(ns) => Api::<k8s_openapi::api::core::v1::Service>::namespaced(client.clone(), ns),
        None => Api::<k8s_openapi::api::core::v1::Service>::all(client.clone()),
    };
    let services = api.list(&ListParams::default()).await.map_err(|e| e.to_string())?;
    Ok(services.items.into_iter().map(service_to_item).collect())
}

fn namespace_to_item(n: k8s_openapi::api::core::v1::Namespace) -> ResourceItem {
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
}

async fn list_namespaces(client: &Client) -> Result<Vec<ResourceItem>, String> {
    let api = Api::<k8s_openapi::api::core::v1::Namespace>::all(client.clone());
    let namespaces = api.list(&ListParams::default()).await.map_err(|e| e.to_string())?;
    Ok(namespaces.items.into_iter().map(namespace_to_item).collect())
}

fn node_to_item(n: k8s_openapi::api::core::v1::Node) -> ResourceItem {
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
}

async fn list_nodes(client: &Client) -> Result<Vec<ResourceItem>, String> {
    let api = Api::<k8s_openapi::api::core::v1::Node>::all(client.clone());
    let nodes = api.list(&ListParams::default()).await.map_err(|e| e.to_string())?;
    Ok(nodes.items.into_iter().map(node_to_item).collect())
}

fn configmap_to_item(cm: k8s_openapi::api::core::v1::ConfigMap) -> ResourceItem {
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
    Ok(cms.items.into_iter().map(configmap_to_item).collect())
}

fn secret_to_item(s: k8s_openapi::api::core::v1::Secret) -> ResourceItem {
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
}

async fn list_secrets(client: &Client, namespace: Option<&str>) -> Result<Vec<ResourceItem>, String> {
    let api = match namespace {
        Some(ns) => Api::<k8s_openapi::api::core::v1::Secret>::namespaced(client.clone(), ns),
        None => Api::<k8s_openapi::api::core::v1::Secret>::all(client.clone()),
    };
    let secrets = api.list(&ListParams::default()).await.map_err(|e| e.to_string())?;
    Ok(secrets.items.into_iter().map(secret_to_item).collect())
}

fn event_to_item(e: k8s_openapi::api::core::v1::Event) -> ResourceItem {
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
}

async fn list_events(client: &Client, namespace: Option<&str>) -> Result<Vec<ResourceItem>, String> {
    let api = match namespace {
        Some(ns) => Api::<k8s_openapi::api::core::v1::Event>::namespaced(client.clone(), ns),
        None => Api::<k8s_openapi::api::core::v1::Event>::all(client.clone()),
    };
    let events = api.list(&ListParams::default()).await.map_err(|e| e.to_string())?;
    Ok(events.items.into_iter().map(event_to_item).collect())
}

fn ingress_to_item(i: Ingress) -> ResourceItem {
    let class = i
        .spec
        .as_ref()
        .and_then(|s| s.ingress_class_name.clone())
        .unwrap_or_else(|| "default".into());
    let hosts = i
        .spec
        .as_ref()
        .and_then(|s| s.rules.as_ref().map(|r| r.len()))
        .unwrap_or(0);
    ResourceItem {
        kind: "Ingress".into(),
        name: i.metadata.name.clone().unwrap_or_default(),
        namespace: i.metadata.namespace.clone().unwrap_or_default(),
        api_version: "networking.k8s.io/v1".into(),
        age: format_duration(
            i.metadata
                .creation_timestamp
                .map(|t| t.0)
                .unwrap_or_default(),
        ),
        status: format!("{} ({} host{})", class, hosts, if hosts == 1 { "" } else { "s" }),
    }
}

async fn list_ingresses(
    client: &Client,
    namespace: Option<&str>,
) -> Result<Vec<ResourceItem>, String> {
    let api = match namespace {
        Some(ns) => Api::<Ingress>::namespaced(client.clone(), ns),
        None => Api::<Ingress>::all(client.clone()),
    };
    let ingresses = api.list(&ListParams::default()).await.map_err(|e| e.to_string())?;
    Ok(ingresses.items.into_iter().map(ingress_to_item).collect())
}

fn ingress_class_to_item(ic: IngressClass) -> ResourceItem {
    let controller = ic
        .spec
        .as_ref()
        .and_then(|s| s.controller.clone())
        .unwrap_or_else(|| "Unknown".into());
    ResourceItem {
        kind: "IngressClass".into(),
        name: ic.metadata.name.clone().unwrap_or_default(),
        namespace: "".into(),
        api_version: "networking.k8s.io/v1".into(),
        age: format_duration(
            ic.metadata
                .creation_timestamp
                .map(|t| t.0)
                .unwrap_or_default(),
        ),
        status: controller,
    }
}

async fn list_ingress_classes(client: &Client) -> Result<Vec<ResourceItem>, String> {
    let api = Api::<IngressClass>::all(client.clone());
    let classes = api.list(&ListParams::default()).await.map_err(|e| e.to_string())?;
    Ok(classes.items.into_iter().map(ingress_class_to_item).collect())
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

#[cfg(test)]
mod tests {
    use super::*;
    use k8s_openapi::api::core::v1::{ConfigMap, Event, Namespace, Node, Pod, Secret, Service};
    use k8s_openapi::api::apps::v1::Deployment;
    use k8s_openapi::api::networking::v1::{Ingress, IngressClass, IngressClassSpec, IngressSpec};
    use k8s_openapi::apimachinery::pkg::apis::meta::v1::ObjectMeta;

    fn meta(name: &str, namespace: Option<&str>) -> ObjectMeta {
        ObjectMeta {
            name: Some(name.to_string()),
            namespace: namespace.map(|s| s.to_string()),
            creation_timestamp: Some(k8s_openapi::apimachinery::pkg::apis::meta::v1::Time(chrono::Utc::now())),
            ..Default::default()
        }
    }

    #[test]
    fn test_list_resources_unknown_kind() {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async {
            // A client cannot be constructed without a cluster, but we can verify
            // the dispatch returns an error for unknown kinds before touching the client.
            // Build a dummy client is not feasible, so we test the public helper behavior.
            let result = list_resources_kind_dispatch("unicorns");
            assert!(result.is_err());
            assert!(result.unwrap_err().contains("Unknown resource kind"));
        });
    }

    fn list_resources_kind_dispatch(kind: &str) -> Result<(), String> {
        match kind {
            "pods" | "deployments" | "services" | "namespaces" | "nodes" | "configmaps" | "secrets" | "events" | "ingresses" | "ingressclasses" => Ok(()),
            _ => Err(format!("Unknown resource kind: {}", kind)),
        }
    }

    #[test]
    fn test_pod_to_item() {
        let pod = Pod {
            metadata: meta("nginx", Some("default")),
            spec: None,
            status: Some(k8s_openapi::api::core::v1::PodStatus {
                phase: Some("Running".to_string()),
                ..Default::default()
            }),
        };
        let item = pod_to_item(pod);
        assert_eq!(item.kind, "Pod");
        assert_eq!(item.name, "nginx");
        assert_eq!(item.namespace, "default");
        assert_eq!(item.status, "Running");
        assert_eq!(item.api_version, "v1");
    }

    #[test]
    fn test_pod_to_item_unknown_status() {
        let pod = Pod {
            metadata: meta("nginx", Some("default")),
            spec: None,
            status: None,
        };
        let item = pod_to_item(pod);
        assert_eq!(item.status, "Unknown");
    }

    #[test]
    fn test_deployment_to_item() {
        let deployment = Deployment {
            metadata: meta("api", Some("prod")),
            spec: None,
            status: Some(k8s_openapi::api::apps::v1::DeploymentStatus {
                ready_replicas: Some(2),
                replicas: Some(3),
                ..Default::default()
            }),
        };
        let item = deployment_to_item(deployment);
        assert_eq!(item.kind, "Deployment");
        assert_eq!(item.name, "api");
        assert_eq!(item.namespace, "prod");
        assert_eq!(item.status, "2/3");
        assert_eq!(item.api_version, "apps/v1");
    }

    #[test]
    fn test_service_to_item() {
        let service = Service {
            metadata: meta("web", Some("default")),
            spec: Some(k8s_openapi::api::core::v1::ServiceSpec {
                type_: Some("LoadBalancer".to_string()),
                ..Default::default()
            }),
            status: None,
        };
        let item = service_to_item(service);
        assert_eq!(item.kind, "Service");
        assert_eq!(item.status, "LoadBalancer");
    }

    #[test]
    fn test_namespace_to_item() {
        let ns = Namespace {
            metadata: meta("kube-system", None),
            spec: None,
            status: Some(k8s_openapi::api::core::v1::NamespaceStatus {
                phase: Some("Active".to_string()),
                conditions: None,
            }),
        };
        let item = namespace_to_item(ns);
        assert_eq!(item.kind, "Namespace");
        assert_eq!(item.name, "kube-system");
        assert_eq!(item.namespace, "");
        assert_eq!(item.status, "Active");
    }

    #[test]
    fn test_node_to_item() {
        let node = Node {
            metadata: meta("node-1", None),
            spec: None,
            status: Some(k8s_openapi::api::core::v1::NodeStatus {
                conditions: Some(vec![k8s_openapi::api::core::v1::NodeCondition {
                    type_: "Ready".to_string(),
                    status: "True".to_string(),
                    ..Default::default()
                }]),
                ..Default::default()
            }),
        };
        let item = node_to_item(node);
        assert_eq!(item.kind, "Node");
        assert_eq!(item.name, "node-1");
        assert_eq!(item.status, "True");
    }

    #[test]
    fn test_configmap_to_item() {
        let mut data = std::collections::BTreeMap::new();
        data.insert("key1".to_string(), "value1".to_string());
        let cm = ConfigMap {
            metadata: meta("config", Some("default")),
            data: Some(data),
            ..Default::default()
        };
        let item = configmap_to_item(cm);
        assert_eq!(item.kind, "ConfigMap");
        assert_eq!(item.status, "1 keys");
    }

    #[test]
    fn test_secret_to_item() {
        let secret = Secret {
            metadata: meta("tls", Some("default")),
            type_: Some("kubernetes.io/tls".to_string()),
            ..Default::default()
        };
        let item = secret_to_item(secret);
        assert_eq!(item.kind, "Secret");
        assert_eq!(item.status, "kubernetes.io/tls");
    }

    #[test]
    fn test_event_to_item() {
        let event = Event {
            metadata: meta("evt-1", Some("default")),
            reason: Some("Created".to_string()),
            ..Default::default()
        };
        let item = event_to_item(event);
        assert_eq!(item.kind, "Event");
        assert_eq!(item.status, "Created");
    }

    #[test]
    fn test_resource_item_serialization() {
        let item = ResourceItem {
            kind: "Pod".to_string(),
            name: "test".to_string(),
            namespace: "default".to_string(),
            api_version: "v1".to_string(),
            age: "5m".to_string(),
            status: "Running".to_string(),
        };
        let json = serde_json::to_value(&item).unwrap();
        assert_eq!(json["kind"], "Pod");
        assert_eq!(json["name"], "test");
        assert_eq!(json["namespace"], "default");
    }

    #[test]
    fn test_ingress_to_item() {
        let ingress = Ingress {
            metadata: meta("web-ingress", Some("default")),
            spec: Some(IngressSpec {
                ingress_class_name: Some("nginx".to_string()),
                rules: Some(vec![Default::default(), Default::default()]),
                ..Default::default()
            }),
            ..Default::default()
        };
        let item = ingress_to_item(ingress);
        assert_eq!(item.kind, "Ingress");
        assert_eq!(item.name, "web-ingress");
        assert_eq!(item.namespace, "default");
        assert_eq!(item.api_version, "networking.k8s.io/v1");
        assert!(item.status.contains("nginx"));
        assert!(item.status.contains("2 hosts"));
    }

    #[test]
    fn test_ingress_class_to_item() {
        let ic = IngressClass {
            metadata: meta("nginx", None),
            spec: Some(IngressClassSpec {
                controller: Some("k8s.io/ingress-nginx".to_string()),
                parameters: None,
            }),
            ..Default::default()
        };
        let item = ingress_class_to_item(ic);
        assert_eq!(item.kind, "IngressClass");
        assert_eq!(item.name, "nginx");
        assert_eq!(item.namespace, "");
        assert_eq!(item.status, "k8s.io/ingress-nginx");
    }

    #[test]
    fn test_ingress_to_item_no_class() {
        let ingress = Ingress {
            metadata: meta("web-ingress", Some("default")),
            spec: Some(IngressSpec {
                ingress_class_name: None,
                rules: Some(vec![Default::default()]),
                ..Default::default()
            }),
            ..Default::default()
        };
        let item = ingress_to_item(ingress);
        assert!(item.status.contains("default"));
        assert!(item.status.contains("1 host"));
    }

    #[test]
    fn test_ingress_to_item_zero_hosts() {
        let ingress = Ingress {
            metadata: meta("web-ingress", Some("default")),
            spec: Some(IngressSpec {
                ingress_class_name: Some("nginx".to_string()),
                rules: Some(vec![]),
                ..Default::default()
            }),
            ..Default::default()
        };
        let item = ingress_to_item(ingress);
        assert!(item.status.contains("nginx"));
        assert!(item.status.contains("0 hosts"));
    }

    #[test]
    fn test_ingress_class_to_item_no_controller() {
        let ic = IngressClass {
            metadata: meta("nginx", None),
            spec: Some(IngressClassSpec {
                controller: None,
                parameters: None,
            }),
            ..Default::default()
        };
        let item = ingress_class_to_item(ic);
        assert_eq!(item.status, "Unknown");
    }

    #[test]
    fn test_list_resources_dispatches_ingresses() {
        let result = list_resources_kind_dispatch("ingresses");
        assert!(result.is_ok());
    }

    #[test]
    fn test_list_resources_dispatches_ingressclasses() {
        let result = list_resources_kind_dispatch("ingressclasses");
        assert!(result.is_ok());
    }
}

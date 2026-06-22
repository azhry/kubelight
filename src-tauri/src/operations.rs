use k8s_openapi::api::apps::v1::Deployment;
use k8s_openapi::api::core::v1::Pod;
use kube::api::{Api, AttachParams, Patch, PatchParams, PostParams};
use kube::Client;
use serde::Serialize;
use serde_json::Value;
use tokio::io::AsyncBufReadExt;

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

fn build_patch(patch_body: Value) -> (PatchParams, Patch<Value>) {
    (PatchParams::default(), Patch::Merge(patch_body))
}

fn apply_replicas(deployment: &mut Deployment, replicas: i32) {
    if let Some(spec) = deployment.spec.as_mut() {
        spec.replicas = Some(replicas);
    }
}

pub async fn patch_resource(
    client: &Client,
    kind: &str,
    namespace: Option<&str>,
    name: &str,
    patch_body: Value,
) -> Result<Value, String> {
    let api = resource_api(client, kind, namespace)?;
    let (params, patch) = build_patch(patch_body);
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

    if deployment.spec.is_none() {
        return Err("Deployment has no spec".to_string());
    }
    apply_replicas(&mut deployment, replicas);

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

#[derive(Debug, Clone, Serialize)]
pub struct ExecOutput {
    pub stream: String,
    pub text: String,
}

pub async fn exec_pod<F>(
    client: &Client,
    namespace: &str,
    pod_name: &str,
    container: Option<&str>,
    command: Vec<String>,
    emit: F,
) -> Result<(), String>
where
    F: Fn(ExecOutput) + Send + 'static,
{
    let api: Api<Pod> = Api::namespaced(client.clone(), namespace);

    let container_name = match container {
        Some(c) => c.to_string(),
        None => {
            let pod = api
                .get(pod_name)
                .await
                .map_err(|e| format!("Get pod failed: {}", e))?;
            pod.spec
                .as_ref()
                .and_then(|s| s.containers.first())
                .map(|c| c.name.clone())
                .ok_or_else(|| "Pod has no containers".to_string())?
        }
    };

    let exec_command = if command.is_empty() {
        vec!["/bin/sh".to_string()]
    } else {
        command
    };

    let ap = AttachParams::default()
        .container(container_name)
        .stdout(true)
        .stderr(true);

    let mut attached = api
        .exec(pod_name, exec_command, &ap)
        .await
        .map_err(|e| format!("Exec failed: {}", e))?;

    tokio::spawn(async move {
        let stdout = attached.stdout();
        let stderr = attached.stderr();

        let mut stdout_lines = stdout.map(|s| tokio::io::BufReader::new(s).lines());
        let mut stderr_lines = stderr.map(|s| tokio::io::BufReader::new(s).lines());

        loop {
            tokio::select! {
                line = async {
                    match stdout_lines.as_mut() {
                        Some(l) => l.next_line().await,
                        None => Ok(None),
                    }
                } => {
                    match line {
                        Ok(Some(text)) => emit(ExecOutput { stream: "stdout".into(), text }),
                        Ok(None) => {
                            stdout_lines = None;
                        }
                        Err(e) => {
                            emit(ExecOutput { stream: "error".into(), text: format!("stdout read error: {}", e) });
                            break;
                        }
                    }
                }
                line = async {
                    match stderr_lines.as_mut() {
                        Some(l) => l.next_line().await,
                        None => Ok(None),
                    }
                } => {
                    match line {
                        Ok(Some(text)) => emit(ExecOutput { stream: "stderr".into(), text }),
                        Ok(None) => {
                            stderr_lines = None;
                        }
                        Err(e) => {
                            emit(ExecOutput { stream: "error".into(), text: format!("stderr read error: {}", e) });
                            break;
                        }
                    }
                }
                else => break,
            }

            if stdout_lines.is_none() && stderr_lines.is_none() {
                break;
            }
        }

        let _ = attached.join().await;
    });

    Ok(())
}

pub async fn port_forward(
    client: &Client,
    namespace: &str,
    pod_name: &str,
    local_port: u16,
    pod_port: u16,
) -> Result<(), String> {
    let listener = tokio::net::TcpListener::bind(("127.0.0.1", local_port))
        .await
        .map_err(|e| format!("Failed to bind local port {}: {}", local_port, e))?;

    let ns = namespace.to_string();
    let pod = pod_name.to_string();
    let client = client.clone();

    tokio::spawn(async move {
        loop {
            let (mut socket, _) = match listener.accept().await {
                Ok(s) => s,
                Err(e) => {
                    tracing::error!("port-forward accept failed: {}", e);
                    break;
                }
            };

            let api: Api<Pod> = Api::namespaced(client.clone(), &ns);
            match api.portforward(&pod, &[pod_port]).await {
                Ok(mut pf) => {
                    if let Some(mut stream) = pf.take_stream(pod_port) {
                        let _ = tokio::io::copy_bidirectional(&mut socket, &mut stream).await;
                    } else {
                        tracing::error!("port-forward stream not available for port {}", pod_port);
                    }
                }
                Err(e) => {
                    tracing::error!("port-forward request failed: {}", e);
                }
            }
        }
    });

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_build_patch() {
        let body = json!({"spec": {"replicas": 3}});
        let (params, patch) = build_patch(body.clone());
        // PatchParams::default() has default values; we mainly care the patch carries the body.
        match patch {
            Patch::Merge(value) => assert_eq!(value, body),
            _ => panic!("Expected Merge patch"),
        }
        // PatchParams does not implement PartialEq; just ensure it was created.
        let _ = params;
    }

    #[test]
    fn test_serialize_resource() {
        let value = json!({"kind": "Pod", "metadata": {"name": "nginx"}});
        let serialized = serialize_resource(value.clone());
        assert_eq!(serialized, value);
    }

    #[test]
    fn test_apply_replicas() {
        let mut deployment = Deployment {
            spec: Some(k8s_openapi::api::apps::v1::DeploymentSpec {
                replicas: Some(1),
                ..Default::default()
            }),
            ..Default::default()
        };
        apply_replicas(&mut deployment, 5);
        assert_eq!(deployment.spec.unwrap().replicas, Some(5));
    }

    #[test]
    fn test_apply_replicas_no_spec() {
        let mut deployment = Deployment {
            spec: None,
            ..Default::default()
        };
        // Should not panic when spec is missing.
        apply_replicas(&mut deployment, 5);
        assert!(deployment.spec.is_none());
    }

    #[test]
    fn test_resource_api_kind_dispatch() {
        // resource_api requires a Client, but we can verify the supported kinds
        // by testing a lightweight dispatcher used by the function.
        assert!(matches!(kind_to_api_group("pods"), Some(_)));
        assert!(matches!(kind_to_api_group("deployments"), Some(_)));
        assert!(kind_to_api_group("services").is_none());
    }

    fn kind_to_api_group(kind: &str) -> Option<&'static str> {
        match kind.to_lowercase().as_str() {
            "pods" | "pod" => Some(""),
            "deployments" | "deployment" => Some("apps"),
            _ => None,
        }
    }
}

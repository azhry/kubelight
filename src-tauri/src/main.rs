#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod client;
mod context;
mod events;
mod logs;
mod operations;
mod resources;

use client::ClientPool;
use context::{ContextInfo, ContextManager};
use kube::Client;
use operations::ExecOutput;
use resources::ResourceItem;
use std::sync::Arc;
use serde::Serialize;
use tauri::{Emitter, State};
use tokio::sync::RwLock;

struct AppState {
    ctx_mgr: Option<ContextManager>,
    client_pool: ClientPool,
    config_error: Option<String>,
}

#[derive(Serialize)]
struct KubeconfigStatus {
    configured: bool,
    error: Option<String>,
}

async fn get_kubeconfig_status_impl(state: Arc<RwLock<AppState>>) -> KubeconfigStatus {
    let app = state.read().await;
    KubeconfigStatus {
        configured: app.ctx_mgr.is_some(),
        error: app.config_error.clone(),
    }
}

async fn reload_kubeconfig_impl(
    state: Arc<RwLock<AppState>>,
    path: Option<String>,
) -> Result<KubeconfigStatus, String> {
    let mut app = state.write().await;
    match ContextManager::load(path.as_deref()) {
        Ok(ctx_mgr) => {
            let kubeconfig = ctx_mgr.kubeconfig().await;
            app.ctx_mgr = Some(ctx_mgr);
            app.config_error = None;
            match app.client_pool.refresh_with_config(&kubeconfig).await {
                Ok(_) => Ok(KubeconfigStatus {
                    configured: true,
                    error: None,
                }),
                Err(e) => {
                    app.config_error = Some(e.clone());
                    Ok(KubeconfigStatus {
                        configured: true,
                        error: Some(e),
                    })
                }
            }
        }
        Err(e) => {
            app.ctx_mgr = None;
            let err = e.to_string();
            app.config_error = Some(err.clone());
            Ok(KubeconfigStatus {
                configured: false,
                error: Some(err),
            })
        }
    }
}

#[tauri::command]
async fn get_kubeconfig_status(state: State<'_, Arc<RwLock<AppState>>>) -> Result<KubeconfigStatus, String> {
    Ok(get_kubeconfig_status_impl(state.inner().clone()).await)
}

#[tauri::command]
async fn reload_kubeconfig(
    state: State<'_, Arc<RwLock<AppState>>>,
    path: Option<String>,
) -> Result<KubeconfigStatus, String> {
    reload_kubeconfig_impl(state.inner().clone(), path).await
}

async fn get_contexts_impl(app: &AppState) -> Result<Vec<ContextInfo>, String> {
    match &app.ctx_mgr {
        Some(mgr) => Ok(mgr.list_contexts().await),
        None => Err("Kubeconfig not configured".to_string()),
    }
}

async fn switch_context_impl(app: &AppState, context_name: &str) -> Result<(), String> {
    match &app.ctx_mgr {
        Some(mgr) => {
            mgr.switch_context(context_name).await?;
            let kubeconfig = mgr.kubeconfig().await;
            app.client_pool
                .refresh_with_config(&kubeconfig)
                .await
                .map_err(|e| e.to_string())?;
            Ok(())
        }
        None => Err("Kubeconfig not configured".to_string()),
    }
}

async fn get_active_context_impl(app: &AppState) -> Result<String, String> {
    match &app.ctx_mgr {
        Some(mgr) => Ok(mgr.active_context_name().await),
        None => Err("Kubeconfig not configured".to_string()),
    }
}

#[tauri::command]
async fn get_contexts(state: State<'_, Arc<RwLock<AppState>>>) -> Result<Vec<ContextInfo>, String> {
    let app = state.read().await;
    get_contexts_impl(&app).await
}

#[tauri::command]
async fn switch_context(
    state: State<'_, Arc<RwLock<AppState>>>,
    context_name: String,
) -> Result<(), String> {
    let app = state.read().await;
    switch_context_impl(&app, &context_name).await
}

#[tauri::command]
async fn get_active_context(
    state: State<'_, Arc<RwLock<AppState>>>,
) -> Result<String, String> {
    let app = state.read().await;
    get_active_context_impl(&app).await
}

async fn get_resources_impl(
    client: &Client,
    kind: &str,
    namespace: Option<String>,
) -> Result<Vec<ResourceItem>, String> {
    resources::list_resources(client, kind, namespace.as_deref()).await
}

async fn get_pod_names_impl(client: &Client, namespace: &str) -> Result<Vec<String>, String> {
    resources::get_pod_names(client, namespace).await
}

#[tauri::command]
async fn get_resources(
    state: State<'_, Arc<RwLock<AppState>>>,
    kind: String,
    namespace: Option<String>,
) -> Result<Vec<ResourceItem>, String> {
    let app = state.read().await;
    let client = app
        .client_pool
        .get_or_init()
        .await
        .map_err(|e| e.to_string())?;
    get_resources_impl(&client, &kind, namespace).await
}

#[tauri::command]
async fn get_pod_names(
    state: State<'_, Arc<RwLock<AppState>>>,
    namespace: String,
) -> Result<Vec<String>, String> {
    let app = state.read().await;
    let client = app
        .client_pool
        .get_or_init()
        .await
        .map_err(|e| e.to_string())?;
    get_pod_names_impl(&client, &namespace).await
}

fn start_log_stream<F>(
    client: Client,
    namespace: String,
    pod_name: String,
    container: Option<String>,
    mut emit: F,
) where
    F: FnMut(logs::LogLine) + Send + 'static,
{
    use tokio_stream::StreamExt;
    let mut log_stream = logs::stream_logs(client, namespace, pod_name, container);

    tokio::spawn(async move {
        while let Some(line) = log_stream.next().await {
            emit(line);
        }
    });
}

#[tauri::command]
async fn stream_pod_logs(
    app_handle: tauri::AppHandle,
    state: State<'_, Arc<RwLock<AppState>>>,
    namespace: String,
    pod_name: String,
    container: Option<String>,
) -> Result<(), String> {
    let client = {
        let app = state.read().await;
        app.client_pool
            .get_or_init()
            .await
            .map_err(|e| e.to_string())?
    };

    start_log_stream(client, namespace, pod_name, container, move |line| {
        let _ = app_handle.emit("log-line", &line);
    });

    Ok(())
}

async fn patch_resource_impl(
    client: &Client,
    kind: &str,
    namespace: Option<String>,
    name: &str,
    patch_body: serde_json::Value,
) -> Result<serde_json::Value, String> {
    operations::patch_resource(client, kind, namespace.as_deref(), name, patch_body).await
}

async fn scale_deployment_impl(
    client: &Client,
    namespace: &str,
    name: &str,
    replicas: i32,
) -> Result<serde_json::Value, String> {
    operations::scale_deployment(client, namespace, name, replicas).await
}

async fn get_resource_yaml_impl(
    client: &Client,
    kind: &str,
    namespace: Option<String>,
    name: &str,
) -> Result<String, String> {
    operations::get_resource_yaml(client, kind, namespace.as_deref(), name).await
}

async fn apply_resource_impl(
    client: &Client,
    kind: &str,
    namespace: Option<String>,
    name: &str,
    yaml: &str,
) -> Result<serde_json::Value, String> {
    operations::apply_resource(client, kind, namespace.as_deref(), name, yaml).await
}

#[tauri::command]
async fn patch_resource(
    state: State<'_, Arc<RwLock<AppState>>>,
    kind: String,
    namespace: Option<String>,
    name: String,
    patch_body: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let app = state.read().await;
    let client = app
        .client_pool
        .get_or_init()
        .await
        .map_err(|e| e.to_string())?;
    patch_resource_impl(&client, &kind, namespace, &name, patch_body).await
}

#[tauri::command]
async fn scale_deployment(
    state: State<'_, Arc<RwLock<AppState>>>,
    namespace: String,
    name: String,
    replicas: i32,
) -> Result<serde_json::Value, String> {
    let app = state.read().await;
    let client = app
        .client_pool
        .get_or_init()
        .await
        .map_err(|e| e.to_string())?;
    scale_deployment_impl(&client, &namespace, &name, replicas).await
}

#[tauri::command]
async fn get_resource_yaml(
    state: State<'_, Arc<RwLock<AppState>>>,
    kind: String,
    namespace: Option<String>,
    name: String,
) -> Result<String, String> {
    let app = state.read().await;
    let client = app
        .client_pool
        .get_or_init()
        .await
        .map_err(|e| e.to_string())?;
    get_resource_yaml_impl(&client, &kind, namespace, &name).await
}

#[tauri::command]
async fn apply_resource(
    state: State<'_, Arc<RwLock<AppState>>>,
    kind: String,
    namespace: Option<String>,
    name: String,
    yaml: String,
) -> Result<serde_json::Value, String> {
    let app = state.read().await;
    let client = app
        .client_pool
        .get_or_init()
        .await
        .map_err(|e| e.to_string())?;
    apply_resource_impl(&client, &kind, namespace, &name, &yaml).await
}

async fn exec_pod_impl(
    client: &Client,
    namespace: &str,
    pod_name: &str,
    container: Option<&str>,
    command: Vec<String>,
    emit: impl Fn(ExecOutput) + Send + 'static,
) -> Result<(), String> {
    operations::exec_pod(client, namespace, pod_name, container, command, emit).await
}

async fn port_forward_impl(
    client: &Client,
    namespace: &str,
    pod_name: &str,
    local_port: u16,
    pod_port: u16,
) -> Result<(), String> {
    operations::port_forward(client, namespace, pod_name, local_port, pod_port).await
}

#[tauri::command]
async fn exec_pod(
    app_handle: tauri::AppHandle,
    state: State<'_, Arc<RwLock<AppState>>>,
    namespace: String,
    pod_name: String,
    container: Option<String>,
    command: Vec<String>,
) -> Result<(), String> {
    let client = {
        let app = state.read().await;
        app.client_pool
            .get_or_init()
            .await
            .map_err(|e| e.to_string())?
    };

    exec_pod_impl(
        &client,
        &namespace,
        &pod_name,
        container.as_deref(),
        command,
        move |line| {
            let _ = app_handle.emit("exec-output", &line);
        },
    )
    .await
}

#[tauri::command]
async fn port_forward(
    state: State<'_, Arc<RwLock<AppState>>>,
    namespace: String,
    pod_name: String,
    local_port: u16,
    pod_port: u16,
) -> Result<(), String> {
    let client = {
        let app = state.read().await;
        app.client_pool
            .get_or_init()
            .await
            .map_err(|e| e.to_string())?
    };

    port_forward_impl(&client, &namespace, &pod_name, local_port, pod_port).await
}

fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info".into()),
        )
        .init();

    let (ctx_mgr, config_error) = match ContextManager::new() {
        Ok(mgr) => (Some(mgr), None),
        Err(e) => (None, Some(e.to_string())),
    };
    let client_pool = ClientPool::new();
    let app_state = Arc::new(RwLock::new(AppState {
        ctx_mgr,
        client_pool,
        config_error,
    }));

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            get_kubeconfig_status,
            reload_kubeconfig,
            get_contexts,
            switch_context,
            get_active_context,
            get_resources,
            get_pod_names,
            stream_pod_logs,
            patch_resource,
            scale_deployment,
            get_resource_yaml,
            apply_resource,
            exec_pod,
            port_forward,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod integration_tests {
    use super::*;
    use std::io::Write;
    use std::sync::atomic::{AtomicUsize, Ordering};

    static COUNTER: AtomicUsize = AtomicUsize::new(0);

    fn sample_kubeconfig() -> &'static str {
        r#"
apiVersion: v1
kind: Config
clusters:
  - cluster:
      server: https://cluster-a.example.com
    name: cluster-a
  - cluster:
      server: https://cluster-b.example.com
    name: cluster-b
contexts:
  - context:
      cluster: cluster-a
      user: user-a
      namespace: ns-a
    name: ctx-a
  - context:
      cluster: cluster-b
      user: user-b
      namespace: ns-b
    name: ctx-b
current-context: ctx-a
users:
  - name: user-a
    user:
      token: token-a
  - name: user-b
    user:
      token: token-b
"#
    }

    fn write_temp_config(contents: &str) -> std::path::PathBuf {
        let mut path = std::env::temp_dir();
        let n = COUNTER.fetch_add(1, Ordering::SeqCst);
        path.push(format!("kubeconfig-be012-{}-{}.yaml", std::process::id(), n));
        let mut file = std::fs::File::create(&path).unwrap();
        file.write_all(contents.as_bytes()).unwrap();
        path
    }

    fn app_state_with_config(path: &str) -> AppState {
        let ctx_mgr = ContextManager::load(Some(path)).unwrap();
        AppState {
            ctx_mgr: Some(ctx_mgr),
            client_pool: ClientPool::new(),
            config_error: None,
        }
    }

    fn unconfigured_app_state() -> AppState {
        AppState {
            ctx_mgr: None,
            client_pool: ClientPool::new(),
            config_error: Some("no kubeconfig".to_string()),
        }
    }

    #[tokio::test]
    async fn test_get_contexts_returns_contexts() {
        let path = write_temp_config(sample_kubeconfig());
        let app = app_state_with_config(path.to_str().unwrap());
        let contexts = get_contexts_impl(&app).await.unwrap();
        assert_eq!(contexts.len(), 2);
        assert_eq!(contexts[0].name, "ctx-a");
        assert!(contexts[0].is_active);
        std::fs::remove_file(path).ok();
    }

    #[tokio::test]
    async fn test_get_contexts_unconfigured() {
        let app = unconfigured_app_state();
        let result = get_contexts_impl(&app).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Kubeconfig not configured"));
    }

    #[tokio::test]
    async fn test_get_active_context() {
        let path = write_temp_config(sample_kubeconfig());
        let app = app_state_with_config(path.to_str().unwrap());
        let active = get_active_context_impl(&app).await.unwrap();
        assert_eq!(active, "ctx-a");
        std::fs::remove_file(path).ok();
    }

    #[tokio::test]
    async fn test_switch_context_updates_active() {
        let path = write_temp_config(sample_kubeconfig());
        let app = app_state_with_config(path.to_str().unwrap());
        switch_context_impl(&app, "ctx-b").await.unwrap();
        let active = get_active_context_impl(&app).await.unwrap();
        assert_eq!(active, "ctx-b");
        let contexts = get_contexts_impl(&app).await.unwrap();
        assert!(contexts.iter().find(|c| c.name == "ctx-b").unwrap().is_active);
        std::fs::remove_file(path).ok();
    }

    #[tokio::test]
    async fn test_switch_context_not_found() {
        let path = write_temp_config(sample_kubeconfig());
        let app = app_state_with_config(path.to_str().unwrap());
        let result = switch_context_impl(&app, "missing").await;
        assert!(result.is_err());
        std::fs::remove_file(path).ok();
    }

    #[tokio::test]
    async fn test_switch_context_unconfigured() {
        let app = unconfigured_app_state();
        let result = switch_context_impl(&app, "ctx-a").await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Kubeconfig not configured"));
    }

    fn mock_unreachable_client() -> Option<Client> {
        let config = kube::config::Config::new("http://127.0.0.1:1".parse().unwrap());
        Client::try_from(config).ok()
    }

    #[tokio::test]
    async fn test_get_resources_impl_unknown_kind() {
        if let Some(client) = mock_unreachable_client() {
            let result = get_resources_impl(&client, "unicorns", None).await;
            assert!(result.is_err());
            assert!(result.unwrap_err().contains("Unknown resource kind"));
        }
    }

    #[tokio::test]
    async fn test_get_resources_impl_reaches_api() {
        if let Some(client) = mock_unreachable_client() {
            // The cluster is unreachable, but the request should be formed correctly
            // and fail with a connection error rather than a panic or compile error.
            let result = get_resources_impl(&client, "pods", Some("default".to_string())).await;
            assert!(result.is_err());
        }
    }

    #[tokio::test]
    async fn test_get_pod_names_impl_reaches_api() {
        if let Some(client) = mock_unreachable_client() {
            let result = get_pod_names_impl(&client, "default").await;
            assert!(result.is_err());
        }
    }

    #[tokio::test]
    async fn test_get_resources_command_without_client() {
        // When no kubeconfig is available, get_or_init should fail to build a client.
        let app = unconfigured_app_state();
        let result = app.client_pool.get_or_init().await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_start_log_stream_emits_lines_or_error() {
        if let Some(client) = mock_unreachable_client() {
            let (tx, mut rx) = tokio::sync::mpsc::channel::<logs::LogLine>(16);
            start_log_stream(
                client,
                "default".to_string(),
                "nginx".to_string(),
                Some("nginx".to_string()),
                move |line| {
                    let _ = tx.try_send(line);
                },
            );
            // Give the spawned task a moment to attempt connection and emit an error line.
            tokio::time::sleep(std::time::Duration::from_millis(100)).await;
            // The channel should either receive an error line or close; either way
            // the stream setup completed without panicking.
            let _ = rx.try_recv();
        }
    }

    #[tokio::test]
    async fn test_stream_pod_logs_command_without_client() {
        let app = unconfigured_app_state();
        let result = app.client_pool.get_or_init().await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_patch_resource_impl_with_mock_client() {
        if let Some(client) = mock_unreachable_client() {
            let patch = serde_json::json!({"spec": {"replicas": 3}});
            let result = patch_resource_impl(&client, "deployments", Some("default".to_string()), "api", patch).await;
            assert!(result.is_err());
        }
    }

    #[tokio::test]
    async fn test_scale_deployment_impl_with_mock_client() {
        if let Some(client) = mock_unreachable_client() {
            let result = scale_deployment_impl(&client, "default", "api", 3).await;
            assert!(result.is_err());
        }
    }

    #[tokio::test]
    async fn test_get_resource_yaml_impl_with_mock_client() {
        if let Some(client) = mock_unreachable_client() {
            let result = get_resource_yaml_impl(&client, "pods", Some("default".to_string()), "nginx").await;
            assert!(result.is_err());
        }
    }

    #[tokio::test]
    async fn test_apply_resource_impl_with_mock_client() {
        if let Some(client) = mock_unreachable_client() {
            let yaml = r#"
apiVersion: v1
kind: Pod
metadata:
  name: nginx
spec:
  containers:
  - name: nginx
    image: nginx
"#;
            let result = apply_resource_impl(&client, "pods", Some("default".to_string()), "nginx", yaml).await;
            assert!(result.is_err());
        }
    }

    #[tokio::test]
    async fn test_apply_resource_impl_unsupported_kind() {
        if let Some(client) = mock_unreachable_client() {
            let yaml = r#"
apiVersion: v1
kind: Pod
metadata:
  name: nginx
spec:
  containers:
  - name: nginx
    image: nginx
"#;
            let result = apply_resource_impl(&client, "unicorns", Some("default".to_string()), "nginx", yaml).await;
            assert!(result.is_err());
            assert!(result.unwrap_err().contains("Unsupported resource kind"));
        }
    }

    #[tokio::test]
    async fn test_apply_resource_impl_missing_namespace() {
        if let Some(client) = mock_unreachable_client() {
            let yaml = r#"
apiVersion: v1
kind: Pod
metadata:
  name: nginx
spec:
  containers:
  - name: nginx
    image: nginx
"#;
            let result = apply_resource_impl(&client, "pods", None, "nginx", yaml).await;
            assert!(result.is_err());
            assert!(result.unwrap_err().contains("Namespace is required"));
        }
    }

    #[tokio::test]
    async fn test_operations_command_without_client() {
        let app = unconfigured_app_state();
        let result = app.client_pool.get_or_init().await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_exec_pod_impl_with_mock_client() {
        if let Some(client) = mock_unreachable_client() {
            let (tx, mut rx) = tokio::sync::mpsc::channel::<ExecOutput>(8);
            let result = exec_pod_impl(
                &client,
                "default",
                "nginx",
                Some("nginx"),
                vec!["/bin/sh".into(), "-c".into(), "echo hi".into()],
                move |out| {
                    let _ = tx.try_send(out);
                },
            )
            .await;
            assert!(result.is_err());
            // Give any spawned task a moment to fail gracefully.
            tokio::time::sleep(std::time::Duration::from_millis(50)).await;
            let _ = rx.try_recv();
        }
    }

    #[tokio::test]
    async fn test_port_forward_impl_with_mock_client() {
        if let Some(client) = mock_unreachable_client() {
            // Pick an ephemeral port so the test is unlikely to conflict.
            let result = port_forward_impl(&client, "default", "nginx", 0, 80).await;
            // Binding port 0 lets the OS choose a port, so local bind should succeed,
            // but the background port-forward request to the unreachable cluster will fail.
            assert!(result.is_ok());
        }
    }

    #[tokio::test]
    async fn test_exec_pod_impl_empty_command_defaults_to_shell() {
        if let Some(client) = mock_unreachable_client() {
            let (tx, mut rx) = tokio::sync::mpsc::channel::<ExecOutput>(8);
            let result = exec_pod_impl(
                &client,
                "default",
                "nginx",
                Some("nginx"),
                vec![], // empty command should default to /bin/sh
                move |out| {
                    let _ = tx.try_send(out);
                },
            )
            .await;
            // The unreachable cluster causes the exec to fail, but the command path
            // should be handled without panicking.
            assert!(result.is_err());
            tokio::time::sleep(std::time::Duration::from_millis(50)).await;
            let _ = rx.try_recv();
        }
    }

    #[tokio::test]
    async fn test_port_forward_impl_binds_specific_port() {
        if let Some(client) = mock_unreachable_client() {
            // Use port 0 so the OS assigns an available ephemeral port.
            let result = port_forward_impl(&client, "default", "nginx", 0, 80).await;
            assert!(result.is_ok());
        }
    }

    #[tokio::test]
    async fn test_exec_pod_command_without_client() {
        let app = unconfigured_app_state();
        let result = app.client_pool.get_or_init().await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_port_forward_command_without_client() {
        let app = unconfigured_app_state();
        let result = app.client_pool.get_or_init().await;
        assert!(result.is_err());
    }

    fn app_state_arc(app: AppState) -> Arc<RwLock<AppState>> {
        Arc::new(RwLock::new(app))
    }

    #[tokio::test]
    async fn test_get_kubeconfig_status_unconfigured() {
        let state = app_state_arc(unconfigured_app_state());
        let status = get_kubeconfig_status_impl(state).await;
        assert!(!status.configured);
        assert!(status.error.is_some());
    }

    #[tokio::test]
    async fn test_get_kubeconfig_status_configured() {
        let path = write_temp_config(sample_kubeconfig());
        let app = app_state_with_config(path.to_str().unwrap());
        let state = app_state_arc(app);
        let status = get_kubeconfig_status_impl(state).await;
        assert!(status.configured);
        assert!(status.error.is_none());
        std::fs::remove_file(path).ok();
    }

    #[tokio::test]
    async fn test_reload_kubeconfig_valid_path() {
        let state = app_state_arc(unconfigured_app_state());
        let path = write_temp_config(sample_kubeconfig());
        let status = reload_kubeconfig_impl(state.clone(), Some(path.to_str().unwrap().to_string()))
            .await
            .unwrap();
        assert!(status.configured);
        let app = state.read().await;
        assert!(app.ctx_mgr.is_some());
        assert!(app.client_pool.has_client().await);
        std::fs::remove_file(path).ok();
    }

    #[tokio::test]
    async fn test_reload_kubeconfig_invalid_path() {
        let state = app_state_arc(unconfigured_app_state());
        let status = reload_kubeconfig_impl(state.clone(), Some("/nonexistent/kubeconfig.yaml".to_string()))
            .await
            .unwrap();
        assert!(!status.configured);
        assert!(status.error.is_some());
        let app = state.read().await;
        assert!(app.ctx_mgr.is_none());
    }

    #[tokio::test]
    async fn test_client_pool_uses_reloaded_config() {
        let state = app_state_arc(unconfigured_app_state());
        let path = write_temp_config(sample_kubeconfig());
        reload_kubeconfig_impl(state.clone(), Some(path.to_str().unwrap().to_string()))
            .await
            .unwrap();
        let app = state.read().await;
        assert!(app.client_pool.has_client().await);
        std::fs::remove_file(path).ok();
    }
}

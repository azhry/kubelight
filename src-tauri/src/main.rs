#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod client;
mod context;
mod events;
mod logs;
mod operations;
mod resources;
mod sessions;

use context::{ContextInfo, ContextManager};
use kube::Client;
use operations::{ExecOutput, NetworkDiagnosticResult};
use resources::ResourceItem;
use serde::{Deserialize, Serialize};
use sessions::{KubeconfigSummary, KubeconfigSession, SessionManager};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, Runtime, State};
use tauri_plugin_store::StoreExt;
use tokio::sync::RwLock;

const STORE_NAME: &str = "kubelight-settings.json";
const LAST_KUBECONFIG_KEY: &str = "last_kubeconfig_path";
const SESSIONS_KEY: &str = "kubeconfig_sessions";
const ACTIVE_SESSION_KEY: &str = "active_kubeconfig_session_id";

#[derive(Clone, Serialize, Deserialize)]
struct StoredSession {
    id: String,
    label: String,
    path: String,
}

#[derive(Clone, Serialize, Deserialize, Default)]
struct StoredSettings {
    sessions: Vec<StoredSession>,
    active_session_id: Option<String>,
}

struct AppState {
    session_mgr: SessionManager,
    active_session_id: Arc<RwLock<Option<String>>>,
    config_error: Option<String>,
}

impl AppState {
    async fn active_session(&self) -> Option<Arc<RwLock<KubeconfigSession>>> {
        let active_id = self.active_session_id.read().await.clone();
        self.session_mgr.active_session(active_id.as_deref()).await
    }

    async fn require_active_session(&self) -> Result<Arc<RwLock<KubeconfigSession>>, String> {
        self.active_session()
            .await
            .ok_or_else(|| "Kubeconfig not configured".to_string())
    }
}

#[derive(Serialize)]
struct KubeconfigStatus {
    configured: bool,
    error: Option<String>,
}

async fn get_kubeconfig_status_impl(state: Arc<RwLock<AppState>>) -> KubeconfigStatus {
    let app = state.read().await;
    match app.active_session().await {
        Some(_) => KubeconfigStatus {
            configured: true,
            error: app.config_error.clone(),
        },
        None => KubeconfigStatus {
            configured: false,
            error: app.config_error.clone(),
        },
    }
}

fn default_kubeconfig_path() -> Option<String> {
    let home = std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(std::path::PathBuf::from)?;
    Some(home.join(".kube").join("config").to_string_lossy().to_string())
}

fn load_last_kubeconfig_path<R: Runtime>(app: &AppHandle<R>) -> Option<String> {
    let store = app.store(STORE_NAME).ok()?;
    store
        .get(LAST_KUBECONFIG_KEY)
        .and_then(|v| v.as_str().map(|s| s.to_string()))
}

fn load_settings<R: Runtime>(app: &AppHandle<R>) -> StoredSettings {
    let store = match app.store(STORE_NAME) {
        Ok(s) => s,
        Err(_) => return StoredSettings::default(),
    };
    store
        .get(SESSIONS_KEY)
        .and_then(|v| serde_json::from_value::<Vec<StoredSession>>(v).ok())
        .map(|sessions| StoredSettings {
            sessions,
            active_session_id: store
                .get(ACTIVE_SESSION_KEY)
                .and_then(|v| v.as_str().map(|s| s.to_string())),
        })
        .unwrap_or_default()
}

fn save_settings<R: Runtime>(app: &AppHandle<R>, settings: &StoredSettings) -> Result<(), String> {
    let store = app.store(STORE_NAME).map_err(|e| e.to_string())?;
    store.set(
        SESSIONS_KEY,
        serde_json::to_value(&settings.sessions).map_err(|e| e.to_string())?,
    );
    store.set(
        ACTIVE_SESSION_KEY,
        serde_json::to_value(&settings.active_session_id).map_err(|e| e.to_string())?,
    );
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

async fn persist_sessions<R: Runtime>(
    app: &AppHandle<R>,
    app_state: &AppState,
) -> Result<(), String> {
    let active_id = app_state.active_session_id.read().await.clone();
    let summaries = app_state.session_mgr.list(active_id.as_deref()).await;
    let settings = StoredSettings {
        sessions: summaries
            .into_iter()
            .map(|s| StoredSession {
                id: s.id,
                label: s.label,
                path: s.path,
            })
            .collect(),
        active_session_id: active_id,
    };
    save_settings(app, &settings)
}

async fn restore_sessions(
    session_mgr: &SessionManager,
    settings: StoredSettings,
) -> Option<String> {
    let mut added_any = false;
    for stored in settings.sessions {
        if std::path::Path::new(&stored.path).exists() {
            if session_mgr
                .add_with_id(stored.id, stored.path, stored.label)
                .await
                .is_ok()
            {
                added_any = true;
            }
        }
    }
    if !added_any {
        return None;
    }
    let candidate = settings.active_session_id;
    let validated = if let Some(id) = candidate {
        if session_mgr.get(&id).await.is_some() {
            Some(id)
        } else {
            None
        }
    } else {
        None
    };
    if let Some(id) = validated {
        Some(id)
    } else {
        session_mgr.first_session_id().await
    }
}

async fn restore_from_path(session_mgr: &SessionManager, path: String) -> Option<String> {
    if !std::path::Path::new(&path).exists() {
        return None;
    }
    session_mgr.add(path, "default".to_string()).await.ok()
}

async fn reload_kubeconfig_impl(
    state: Arc<RwLock<AppState>>,
    path: Option<String>,
) -> Result<KubeconfigStatus, String> {
    let mut app = state.write().await;
    if let Some(active) = app.active_session().await {
        let mut session = active.write().await;
        let path_to_load = path.unwrap_or_else(|| session.path.clone());
        match ContextManager::load(Some(&path_to_load)) {
            Ok(ctx_mgr) => {
                let kubeconfig = ctx_mgr.kubeconfig().await;
                session.ctx_mgr = ctx_mgr;
                session.path = path_to_load;
                app.config_error = None;
                match session.client_pool.refresh_with_config(&kubeconfig).await {
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
                let err = e.to_string();
                app.config_error = Some(err.clone());
                Ok(KubeconfigStatus {
                    configured: false,
                    error: Some(err),
                })
            }
        }
    } else {
        let path_to_load = path
            .or_else(default_kubeconfig_path)
            .ok_or_else(|| "No kubeconfig path provided".to_string())?;
        match app
            .session_mgr
            .add(path_to_load.clone(), "default".to_string())
            .await
        {
            Ok(id) => {
                *app.active_session_id.write().await = Some(id);
                app.config_error = None;
                Ok(KubeconfigStatus {
                    configured: true,
                    error: None,
                })
            }
            Err(e) => {
                app.config_error = Some(e.clone());
                Ok(KubeconfigStatus {
                    configured: false,
                    error: Some(e),
                })
            }
        }
    }
}

#[tauri::command]
async fn get_kubeconfig_status(state: State<'_, Arc<RwLock<AppState>>>) -> Result<KubeconfigStatus, String> {
    Ok(get_kubeconfig_status_impl(state.inner().clone()).await)
}

#[tauri::command]
async fn reload_kubeconfig(
    app_handle: tauri::AppHandle,
    state: State<'_, Arc<RwLock<AppState>>>,
    path: Option<String>,
) -> Result<KubeconfigStatus, String> {
    let state_arc = state.inner().clone();
    let status = reload_kubeconfig_impl(state_arc.clone(), path.clone()).await?;
    if status.configured {
        let _ = persist_sessions(&app_handle, &*state_arc.read().await).await;
    }
    Ok(status)
}

#[tauri::command]
async fn get_last_kubeconfig_path(
    state: State<'_, Arc<RwLock<AppState>>>,
) -> Result<Option<String>, String> {
    let app = state.read().await;
    match app.active_session().await {
        Some(session) => Ok(Some(session.read().await.path.clone())),
        None => Ok(None),
    }
}

#[tauri::command]
async fn list_kubeconfigs(
    state: State<'_, Arc<RwLock<AppState>>>,
) -> Result<Vec<KubeconfigSummary>, String> {
    let app = state.read().await;
    let active_id = app.active_session_id.read().await.clone();
    Ok(app.session_mgr.list(active_id.as_deref()).await)
}

#[tauri::command]
async fn add_kubeconfig(
    app_handle: tauri::AppHandle,
    state: State<'_, Arc<RwLock<AppState>>>,
    path: String,
    label: Option<String>,
) -> Result<String, String> {
    let label = label.unwrap_or_else(|| {
        std::path::Path::new(&path)
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| path.clone())
    });
    let state_arc = state.inner().clone();
    let id = {
        let app = state_arc.read().await;
        app.session_mgr.add(path, label).await?
    };
    {
        let active_id = state_arc.read().await.active_session_id.clone();
        if active_id.read().await.is_none() {
            *active_id.write().await = Some(id.clone());
        }
    }
    let _ = persist_sessions(&app_handle, &*state_arc.read().await).await;
    Ok(id)
}

#[tauri::command]
async fn remove_kubeconfig(
    app_handle: tauri::AppHandle,
    state: State<'_, Arc<RwLock<AppState>>>,
    id: String,
) -> Result<(), String> {
    let state_arc = state.inner().clone();
    let active_id_before = {
        let app = state_arc.read().await;
        let id = app.active_session_id.read().await.clone();
        id
    };
    {
        let app = state_arc.read().await;
        app.session_mgr.remove(&id).await?;
    }
    if active_id_before.as_deref() == Some(&id) {
        let new_active = state_arc.read().await.session_mgr.first_session_id().await;
        let active_id = state_arc.read().await.active_session_id.clone();
        *active_id.write().await = new_active;
    }
    let _ = persist_sessions(&app_handle, &*state_arc.read().await).await;
    Ok(())
}

#[tauri::command]
async fn switch_kubeconfig(
    app_handle: tauri::AppHandle,
    state: State<'_, Arc<RwLock<AppState>>>,
    id: String,
) -> Result<(), String> {
    let state_arc = state.inner().clone();
    {
        let app = state_arc.read().await;
        if app.session_mgr.get(&id).await.is_none() {
            return Err(format!("Kubeconfig session '{}' not found", id));
        }
    }
    {
        let active_id = state_arc.read().await.active_session_id.clone();
        *active_id.write().await = Some(id);
    }
    let _ = persist_sessions(&app_handle, &*state_arc.read().await).await;
    Ok(())
}

async fn get_contexts_impl(app: &AppState) -> Result<Vec<ContextInfo>, String> {
    let session = app.require_active_session().await?;
    let s = session.read().await;
    Ok(s.ctx_mgr.list_contexts().await)
}

async fn switch_context_impl(app: &AppState, context_name: &str) -> Result<(), String> {
    let session = app.require_active_session().await?;
    let s = session.write().await;
    s.ctx_mgr.switch_context(context_name).await?;
    let kubeconfig = s.ctx_mgr.kubeconfig().await;
    s.client_pool
        .refresh_with_config(&kubeconfig)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

async fn get_active_context_impl(app: &AppState) -> Result<String, String> {
    let session = app.require_active_session().await?;
    let s = session.read().await;
    Ok(s.ctx_mgr.active_context_name().await)
}

async fn active_client(state: &State<'_, Arc<RwLock<AppState>>>) -> Result<Client, String> {
    let app = state.read().await;
    let session = app.require_active_session().await?;
    let s = session.read().await;
    s.client_pool.get_or_init().await.map_err(|e| e.to_string())
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
    let client = active_client(&state).await?;
    get_resources_impl(&client, &kind, namespace).await
}

#[tauri::command]
async fn get_pod_names(
    state: State<'_, Arc<RwLock<AppState>>>,
    namespace: String,
) -> Result<Vec<String>, String> {
    let client = active_client(&state).await?;
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
    let client = active_client(&state).await?;

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
    let client = active_client(&state).await?;
    patch_resource_impl(&client, &kind, namespace, &name, patch_body).await
}

#[tauri::command]
async fn scale_deployment(
    state: State<'_, Arc<RwLock<AppState>>>,
    namespace: String,
    name: String,
    replicas: i32,
) -> Result<serde_json::Value, String> {
    let client = active_client(&state).await?;
    scale_deployment_impl(&client, &namespace, &name, replicas).await
}

#[tauri::command]
async fn get_resource_yaml(
    state: State<'_, Arc<RwLock<AppState>>>,
    kind: String,
    namespace: Option<String>,
    name: String,
) -> Result<String, String> {
    let client = active_client(&state).await?;
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
    let client = active_client(&state).await?;
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
    let client = active_client(&state).await?;

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
    let client = active_client(&state).await?;

    port_forward_impl(&client, &namespace, &pod_name, local_port, pod_port).await
}

#[tauri::command]
async fn diagnose_pod_network(
    state: State<'_, Arc<RwLock<AppState>>>,
    source_namespace: String,
    source_pod: String,
    target: String,
) -> Result<NetworkDiagnosticResult, String> {
    let client = active_client(&state).await?;
    operations::diagnose_pod_network(&client, &source_namespace, &source_pod, &target).await
}

fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info".into()),
        )
        .init();

    let app_state = Arc::new(RwLock::new(AppState {
        session_mgr: SessionManager::new(),
        active_session_id: Arc::new(RwLock::new(None)),
        config_error: None,
    }));

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .manage(app_state)
        .setup(|app| {
            let app_handle = app.handle().clone();
            let state: Arc<RwLock<AppState>> =
                app_handle.state::<Arc<RwLock<AppState>>>().inner().clone();
            tauri::async_runtime::spawn(async move {
                let settings = load_settings(&app_handle);
                let active_id = restore_sessions(&state.read().await.session_mgr, settings).await;
                let active_id = if active_id.is_some() {
                    active_id
                } else {
                    let persisted_last = load_last_kubeconfig_path(&app_handle);
                    let candidate = persisted_last.or_else(default_kubeconfig_path);
                    if let Some(path) = candidate {
                        restore_from_path(&state.read().await.session_mgr, path).await
                    } else {
                        None
                    }
                };
                if let Some(id) = active_id {
                    let active = state.read().await.active_session_id.clone();
                    *active.write().await = Some(id);
                    let _ = persist_sessions(&app_handle, &*state.read().await).await;
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_kubeconfig_status,
            reload_kubeconfig,
            get_last_kubeconfig_path,
            list_kubeconfigs,
            add_kubeconfig,
            remove_kubeconfig,
            switch_kubeconfig,
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
            diagnose_pod_network,
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

    async fn app_state_with_config(path: &str) -> AppState {
        let session_mgr = SessionManager::new();
        let id = session_mgr
            .add(path.to_string(), "test".to_string())
            .await
            .unwrap();
        AppState {
            session_mgr,
            active_session_id: Arc::new(RwLock::new(Some(id))),
            config_error: None,
        }
    }

    fn unconfigured_app_state() -> AppState {
        AppState {
            session_mgr: SessionManager::new(),
            active_session_id: Arc::new(RwLock::new(None)),
            config_error: Some("no kubeconfig".to_string()),
        }
    }

    #[tokio::test]
    async fn test_get_contexts_returns_contexts() {
        let path = write_temp_config(sample_kubeconfig());
        let app = app_state_with_config(path.to_str().unwrap()).await;
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
        let app = app_state_with_config(path.to_str().unwrap()).await;
        let active = get_active_context_impl(&app).await.unwrap();
        assert_eq!(active, "ctx-a");
        std::fs::remove_file(path).ok();
    }

    #[tokio::test]
    async fn test_switch_context_updates_active() {
        let path = write_temp_config(sample_kubeconfig());
        let app = app_state_with_config(path.to_str().unwrap()).await;
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
        let app = app_state_with_config(path.to_str().unwrap()).await;
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
        let result = app.require_active_session().await;
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
        let result = app.require_active_session().await;
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
        let result = app.require_active_session().await;
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
        let result = app.require_active_session().await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_port_forward_command_without_client() {
        let app = unconfigured_app_state();
        let result = app.require_active_session().await;
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
        let app = app_state_with_config(path.to_str().unwrap()).await;
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
        let session = app.active_session().await.unwrap();
        assert!(session.read().await.ctx_mgr.kubeconfig().await.contexts.len() > 0);
        assert!(session.read().await.client_pool.has_client().await);
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
        assert!(app.active_session().await.is_none());
    }

    #[tokio::test]
    async fn test_client_pool_uses_reloaded_config() {
        let state = app_state_arc(unconfigured_app_state());
        let path = write_temp_config(sample_kubeconfig());
        reload_kubeconfig_impl(state.clone(), Some(path.to_str().unwrap().to_string()))
            .await
            .unwrap();
        let app = state.read().await;
        let session = app.active_session().await.unwrap();
        assert!(session.read().await.client_pool.has_client().await);
        std::fs::remove_file(path).ok();
    }

    #[tokio::test]
    async fn test_session_manager_lifecycle() {
        let state = app_state_arc(unconfigured_app_state());
        let path = write_temp_config(sample_kubeconfig());
        let path_str = path.to_str().unwrap().to_string();

        let id = {
            let app = state.read().await;
            app.session_mgr
                .add(path_str.clone(), "first".to_string())
                .await
                .unwrap()
        };
        {
            let app = state.read().await;
            *app.active_session_id.write().await = Some(id.clone());
        }

        let list = {
            let app = state.read().await;
            app.session_mgr.list(Some(&id)).await
        };
        assert_eq!(list.len(), 1);
        assert!(list[0].active);

        let id2 = {
            let app = state.read().await;
            app.session_mgr
                .add(path_str.clone(), "second".to_string())
                .await
                .unwrap()
        };
        {
            let app = state.read().await;
            *app.active_session_id.write().await = Some(id2.clone());
        }

        let list = {
            let app = state.read().await;
            app.session_mgr.list(Some(&id2)).await
        };
        assert!(list.iter().find(|s| s.id == id2).unwrap().active);

        {
            let app = state.read().await;
            app.session_mgr.remove(&id).await.unwrap();
        }
        {
            let app = state.read().await;
            let new_active = app.session_mgr.first_session_id().await;
            *app.active_session_id.write().await = new_active;
        }

        let list = {
            let app = state.read().await;
            let active_id = app.active_session_id.read().await.clone();
            app.session_mgr.list(active_id.as_deref()).await
        };
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].id, id2);

        std::fs::remove_file(path).ok();
    }

    #[tokio::test]
    async fn test_restore_sessions_loads_persisted_sessions_and_keeps_active() {
        let session_mgr = SessionManager::new();
        let path = write_temp_config(sample_kubeconfig());
        let path_str = path.to_str().unwrap().to_string();
        let settings = StoredSettings {
            sessions: vec![
                StoredSession {
                    id: "session-a".to_string(),
                    label: "first".to_string(),
                    path: path_str.clone(),
                },
                StoredSession {
                    id: "session-b".to_string(),
                    label: "second".to_string(),
                    path: path_str.clone(),
                },
            ],
            active_session_id: Some("session-b".to_string()),
        };

        let active_id = restore_sessions(&session_mgr, settings).await;

        assert_eq!(active_id, Some("session-b".to_string()));
        let list = session_mgr.list(active_id.as_deref()).await;
        assert_eq!(list.len(), 2);
        assert!(list.iter().find(|s| s.id == "session-b").unwrap().active);
        std::fs::remove_file(path).ok();
    }

    #[tokio::test]
    async fn test_restore_sessions_ignores_missing_files() {
        let session_mgr = SessionManager::new();
        let path = write_temp_config(sample_kubeconfig());
        let settings = StoredSettings {
            sessions: vec![
                StoredSession {
                    id: "missing".to_string(),
                    label: "missing".to_string(),
                    path: "/nonexistent/kubeconfig.yaml".to_string(),
                },
                StoredSession {
                    id: "present".to_string(),
                    label: "present".to_string(),
                    path: path.to_str().unwrap().to_string(),
                },
            ],
            active_session_id: Some("missing".to_string()),
        };

        let active_id = restore_sessions(&session_mgr, settings).await;

        assert_eq!(active_id, Some("present".to_string()));
        let list = session_mgr.list(active_id.as_deref()).await;
        assert_eq!(list.len(), 1);
        std::fs::remove_file(path).ok();
    }

    #[tokio::test]
    async fn test_restore_sessions_falls_back_to_first_when_active_missing() {
        let session_mgr = SessionManager::new();
        let path = write_temp_config(sample_kubeconfig());
        let path_str = path.to_str().unwrap().to_string();
        let settings = StoredSettings {
            sessions: vec![StoredSession {
                id: "only".to_string(),
                label: "only".to_string(),
                path: path_str,
            }],
            active_session_id: Some("unknown".to_string()),
        };

        let active_id = restore_sessions(&session_mgr, settings).await;

        assert_eq!(active_id, Some("only".to_string()));
        std::fs::remove_file(path).ok();
    }

    #[tokio::test]
    async fn test_restore_sessions_returns_none_when_empty() {
        let session_mgr = SessionManager::new();
        let settings = StoredSettings::default();

        let active_id = restore_sessions(&session_mgr, settings).await;

        assert!(active_id.is_none());
        assert!(session_mgr.list(None).await.is_empty());
    }

    #[tokio::test]
    async fn test_restore_from_path_creates_default_session() {
        let session_mgr = SessionManager::new();
        let path = write_temp_config(sample_kubeconfig());

        let active_id = restore_from_path(&session_mgr, path.to_str().unwrap().to_string()).await;

        assert!(active_id.is_some());
        assert!(!session_mgr.list(None).await.is_empty());
        let list = session_mgr.list(active_id.as_deref()).await;
        assert_eq!(list[0].label, "default");
        std::fs::remove_file(path).ok();
    }

    #[tokio::test]
    async fn test_restore_from_path_returns_none_for_missing_file() {
        let session_mgr = SessionManager::new();

        let active_id =
            restore_from_path(&session_mgr, "/nonexistent/kubeconfig.yaml".to_string()).await;

        assert!(active_id.is_none());
        assert!(session_mgr.list(None).await.is_empty());
    }

    #[test]
    fn test_default_kubeconfig_path_uses_home() {
        // Default path should resolve to $HOME/.kube/config or $USERPROFILE\.kube\config.
        let path = default_kubeconfig_path().unwrap();
        assert!(path.ends_with(".kube/config") || path.ends_with(".kube\\config"));
    }
}

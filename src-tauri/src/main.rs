#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod client;
mod context;
mod events;
mod logs;
mod operations;
mod resources;

use client::ClientPool;
use context::{ContextInfo, ContextManager};
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

#[tauri::command]
async fn get_kubeconfig_status(state: State<'_, Arc<RwLock<AppState>>>) -> Result<KubeconfigStatus, String> {
    let app = state.read().await;
    Ok(KubeconfigStatus {
        configured: app.ctx_mgr.is_some(),
        error: app.config_error.clone(),
    })
}

#[tauri::command]
async fn reload_kubeconfig(
    state: State<'_, Arc<RwLock<AppState>>>,
    path: Option<String>,
) -> Result<KubeconfigStatus, String> {
    let mut app = state.write().await;
    match ContextManager::load(path.as_deref()) {
        Ok(ctx_mgr) => {
            app.ctx_mgr = Some(ctx_mgr);
            app.config_error = None;
            let _ = app.client_pool.refresh().await;
            Ok(KubeconfigStatus {
                configured: true,
                error: None,
            })
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
async fn get_contexts(state: State<'_, Arc<RwLock<AppState>>>) -> Result<Vec<ContextInfo>, String> {
    let app = state.read().await;
    match &app.ctx_mgr {
        Some(mgr) => Ok(mgr.list_contexts().await),
        None => Err("Kubeconfig not configured".to_string()),
    }
}

#[tauri::command]
async fn switch_context(
    state: State<'_, Arc<RwLock<AppState>>>,
    context_name: String,
) -> Result<(), String> {
    let app = state.read().await;
    match &app.ctx_mgr {
        Some(mgr) => {
            mgr.switch_context(&context_name).await?;
            app.client_pool.refresh().await.map_err(|e| e.to_string())?;
            Ok(())
        }
        None => Err("Kubeconfig not configured".to_string()),
    }
}

#[tauri::command]
async fn get_active_context(
    state: State<'_, Arc<RwLock<AppState>>>,
) -> Result<String, String> {
    let app = state.read().await;
    match &app.ctx_mgr {
        Some(mgr) => Ok(mgr.active_context_name().await),
        None => Err("Kubeconfig not configured".to_string()),
    }
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
    resources::list_resources(&client, &kind, namespace.as_deref()).await
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
    resources::get_pod_names(&client, &namespace).await
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

    use tokio_stream::StreamExt;
    let mut log_stream = logs::stream_logs(client, namespace, pod_name, container);

    tokio::spawn(async move {
        while let Some(line) = log_stream.next().await {
            let _ = app_handle.emit("log-line", &line);
        }
    });

    Ok(())
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
    operations::patch_resource(&client, &kind, namespace.as_deref(), &name, patch_body).await
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
    operations::scale_deployment(&client, &namespace, &name, replicas).await
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
    operations::get_resource_yaml(&client, &kind, namespace.as_deref(), &name).await
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

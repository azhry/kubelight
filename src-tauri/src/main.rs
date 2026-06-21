#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod client;
mod context;
mod events;
mod resources;

use client::ClientPool;
use context::{ContextInfo, ContextManager};
use resources::ResourceItem;
use std::sync::Arc;
use tauri::State;
use tokio::sync::RwLock;

struct AppState {
    ctx_mgr: ContextManager,
    client_pool: ClientPool,
}

#[tauri::command]
async fn get_contexts(state: State<'_, Arc<RwLock<AppState>>>) -> Result<Vec<ContextInfo>, String> {
    let app = state.read().await;
    Ok(app.ctx_mgr.list_contexts().await)
}

#[tauri::command]
async fn switch_context(
    state: State<'_, Arc<RwLock<AppState>>>,
    context_name: String,
) -> Result<(), String> {
    let app = state.read().await;
    app.ctx_mgr.switch_context(&context_name).await?;
    app.client_pool.refresh().await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn get_active_context(
    state: State<'_, Arc<RwLock<AppState>>>,
) -> Result<String, String> {
    let app = state.read().await;
    Ok(app.ctx_mgr.active_context_name().await)
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

fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info".into()),
        )
        .init();

    let ctx_mgr = ContextManager::new().expect("Failed to load kubeconfig");
    let client_pool = ClientPool::new();
    let app_state = Arc::new(RwLock::new(AppState {
        ctx_mgr,
        client_pool,
    }));

    tauri::Builder::default()
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            get_contexts,
            switch_context,
            get_active_context,
            get_resources,
            get_pod_names,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

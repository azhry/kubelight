use crate::client::ClientPool;
use crate::context::ContextManager;
use serde::Serialize;
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Clone, Serialize)]
pub struct KubeconfigSummary {
    pub id: String,
    pub label: String,
    pub path: String,
    pub active: bool,
}

pub struct KubeconfigSession {
    pub id: String,
    pub label: String,
    pub path: String,
    pub ctx_mgr: ContextManager,
    pub client_pool: ClientPool,
}

#[derive(Clone, Default)]
pub struct SessionManager {
    sessions: Arc<RwLock<Vec<Arc<RwLock<KubeconfigSession>>>>>,
}

impl SessionManager {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(RwLock::new(Vec::new())),
        }
    }

    pub async fn add(&self, path: String, label: String) -> Result<String, String> {
        let ctx_mgr = ContextManager::load(Some(&path)).map_err(|e| e.to_string())?;
        let client_pool = ClientPool::new();
        let kubeconfig = ctx_mgr.kubeconfig().await;
        client_pool
            .refresh_with_config(&kubeconfig)
            .await
            .map_err(|e| e.to_string())?;
        let id = uuid::Uuid::new_v4().to_string();
        let session = Arc::new(RwLock::new(KubeconfigSession {
            id: id.clone(),
            label,
            path,
            ctx_mgr,
            client_pool,
        }));
        self.sessions.write().await.push(session);
        Ok(id)
    }

    pub async fn add_with_id(
        &self,
        id: String,
        path: String,
        label: String,
    ) -> Result<String, String> {
        let ctx_mgr = ContextManager::load(Some(&path)).map_err(|e| e.to_string())?;
        let client_pool = ClientPool::new();
        let kubeconfig = ctx_mgr.kubeconfig().await;
        client_pool
            .refresh_with_config(&kubeconfig)
            .await
            .map_err(|e| e.to_string())?;
        let session = Arc::new(RwLock::new(KubeconfigSession {
            id: id.clone(),
            label,
            path,
            ctx_mgr,
            client_pool,
        }));
        self.sessions.write().await.push(session);
        Ok(id)
    }

    pub async fn remove(&self, id: &str) -> Result<(), String> {
        let mut sessions = self.sessions.write().await;
        let mut pos = None;
        for (i, s) in sessions.iter().enumerate() {
            if s.read().await.id == id {
                pos = Some(i);
                break;
            }
        }
        let pos = pos.ok_or_else(|| format!("Session '{}' not found", id))?;
        sessions.remove(pos);
        Ok(())
    }

    pub async fn get(&self, id: &str) -> Option<Arc<RwLock<KubeconfigSession>>> {
        let sessions = self.sessions.read().await;
        for s in sessions.iter() {
            if s.read().await.id == id {
                return Some(s.clone());
            }
        }
        None
    }

    pub async fn list(&self, active_id: Option<&str>) -> Vec<KubeconfigSummary> {
        let sessions = self.sessions.read().await;
        let mut summaries = Vec::new();
        for session in sessions.iter() {
            let s = session.read().await;
            summaries.push(KubeconfigSummary {
                id: s.id.clone(),
                label: s.label.clone(),
                path: s.path.clone(),
                active: active_id == Some(s.id.as_str()),
            });
        }
        summaries
    }

    pub async fn active_session(
        &self,
        active_id: Option<&str>,
    ) -> Option<Arc<RwLock<KubeconfigSession>>> {
        match active_id {
            Some(id) => self.get(id).await,
            None => self.sessions.read().await.first().cloned(),
        }
    }

    pub async fn first_session_id(&self) -> Option<String> {
        let sessions = self.sessions.read().await;
        if let Some(s) = sessions.first() {
            return Some(s.read().await.id.clone());
        }
        None
    }
}

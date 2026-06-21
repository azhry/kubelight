use kube::config::KubeconfigError;
use kube::config::Kubeconfig;
use serde::Serialize;
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Debug, Clone, Serialize)]
pub struct ContextInfo {
    pub name: String,
    pub cluster: String,
    pub user: String,
    pub current_namespace: String,
    pub is_active: bool,
}

pub struct ContextManager {
    config: Arc<RwLock<Kubeconfig>>,
    active_context: Arc<RwLock<String>>,
}

impl ContextManager {
    pub fn new() -> Result<Self, KubeconfigError> {
        let kubeconfig = Kubeconfig::from_env()?
            .ok_or(KubeconfigError::FindPath)?;
        Self::from_kubeconfig(kubeconfig)
    }

    pub fn load(path: Option<&str>) -> Result<Self, KubeconfigError> {
        let kubeconfig = match path {
            Some(p) => Kubeconfig::read_from(std::path::Path::new(p))?,
            None => Kubeconfig::from_env()?
                .ok_or(KubeconfigError::FindPath)?,
        };
        Self::from_kubeconfig(kubeconfig)
    }

    fn from_kubeconfig(kubeconfig: Kubeconfig) -> Result<Self, KubeconfigError> {
        let active = kubeconfig
            .current_context
            .clone()
            .unwrap_or_default();
        Ok(Self {
            config: Arc::new(RwLock::new(kubeconfig)),
            active_context: Arc::new(RwLock::new(active)),
        })
    }

    pub async fn list_contexts(&self) -> Vec<ContextInfo> {
        let config = self.config.read().await;
        let active = self.active_context.read().await;
        config
            .contexts
            .iter()
            .map(|ctx| {
                let name = ctx.name.clone();
                let c = ctx.context.as_ref();
                ContextInfo {
                    is_active: name == *active,
                    cluster: c.map(|c| c.cluster.clone()).unwrap_or_default(),
                    user: c
                        .and_then(|c| c.user.clone())
                        .unwrap_or_default(),
                    current_namespace: c
                        .and_then(|c| c.namespace.clone())
                        .unwrap_or_else(|| "default".into()),
                    name,
                }
            })
            .collect()
    }

    pub async fn switch_context(&self, context_name: &str) -> Result<(), String> {
        let mut config = self.config.write().await;
        let exists = config.contexts.iter().any(|c| c.name == context_name);
        if !exists {
            return Err(format!("Context '{}' not found in kubeconfig", context_name));
        }
        config.current_context = Some(context_name.to_string());
        let mut active = self.active_context.write().await;
        *active = context_name.to_string();
        Ok(())
    }

    pub async fn active_context_name(&self) -> String {
        self.active_context.read().await.clone()
    }

    pub async fn kubeconfig(&self) -> Kubeconfig {
        self.config.read().await.clone()
    }

    #[allow(dead_code)]
    pub async fn active_namespace(&self) -> String {
        let config = self.config.read().await;
        let active = self.active_context.read().await;
        config
            .contexts
            .iter()
            .find(|c| c.name == *active)
            .and_then(|c| c.context.as_ref())
            .and_then(|c| c.namespace.clone())
            .unwrap_or_else(|| "default".into())
    }
}

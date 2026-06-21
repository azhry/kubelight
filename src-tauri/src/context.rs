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

#[cfg(test)]
mod tests {
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
        path.push(format!("kubeconfig-{}-{}.yaml", std::process::id(), n));
        let mut file = std::fs::File::create(&path).unwrap();
        file.write_all(contents.as_bytes()).unwrap();
        path
    }

    #[tokio::test]
    async fn test_load_valid_kubeconfig() {
        let path = write_temp_config(sample_kubeconfig());
        let mgr = ContextManager::load(Some(path.to_str().unwrap()));
        assert!(mgr.is_ok());
        let mgr = mgr.unwrap();
        assert_eq!(mgr.active_context_name().await, "ctx-a");
        std::fs::remove_file(path).ok();
    }

    #[test]
    fn test_load_missing_file() {
        let result = ContextManager::load(Some("/nonexistent/kubeconfig.yaml"));
        assert!(result.is_err());
    }

    #[test]
    fn test_load_invalid_yaml() {
        let path = write_temp_config("apiVersion: v1\nkind: Config\ncontexts:\n  - bad\n");
        let result = ContextManager::load(Some(path.to_str().unwrap()));
        assert!(result.is_err());
        std::fs::remove_file(path).ok();
    }

    #[tokio::test]
    async fn test_list_contexts() {
        let path = write_temp_config(sample_kubeconfig());
        let mgr = ContextManager::load(Some(path.to_str().unwrap())).unwrap();
        let contexts = mgr.list_contexts().await;
        assert_eq!(contexts.len(), 2);
        assert_eq!(contexts[0].name, "ctx-a");
        assert_eq!(contexts[0].cluster, "cluster-a");
        assert_eq!(contexts[0].user, "user-a");
        assert_eq!(contexts[0].current_namespace, "ns-a");
        assert!(contexts[0].is_active);
        assert!(!contexts[1].is_active);
        std::fs::remove_file(path).ok();
    }

    #[tokio::test]
    async fn test_switch_context() {
        let path = write_temp_config(sample_kubeconfig());
        let mgr = ContextManager::load(Some(path.to_str().unwrap())).unwrap();
        mgr.switch_context("ctx-b").await.unwrap();
        assert_eq!(mgr.active_context_name().await, "ctx-b");
        let contexts = mgr.list_contexts().await;
        assert!(!contexts[0].is_active);
        assert!(contexts[1].is_active);
        std::fs::remove_file(path).ok();
    }

    #[tokio::test]
    async fn test_switch_context_not_found() {
        let path = write_temp_config(sample_kubeconfig());
        let mgr = ContextManager::load(Some(path.to_str().unwrap())).unwrap();
        let result = mgr.switch_context("missing").await;
        assert!(result.is_err());
        std::fs::remove_file(path).ok();
    }

    #[tokio::test]
    async fn test_kubeconfig_accessor() {
        let path = write_temp_config(sample_kubeconfig());
        let mgr = ContextManager::load(Some(path.to_str().unwrap())).unwrap();
        let config = mgr.kubeconfig().await;
        assert_eq!(config.current_context, Some("ctx-a".to_string()));
        assert_eq!(config.contexts.len(), 2);
        std::fs::remove_file(path).ok();
    }
}

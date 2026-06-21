use kube::Client;
use kube::config::{Config, Kubeconfig};
use std::sync::Arc;
use tokio::sync::RwLock;

pub struct ClientPool {
    current: Arc<RwLock<Option<Client>>>,
}

impl ClientPool {
    pub fn new() -> Self {
        Self {
            current: Arc::new(RwLock::new(None)),
        }
    }

    pub async fn get_or_init(&self) -> Result<Client, kube::Error> {
        let mut guard = self.current.write().await;
        if let Some(client) = guard.as_ref() {
            return Ok(client.clone());
        }
        let client = Client::try_default().await?;
        *guard = Some(client.clone());
        Ok(client)
    }

    pub async fn refresh_with_config(&self, kubeconfig: &Kubeconfig) -> Result<Client, String> {
        let config = Config::from_custom_kubeconfig(kubeconfig.clone(), &Default::default())
            .await
            .map_err(|e| e.to_string())?;
        let client = Client::try_from(config).map_err(|e| e.to_string())?;
        let mut guard = self.current.write().await;
        *guard = Some(client.clone());
        Ok(client)
    }

    #[allow(dead_code)]
    pub async fn has_client(&self) -> bool {
        self.current.read().await.is_some()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use kube::config::Kubeconfig;

    fn sample_kubeconfig() -> Kubeconfig {
        let yaml = r#"
apiVersion: v1
kind: Config
clusters:
  - cluster:
      server: https://test.example.com
    name: test-cluster
contexts:
  - context:
      cluster: test-cluster
      user: test-user
    name: test-ctx
current-context: test-ctx
users:
  - name: test-user
    user:
      token: test-token
"#;
        Kubeconfig::from_yaml(yaml).unwrap()
    }

    #[tokio::test]
    async fn test_client_pool_starts_empty() {
        let pool = ClientPool::new();
        assert!(!pool.has_client().await);
    }

    #[tokio::test]
    async fn test_refresh_with_config_sets_client() {
        let pool = ClientPool::new();
        let kubeconfig = sample_kubeconfig();
        let result = pool.refresh_with_config(&kubeconfig).await;
        assert!(result.is_ok());
        assert!(pool.has_client().await);
    }

    #[tokio::test]
    async fn test_refresh_with_config_keeps_client() {
        let pool = ClientPool::new();
        let kubeconfig = sample_kubeconfig();
        let first = pool.refresh_with_config(&kubeconfig).await.unwrap();
        let second = pool.refresh_with_config(&kubeconfig).await.unwrap();
        // Both should be valid Client instances.
        let _ = (first, second);
        assert!(pool.has_client().await);
    }
}

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
}

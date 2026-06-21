use kube::Client;
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

    pub async fn refresh(&self) -> Result<Client, kube::Error> {
        let client = Client::try_default().await?;
        let mut guard = self.current.write().await;
        *guard = Some(client.clone());
        Ok(client)
    }

}

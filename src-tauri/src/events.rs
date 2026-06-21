use futures::StreamExt;
use k8s_openapi::api::core::v1::Event;
use kube::api::{Api, WatchEvent, WatchParams};
use kube::Client;
use serde::Serialize;
use std::pin::Pin;
use tokio::sync::mpsc;
use tokio_stream::wrappers::ReceiverStream;
use tokio_stream::Stream;

#[derive(Debug, Clone, Serialize)]
pub struct KubeEvent {
    pub kind: String,
    pub name: String,
    pub namespace: String,
    pub reason: String,
    pub message: String,
    pub event_type: String,
}

#[allow(dead_code)]
pub fn stream_events(
    client: Client,
    namespace: Option<String>,
) -> Pin<Box<dyn Stream<Item = KubeEvent> + Send>> {
    let (tx, rx) = mpsc::channel::<KubeEvent>(256);
    let api: Api<Event> = match namespace {
        Some(ref ns) => Api::namespaced(client, ns),
        None => Api::all(client),
    };

    tokio::spawn(async move {
        let wp = WatchParams::default();
        let stream = match api.watch(&wp, "0").await {
            Ok(s) => s,
            Err(e) => {
                let _ = tx
                    .send(KubeEvent {
                        kind: "Error".into(),
                        name: String::new(),
                        namespace: namespace.clone().unwrap_or_default(),
                        reason: "WatchFailed".into(),
                        message: e.to_string(),
                        event_type: "Error".into(),
                    })
                    .await;
                return;
            }
        };

        tokio::pin!(stream);

        while let Some(result) = stream.next().await {
            match result {
                Ok(WatchEvent::Added(ev)) => {
                    send_event(&tx, &ev, "ADDED", &namespace).await;
                }
                Ok(WatchEvent::Modified(ev)) => {
                    send_event(&tx, &ev, "MODIFIED", &namespace).await;
                }
                Ok(WatchEvent::Deleted(ev)) => {
                    send_event(&tx, &ev, "DELETED", &namespace).await;
                }
                Ok(WatchEvent::Bookmark(_)) => {}
                Ok(WatchEvent::Error(e)) => {
                    let _ = tx
                        .send(KubeEvent {
                            kind: "Error".into(),
                            name: String::new(),
                            namespace: namespace.clone().unwrap_or_default(),
                            reason: "WatchError".into(),
                            message: format!("{:?}", e),
                            event_type: "Error".into(),
                        })
                        .await;
                }
                Err(_) => break,
            }
        }
    });

    Box::pin(ReceiverStream::new(rx))
}

async fn send_event(
    tx: &mpsc::Sender<KubeEvent>,
    ev: &Event,
    event_type: &str,
    namespace: &Option<String>,
) {
    let _ = tx
        .send(KubeEvent {
            kind: "Event".into(),
            name: ev.metadata.name.clone().unwrap_or_default(),
            namespace: ev.metadata.namespace.clone().unwrap_or_default(),
            reason: ev.reason.clone().unwrap_or_default(),
            message: ev.message.clone().unwrap_or_default(),
            event_type: event_type.into(),
        })
        .await;
}

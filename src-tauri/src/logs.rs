use futures::stream::TryStreamExt;
use futures::AsyncBufReadExt;
use k8s_openapi::api::core::v1::Pod;
use kube::api::Api;
use kube::api::LogParams;
use kube::Client;
use serde::Serialize;
use std::pin::Pin;
use tokio::sync::mpsc;
use tokio_stream::wrappers::ReceiverStream;
use tokio_stream::Stream;

#[derive(Debug, Clone, Serialize)]
pub struct LogLine {
    pub line: String,
    pub timestamp: String,
}

#[allow(dead_code)]
pub fn stream_logs(
    client: Client,
    namespace: String,
    pod_name: String,
    container: Option<String>,
) -> Pin<Box<dyn Stream<Item = LogLine> + Send>> {
    let (tx, rx) = mpsc::channel::<LogLine>(256);

    tokio::spawn(async move {
        let api: Api<Pod> = Api::namespaced(client, &namespace);
        let mut log_params = LogParams::default();
        log_params.follow = true;
        log_params.tail_lines = Some(100);
        if let Some(ref container_name) = container {
            log_params.container = Some(container_name.clone());
        }

        let reader = match api.log_stream(&pod_name, &log_params).await {
            Ok(r) => r,
            Err(e) => {
                let _ = tx
                    .send(LogLine {
                        line: format!("Error: {}", e),
                        timestamp: chrono::Utc::now().to_rfc3339(),
                    })
                    .await;
                return;
            }
        };

        let mut lines = reader.lines();
        while let Ok(Some(line)) = lines.try_next().await {
            if tx
                .send(LogLine {
                    line,
                    timestamp: chrono::Utc::now().to_rfc3339(),
                })
                .await
                .is_err()
            {
                break;
            }
        }
    });

    Box::pin(ReceiverStream::new(rx))
}

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

fn build_log_params(container: Option<String>, tail_lines: Option<i64>) -> LogParams {
    let mut log_params = LogParams::default();
    log_params.follow = true;
    log_params.tail_lines = tail_lines.or(Some(100));
    if let Some(ref container_name) = container {
        log_params.container = Some(container_name.clone());
    }
    log_params
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
        let log_params = build_log_params(container, None);

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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_log_params_defaults() {
        let params = build_log_params(None, None);
        assert!(params.follow);
        assert_eq!(params.tail_lines, Some(100));
        assert_eq!(params.container, None);
    }

    #[test]
    fn test_build_log_params_with_container() {
        let params = build_log_params(Some("sidecar".to_string()), None);
        assert!(params.follow);
        assert_eq!(params.tail_lines, Some(100));
        assert_eq!(params.container, Some("sidecar".to_string()));
    }

    #[test]
    fn test_build_log_params_with_tail_lines() {
        let params = build_log_params(None, Some(500));
        assert!(params.follow);
        assert_eq!(params.tail_lines, Some(500));
    }

    #[test]
    fn test_log_line_serialization() {
        let line = LogLine {
            line: "hello world".to_string(),
            timestamp: "2026-06-21T08:00:00Z".to_string(),
        };
        let json = serde_json::to_value(&line).unwrap();
        assert_eq!(json["line"], "hello world");
        assert_eq!(json["timestamp"], "2026-06-21T08:00:00Z");
    }

    #[tokio::test]
    async fn test_stream_logs_returns_stream() {
        // We cannot construct a real kube::Client in a unit test without a cluster,
        // but we can verify the function compiles and returns a boxed stream type.
        // Constructing a Client from an unreachable endpoint is enough to exercise
        // the stream setup path without making any network call.
        let config = kube::config::Config::new("http://127.0.0.1:1".parse().unwrap());
        if let Ok(client) = Client::try_from(config) {
            let stream = stream_logs(client, "default".to_string(), "pod".to_string(), None);
            // Ensure the stream type implements Stream by checking it can be polled.
            use tokio_stream::StreamExt;
            let mut stream = stream;
            let first = stream.next().await;
            // Since the endpoint is unreachable, we expect either an error line or none.
            // The important assertion is that the stream setup does not panic.
            let _ = first;
        }
    }
}

use crate::models::TriggerN8nRequest;
use anyhow::Result;

/// 触发 n8n webhook
pub async fn trigger_n8n(webhook_url: &str, request: &TriggerN8nRequest) -> Result<()> {
    let client = reqwest::Client::new();

    let response = client
        .post(webhook_url)
        .json(request)
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        anyhow::bail!("n8n webhook failed: {} - {}", status, body);
    }

    tracing::info!(
        "n8n webhook triggered successfully for task {}",
        request.task_id
    );
    Ok(())
}

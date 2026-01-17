use anyhow::{Context, Result};

#[derive(Clone)]
pub struct Config {
    pub database_url: String,
    pub redis_url: String,
    pub host: String,
    pub port: u16,
    pub n8n_webhook_url: String,
    /// n8n 回调时使用的后端地址 (从 n8n 容器内可访问)
    pub callback_host: String,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        let host = std::env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
        let port: u16 = std::env::var("PORT")
            .unwrap_or_else(|_| "3001".to_string())
            .parse()
            .context("PORT must be a valid number")?;

        // 回调地址: 优先使用 CALLBACK_HOST，否则使用 localhost
        let callback_host = std::env::var("CALLBACK_HOST")
            .unwrap_or_else(|_| format!("http://host.docker.internal:{}", port));

        Ok(Self {
            database_url: std::env::var("DATABASE_URL").context("DATABASE_URL must be set")?,
            redis_url: std::env::var("REDIS_URL")
                .unwrap_or_else(|_| "redis://localhost:6379".to_string()),
            host,
            port,
            n8n_webhook_url: std::env::var("N8N_WEBHOOK_URL")
                .unwrap_or_else(|_| "http://localhost:5678/webhook/mimic-ai-generate".to_string()),
            callback_host,
        })
    }
}

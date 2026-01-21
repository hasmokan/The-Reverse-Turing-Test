use anyhow::{Context, Result};

#[derive(Clone)]
pub struct Config {
    pub database_url: String,
    pub redis_url: String,
    pub host: String,
    pub port: u16,
    pub n8n_webhook_url: String,
    pub callback_base_url: String,
    pub ai_generation_enabled: bool,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        Ok(Self {
            database_url: std::env::var("DATABASE_URL").context("DATABASE_URL must be set")?,
            redis_url: std::env::var("REDIS_URL")
                .unwrap_or_else(|_| "redis://localhost:6379".to_string()),
            host: std::env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string()),
            port: std::env::var("PORT")
                .unwrap_or_else(|_| "3001".to_string())
                .parse()
                .context("PORT must be a valid number")?,
            n8n_webhook_url: std::env::var("N8N_WEBHOOK_URL")
                .unwrap_or_else(|_| "http://localhost:5678/webhook/mimic-ai-generate".to_string()),
            callback_base_url: std::env::var("CALLBACK_BASE_URL")
                .unwrap_or_else(|_| "http://backend:3001".to_string()),
            ai_generation_enabled: std::env::var("AI_GENERATION_ENABLED")
                .map(|v| v.to_lowercase() == "true")
                .unwrap_or(false),
        })
    }
}

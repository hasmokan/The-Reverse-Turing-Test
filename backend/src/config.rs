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
    pub single_player_allow_duplicates_max_level: i32,
    pub image_storage_backend: String,
    pub s3_root: String,
    pub s3_bucket: Option<String>,
    pub s3_region: Option<String>,
    pub s3_endpoint: Option<String>,
    pub s3_access_key_id: Option<String>,
    pub s3_secret_access_key: Option<String>,
    pub wechat_mp_appid: Option<String>,
    pub wechat_mp_secret: Option<String>,
    pub auth_token_ttl_days: i64,
    pub dev_auth_enabled: bool,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        let image_storage_backend =
            std::env::var("IMAGE_STORAGE_BACKEND").unwrap_or_else(|_| "db".to_string());
        let s3_enabled = image_storage_backend == "s3";
        let wechat_enabled = std::env::var("WECHAT_MP_ENABLED")
            .map(|v| v.to_lowercase() == "true")
            .unwrap_or(false);

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
            single_player_allow_duplicates_max_level: std::env::var(
                "SINGLE_PLAYER_ALLOW_DUPLICATES_MAX_LEVEL",
            )
            .unwrap_or_else(|_| "1".to_string())
            .parse()
            .context("SINGLE_PLAYER_ALLOW_DUPLICATES_MAX_LEVEL must be a valid number")?,
            image_storage_backend,
            s3_root: std::env::var("S3_ROOT").unwrap_or_else(|_| "/".to_string()),
            s3_bucket: if s3_enabled {
                Some(std::env::var("S3_BUCKET").context("S3_BUCKET must be set")?)
            } else {
                None
            },
            s3_region: if s3_enabled {
                Some(std::env::var("S3_REGION").context("S3_REGION must be set")?)
            } else {
                None
            },
            s3_endpoint: if s3_enabled {
                Some(std::env::var("S3_ENDPOINT").context("S3_ENDPOINT must be set")?)
            } else {
                None
            },
            s3_access_key_id: if s3_enabled {
                Some(std::env::var("S3_ACCESS_KEY_ID").context("S3_ACCESS_KEY_ID must be set")?)
            } else {
                None
            },
            s3_secret_access_key: if s3_enabled {
                Some(
                    std::env::var("S3_SECRET_ACCESS_KEY")
                        .context("S3_SECRET_ACCESS_KEY must be set")?,
                )
            } else {
                None
            },
            wechat_mp_appid: if wechat_enabled {
                Some(std::env::var("WECHAT_MP_APPID").context("WECHAT_MP_APPID must be set")?)
            } else {
                None
            },
            wechat_mp_secret: if wechat_enabled {
                Some(std::env::var("WECHAT_MP_SECRET").context("WECHAT_MP_SECRET must be set")?)
            } else {
                None
            },
            auth_token_ttl_days: std::env::var("AUTH_TOKEN_TTL_DAYS")
                .unwrap_or_else(|_| "30".to_string())
                .parse()
                .context("AUTH_TOKEN_TTL_DAYS must be a valid number")?,
            dev_auth_enabled: std::env::var("DEV_AUTH_ENABLED")
                .map(|v| v.to_lowercase() == "true")
                .unwrap_or(false),
        })
    }
}

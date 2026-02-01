use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, FromRow)]
pub struct AuthIdentity {
    pub provider: String,
    pub appid: Option<String>,
    pub unionid: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthIdentitySummary {
    pub provider: String,
    pub appid: Option<String>,
    pub unionid: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthMeResponse {
    pub user_id: Uuid,
    pub identities: Vec<AuthIdentitySummary>,
}

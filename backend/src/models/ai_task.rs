use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AiTaskStatus {
    Pending,
    Generating,
    Completed,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct AiTask {
    pub id: Uuid,
    pub room_id: Uuid,
    pub drawing_id: Option<Uuid>,
    pub status: String,
    pub n8n_execution_id: Option<String>,
    pub prompt: Option<String>,
    pub keyword: Option<String>,
    pub image_data: Option<String>,
    pub generated_name: Option<String>,
    pub generated_description: Option<String>,
    pub error_message: Option<String>,
    pub retry_count: i32,
    pub created_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
}

/// n8n 回调请求
#[derive(Debug, Deserialize)]
pub struct N8nCallbackRequest {
    pub task_id: Uuid,
    pub status: String,
    #[serde(default)]
    pub image_data: Option<String>,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub error_message: Option<String>,
}

/// 触发 n8n 的请求体
#[derive(Debug, Serialize)]
pub struct TriggerN8nRequest {
    pub room_id: Uuid,
    pub task_id: Uuid,
    pub theme: TriggerN8nTheme,
    pub callback_url: String,
}

#[derive(Debug, Serialize)]
pub struct TriggerN8nTheme {
    pub palette: Vec<String>,
    pub keywords: Vec<String>,
    pub prompt_style: String,
}

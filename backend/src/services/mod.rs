pub mod game_logic;
pub mod n8n_client;
pub mod room_manager;

use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use deadpool_redis::Pool as RedisPool;
use sqlx::PgPool;
use uuid::Uuid;

use crate::config::Config;
use crate::models::{Drawing, Room, Theme, TriggerN8nRequest, TriggerN8nTheme};

pub use n8n_client::*;

/// 应用共享状态
pub struct AppState {
    pub db: PgPool,
    pub redis: RedisPool,
    pub config: Config,
}

impl AppState {
    pub fn new(db: PgPool, redis: RedisPool, config: Config) -> Self {
        Self { db, redis, config }
    }

    /// 触发 AI 生成
    pub async fn trigger_ai_generation(&self, room_id: Uuid, theme: &Theme) {
        let task_id = Uuid::new_v4();

        // 创建任务记录
        if let Err(e) =
            sqlx::query("INSERT INTO ai_tasks (id, room_id, status) VALUES ($1, $2, 'pending')")
                .bind(task_id)
                .bind(room_id)
                .execute(&self.db)
                .await
        {
            tracing::error!("Failed to create AI task: {}", e);
            return;
        }

        // 构造请求
        let palette: Vec<String> =
            serde_json::from_value(theme.palette.clone()).unwrap_or_default();
        let keywords: Vec<String> =
            serde_json::from_value(theme.ai_keywords.clone()).unwrap_or_default();

        let callback_url = format!(
            "http://{}:{}/api/n8n/callback",
            self.config.host, self.config.port
        );

        let request = TriggerN8nRequest {
            room_id,
            task_id,
            theme: TriggerN8nTheme {
                palette,
                keywords,
                prompt_style: theme.ai_prompt_style.clone(),
            },
            callback_url,
        };

        // 异步触发 n8n
        let webhook_url = self.config.n8n_webhook_url.clone();
        tokio::spawn(async move {
            if let Err(e) = trigger_n8n(&webhook_url, &request).await {
                tracing::error!("Failed to trigger n8n: {}", e);
            }
        });

        tracing::info!("AI generation triggered for room {}", room_id);
    }

    /// 淘汰绘画
    pub async fn eliminate_drawing(
        &self,
        room: &Room,
        drawing: &Drawing,
    ) -> Result<bool, ApiError> {
        // 标记为已淘汰
        sqlx::query(
            "UPDATE drawings SET is_eliminated = TRUE, eliminated_at = NOW() WHERE id = $1",
        )
        .bind(drawing.id)
        .execute(&self.db)
        .await?;

        // 如果是 AI 被淘汰，减少 AI 计数
        if drawing.is_ai {
            sqlx::query("UPDATE rooms SET ai_count = ai_count - 1 WHERE id = $1")
                .bind(room.id)
                .execute(&self.db)
                .await?;
        }

        // Socket.IO 广播将由调用方通过 SocketIo 实例完成
        tracing::info!(
            "Drawing {} eliminated from room {}",
            drawing.id,
            room.room_code
        );
        Ok(true)
    }

    /// 触发游戏结束
    pub async fn trigger_game_over(&self, room: &Room) -> Result<(), ApiError> {
        // 更新房间状态
        sqlx::query("UPDATE rooms SET status = 'gameover' WHERE id = $1")
            .bind(room.id)
            .execute(&self.db)
            .await?;

        tracing::info!("Game over in room {}: AI overrun", room.room_code);
        Ok(())
    }
}

/// API 错误类型
#[derive(Debug)]
pub enum ApiError {
    NotFound(String),
    BadRequest(String),
    Internal(String),
}

impl From<sqlx::Error> for ApiError {
    fn from(e: sqlx::Error) -> Self {
        tracing::error!("Database error: {}", e);
        ApiError::Internal("Database error".to_string())
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, message) = match self {
            ApiError::NotFound(msg) => (StatusCode::NOT_FOUND, msg),
            ApiError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg),
            ApiError::Internal(msg) => (StatusCode::INTERNAL_SERVER_ERROR, msg),
        };

        let body = serde_json::json!({ "error": message });
        (status, Json(body)).into_response()
    }
}

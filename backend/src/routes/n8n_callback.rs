use axum::{extract::State, Json};
use chrono::Utc;
use std::sync::Arc;
use uuid::Uuid;

use crate::models::N8nCallbackRequest;
use crate::services::{ApiError, AppState};

/// POST /api/n8n/callback - AI 生成完成回调
/// 
/// 新逻辑：生成的 AI 鱼加入 Redis 队列，而不是直接创建 drawing
/// drawing 的创建在 drawings.rs 的 create_drawing 中触发
#[axum::debug_handler]
pub async fn callback(
    State(state): State<Arc<AppState>>,
    Json(req): Json<N8nCallbackRequest>,
) -> Result<Json<CallbackResponse>, ApiError> {
    tracing::info!("n8n callback received for task {}", req.task_id);

    // 获取任务
    let task: crate::models::AiTask = sqlx::query_as("SELECT * FROM ai_tasks WHERE id = $1")
        .bind(req.task_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(ApiError::NotFound("Task not found".to_string()))?;

    if req.status == "completed" {
        // 成功：将 AI 鱼数据加入队列
        let image_data = req
            .image_data
            .ok_or(ApiError::BadRequest("Missing image_data".to_string()))?;
        let name = req.name.unwrap_or_else(|| "小东西".to_string());
        let description = req.description;

        // 构造鱼数据加入队列
        let fish_data = serde_json::json!({
            "image_data": image_data,
            "name": name,
            "description": description
        });
        
        // 加入 Redis 队列（供后续使用）
        state.push_ai_fish_to_queue(task.room_id, &fish_data).await;

        // 更新任务状态
        sqlx::query(
            "UPDATE ai_tasks SET status = 'completed', image_data = $1, generated_name = $2, generated_description = $3, completed_at = $4 WHERE id = $5",
        )
        .bind(&image_data)
        .bind(&name)
        .bind(&description)
        .bind(Utc::now())
        .bind(req.task_id)
        .execute(&state.db)
        .await?;

        tracing::info!("AI fish added to queue for room {}", task.room_id);
        Ok(Json(CallbackResponse {
            success: true,
            drawing_id: None, // 不再直接创建 drawing
            message: "AI fish added to queue".to_string(),
        }))
    } else {
        // 失败：更新任务状态
        sqlx::query(
            "UPDATE ai_tasks SET status = 'failed', error_message = $1, retry_count = retry_count + 1 WHERE id = $2",
        )
        .bind(&req.error_message)
        .bind(req.task_id)
        .execute(&state.db)
        .await?;

        tracing::warn!("AI task failed: {:?}", req.error_message);
        Ok(Json(CallbackResponse {
            success: false,
            drawing_id: None,
            message: req
                .error_message
                .unwrap_or_else(|| "Unknown error".to_string()),
        }))
    }
}

#[derive(serde::Serialize)]
pub struct CallbackResponse {
    pub success: bool,
    pub drawing_id: Option<Uuid>,
    pub message: String,
}

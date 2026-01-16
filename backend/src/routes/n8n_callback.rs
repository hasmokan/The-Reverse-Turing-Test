use axum::{extract::State, Json};
use chrono::Utc;
use std::sync::Arc;
use uuid::Uuid;

use crate::models::{Drawing, N8nCallbackRequest, Room};
use crate::services::{ApiError, AppState};

/// POST /api/n8n/callback - AI 生成完成回调
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
        // 成功：创建 AI 绘画
        let image_data = req
            .image_data
            .ok_or(ApiError::BadRequest("Missing image_data".to_string()))?;
        let name = req.name.unwrap_or_else(|| "小东西".to_string());
        let description = req.description;

        // 获取房间
        let room: Room = sqlx::query_as("SELECT * FROM rooms WHERE id = $1")
            .bind(task.room_id)
            .fetch_one(&state.db)
            .await?;

        // 随机位置 (使用 StdRng 以满足 Send)
        use rand::{rngs::StdRng, Rng, SeedableRng};
        let mut rng = StdRng::from_entropy();
        let position_x: f64 = rng.gen_range(0.2..0.8);
        let position_y: f64 = rng.gen_range(0.2..0.8);
        let velocity_x: f64 = rng.gen_range(-0.02..0.02);
        let velocity_y: f64 = rng.gen_range(-0.02..0.02);
        let flip_x = rng.gen_bool(0.5);

        let drawing_id = Uuid::new_v4();

        // 创建 AI 绘画
        let drawing: Drawing = sqlx::query_as(
            r#"
            INSERT INTO drawings (
                id, room_id, is_ai, image_data, name, description, author_name,
                position_x, position_y, velocity_x, velocity_y, flip_x
            )
            VALUES ($1, $2, TRUE, $3, $4, $5, 'AI画家', $6, $7, $8, $9, $10)
            RETURNING *
            "#,
        )
        .bind(drawing_id)
        .bind(task.room_id)
        .bind(&image_data)
        .bind(&name)
        .bind(&description)
        .bind(position_x)
        .bind(position_y)
        .bind(velocity_x)
        .bind(velocity_y)
        .bind(flip_x)
        .fetch_one(&state.db)
        .await?;

        // 更新任务状态
        sqlx::query(
            "UPDATE ai_tasks SET status = 'completed', drawing_id = $1, image_data = $2, generated_name = $3, generated_description = $4, completed_at = $5 WHERE id = $6",
        )
        .bind(drawing_id)
        .bind(&image_data)
        .bind(&name)
        .bind(&description)
        .bind(Utc::now())
        .bind(req.task_id)
        .execute(&state.db)
        .await?;

        // 更新房间 AI 计数
        let new_ai_count: i32 = sqlx::query_scalar(
            "UPDATE rooms SET ai_count = ai_count + 1, total_items = total_items + 1, updated_at = NOW() WHERE id = $1 RETURNING ai_count",
        )
        .bind(task.room_id)
        .fetch_one(&state.db)
        .await?;

        // 更新浑浊度
        let theme: crate::models::Theme = sqlx::query_as("SELECT * FROM themes WHERE id = $1")
            .bind(room.theme_id)
            .fetch_one(&state.db)
            .await?;

        let turbidity = (new_ai_count as f64) / (theme.max_imposters as f64);
        sqlx::query("UPDATE rooms SET turbidity = $1 WHERE id = $2")
            .bind(turbidity.min(1.0))
            .bind(task.room_id)
            .execute(&state.db)
            .await?;

        // 注意: Socket.IO 广播由 socketio_handler 处理
        // AI 绘画创建后，前端通过 sync:state 事件获取更新

        // 检查是否达到 max_imposters
        if new_ai_count >= theme.max_imposters {
            state.trigger_game_over(&room).await?;
        }

        tracing::info!("AI drawing created: {}", drawing_id);
        Ok(Json(CallbackResponse {
            success: true,
            drawing_id: Some(drawing_id),
            message: "AI drawing created".to_string(),
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

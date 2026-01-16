use axum::{
    extract::{Path, State},
    Json,
};
use rand::{rngs::StdRng, Rng, SeedableRng};
use std::sync::Arc;
use uuid::Uuid;

use crate::models::{
    CreateDrawingRequest, Drawing, DrawingResponse, ReportRequest, Room, Theme, VoteRequest,
};
use crate::services::{ApiError, AppState};

/// POST /api/rooms/:room_code/drawings - 提交绘画
#[axum::debug_handler]
pub async fn create_drawing(
    State(state): State<Arc<AppState>>,
    Path(room_code): Path<String>,
    Json(req): Json<CreateDrawingRequest>,
) -> Result<Json<DrawingResponse>, ApiError> {
    // 验证房间
    let room: Room = sqlx::query_as("SELECT * FROM rooms WHERE room_code = $1")
        .bind(&room_code)
        .fetch_optional(&state.db)
        .await?
        .ok_or(ApiError::NotFound(format!("Room {} not found", room_code)))?;

    if room.status != "active" {
        return Err(ApiError::BadRequest("Room is not active".to_string()));
    }

    // 获取主题配置
    let theme: Theme = sqlx::query_as("SELECT * FROM themes WHERE id = $1")
        .bind(room.theme_id)
        .fetch_one(&state.db)
        .await?;

    // 随机初始位置和速度 (使用 StdRng 以满足 Send)
    let mut rng = StdRng::from_entropy();
    let position_x: f64 = rng.gen_range(0.2..0.8);
    let position_y: f64 = rng.gen_range(0.2..0.8);
    let velocity_x: f64 = rng.gen_range(-0.02..0.02);
    let velocity_y: f64 = rng.gen_range(-0.02..0.02);
    let flip_x = rng.gen_bool(0.5);

    let drawing_id = Uuid::new_v4();
    let name = if req.name.chars().count() > 8 {
        req.name.chars().take(8).collect()
    } else {
        req.name.clone()
    };

    // 插入绘画
    let drawing: Drawing = sqlx::query_as(
        r#"
        INSERT INTO drawings (
            id, room_id, is_ai, image_data, name, description, author_name,
            position_x, position_y, velocity_x, velocity_y, flip_x, session_id
        )
        VALUES ($1, $2, FALSE, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
        "#,
    )
    .bind(drawing_id)
    .bind(room.id)
    .bind(&req.image_data)
    .bind(&name)
    .bind(&req.description)
    .bind(&req.author_name)
    .bind(position_x)
    .bind(position_y)
    .bind(velocity_x)
    .bind(velocity_y)
    .bind(flip_x)
    .bind(&req.session_id)
    .fetch_one(&state.db)
    .await?;

    // 更新房间计数
    let new_total: i32 = sqlx::query_scalar(
        "UPDATE rooms SET total_items = total_items + 1, updated_at = NOW() WHERE id = $1 RETURNING total_items",
    )
    .bind(room.id)
    .fetch_one(&state.db)
    .await?;

    // 检查是否需要触发 AI 生成
    if new_total % theme.spawn_rate == 0 {
        state.trigger_ai_generation(room.id, &theme).await;
    }

    // 注意: Socket.IO 广播由 socketio_handler 处理
    // 前端创建作品后应通过 Socket.IO emit 通知其他玩家

    Ok(Json(drawing.into()))
}

/// GET /api/drawings/:drawing_id - 获取作品详情 (含 image_data)
pub async fn get_drawing(
    State(state): State<Arc<AppState>>,
    Path(drawing_id): Path<Uuid>,
) -> Result<Json<DrawingResponse>, ApiError> {
    let drawing: Drawing = sqlx::query_as("SELECT * FROM drawings WHERE id = $1")
        .bind(drawing_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(ApiError::NotFound("Drawing not found".to_string()))?;

    if drawing.is_hidden {
        return Err(ApiError::NotFound("Drawing not found".to_string()));
    }

    Ok(Json(drawing.into()))
}

/// POST /api/drawings/:drawing_id/vote - 投票
pub async fn vote_drawing(
    State(state): State<Arc<AppState>>,
    Path(drawing_id): Path<Uuid>,
    Json(req): Json<VoteRequest>,
) -> Result<Json<VoteResponse>, ApiError> {
    // 验证绘画存在
    let drawing: Drawing = sqlx::query_as("SELECT * FROM drawings WHERE id = $1")
        .bind(drawing_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(ApiError::NotFound("Drawing not found".to_string()))?;

    if drawing.is_eliminated {
        return Err(ApiError::BadRequest(
            "Drawing already eliminated".to_string(),
        ));
    }

    // 尝试插入投票记录 (利用 UNIQUE 约束防止重复投票)
    let result = sqlx::query(
        "INSERT INTO votes (drawing_id, session_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
    )
    .bind(drawing_id)
    .bind(&req.session_id)
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(ApiError::BadRequest("Already voted".to_string()));
    }

    // 更新投票计数
    let new_count: i32 = sqlx::query_scalar(
        "UPDATE drawings SET vote_count = vote_count + 1, updated_at = NOW() WHERE id = $1 RETURNING vote_count",
    )
    .bind(drawing_id)
    .fetch_one(&state.db)
    .await?;

    // 获取房间检查是否达到淘汰阈值
    let room: Room = sqlx::query_as("SELECT * FROM rooms WHERE id = $1")
        .bind(drawing.room_id)
        .fetch_one(&state.db)
        .await?;

    let room_code = room.room_code.clone();
    let threshold = room.vote_threshold();

    // 注意: Socket.IO 广播由 socketio_handler 的 vote:cast 事件处理

    // 检查是否需要淘汰
    let mut eliminated = false;
    if new_count >= threshold {
        eliminated = state.eliminate_drawing(&room, &drawing).await?;
    }

    Ok(Json(VoteResponse {
        vote_count: new_count,
        threshold,
        eliminated,
    }))
}

/// POST /api/drawings/:drawing_id/report - 举报
pub async fn report_drawing(
    State(state): State<Arc<AppState>>,
    Path(drawing_id): Path<Uuid>,
    Json(req): Json<ReportRequest>,
) -> Result<Json<ReportResponse>, ApiError> {
    // 验证绘画存在
    let _drawing: Drawing = sqlx::query_as("SELECT * FROM drawings WHERE id = $1")
        .bind(drawing_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(ApiError::NotFound("Drawing not found".to_string()))?;

    // 插入举报记录
    let result = sqlx::query(
        "INSERT INTO reports (drawing_id, session_id, reason) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
    )
    .bind(drawing_id)
    .bind(&req.session_id)
    .bind(&req.reason)
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(ApiError::BadRequest("Already reported".to_string()));
    }

    // 更新举报计数
    let new_count: i32 = sqlx::query_scalar(
        "UPDATE drawings SET report_count = report_count + 1, updated_at = NOW() WHERE id = $1 RETURNING report_count",
    )
    .bind(drawing_id)
    .fetch_one(&state.db)
    .await?;

    // 超过3次举报自动隐藏
    if new_count >= 3 {
        sqlx::query("UPDATE drawings SET is_hidden = TRUE WHERE id = $1")
            .bind(drawing_id)
            .execute(&state.db)
            .await?;
    }

    Ok(Json(ReportResponse {
        report_count: new_count,
        hidden: new_count >= 3,
    }))
}

#[derive(serde::Serialize)]
pub struct VoteResponse {
    pub vote_count: i32,
    pub threshold: i32,
    pub eliminated: bool,
}

#[derive(serde::Serialize)]
pub struct ReportResponse {
    pub report_count: i32,
    pub hidden: bool,
}

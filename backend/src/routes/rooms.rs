use axum::{
    extract::{Path, State},
    Json,
};
use rand::Rng;
use std::sync::Arc;
use uuid::Uuid;

use crate::models::{
    CreateRoomRequest, DrawingItemRow, DrawingListItem, Room, RoomResponse, Theme, ThemeResponse,
};
use crate::services::{ApiError, AppState};

/// POST /api/rooms - 创建房间
pub async fn create_room(
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateRoomRequest>,
) -> Result<Json<RoomWithTheme>, ApiError> {
    // 查找主题
    let theme: Theme = sqlx::query_as("SELECT * FROM themes WHERE theme_id = $1")
        .bind(&req.theme_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(ApiError::NotFound(format!(
            "Theme {} not found",
            req.theme_id
        )))?;

    // 生成房间码 (6位数字字母)
    let room_code = generate_room_code();
    let room_id = Uuid::new_v4();

    // 创建房间
    let room: Room = sqlx::query_as(
        r#"
        INSERT INTO rooms (id, theme_id, room_code, status, total_items, ai_count, online_count, turbidity)
        VALUES ($1, $2, $3, 'active', 0, 0, 0, 0.0)
        RETURNING *
        "#,
    )
    .bind(room_id)
    .bind(theme.id)
    .bind(&room_code)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(RoomWithTheme {
        room: room.into(),
        theme: theme.into(),
    }))
}

/// GET /api/rooms/:room_code - 获取房间状态
pub async fn get_room(
    State(state): State<Arc<AppState>>,
    Path(room_code): Path<String>,
) -> Result<Json<RoomWithTheme>, ApiError> {
    let room: Room = sqlx::query_as("SELECT * FROM rooms WHERE room_code = $1")
        .bind(&room_code)
        .fetch_optional(&state.db)
        .await?
        .ok_or(ApiError::NotFound(format!("Room {} not found", room_code)))?;

    let theme: Theme = sqlx::query_as("SELECT * FROM themes WHERE id = $1")
        .bind(room.theme_id)
        .fetch_one(&state.db)
        .await?;

    Ok(Json(RoomWithTheme {
        room: room.into(),
        theme: theme.into(),
    }))
}

/// GET /api/rooms/:room_code/drawings - 获取房间内所有作品 (不含 image_data)
pub async fn list_drawings(
    State(state): State<Arc<AppState>>,
    Path(room_code): Path<String>,
) -> Result<Json<Vec<DrawingListItem>>, ApiError> {
    // 先获取房间
    let room: Room = sqlx::query_as("SELECT * FROM rooms WHERE room_code = $1")
        .bind(&room_code)
        .fetch_optional(&state.db)
        .await?
        .ok_or(ApiError::NotFound(format!("Room {} not found", room_code)))?;

    let drawings: Vec<DrawingItemRow> = sqlx::query_as(
        r#"
        SELECT
            id,
            room_id,
            is_ai,
            name,
            description,
            author_name,
            position_x,
            position_y,
            velocity_x,
            velocity_y,
            rotation,
            scale,
            flip_x,
            vote_count,
            is_eliminated,
            is_hidden,
            session_id,
            created_at
        FROM drawings
        WHERE room_id = $1 AND is_eliminated = FALSE AND is_hidden = FALSE
        ORDER BY created_at
        "#,
    )
    .bind(room.id)
    .fetch_all(&state.db)
    .await?;

    let items: Vec<DrawingListItem> = drawings.into_iter().map(Into::into).collect();
    Ok(Json(items))
}

// 响应类型
#[derive(serde::Serialize)]
pub struct RoomWithTheme {
    pub room: RoomResponse,
    pub theme: ThemeResponse,
}

/// 生成6位房间码
fn generate_room_code() -> String {
    let mut rng = rand::thread_rng();
    let chars: Vec<char> = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".chars().collect();
    (0..6)
        .map(|_| chars[rng.gen_range(0..chars.len())])
        .collect()
}

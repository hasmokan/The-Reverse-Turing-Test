use axum::{
    extract::{Path, State},
    Json,
};
use rand::{rngs::StdRng, Rng, SeedableRng};
use std::sync::Arc;

use crate::models::{Room, Theme, ThemeResponse};
use crate::services::{ApiError, AppState};

/// GET /api/themes - 获取所有主题
pub async fn list_themes(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<ThemeResponse>>, ApiError> {
    let themes: Vec<Theme> = sqlx::query_as("SELECT * FROM themes ORDER BY created_at")
        .fetch_all(&state.db)
        .await?;

    let responses: Vec<ThemeResponse> = themes.into_iter().map(Into::into).collect();
    Ok(Json(responses))
}

/// GET /api/themes/:theme_id - 获取单个主题
pub async fn get_theme(
    State(state): State<Arc<AppState>>,
    Path(theme_id): Path<String>,
) -> Result<Json<ThemeResponse>, ApiError> {
    let theme: Theme = sqlx::query_as("SELECT * FROM themes WHERE theme_id = $1")
        .bind(&theme_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(ApiError::NotFound(format!("Theme {} not found", theme_id)))?;

    Ok(Json(theme.into()))
}

/// GET /api/themes/:theme_id/room - 获取主题对应的房间 (不存在则创建)
pub async fn get_or_create_room_by_theme(
    State(state): State<Arc<AppState>>,
    Path(theme_id): Path<String>,
) -> Result<Json<ThemeRoomResponse>, ApiError> {
    // 查找主题
    let theme: Theme = sqlx::query_as("SELECT * FROM themes WHERE theme_id = $1")
        .bind(&theme_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(ApiError::NotFound(format!("Theme {} not found", theme_id)))?;

    // 查找该主题已有的活跃房间
    let existing_room: Option<Room> = sqlx::query_as(
        "SELECT r.* FROM rooms r WHERE r.theme_id = $1 AND r.status IN ('active', 'voting') ORDER BY r.created_at DESC LIMIT 1"
    )
    .bind(theme.id)
    .fetch_optional(&state.db)
    .await?;

    let room = if let Some(room) = existing_room {
        room
    } else {
        // 创建新房间
        let mut rng = StdRng::from_entropy();
        let chars: Vec<char> = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".chars().collect();
        let room_code: String = (0..6)
            .map(|_| chars[rng.gen_range(0..chars.len())])
            .collect();

        sqlx::query_as(
            r#"
            INSERT INTO rooms (id, theme_id, room_code, status, total_items, ai_count, online_count, turbidity)
            VALUES ($1, $2, $3, 'active', 0, 0, 0, 0.0)
            RETURNING *
            "#,
        )
        .bind(uuid::Uuid::new_v4())
        .bind(theme.id)
        .bind(&room_code)
        .fetch_one(&state.db)
        .await?
    };

    Ok(Json(ThemeRoomResponse {
        room_code: room.room_code,
        theme: theme.into(),
    }))
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ThemeRoomResponse {
    pub room_code: String,
    pub theme: ThemeResponse,
}

use axum::{
    extract::{Path, State},
    Json,
};
use std::sync::Arc;

use crate::models::{Theme, ThemeResponse};
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

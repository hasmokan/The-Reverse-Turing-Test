use axum::{extract::State, Json};
use std::sync::Arc;

use crate::services::{auth, ApiError, AppState};

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DevLoginRequest {
    #[serde(default, alias = "session_id", alias = "legacySessionId")]
    pub session_id: Option<String>,
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DevLoginResponse {
    pub token: String,
    pub user_id: String,
    pub is_new_user: bool,
}

pub async fn dev_login(
    State(state): State<Arc<AppState>>,
    Json(req): Json<DevLoginRequest>,
) -> Result<Json<DevLoginResponse>, ApiError> {
    let result = auth::login_dev(&state.db, &state.config, req.session_id.as_deref()).await?;
    Ok(Json(DevLoginResponse {
        token: result.token,
        user_id: result.user_id.to_string(),
        is_new_user: result.is_new_user,
    }))
}

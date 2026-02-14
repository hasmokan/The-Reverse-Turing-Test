use axum::{extract::State, response::IntoResponse, Json};
use axum_extra::{
    headers::{authorization::Bearer, Authorization},
    TypedHeader,
};
use std::sync::Arc;

use crate::models::{AuthIdentitySummary, AuthMeResponse};
use crate::services::{auth, ApiError, AppState};

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WechatMpLoginRequest {
    pub code: String,
    #[serde(default, alias = "session_id")]
    pub session_id: Option<String>,
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WechatMpLoginResponse {
    pub token: String,
    pub user_id: String,
    pub is_new_user: bool,
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GuestLoginRequest {
    #[serde(default, alias = "deviceToken")]
    pub device_token: Option<String>,
    // Deprecated compatibility field; ignored for identity binding.
    #[serde(default, alias = "device_id")]
    pub device_id: Option<String>,
    #[serde(default, alias = "session_id", alias = "legacySessionId")]
    pub session_id: Option<String>,
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GuestLoginResponse {
    pub token: String,
    pub user_id: String,
    pub is_new_user: bool,
    pub is_guest: bool,
    pub device_token: String,
}

pub async fn wechat_mp_login(
    State(state): State<Arc<AppState>>,
    Json(req): Json<WechatMpLoginRequest>,
) -> Result<Json<WechatMpLoginResponse>, ApiError> {
    let result = auth::login_wechat_miniprogram(
        &state.db,
        &state.config,
        &req.code,
        req.session_id.as_deref(),
    )
    .await?;

    Ok(Json(WechatMpLoginResponse {
        token: result.token,
        user_id: result.user_id.to_string(),
        is_new_user: result.is_new_user,
    }))
}

pub async fn guest_login(
    State(state): State<Arc<AppState>>,
    Json(req): Json<GuestLoginRequest>,
) -> Result<Json<GuestLoginResponse>, ApiError> {
    let requested_device_token = req.device_token.as_deref().or(req.device_id.as_deref());
    let result = auth::login_guest_device(
        &state.db,
        &state.config,
        requested_device_token,
        req.session_id.as_deref(),
    )
    .await?;

    Ok(Json(GuestLoginResponse {
        token: result.token,
        user_id: result.user_id.to_string(),
        is_new_user: result.is_new_user,
        is_guest: true,
        device_token: result.device_token,
    }))
}

pub async fn me(
    State(state): State<Arc<AppState>>,
    TypedHeader(auth_header): TypedHeader<Authorization<Bearer>>,
) -> Result<impl IntoResponse, ApiError> {
    let token = auth_header.token();
    let user_id = auth::user_id_from_token(&state.db, token).await?;
    let identities = auth::list_identities_for_user(&state.db, user_id).await?;
    let identities = identities
        .into_iter()
        .map(|i| AuthIdentitySummary {
            provider: i.provider,
            appid: i.appid,
            unionid: i.unionid,
            created_at: i.created_at,
        })
        .collect();
    Ok(Json(AuthMeResponse {
        user_id,
        identities,
    }))
}

pub async fn logout(
    State(state): State<Arc<AppState>>,
    TypedHeader(auth_header): TypedHeader<Authorization<Bearer>>,
) -> Result<impl IntoResponse, ApiError> {
    let token = auth_header.token();
    auth::logout_token(&state.db, token).await?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

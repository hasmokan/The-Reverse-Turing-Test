use base64::Engine;
use chrono::{Duration, Utc};
use rand::RngCore;
use sqlx::PgPool;
use uuid::Uuid;

use crate::config::Config;
use crate::models::AuthIdentity;
use crate::services::ApiError;

pub const PROVIDER_WECHAT_MINIPROGRAM: &str = "wechat_miniprogram";

pub struct LoginResult {
    pub token: String,
    pub user_id: Uuid,
    pub is_new_user: bool,
}

pub struct WechatSession {
    pub openid: String,
    pub unionid: Option<String>,
}

#[derive(serde::Deserialize)]
struct WechatCode2SessionResponse {
    openid: Option<String>,
    unionid: Option<String>,
    errcode: Option<i32>,
    errmsg: Option<String>,
}

fn generate_token() -> String {
    let mut bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut bytes);
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(bytes)
}

async fn wechat_code_to_session(config: &Config, code: &str) -> Result<WechatSession, ApiError> {
    let Some(appid) = config.wechat_mp_appid.as_deref() else {
        return Err(ApiError::BadRequest(
            "WeChat login is not enabled".to_string(),
        ));
    };
    let Some(secret) = config.wechat_mp_secret.as_deref() else {
        return Err(ApiError::BadRequest(
            "WeChat login is not enabled".to_string(),
        ));
    };

    let client = reqwest::Client::new();
    let resp = client
        .get("https://api.weixin.qq.com/sns/jscode2session")
        .query(&[
            ("appid", appid),
            ("secret", secret),
            ("js_code", code),
            ("grant_type", "authorization_code"),
        ])
        .send()
        .await
        .map_err(|e| {
            tracing::error!("WeChat code2Session request failed: {}", e);
            ApiError::Internal("WeChat login failed".to_string())
        })?;

    let status = resp.status();
    let body = resp.text().await.map_err(|e| {
        tracing::error!("WeChat code2Session read body failed: {}", e);
        ApiError::Internal("WeChat login failed".to_string())
    })?;

    let parsed: WechatCode2SessionResponse = serde_json::from_str(&body).map_err(|e| {
        tracing::error!("WeChat code2Session parse failed: {}", e);
        ApiError::Internal("WeChat login failed".to_string())
    })?;

    if !status.is_success() {
        tracing::error!("WeChat code2Session HTTP error: {}", status);
        return Err(ApiError::Internal("WeChat login failed".to_string()));
    }

    if let Some(errcode) = parsed.errcode {
        let errmsg = parsed.errmsg.unwrap_or_else(|| "unknown".to_string());
        tracing::warn!("WeChat code2Session error {}: {}", errcode, errmsg);
        return Err(ApiError::BadRequest("Invalid WeChat code".to_string()));
    }

    let Some(openid) = parsed.openid else {
        tracing::error!("WeChat code2Session missing openid");
        return Err(ApiError::Internal("WeChat login failed".to_string()));
    };

    Ok(WechatSession {
        openid,
        unionid: parsed.unionid,
    })
}

pub async fn login_wechat_miniprogram(
    db: &PgPool,
    config: &Config,
    code: &str,
    legacy_session_id: Option<&str>,
) -> Result<LoginResult, ApiError> {
    let session = wechat_code_to_session(config, code).await?;

    let appid = config
        .wechat_mp_appid
        .as_deref()
        .ok_or_else(|| ApiError::BadRequest("WeChat login is not enabled".to_string()))?;

    let mut tx = db.begin().await?;

    let existing_user_id: Option<Uuid> = sqlx::query_scalar(
        r#"
        SELECT user_id
        FROM auth_identities
        WHERE provider = $1 AND appid = $2 AND openid = $3
        "#,
    )
    .bind(PROVIDER_WECHAT_MINIPROGRAM)
    .bind(appid)
    .bind(&session.openid)
    .fetch_optional(&mut *tx)
    .await?;

    let (user_id, is_new_user) = if let Some(user_id) = existing_user_id {
        if let Some(unionid) = session.unionid.as_deref() {
            let _ = sqlx::query(
                r#"
                UPDATE auth_identities
                SET unionid = COALESCE(unionid, $1)
                WHERE provider = $2 AND appid = $3 AND openid = $4
                "#,
            )
            .bind(unionid)
            .bind(PROVIDER_WECHAT_MINIPROGRAM)
            .bind(appid)
            .bind(&session.openid)
            .execute(&mut *tx)
            .await?;
        }

        (user_id, false)
    } else {
        let user_id: Uuid = sqlx::query_scalar("INSERT INTO users DEFAULT VALUES RETURNING id")
            .fetch_one(&mut *tx)
            .await?;

        let _ = sqlx::query(
            r#"
            INSERT INTO auth_identities (user_id, provider, appid, openid, unionid)
            VALUES ($1, $2, $3, $4, $5)
            "#,
        )
        .bind(user_id)
        .bind(PROVIDER_WECHAT_MINIPROGRAM)
        .bind(appid)
        .bind(&session.openid)
        .bind(&session.unionid)
        .execute(&mut *tx)
        .await?;

        (user_id, true)
    };

    let token = generate_token();
    let expires_at = Utc::now() + Duration::days(config.auth_token_ttl_days);

    let _ = sqlx::query(
        r#"
        INSERT INTO auth_sessions (token, user_id, legacy_session_id, expires_at)
        VALUES ($1, $2, $3, $4)
        "#,
    )
    .bind(&token)
    .bind(user_id)
    .bind(legacy_session_id)
    .bind(expires_at)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(LoginResult {
        token,
        user_id,
        is_new_user,
    })
}

pub async fn user_id_from_token(db: &PgPool, token: &str) -> Result<Uuid, ApiError> {
    let user_id: Option<Uuid> = sqlx::query_scalar(
        r#"
        SELECT user_id
        FROM auth_sessions
        WHERE token = $1 AND revoked_at IS NULL AND expires_at > NOW()
        "#,
    )
    .bind(token)
    .fetch_optional(db)
    .await?;

    user_id.ok_or_else(|| ApiError::Unauthorized("Unauthorized".to_string()))
}

pub async fn logout_token(db: &PgPool, token: &str) -> Result<(), ApiError> {
    let res = sqlx::query(
        r#"
        UPDATE auth_sessions
        SET revoked_at = NOW()
        WHERE token = $1 AND revoked_at IS NULL
        "#,
    )
    .bind(token)
    .execute(db)
    .await?;

    if res.rows_affected() == 0 {
        return Err(ApiError::Unauthorized("Unauthorized".to_string()));
    }

    Ok(())
}

pub async fn list_identities_for_user(
    db: &PgPool,
    user_id: Uuid,
) -> Result<Vec<AuthIdentity>, ApiError> {
    let rows: Vec<AuthIdentity> = sqlx::query_as(
        r#"
        SELECT provider, appid, unionid, created_at
        FROM auth_identities
        WHERE user_id = $1
        ORDER BY created_at
        "#,
    )
    .bind(user_id)
    .fetch_all(db)
    .await?;
    Ok(rows)
}

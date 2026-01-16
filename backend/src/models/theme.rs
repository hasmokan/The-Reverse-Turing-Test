use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Theme {
    pub id: Uuid,
    pub theme_id: String,
    pub theme_name: String,
    pub background_url: String,
    pub particle_effect: Option<String>,
    pub palette: serde_json::Value, // JSONB: ["#FF6B6B", "#4ECDC4"]
    pub ai_keywords: serde_json::Value, // JSONB: ["fish", "whale"]
    pub ai_prompt_style: String,
    pub spawn_rate: i32,
    pub max_imposters: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// 主题前端响应格式
#[derive(Debug, Serialize)]
pub struct ThemeResponse {
    pub theme_id: String,
    pub theme_name: String,
    pub assets: ThemeAssets,
    pub palette: Vec<String>,
    pub ai_settings: AiSettings,
    pub game_rules: GameRules,
}

#[derive(Debug, Serialize)]
pub struct ThemeAssets {
    pub background_url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub particle_effect: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AiSettings {
    pub keywords: Vec<String>,
    pub prompt_style: String,
}

#[derive(Debug, Serialize)]
pub struct GameRules {
    pub spawn_rate: i32,
    pub max_imposters: i32,
}

impl From<Theme> for ThemeResponse {
    fn from(t: Theme) -> Self {
        Self {
            theme_id: t.theme_id,
            theme_name: t.theme_name,
            assets: ThemeAssets {
                background_url: t.background_url,
                particle_effect: t.particle_effect,
            },
            palette: serde_json::from_value(t.palette).unwrap_or_default(),
            ai_settings: AiSettings {
                keywords: serde_json::from_value(t.ai_keywords).unwrap_or_default(),
                prompt_style: t.ai_prompt_style,
            },
            game_rules: GameRules {
                spawn_rate: t.spawn_rate,
                max_imposters: t.max_imposters,
            },
        }
    }
}

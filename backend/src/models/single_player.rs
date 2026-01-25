use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

pub fn single_player_fish_image_url(fish_instance_id: Uuid) -> String {
    format!("/api/game/fish/{}/image", fish_instance_id)
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct SinglePlayerRun {
    pub id: Uuid,
    pub session_id: String,
    pub theme_id: Option<Uuid>,
    pub level: i32,
    pub status: String,
    pub max_mistakes: i32,
    pub mistakes: i32,
    pub target_total: i32,
    pub targets_found: i32,
    pub started_at: DateTime<Utc>,
    pub ends_at: DateTime<Utc>,
    pub submitted_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct SinglePlayerRunFish {
    pub id: Uuid,
    pub run_id: Uuid,
    pub fish_kind: String,
    pub fish_id: Uuid,
    pub order_index: i32,
    pub is_caught: bool,
    pub caught_at: Option<DateTime<Utc>>,
}

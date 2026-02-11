use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use crate::config::Config;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Room {
    pub id: Uuid,
    pub theme_id: Uuid,
    pub room_code: String,
    pub status: String, // 存储为 VARCHAR
    pub total_items: i32,
    pub ai_count: i32,
    pub online_count: i32,
    pub turbidity: f64,
    pub voting_started_at: Option<DateTime<Utc>>,
    pub voting_ends_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Room {
    /// 计算动态投票阈值（在线人数 * 配置比例，且不低于最小阈值）
    pub fn vote_threshold(&self, config: &Config) -> i32 {
        let ratio = config.vote_threshold_ratio.clamp(0.0, 1.0);
        let dynamic = ((self.online_count as f64) * ratio).ceil() as i32;
        std::cmp::max(config.vote_min_threshold, dynamic)
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RoomResponse {
    #[serde(rename = "roomId")]
    pub room_code: String,
    pub status: String,
    pub total_items: i32,
    pub ai_count: i32,
    pub online_count: i32,
    pub turbidity: f64,
    pub voting_started_at: Option<DateTime<Utc>>,
    pub voting_ends_at: Option<DateTime<Utc>>,
}

impl From<Room> for RoomResponse {
    fn from(r: Room) -> Self {
        Self {
            room_code: r.room_code,
            status: r.status,
            total_items: r.total_items,
            ai_count: r.ai_count,
            online_count: r.online_count,
            turbidity: r.turbidity,
            voting_started_at: r.voting_started_at,
            voting_ends_at: r.voting_ends_at,
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct CreateRoomRequest {
    pub theme_id: String,
}

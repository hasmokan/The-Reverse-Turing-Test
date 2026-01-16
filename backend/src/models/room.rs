use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "VARCHAR", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum RoomStatus {
    Active,
    Voting,
    Gameover,
}

impl Default for RoomStatus {
    fn default() -> Self {
        Self::Active
    }
}

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
    pub fn status_enum(&self) -> RoomStatus {
        match self.status.as_str() {
            "voting" => RoomStatus::Voting,
            "gameover" => RoomStatus::Gameover,
            _ => RoomStatus::Active,
        }
    }

    /// 计算动态投票阈值 (在线人数的 30%)
    pub fn vote_threshold(&self) -> i32 {
        ((self.online_count as f64) * 0.3).ceil() as i32
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

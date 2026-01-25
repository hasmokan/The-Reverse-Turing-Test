use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct DrawingItemRow {
    pub id: Uuid,
    pub room_id: Uuid,
    pub is_ai: bool,
    pub name: String,
    pub description: Option<String>,
    pub author_name: String,
    pub position_x: f64,
    pub position_y: f64,
    pub velocity_x: f64,
    pub velocity_y: f64,
    pub rotation: f64,
    pub scale: f64,
    pub flip_x: bool,
    pub vote_count: i32,
    pub is_eliminated: bool,
    pub is_hidden: bool,
    pub session_id: Option<String>,
    pub created_at: DateTime<Utc>,
}

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

pub fn drawing_image_url(drawing_id: Uuid) -> String {
    format!("/api/drawings/{}/image", drawing_id)
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Drawing {
    pub id: Uuid,
    pub room_id: Uuid,
    pub is_ai: bool,
    pub image_data: String, // Base64: data:image/png;base64,...
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
    pub eliminated_at: Option<DateTime<Utc>>,
    pub report_count: i32,
    pub is_hidden: bool,
    pub session_id: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// 列表响应 (不含 image_data，节省带宽)
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DrawingListItem {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    #[serde(rename = "author")]
    pub author_name: String,
    #[serde(rename = "imageUrl")]
    pub image_url: String,
    pub position: Position,
    pub velocity: Velocity,
    pub rotation: f64,
    pub scale: f64,
    #[serde(rename = "flipX")]
    pub flip_x: bool,
    #[serde(rename = "voteCount")]
    pub vote_count: i32,
    #[serde(rename = "isEliminated")]
    pub is_eliminated: bool,
    #[serde(rename = "createdAt")]
    pub created_at: DateTime<Utc>,
}

/// 详情响应 (含 image_data)
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DrawingResponse {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    #[serde(rename = "author")]
    pub author_name: String,
    #[serde(rename = "imageUrl")]
    pub image_url: String,
    pub position: Position,
    pub velocity: Velocity,
    pub rotation: f64,
    pub scale: f64,
    #[serde(rename = "flipX")]
    pub flip_x: bool,
    #[serde(rename = "voteCount")]
    pub vote_count: i32,
    #[serde(rename = "isEliminated")]
    pub is_eliminated: bool,
    #[serde(rename = "createdAt")]
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Position {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Velocity {
    pub vx: f64,
    pub vy: f64,
}

impl From<Drawing> for DrawingListItem {
    fn from(d: Drawing) -> Self {
        Self {
            id: d.id,
            name: d.name,
            description: d.description.clone(),
            author_name: d.author_name,
            image_url: drawing_image_url(d.id),
            position: Position {
                x: d.position_x,
                y: d.position_y,
            },
            velocity: Velocity {
                vx: d.velocity_x,
                vy: d.velocity_y,
            },
            rotation: d.rotation,
            scale: d.scale,
            flip_x: d.flip_x,
            vote_count: d.vote_count,
            is_eliminated: d.is_eliminated,
            created_at: d.created_at,
        }
    }
}

impl From<crate::models::DrawingItemRow> for DrawingListItem {
    fn from(d: crate::models::DrawingItemRow) -> Self {
        Self {
            id: d.id,
            name: d.name,
            description: d.description,
            author_name: d.author_name,
            image_url: drawing_image_url(d.id),
            position: Position {
                x: d.position_x,
                y: d.position_y,
            },
            velocity: Velocity {
                vx: d.velocity_x,
                vy: d.velocity_y,
            },
            rotation: d.rotation,
            scale: d.scale,
            flip_x: d.flip_x,
            vote_count: d.vote_count,
            is_eliminated: d.is_eliminated,
            created_at: d.created_at,
        }
    }
}

impl From<Drawing> for DrawingResponse {
    fn from(d: Drawing) -> Self {
        Self {
            id: d.id,
            name: d.name,
            description: d.description.clone(),
            author_name: d.author_name,
            image_url: drawing_image_url(d.id),
            position: Position {
                x: d.position_x,
                y: d.position_y,
            },
            velocity: Velocity {
                vx: d.velocity_x,
                vy: d.velocity_y,
            },
            rotation: d.rotation,
            scale: d.scale,
            flip_x: d.flip_x,
            vote_count: d.vote_count,
            is_eliminated: d.is_eliminated,
            created_at: d.created_at,
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct CreateDrawingRequest {
    pub image_data: String,
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    pub session_id: String,
    #[serde(default = "default_author")]
    pub author_name: String,
}

fn default_author() -> String {
    "匿名艺术家".to_string()
}

#[derive(Debug, Deserialize)]
pub struct VoteRequest {
    pub session_id: String,
}

#[derive(Debug, Deserialize)]
pub struct ReportRequest {
    pub session_id: String,
    #[serde(default)]
    pub reason: Option<String>,
}

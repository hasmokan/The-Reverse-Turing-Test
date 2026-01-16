use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// WebSocket 消息类型
#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
#[serde(rename_all = "snake_case")]
pub enum WsMessage {
    /// 初始房间状态
    RoomState(RoomStateData),
    /// 新作品加入
    DrawingAdded(DrawingAddedData),
    /// 投票数更新
    VoteUpdated(VoteUpdatedData),
    /// AI 卧底出现
    AiSpawned(AiSpawnedData),
    /// 作品被淘汰
    DrawingEliminated(DrawingEliminatedData),
    /// 在线人数更新
    OnlineCount(OnlineCountData),
    /// 浑浊度变化
    TurbidityChanged(TurbidityChangedData),
    /// 游戏结束
    GameOver(GameOverData),
    /// 心跳响应
    Pong,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RoomStateData {
    pub room: serde_json::Value,
    pub drawings: Vec<serde_json::Value>,
    pub theme: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DrawingAddedData {
    pub id: Uuid,
    pub name: String,
    pub position: Position,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Position {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VoteUpdatedData {
    pub drawing_id: Uuid,
    pub vote_count: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AiSpawnedData {
    pub ai_count: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DrawingEliminatedData {
    pub drawing_id: Uuid,
    pub was_ai: bool,
    pub animation: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OnlineCountData {
    pub count: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TurbidityChangedData {
    pub level: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GameOverData {
    pub reason: String,
    pub final_ai_count: i32,
    pub animation: String,
}

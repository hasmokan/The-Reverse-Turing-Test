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

// ==================== 战斗系统事件 ====================

/// 投票/开火事件 (前端 → 后端)
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VoteCastInput {
    pub fish_id: String,
    pub voter_id: String,
}

/// 撤票事件 (前端 → 后端)
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VoteRetractInput {
    pub fish_id: String,
    pub voter_id: String,
}

/// 追击事件 (前端 → 后端)
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VoteChaseInput {
    pub fish_id: String,
    pub voter_id: String,
}

/// 票数更新 (后端 → 前端)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VoteUpdateOutput {
    pub fish_id: String,
    pub count: i32,
    pub voters: Vec<String>,
}

/// 被投票通知 (后端 → 前端)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VoteReceivedOutput {
    pub fish_id: String,
    pub voter_id: String,
}

/// 鱼被淘汰 (后端 → 前端)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FishEliminateOutput {
    pub fish_id: String,
    pub fish_name: String,
    pub is_ai: bool,
    pub fish_owner_id: String,
    pub killer_names: Vec<String>,
}

/// 游戏胜利 (后端 → 前端)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameVictoryOutput {
    pub mvp_id: String,
    pub mvp_name: String,
    pub ai_remaining: i32,
    pub human_remaining: i32,
}

/// 游戏失败 (后端 → 前端)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameDefeatOutput {
    pub ai_remaining: i32,
    pub human_remaining: i32,
}

/// 战斗系统常量
pub mod battle_constants {
    pub const ELIMINATION_THRESHOLD: i32 = 4;
    pub const DEFEAT_AI_COUNT: i32 = 5;
    pub const VICTORY_MIN_HUMAN: i32 = 5;
}

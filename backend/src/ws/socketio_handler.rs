//! Socket.IO 事件处理器
//! 兼容前端 socket.io-client

use socketioxide::extract::{Data, SocketRef, State as SioState};
use std::sync::Arc;
use tracing::{debug, info};

use crate::models::{Drawing, Room, Theme, ThemeResponse};
use crate::services::AppState;

/// 存储在 socket extensions 中的会话信息
#[derive(Clone)]
pub struct RoomSession {
    pub room_code: String,
    pub session_id: String,
}

/// Socket.IO 连接处理
pub fn on_connect(socket: SocketRef, state: SioState<Arc<AppState>>) {
    let session_id = socket.id.to_string();
    info!("[Socket.IO] New connection: {}", session_id);

    // 注册事件处理器
    socket.on("room:join", on_room_join);
    socket.on("room:leave", on_room_leave);
    socket.on("vote:cast", on_vote_cast);
    socket.on("comment:add", on_comment_add);
    socket.on_disconnect(on_disconnect);
}

/// 加入房间
async fn on_room_join(
    socket: SocketRef,
    Data(data): Data<RoomJoinData>,
    state: SioState<Arc<AppState>>,
) {
    let room_id = &data.room_id;
    info!("[Socket.IO] {} joining room {}", socket.id, room_id);

    // 加入 Socket.IO 房间
    let _ = socket.leave_all();
    let _ = socket.join(room_id.clone());

    // 保存 session 信息到 extensions
    socket.extensions.insert(RoomSession {
        room_code: room_id.clone(),
        session_id: socket.id.to_string(),
    });

    // 更新在线人数
    update_online_count(&state, room_id, 1).await;

    // 发送房间初始状态
    if let Ok(room_state) = get_room_state(&state, room_id).await {
        let _ = socket.emit("sync:state", &room_state);
    }
}

/// 离开房间
async fn on_room_leave(
    socket: SocketRef,
    Data(data): Data<RoomLeaveData>,
    state: SioState<Arc<AppState>>,
) {
    info!("[Socket.IO] {} leaving room {}", socket.id, data.room_id);
    let _ = socket.leave(data.room_id.clone());
    update_online_count(&state, &data.room_id, -1).await;
}

/// 断开连接
fn on_disconnect(socket: SocketRef, state: SioState<Arc<AppState>>) {
    if let Some(session) = socket.extensions.get::<RoomSession>() {
        info!(
            "[Socket.IO] {} disconnected from room {}",
            socket.id, session.room_code
        );
        let state = state.clone();
        let room_code = session.room_code.clone();
        tokio::spawn(async move {
            update_online_count(&state, &room_code, -1).await;
        });
    }
}

/// 投票
async fn on_vote_cast(
    socket: SocketRef,
    Data(data): Data<VoteCastData>,
    state: SioState<Arc<AppState>>,
) {
    debug!("[Socket.IO] Vote cast for item {}", data.item_id);

    // 从数据库获取 drawing
    let drawing_id = match uuid::Uuid::parse_str(&data.item_id) {
        Ok(id) => id,
        Err(_) => return,
    };

    if let Ok(Some(drawing)) = sqlx::query_as::<_, Drawing>("SELECT * FROM drawings WHERE id = $1")
        .bind(drawing_id)
        .fetch_optional(&state.db)
        .await
    {
        if let Ok(room) = sqlx::query_as::<_, Room>("SELECT * FROM rooms WHERE id = $1")
            .bind(drawing.room_id)
            .fetch_one(&state.db)
            .await
        {
            // 广播投票更新到房间
            let vote_data = serde_json::json!({
                "itemId": data.item_id,
                "voteCount": drawing.vote_count + 1
            });
            let _ = socket.within(room.room_code).emit("vote:cast", &vote_data);
        }
    }
}

/// 添加评论
async fn on_comment_add(socket: SocketRef, Data(data): Data<CommentAddData>) {
    debug!("[Socket.IO] Comment added to item {}", data.item_id);

    if let Some(session) = socket.extensions.get::<RoomSession>() {
        // 广播评论到房间内其他人
        let _ = socket
            .within(session.room_code.clone())
            .except(socket.id)
            .emit("comment:add", &data);
    }
}

// === Helper Types ===

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct RoomJoinData {
    room_id: String,
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct RoomLeaveData {
    room_id: String,
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct VoteCastData {
    item_id: String,
}

#[derive(Debug, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct CommentAddData {
    item_id: String,
    comment: CommentData,
}

#[derive(Debug, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct CommentData {
    author: String,
    content: String,
}

// === Helper Functions ===

/// 获取房间初始状态 (sync:state)
async fn get_room_state(state: &AppState, room_code: &str) -> Result<SyncStateData, ()> {
    // 获取房间
    let room: Room = sqlx::query_as("SELECT * FROM rooms WHERE room_code = $1")
        .bind(room_code)
        .fetch_optional(&state.db)
        .await
        .map_err(|_| ())?
        .ok_or(())?;

    // 获取主题
    let theme: Theme = sqlx::query_as("SELECT * FROM themes WHERE id = $1")
        .bind(room.theme_id)
        .fetch_optional(&state.db)
        .await
        .map_err(|_| ())?
        .ok_or(())?;

    // 获取作品列表
    let drawings: Vec<Drawing> = sqlx::query_as(
        "SELECT * FROM drawings WHERE room_id = $1 AND is_eliminated = FALSE AND is_hidden = FALSE ORDER BY created_at",
    )
    .bind(room.id)
    .fetch_all(&state.db)
    .await
    .map_err(|_| ())?;

    // 转换为前端格式 (camelCase)
    let items: Vec<GameItemData> = drawings.into_iter().map(GameItemData::from).collect();
    let theme_response: ThemeResponse = theme.into();

    Ok(SyncStateData {
        phase: room.status.clone(),
        room_id: room.room_code.clone(),
        total_items: room.total_items,
        ai_count: room.ai_count,
        turbidity: room.turbidity,
        theme: theme_response,
        items,
    })
}

/// 更新在线人数
async fn update_online_count(state: &AppState, room_code: &str, delta: i32) {
    if let Ok(room) = sqlx::query_as::<_, Room>("SELECT * FROM rooms WHERE room_code = $1")
        .bind(room_code)
        .fetch_optional(&state.db)
        .await
    {
        if let Some(room) = room {
            let new_count = (room.online_count + delta).max(0);
            let _ = sqlx::query("UPDATE rooms SET online_count = $1 WHERE id = $2")
                .bind(new_count)
                .bind(room.id)
                .execute(&state.db)
                .await;
        }
    }
}

// === Response Types (camelCase) ===

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct SyncStateData {
    phase: String,
    room_id: String,
    total_items: i32,
    ai_count: i32,
    turbidity: f64,
    theme: ThemeResponse,
    items: Vec<GameItemData>,
}

/// 前端 GameItem 格式
#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct GameItemData {
    id: String,
    #[serde(rename = "imageUrl")]
    image_url: String,
    name: String,
    description: String,
    author: String,
    #[serde(rename = "isAI")]
    is_ai: bool,
    created_at: i64,
    position: PositionData,
    velocity: VelocityData,
    rotation: f64,
    scale: f64,
    flip_x: bool,
    comments: Vec<()>, // 暂时为空数组
}

#[derive(Debug, serde::Serialize)]
struct PositionData {
    x: f64,
    y: f64,
}

#[derive(Debug, serde::Serialize)]
struct VelocityData {
    vx: f64,
    vy: f64,
}

impl From<Drawing> for GameItemData {
    fn from(d: Drawing) -> Self {
        Self {
            id: d.id.to_string(),
            image_url: d.image_data, // 前端用 imageUrl
            name: d.name,
            description: d.description.unwrap_or_default(),
            author: d.author_name, // 前端用 author
            is_ai: d.is_ai,
            created_at: d.created_at.timestamp_millis(),
            position: PositionData {
                x: d.position_x,
                y: d.position_y,
            },
            velocity: VelocityData {
                vx: d.velocity_x,
                vy: d.velocity_y,
            },
            rotation: d.rotation,
            scale: d.scale,
            flip_x: d.flip_x,
            comments: vec![],
        }
    }
}

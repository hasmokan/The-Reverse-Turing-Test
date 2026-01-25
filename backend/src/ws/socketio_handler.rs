//! Socket.IO 事件处理器
//! 兼容前端 socket.io-client

use socketioxide::extract::{Data, SocketRef, State as SioState};
use std::sync::Arc;
use tracing::{debug, info};

use crate::models::{drawing_image_url, Drawing, DrawingItemRow, Room, Theme, ThemeResponse};
use crate::services::AppState;

/// 存储在 socket extensions 中的会话信息
#[derive(Clone)]
pub struct RoomSession {
    pub room_code: String,
}

/// Socket.IO 连接处理
pub fn on_connect(socket: SocketRef, _state: SioState<Arc<AppState>>) {
    let session_id = socket.id.to_string();
    info!("[Socket.IO] New connection: {}", session_id);

    // 注册事件处理器
    socket.on("room:join", on_room_join);
    socket.on("room:leave", on_room_leave);
    socket.on("vote:cast", on_vote_cast);
    socket.on("vote:retract", on_vote_retract);
    socket.on("vote:chase", on_vote_chase);
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

/// 投票/开火 (战斗系统)
async fn on_vote_cast(
    socket: SocketRef,
    Data(data): Data<BattleVoteCastData>,
    state: SioState<Arc<AppState>>,
) {
    info!("[Socket.IO] Vote cast: {:?}", data);

    let fish_id = match uuid::Uuid::parse_str(&data.fish_id) {
        Ok(id) => id,
        Err(_) => return,
    };

    // 获取 drawing 和 room
    let drawing = match sqlx::query_as::<_, Drawing>("SELECT * FROM drawings WHERE id = $1")
        .bind(fish_id)
        .fetch_optional(&state.db)
        .await
    {
        Ok(Some(d)) if !d.is_eliminated => d,
        _ => return,
    };

    let room = match sqlx::query_as::<_, Room>("SELECT * FROM rooms WHERE id = $1")
        .bind(drawing.room_id)
        .fetch_one(&state.db)
        .await
    {
        Ok(r) => r,
        Err(_) => return,
    };

    // 插入投票记录
    let insert_result = match sqlx::query(
        "INSERT INTO votes (drawing_id, session_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
    )
    .bind(fish_id)
    .bind(&data.voter_id)
    .execute(&state.db)
    .await
    {
        Ok(r) => r,
        Err(_) => return,
    };
    if insert_result.rows_affected() == 0 {
        return;
    }

    // 更新票数
    let new_count: i32 = match sqlx::query_scalar(
        "UPDATE drawings SET vote_count = vote_count + 1, updated_at = NOW() WHERE id = $1 RETURNING vote_count",
    )
    .bind(fish_id)
    .fetch_one(&state.db)
    .await
    {
        Ok(c) => c,
        Err(_) => return,
    };

    // 获取投票者列表
    let voters: Vec<String> =
        sqlx::query_scalar("SELECT session_id FROM votes WHERE drawing_id = $1")
            .bind(fish_id)
            .fetch_all(&state.db)
            .await
            .unwrap_or_default();

    // 广播 vote:update
    let vote_update = serde_json::json!({
        "fishId": data.fish_id,
        "count": new_count,
        "voters": voters
    });
    let _ = socket
        .within(room.room_code.clone())
        .emit("vote:update", &vote_update);

    // 通知被投票者 vote:received
    let vote_received = serde_json::json!({
        "fishId": data.fish_id,
        "voterId": data.voter_id
    });
    let _ = socket
        .within(room.room_code.clone())
        .emit("vote:received", &vote_received);

    let elimination_threshold = room.vote_threshold();
    if new_count >= elimination_threshold {
        // 标记为淘汰
        let _ = sqlx::query(
            "UPDATE drawings SET is_eliminated = TRUE, eliminated_at = NOW() WHERE id = $1",
        )
        .bind(fish_id)
        .execute(&state.db)
        .await;

        // 获取投票者名字
        let killer_names: Vec<String> = voters.clone();

        // 广播 fish:eliminate
        let eliminate_data = serde_json::json!({
            "fishId": data.fish_id,
            "fishName": drawing.name,
            "isAI": drawing.is_ai,
            "fishOwnerId": drawing.session_id.unwrap_or_default(),
            "killerNames": killer_names
        });
        let _ = socket
            .within(room.room_code.clone())
            .emit("fish:eliminate", &eliminate_data);

        // 更新 AI 计数
        if drawing.is_ai {
            let _ = sqlx::query("UPDATE rooms SET ai_count = ai_count - 1 WHERE id = $1")
                .bind(room.id)
                .execute(&state.db)
                .await;
        }

        // 检查游戏结束条件
        check_game_end(&socket, &state, &room).await;
    }
}

/// 撤票 (换目标时)
async fn on_vote_retract(
    socket: SocketRef,
    Data(data): Data<BattleVoteCastData>,
    state: SioState<Arc<AppState>>,
) {
    info!("[Socket.IO] Vote retract: {:?}", data);

    let fish_id = match uuid::Uuid::parse_str(&data.fish_id) {
        Ok(id) => id,
        Err(_) => return,
    };

    // 删除投票记录
    let delete_result =
        match sqlx::query("DELETE FROM votes WHERE drawing_id = $1 AND session_id = $2")
            .bind(fish_id)
            .bind(&data.voter_id)
            .execute(&state.db)
            .await
        {
            Ok(r) => r,
            Err(_) => return,
        };
    if delete_result.rows_affected() == 0 {
        return;
    }

    // 减少票数
    let new_count: i32 = match sqlx::query_scalar(
        "UPDATE drawings SET vote_count = GREATEST(vote_count - 1, 0), updated_at = NOW() WHERE id = $1 RETURNING vote_count",
    )
    .bind(fish_id)
    .fetch_one(&state.db)
    .await
    {
        Ok(c) => c,
        Err(_) => return,
    };

    // 获取房间
    if let Ok(drawing) = sqlx::query_as::<_, Drawing>("SELECT * FROM drawings WHERE id = $1")
        .bind(fish_id)
        .fetch_one(&state.db)
        .await
    {
        if let Ok(room) = sqlx::query_as::<_, Room>("SELECT * FROM rooms WHERE id = $1")
            .bind(drawing.room_id)
            .fetch_one(&state.db)
            .await
        {
            // 获取剩余投票者
            let voters: Vec<String> =
                sqlx::query_scalar("SELECT session_id FROM votes WHERE drawing_id = $1")
                    .bind(fish_id)
                    .fetch_all(&state.db)
                    .await
                    .unwrap_or_default();

            // 广播更新
            let vote_update = serde_json::json!({
                "fishId": data.fish_id,
                "count": new_count,
                "voters": voters
            });
            let _ = socket
                .within(room.room_code)
                .emit("vote:update", &vote_update);
        }
    }
}

/// 追击 (重复投同目标，增加票数)
async fn on_vote_chase(
    socket: SocketRef,
    Data(data): Data<BattleVoteCastData>,
    state: SioState<Arc<AppState>>,
) {
    info!("[Socket.IO] Vote chase: {:?}", data);

    // 解析 fish_id (必须是 UUID 格式，非 UUID 静默忽略)
    let fish_id = match uuid::Uuid::parse_str(&data.fish_id) {
        Ok(id) => id,
        Err(_) => {
            info!("[Socket.IO] Vote chase: invalid UUID format, ignoring");
            return;
        }
    };

    // 获取 drawing (必须存在且未被淘汰)
    let drawing = match sqlx::query_as::<_, Drawing>("SELECT * FROM drawings WHERE id = $1")
        .bind(fish_id)
        .fetch_optional(&state.db)
        .await
    {
        Ok(Some(d)) if !d.is_eliminated => d,
        Ok(Some(_)) => {
            info!("[Socket.IO] Vote chase: drawing already eliminated");
            return;
        }
        Ok(None) => {
            info!("[Socket.IO] Vote chase: drawing not found");
            return;
        }
        Err(e) => {
            info!("[Socket.IO] Vote chase: db error: {}", e);
            return;
        }
    };

    // 获取 room
    let room = match sqlx::query_as::<_, Room>("SELECT * FROM rooms WHERE id = $1")
        .bind(drawing.room_id)
        .fetch_one(&state.db)
        .await
    {
        Ok(r) => r,
        Err(e) => {
            info!("[Socket.IO] Vote chase: room not found: {}", e);
            return;
        }
    };

    // 增加票数 (不插入投票记录，与 vote:cast 的区别)
    let new_count: i32 = match sqlx::query_scalar(
        "UPDATE drawings SET vote_count = vote_count + 1, updated_at = NOW() WHERE id = $1 RETURNING vote_count"
    )
    .bind(fish_id)
    .fetch_one(&state.db)
    .await {
        Ok(c) => c,
        Err(e) => {
            info!("[Socket.IO] Vote chase: update failed: {}", e);
            return;
        }
    };

    // 获取投票者列表
    let voters: Vec<String> =
        sqlx::query_scalar("SELECT session_id FROM votes WHERE drawing_id = $1")
            .bind(fish_id)
            .fetch_all(&state.db)
            .await
            .unwrap_or_default();

    // 广播 vote:update (不是 vote:chase)
    let vote_update = serde_json::json!({
        "fishId": data.fish_id,
        "count": new_count,
        "voters": voters
    });
    let _ = socket
        .within(room.room_code.clone())
        .emit("vote:update", &vote_update);

    info!(
        "[Socket.IO] Vote chase: updated count to {} for fish {}",
        new_count, data.fish_id
    );

    let elimination_threshold = room.vote_threshold();
    if new_count >= elimination_threshold {
        // 标记为淘汰
        let _ = sqlx::query(
            "UPDATE drawings SET is_eliminated = TRUE, eliminated_at = NOW() WHERE id = $1",
        )
        .bind(fish_id)
        .execute(&state.db)
        .await;

        // 广播 fish:eliminate
        let eliminate_data = serde_json::json!({
            "fishId": data.fish_id,
            "fishName": drawing.name,
            "isAI": drawing.is_ai,
            "fishOwnerId": drawing.session_id.unwrap_or_default(),
            "killerNames": voters
        });
        let _ = socket
            .within(room.room_code.clone())
            .emit("fish:eliminate", &eliminate_data);

        info!(
            "[Socket.IO] Vote chase: fish {} eliminated (isAI: {})",
            data.fish_id, drawing.is_ai
        );

        // 更新 AI 计数
        if drawing.is_ai {
            let _ = sqlx::query("UPDATE rooms SET ai_count = ai_count - 1 WHERE id = $1")
                .bind(room.id)
                .execute(&state.db)
                .await;
        }

        // 检查游戏结束条件
        check_game_end(&socket, &state, &room).await;
    }
}

/// 检查游戏结束条件
///
/// 游戏结束条件:
/// 1. 前置检查: total_items <= 5 时不检查（还没有 AI 鱼出现）
/// 2. 失败条件: 杀了 3 条非 AI 鱼
/// 3. 失败条件: AI 鱼数量 > 5
/// 4. 胜利条件: AI 全灭 + 人类 >= 5
async fn check_game_end(socket: &SocketRef, state: &AppState, room: &Room) {
    // 重新查询最新的 room 数据以获取准确的 total_items
    let room = match sqlx::query_as::<_, Room>("SELECT * FROM rooms WHERE id = $1")
        .bind(room.id)
        .fetch_one(&state.db)
        .await
    {
        Ok(r) => r,
        Err(_) => return,
    };

    // ============ 前置检查 ============
    // 如果总鱼数 <= 5，不允许游戏结束（还没有 AI 鱼）
    const MIN_ITEMS_FOR_GAME_END: i32 = 6; // 5 条人类鱼 + 至少 1 条 AI 鱼
    if room.total_items < MIN_ITEMS_FOR_GAME_END {
        tracing::info!(
            "[Game] End check skipped: total_items={} < {}",
            room.total_items,
            MIN_ITEMS_FOR_GAME_END
        );
        return;
    }

    // ============ 获取统计数据 ============
    // 查询存活和淘汰的鱼数量
    #[derive(sqlx::FromRow)]
    struct GameStats {
        ai_alive: i64,
        human_alive: i64,
        human_eliminated: i64,
    }

    let stats: Option<GameStats> = sqlx::query_as(
        "SELECT 
            COUNT(*) FILTER (WHERE is_ai = TRUE AND is_eliminated = FALSE) as ai_alive,
            COUNT(*) FILTER (WHERE is_ai = FALSE AND is_eliminated = FALSE) as human_alive,
            COUNT(*) FILTER (WHERE is_ai = FALSE AND is_eliminated = TRUE) as human_eliminated
         FROM drawings WHERE room_id = $1",
    )
    .bind(room.id)
    .fetch_optional(&state.db)
    .await
    .ok()
    .flatten();

    let Some(stats) = stats else {
        return;
    };

    // ============ 失败条件 1: 杀了太多人类鱼 ============
    const MAX_HUMAN_ELIMINATED: i64 = 3;
    if stats.human_eliminated >= MAX_HUMAN_ELIMINATED {
        let defeat_data = serde_json::json!({
            "reason": "too_many_human_killed",
            "humanKilled": stats.human_eliminated,
            "aiRemaining": stats.ai_alive,
            "humanRemaining": stats.human_alive
        });
        let _ = socket
            .within(room.room_code.clone())
            .emit("game:defeat", &defeat_data);
        let _ = sqlx::query("UPDATE rooms SET status = 'gameover' WHERE id = $1")
            .bind(room.id)
            .execute(&state.db)
            .await;
        tracing::info!(
            "[Game] Defeat: {} humans killed in room {}",
            stats.human_eliminated,
            room.room_code
        );
        return;
    }

    // ============ 原有逻辑 ============
    const VICTORY_MIN_HUMAN: i64 = 5;
    const DEFEAT_AI_COUNT: i64 = 5;

    // 胜利: AI 全灭 + 人类 >= 5
    if stats.ai_alive == 0 && stats.human_alive >= VICTORY_MIN_HUMAN {
        let victory_data = serde_json::json!({
            "mvpId": "",
            "mvpName": "Unknown",
            "aiRemaining": stats.ai_alive,
            "humanRemaining": stats.human_alive
        });
        let _ = socket
            .within(room.room_code.clone())
            .emit("game:victory", &victory_data);
        let _ = sqlx::query("UPDATE rooms SET status = 'gameover' WHERE id = $1")
            .bind(room.id)
            .execute(&state.db)
            .await;
        tracing::info!("[Game] Victory in room {}", room.room_code);
    }
    // 失败: AI > 5
    else if stats.ai_alive > DEFEAT_AI_COUNT {
        let defeat_data = serde_json::json!({
            "reason": "ai_overrun",
            "aiRemaining": stats.ai_alive,
            "humanRemaining": stats.human_alive
        });
        let _ = socket
            .within(room.room_code.clone())
            .emit("game:defeat", &defeat_data);
        let _ = sqlx::query("UPDATE rooms SET status = 'gameover' WHERE id = $1")
            .bind(room.id)
            .execute(&state.db)
            .await;
        tracing::info!("[Game] Defeat: AI overrun in room {}", room.room_code);
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
struct BattleVoteCastData {
    fish_id: String,
    voter_id: String,
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

    let drawings: Vec<DrawingItemRow> = sqlx::query_as(
        r#"
        SELECT
            id,
            room_id,
            is_ai,
            name,
            description,
            author_name,
            position_x,
            position_y,
            velocity_x,
            velocity_y,
            rotation,
            scale,
            flip_x,
            vote_count,
            is_eliminated,
            is_hidden,
            session_id,
            created_at
        FROM drawings
        WHERE room_id = $1 AND is_eliminated = FALSE AND is_hidden = FALSE
        ORDER BY created_at
        "#,
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
    if let Ok(Some(room)) = sqlx::query_as::<_, Room>("SELECT * FROM rooms WHERE room_code = $1")
        .bind(room_code)
        .fetch_optional(&state.db)
        .await
    {
        let new_count = (room.online_count + delta).max(0);
        let _ = sqlx::query("UPDATE rooms SET online_count = $1 WHERE id = $2")
            .bind(new_count)
            .bind(room.id)
            .execute(&state.db)
            .await;
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
pub struct GameItemData {
    pub id: String,
    #[serde(rename = "imageUrl")]
    pub image_url: String,
    pub name: String,
    pub description: String,
    pub author: String,
    #[serde(rename = "isAI")]
    pub is_ai: bool,
    pub created_at: i64,
    pub position: PositionData,
    pub velocity: VelocityData,
    pub rotation: f64,
    pub scale: f64,
    pub flip_x: bool,
    pub comments: Vec<()>, // 暂时为空数组
}

#[derive(Debug, serde::Serialize)]
pub struct PositionData {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, serde::Serialize)]
pub struct VelocityData {
    pub vx: f64,
    pub vy: f64,
}

impl From<Drawing> for GameItemData {
    fn from(d: Drawing) -> Self {
        Self {
            id: d.id.to_string(),
            image_url: drawing_image_url(d.id),
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

impl From<DrawingItemRow> for GameItemData {
    fn from(d: DrawingItemRow) -> Self {
        Self {
            id: d.id.to_string(),
            image_url: drawing_image_url(d.id),
            name: d.name,
            description: d.description.unwrap_or_default(),
            author: d.author_name,
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

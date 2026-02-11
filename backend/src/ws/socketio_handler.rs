//! Socket.IO 事件处理器
//! 兼容前端 socket.io-client

use chrono::{Duration, Utc};
use socketioxide::extract::{Data, SocketRef, State as SioState};
use std::sync::Arc;
use tracing::{debug, info};
use uuid::Uuid;

use crate::models::{drawing_image_url, Drawing, DrawingItemRow, Room, Theme, ThemeResponse};
use crate::services::{auth, AppState};
use crate::ws::game_rules;

/// 存储在 socket extensions 中的会话信息
#[derive(Clone)]
pub struct RoomSession {
    pub room_code: String,
}

/// 存储在 socket extensions 中的鉴权信息
#[derive(Clone)]
pub struct AuthSession {
    pub user_id: Uuid,
}

#[derive(Debug)]
pub struct WsAuthError(String);

impl std::fmt::Display for WsAuthError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.0)
    }
}

impl std::error::Error for WsAuthError {}

pub async fn auth_middleware(
    socket: SocketRef,
    state: SioState<Arc<AppState>>,
    Data(auth_data): Data<ConnectAuthData>,
) -> Result<(), WsAuthError> {
    let token = extract_auth_token(&auth_data)
        .ok_or_else(|| WsAuthError("missing auth token".to_string()))?;

    let user_id = auth::user_id_from_token(&state.db, &token)
        .await
        .map_err(|_| WsAuthError("invalid auth token".to_string()))?;

    socket.extensions.insert(AuthSession { user_id });
    Ok(())
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
    // Kept for backward compatibility; currently disabled at handler level.
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

    let _ = phase_tick_by_room_code(&socket, &state, room_id).await;

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
    let Some(voter_id) = authenticated_voter_id(&socket) else {
        let payload = serde_json::json!({
            "reason": "unauthorized",
            "fishId": data.fish_id
        });
        let _ = socket.emit("vote:error", &payload);
        return;
    };

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

    let room = match phase_tick_by_room_id(&socket, &state, room.id).await {
        Some(r) => r,
        None => return,
    };
    if room.status != "voting" {
        let payload = serde_json::json!({
            "reason": "not_voting",
            "fishId": data.fish_id
        });
        let _ = socket.emit("vote:error", &payload);
        return;
    }

    // 插入投票记录
    let insert_result = match sqlx::query(
        "INSERT INTO votes (drawing_id, session_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
    )
    .bind(fish_id)
    .bind(&voter_id)
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
        "voterId": voter_id
    });
    let _ = socket
        .within(room.room_code.clone())
        .emit("vote:received", &vote_received);

    let elimination_threshold = room.vote_threshold(&state.config);
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
        check_game_end(&socket, &state, &room, true).await;
    }
}

/// 撤票 (换目标时)
async fn on_vote_retract(
    socket: SocketRef,
    Data(data): Data<BattleVoteCastData>,
    state: SioState<Arc<AppState>>,
) {
    info!("[Socket.IO] Vote retract: {:?}", data);
    let Some(voter_id) = authenticated_voter_id(&socket) else {
        let payload = serde_json::json!({
            "reason": "unauthorized",
            "fishId": data.fish_id
        });
        let _ = socket.emit("vote:error", &payload);
        return;
    };

    let fish_id = match uuid::Uuid::parse_str(&data.fish_id) {
        Ok(id) => id,
        Err(_) => return,
    };

    let drawing = match sqlx::query_as::<_, Drawing>("SELECT * FROM drawings WHERE id = $1")
        .bind(fish_id)
        .fetch_optional(&state.db)
        .await
    {
        Ok(Some(d)) => d,
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

    let room = match phase_tick_by_room_id(&socket, &state, room.id).await {
        Some(r) => r,
        None => return,
    };
    if room.status != "voting" {
        let payload = serde_json::json!({
            "reason": "not_voting",
            "fishId": data.fish_id
        });
        let _ = socket.emit("vote:error", &payload);
        return;
    }

    // 删除投票记录
    let delete_result =
        match sqlx::query("DELETE FROM votes WHERE drawing_id = $1 AND session_id = $2")
            .bind(fish_id)
            .bind(&voter_id)
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

    let voters: Vec<String> =
        sqlx::query_scalar("SELECT session_id FROM votes WHERE drawing_id = $1")
            .bind(fish_id)
            .fetch_all(&state.db)
            .await
            .unwrap_or_default();

    let vote_update = serde_json::json!({
        "fishId": data.fish_id,
        "count": new_count,
        "voters": voters
    });
    let _ = socket
        .within(room.room_code)
        .emit("vote:update", &vote_update);
}

/// 追击能力当前关闭：保留事件名以兼容旧前端，统一返回 `chase_disabled`。
async fn on_vote_chase(socket: SocketRef, Data(data): Data<BattleVoteCastData>) {
    info!("[Socket.IO] Vote chase: {:?}", data);

    let payload = serde_json::json!({
        "reason": "chase_disabled",
        "fishId": data.fish_id
    });
    let _ = socket.emit("vote:error", &payload);
}

/// 检查游戏结束条件
///
/// 游戏结束条件（基于当前存活/淘汰统计与配置比例）:
/// 1. 失败：被淘汰人类达到 `human_eliminated_ratio` 推导阈值
/// 2. 胜利：AI 全灭，且存活人类达到 `victory_human_survive_ratio` 推导阈值
/// 3. 失败：AI 相对人类优势超过 `ai_overflow_delta`
///
/// `broadcast_phase_update = true` 时，在写入 `rooms.status=gameover` 后立即广播 `phase:update`。
async fn check_game_end(
    socket: &SocketRef,
    state: &AppState,
    room: &Room,
    broadcast_phase_update: bool,
) {
    let room = match sqlx::query_as::<_, Room>("SELECT * FROM rooms WHERE id = $1")
        .bind(room.id)
        .fetch_one(&state.db)
        .await
    {
        Ok(r) => r,
        Err(_) => return,
    };

    // ============ 获取统计数据 ============
    // 查询存活和淘汰的鱼数量
    #[derive(sqlx::FromRow)]
    struct GameStats {
        ai_alive: i64,
        ai_eliminated: i64,
        human_alive: i64,
        human_eliminated: i64,
    }

    let stats: Option<GameStats> = sqlx::query_as(
        "SELECT 
            COUNT(*) FILTER (WHERE is_ai = TRUE AND is_eliminated = FALSE) as ai_alive,
            COUNT(*) FILTER (WHERE is_ai = TRUE AND is_eliminated = TRUE) as ai_eliminated,
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

    let human_total = stats.human_alive + stats.human_eliminated;
    let ai_total = stats.ai_alive + stats.ai_eliminated;
    if ai_total < 1 || human_total < 1 {
        return;
    }

    let max_human_eliminated =
        game_rules::human_eliminated_limit(human_total, state.config.human_eliminated_ratio);

    if stats.human_eliminated >= max_human_eliminated {
        let defeat_data = serde_json::json!({
            "reason": "too_many_human_killed",
            "humanKilled": stats.human_eliminated,
            "aiRemaining": stats.ai_alive,
            "humanRemaining": stats.human_alive,
            "humanTotal": human_total
        });
        let _ = socket
            .within(room.room_code.clone())
            .emit("game:defeat", &defeat_data);
        let _ = sqlx::query("UPDATE rooms SET status = 'gameover' WHERE id = $1")
            .bind(room.id)
            .execute(&state.db)
            .await;
        if let Ok(updated_room) = sqlx::query_as::<_, Room>("SELECT * FROM rooms WHERE id = $1")
            .bind(room.id)
            .fetch_one(&state.db)
            .await
        {
            if broadcast_phase_update {
                emit_phase_update(socket, &updated_room);
            }
        }
        tracing::info!(
            "[Game] Defeat: {} humans killed in room {}",
            stats.human_eliminated,
            room.room_code
        );
        return;
    }

    let min_human_survive =
        game_rules::min_human_survive(human_total, state.config.victory_human_survive_ratio);
    if stats.ai_alive == 0 && stats.human_alive >= min_human_survive {
        let victory_data = serde_json::json!({
            "mvpId": "",
            "mvpName": "Unknown",
            "aiRemaining": stats.ai_alive,
            "humanRemaining": stats.human_alive,
            "humanTotal": human_total
        });
        let _ = socket
            .within(room.room_code.clone())
            .emit("game:victory", &victory_data);
        let _ = sqlx::query("UPDATE rooms SET status = 'gameover' WHERE id = $1")
            .bind(room.id)
            .execute(&state.db)
            .await;
        if let Ok(updated_room) = sqlx::query_as::<_, Room>("SELECT * FROM rooms WHERE id = $1")
            .bind(room.id)
            .fetch_one(&state.db)
            .await
        {
            if broadcast_phase_update {
                emit_phase_update(socket, &updated_room);
            }
        }
        tracing::info!("[Game] Victory in room {}", room.room_code);
    }
    // 失败: AI 过载（相对优势过大）
    else if game_rules::ai_overflow(
        stats.ai_alive,
        stats.human_alive,
        state.config.ai_overflow_delta,
    ) {
        let defeat_data = serde_json::json!({
            "reason": "ai_overrun",
            "aiRemaining": stats.ai_alive,
            "humanRemaining": stats.human_alive,
            "humanTotal": human_total
        });
        let _ = socket
            .within(room.room_code.clone())
            .emit("game:defeat", &defeat_data);
        let _ = sqlx::query("UPDATE rooms SET status = 'gameover' WHERE id = $1")
            .bind(room.id)
            .execute(&state.db)
            .await;
        if let Ok(updated_room) = sqlx::query_as::<_, Room>("SELECT * FROM rooms WHERE id = $1")
            .bind(room.id)
            .fetch_one(&state.db)
            .await
        {
            if broadcast_phase_update {
                emit_phase_update(socket, &updated_room);
            }
        }
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
pub(crate) struct ConnectAuthData {
    #[serde(default)]
    token: Option<String>,
    #[serde(default)]
    authorization: Option<String>,
}

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

fn extract_auth_token(auth: &ConnectAuthData) -> Option<String> {
    if let Some(token) = auth
        .token
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        return Some(token.to_string());
    }

    let authorization = auth
        .authorization
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())?;

    if authorization.len() >= 7 && authorization[..7].eq_ignore_ascii_case("Bearer ") {
        let bearer = authorization[7..].trim();
        if bearer.is_empty() {
            None
        } else {
            Some(bearer.to_string())
        }
    } else {
        Some(authorization.to_string())
    }
}

fn authenticated_voter_id(socket: &SocketRef) -> Option<String> {
    socket
        .extensions
        .get::<AuthSession>()
        .map(|session| session.user_id.to_string())
}

#[cfg(test)]
mod tests {
    use super::{extract_auth_token, ConnectAuthData};

    #[test]
    fn extract_auth_token_prefers_token_field() {
        let payload = ConnectAuthData {
            token: Some("token-123".to_string()),
            authorization: Some("Bearer ignored".to_string()),
        };

        assert_eq!(extract_auth_token(&payload), Some("token-123".to_string()));
    }

    #[test]
    fn extract_auth_token_supports_bearer_authorization() {
        let payload = ConnectAuthData {
            token: None,
            authorization: Some("Bearer token-xyz".to_string()),
        };

        assert_eq!(extract_auth_token(&payload), Some("token-xyz".to_string()));
    }

    #[test]
    fn extract_auth_token_returns_none_when_missing() {
        let payload = ConnectAuthData {
            token: None,
            authorization: None,
        };

        assert_eq!(extract_auth_token(&payload), None);
    }
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
        voting_started_at: room.voting_started_at.map(|t| t.timestamp_millis()),
        voting_ends_at: room.voting_ends_at.map(|t| t.timestamp_millis()),
        server_time: Utc::now().timestamp_millis(),
        theme: theme_response,
        items,
    })
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct PhaseUpdateData {
    phase: String,
    room_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    voting_started_at: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    voting_ends_at: Option<i64>,
    server_time: i64,
}

fn emit_phase_update(socket: &SocketRef, room: &Room) {
    let payload = PhaseUpdateData {
        phase: room.status.clone(),
        room_id: room.room_code.clone(),
        voting_started_at: room.voting_started_at.map(|t| t.timestamp_millis()),
        voting_ends_at: room.voting_ends_at.map(|t| t.timestamp_millis()),
        server_time: Utc::now().timestamp_millis(),
    };
    let _ = socket
        .within(room.room_code.clone())
        .emit("phase:update", &payload);
}

async fn phase_tick_by_room_code(
    socket: &SocketRef,
    state: &AppState,
    room_code: &str,
) -> Option<Room> {
    let room: Room = sqlx::query_as("SELECT * FROM rooms WHERE room_code = $1")
        .bind(room_code)
        .fetch_optional(&state.db)
        .await
        .ok()
        .flatten()?;
    phase_tick(socket, state, room).await
}

async fn phase_tick_by_room_id(
    socket: &SocketRef,
    state: &AppState,
    room_id: uuid::Uuid,
) -> Option<Room> {
    let room: Room = sqlx::query_as("SELECT * FROM rooms WHERE id = $1")
        .bind(room_id)
        .fetch_optional(&state.db)
        .await
        .ok()
        .flatten()?;
    phase_tick(socket, state, room).await
}

async fn phase_tick(socket: &SocketRef, state: &AppState, mut room: Room) -> Option<Room> {
    let before_phase = room.status.clone();

    if room.status == "voting" {
        let expired = room
            .voting_ends_at
            .map(|t| Utc::now() >= t)
            .unwrap_or(false);
        if expired {
            check_game_end(socket, state, &room, false).await;
            let refreshed: Room = sqlx::query_as("SELECT * FROM rooms WHERE id = $1")
                .bind(room.id)
                .fetch_one(&state.db)
                .await
                .ok()?;
            if refreshed.status != "gameover" {
                reset_votes_and_exit_voting(state, refreshed.id).await;
                room = sqlx::query_as("SELECT * FROM rooms WHERE id = $1")
                    .bind(refreshed.id)
                    .fetch_one(&state.db)
                    .await
                    .ok()?;
            } else {
                room = refreshed;
            }
        }
    }

    if room.status == "active" {
        #[derive(sqlx::FromRow)]
        struct AliveStats {
            ai_alive: i64,
            human_alive: i64,
        }

        let stats: AliveStats = sqlx::query_as(
            "SELECT 
                COUNT(*) FILTER (WHERE is_ai = TRUE AND is_hidden = FALSE AND is_eliminated = FALSE) as ai_alive,
                COUNT(*) FILTER (WHERE is_ai = FALSE AND is_hidden = FALSE AND is_eliminated = FALSE) as human_alive
             FROM drawings WHERE room_id = $1",
        )
        .bind(room.id)
        .fetch_one(&state.db)
        .await
        .ok()?;

        let min_humans = state.config.min_humans_to_start_voting.max(1);
        let submit_deadline =
            room.created_at + Duration::seconds(state.config.submit_duration_seconds.max(10));
        let submit_time_up = Utc::now() >= submit_deadline;
        let should_start = (stats.ai_alive >= 1 && stats.human_alive >= min_humans)
            || (submit_time_up && stats.ai_alive >= 1 && stats.human_alive >= 1);
        if should_start {
            room = start_voting(state, room.id).await.unwrap_or(room);
        }
    }

    if before_phase != room.status {
        emit_phase_update(socket, &room);
    }

    Some(room)
}

async fn start_voting(state: &AppState, room_id: uuid::Uuid) -> Option<Room> {
    let seconds = state.config.voting_duration_seconds.max(5);
    let updated: Room = sqlx::query_as(
        "UPDATE rooms
         SET status = 'voting',
             voting_started_at = NOW(),
             voting_ends_at = NOW() + ($2 || ' seconds')::interval,
             updated_at = NOW()
         WHERE id = $1 AND status = 'active' AND voting_started_at IS NULL
         RETURNING *",
    )
    .bind(room_id)
    .bind(seconds)
    .fetch_optional(&state.db)
    .await
    .ok()
    .flatten()?;
    Some(updated)
}

async fn reset_votes_and_exit_voting(state: &AppState, room_id: uuid::Uuid) {
    let mut tx = match state.db.begin().await {
        Ok(tx) => tx,
        Err(_) => return,
    };

    let _ = sqlx::query(
        "DELETE FROM votes v
         USING drawings d
         WHERE v.drawing_id = d.id AND d.room_id = $1",
    )
    .bind(room_id)
    .execute(&mut *tx)
    .await;

    let _ =
        sqlx::query("UPDATE drawings SET vote_count = 0, updated_at = NOW() WHERE room_id = $1")
            .bind(room_id)
            .execute(&mut *tx)
            .await;

    let _ = sqlx::query(
        "UPDATE rooms
         SET status = 'active',
             voting_started_at = NULL,
             voting_ends_at = NULL,
             updated_at = NOW()
         WHERE id = $1 AND status = 'voting'",
    )
    .bind(room_id)
    .execute(&mut *tx)
    .await;

    let _ = tx.commit().await;
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
    #[serde(skip_serializing_if = "Option::is_none")]
    voting_started_at: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    voting_ends_at: Option<i64>,
    server_time: i64,
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

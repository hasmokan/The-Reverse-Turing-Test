pub mod game_logic;
pub mod image_store;
pub mod n8n_client;
pub mod preset_fish;
pub mod room_manager;

use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use deadpool_redis::{redis::AsyncCommands, Pool as RedisPool};
use rand::{seq::SliceRandom, thread_rng};
use sqlx::PgPool;
use std::collections::HashMap;
use std::sync::Arc;
use uuid::Uuid;

use crate::config::Config;
use crate::models::{Drawing, Room, Theme, TriggerN8nRequest, TriggerN8nTheme};
use image_store::{DbDataUrlImageStore, ImageStore};

pub use n8n_client::*;
pub use preset_fish::*;

/// 随机作者名列表（避免 AI 相关字眼）
const RANDOM_AUTHORS: &[&str] = &[
    "小明", "阿强", "花花", "大毛", "翠花", "老王", "小李", "阿珍", "铁柱", "建国", "美丽", "胖虎",
    "小新", "大雄", "静香", "小红", "阿华", "小刚", "丽丽", "小芳",
];

/// 获取随机作者名
fn get_random_author() -> &'static str {
    RANDOM_AUTHORS
        .choose(&mut thread_rng())
        .unwrap_or(&"匿名画家")
}

/// 应用共享状态
pub struct AppState {
    pub db: PgPool,
    pub redis: RedisPool,
    pub config: Config,
    pub image_store: Arc<dyn ImageStore>,
}

impl AppState {
    pub fn new(db: PgPool, redis: RedisPool, config: Config) -> Self {
        Self {
            db,
            redis,
            config,
            image_store: Arc::new(DbDataUrlImageStore),
        }
    }

    /// 触发 AI 生成
    pub async fn trigger_ai_generation(&self, room_id: Uuid, theme: &Theme) {
        // 检查是否启用 AI 生成
        if !self.config.ai_generation_enabled {
            tracing::info!("AI generation is disabled, skipping for room {}", room_id);
            return;
        }

        let task_id = Uuid::new_v4();

        // 创建任务记录
        if let Err(e) =
            sqlx::query("INSERT INTO ai_tasks (id, room_id, status) VALUES ($1, $2, 'pending')")
                .bind(task_id)
                .bind(room_id)
                .execute(&self.db)
                .await
        {
            tracing::error!("Failed to create AI task: {}", e);
            return;
        }

        // 构造请求
        let palette: Vec<String> =
            serde_json::from_value(theme.palette.clone()).unwrap_or_default();
        let keywords: Vec<String> =
            serde_json::from_value(theme.ai_keywords.clone()).unwrap_or_default();

        let callback_url = format!("{}/api/n8n/callback", self.config.callback_base_url);

        let request = TriggerN8nRequest {
            room_id,
            task_id,
            theme: TriggerN8nTheme {
                palette,
                keywords,
                prompt_style: theme.ai_prompt_style.clone(),
            },
            callback_url,
        };

        // 异步触发 n8n
        let webhook_url = self.config.n8n_webhook_url.clone();
        tokio::spawn(async move {
            if let Err(e) = trigger_n8n(&webhook_url, &request).await {
                tracing::error!("Failed to trigger n8n: {}", e);
            }
        });

        tracing::info!("AI generation triggered for room {}", room_id);
    }

    /// 淘汰绘画
    pub async fn eliminate_drawing(
        &self,
        room: &Room,
        drawing: &Drawing,
    ) -> Result<bool, ApiError> {
        // 标记为已淘汰
        sqlx::query(
            "UPDATE drawings SET is_eliminated = TRUE, eliminated_at = NOW() WHERE id = $1",
        )
        .bind(drawing.id)
        .execute(&self.db)
        .await?;

        // 如果是 AI 被淘汰，减少 AI 计数
        if drawing.is_ai {
            sqlx::query("UPDATE rooms SET ai_count = ai_count - 1 WHERE id = $1")
                .bind(room.id)
                .execute(&self.db)
                .await?;
        }

        // Socket.IO 广播将由调用方通过 SocketIo 实例完成
        tracing::info!(
            "Drawing {} eliminated from room {}",
            drawing.id,
            room.room_code
        );
        Ok(true)
    }

    // ============ 预置鱼池管理 (Redis 全局统计) ============

    /// 获取所有预置鱼的全局使用次数
    pub async fn get_fish_usage_counts(&self) -> HashMap<u8, u32> {
        let key = "preset_fish:usage";
        match self.redis.get().await {
            Ok(mut conn) => {
                let result: Result<Vec<(String, u32)>, _> = conn.hgetall(key).await;
                match result {
                    Ok(pairs) => pairs
                        .into_iter()
                        .filter_map(|(k, v)| k.parse::<u8>().ok().map(|id| (id, v)))
                        .collect(),
                    Err(e) => {
                        tracing::error!("Redis get_fish_usage_counts error: {}", e);
                        HashMap::new()
                    }
                }
            }
            Err(e) => {
                tracing::error!("Redis connection error in get_fish_usage_counts: {}", e);
                HashMap::new()
            }
        }
    }

    /// 递增某条预置鱼的全局使用次数
    pub async fn increment_fish_usage(&self, fish_id: u8) {
        let key = "preset_fish:usage";
        match self.redis.get().await {
            Ok(mut conn) => {
                let _: Result<u32, _> = conn.hincr(key, fish_id.to_string(), 1u32).await;
            }
            Err(e) => {
                tracing::error!("Redis increment_fish_usage error: {}", e);
            }
        }
    }

    // ============ n8n 生成队列管理 (Redis) ============

    /// 将 n8n 生成的 AI 鱼加入队列
    pub async fn push_ai_fish_to_queue(&self, room_id: Uuid, fish_data: &serde_json::Value) {
        let key = format!("room:{}:ai_fish_queue", room_id);
        match self.redis.get().await {
            Ok(mut conn) => {
                let data = serde_json::to_string(fish_data).unwrap_or_default();
                let _: Result<(), _> = conn.rpush(&key, data).await;
                tracing::info!("AI fish pushed to queue for room {}", room_id);
            }
            Err(e) => {
                tracing::error!("Redis push_ai_fish_to_queue error: {}", e);
            }
        }
    }

    /// 从队列取出一条 n8n 生成的 AI 鱼
    pub async fn pop_ai_fish_from_queue(&self, room_id: Uuid) -> Option<serde_json::Value> {
        let key = format!("room:{}:ai_fish_queue", room_id);
        match self.redis.get().await {
            Ok(mut conn) => {
                let result: Result<Option<String>, _> = conn.lpop(&key, None).await;
                match result {
                    Ok(Some(data)) => serde_json::from_str(&data).ok(),
                    _ => None,
                }
            }
            Err(e) => {
                tracing::error!("Redis pop_ai_fish_from_queue error: {}", e);
                None
            }
        }
    }

    // ============ 预置 AI 鱼生成 ============

    /// 从预置池生成 AI 鱼（返回 Drawing，需要后续广播）
    /// 优先选择全局使用次数最少的鱼，确保均匀分布
    pub async fn spawn_preset_ai_fish(&self, room_id: Uuid) -> Option<Drawing> {
        // 1. 获取所有预置鱼的全局使用次数
        let usage_counts = self.get_fish_usage_counts().await;

        // 2. 找出使用次数最少的值
        let fish_count = preset_fish_count() as u8;
        let min_count = (0..fish_count)
            .map(|id| usage_counts.get(&id).copied().unwrap_or(0))
            .min()
            .unwrap_or(0);

        // 3. 筛选出所有使用次数等于最小值的鱼 ID
        let least_used: Vec<u8> = (0..fish_count)
            .filter(|id| usage_counts.get(id).copied().unwrap_or(0) == min_count)
            .collect();

        if least_used.is_empty() {
            tracing::warn!("No preset fish available");
            return None;
        }

        // 4. 从使用次数最少的鱼中随机选择一条
        let fish_id = {
            let mut rng = thread_rng();
            *least_used.choose(&mut rng)?
        };

        let fish = get_preset_fish(fish_id)?;

        // 5. 创建 drawing 记录
        let drawing = self
            .create_ai_drawing_from_preset(room_id, fish)
            .await
            .ok()?;

        // 6. 递增该鱼的全局使用次数
        self.increment_fish_usage(fish_id).await;

        // 7. 更新 room 的 ai_count 和 total_items
        let _ = sqlx::query(
            "UPDATE rooms SET ai_count = ai_count + 1, total_items = total_items + 1, updated_at = NOW() WHERE id = $1"
        )
        .bind(room_id)
        .execute(&self.db)
        .await;

        tracing::info!(
            "Preset AI fish {} spawned for room {} (global usage: {})",
            fish_id,
            room_id,
            min_count + 1
        );
        Some(drawing)
    }

    /// 从预置鱼数据创建 Drawing 记录
    async fn create_ai_drawing_from_preset(
        &self,
        room_id: Uuid,
        fish: &PresetFish,
    ) -> Result<Drawing, ApiError> {
        use rand::{rngs::StdRng, Rng, SeedableRng};

        let mut rng = StdRng::from_entropy();
        let position_x: f64 = rng.gen_range(0.2..0.8);
        let position_y: f64 = rng.gen_range(0.2..0.8);
        let velocity_x: f64 = rng.gen_range(-0.02..0.02);
        let velocity_y: f64 = rng.gen_range(-0.02..0.02);
        let flip_x = rng.gen_bool(0.5);

        let drawing_id = Uuid::new_v4();

        // 添加 data:image/png;base64, 前缀
        let image_data = format!("data:image/png;base64,{}", fish.image_base64);

        // 随机选择作者名
        let author_name = get_random_author();

        let drawing: Drawing = sqlx::query_as(
            r#"
            INSERT INTO drawings (
                id, room_id, is_ai, image_data, name, description, author_name,
                position_x, position_y, velocity_x, velocity_y, flip_x
            )
            VALUES ($1, $2, TRUE, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *
            "#,
        )
        .bind(drawing_id)
        .bind(room_id)
        .bind(&image_data)
        .bind(fish.name)
        .bind(fish.description)
        .bind(author_name)
        .bind(position_x)
        .bind(position_y)
        .bind(velocity_x)
        .bind(velocity_y)
        .bind(flip_x)
        .fetch_one(&self.db)
        .await?;

        Ok(drawing)
    }

    /// 尝试从 n8n 队列生成 AI 鱼
    pub async fn try_spawn_from_n8n_queue(&self, room_id: Uuid) -> Option<Drawing> {
        let fish_data = self.pop_ai_fish_from_queue(room_id).await?;
        let task_id = fish_data.get("task_id")?.as_str()?;
        let task_id = Uuid::parse_str(task_id).ok()?;

        #[derive(sqlx::FromRow)]
        struct AiFishData {
            image_data: Option<String>,
            generated_name: Option<String>,
            generated_description: Option<String>,
        }

        let task: AiFishData = sqlx::query_as(
            "SELECT image_data, generated_name, generated_description FROM ai_tasks WHERE id = $1 AND status = 'completed'",
        )
        .bind(task_id)
        .fetch_optional(&self.db)
        .await
        .ok()
        .flatten()?;

        let image_data = task.image_data?;
        let name = task.generated_name.unwrap_or_else(|| "小东西".to_string());
        let description = task.generated_description;

        // 创建 drawing 记录
        use rand::{rngs::StdRng, Rng, SeedableRng};

        let mut rng = StdRng::from_entropy();
        let position_x: f64 = rng.gen_range(0.2..0.8);
        let position_y: f64 = rng.gen_range(0.2..0.8);
        let velocity_x: f64 = rng.gen_range(-0.02..0.02);
        let velocity_y: f64 = rng.gen_range(-0.02..0.02);
        let flip_x = rng.gen_bool(0.5);

        let drawing_id = Uuid::new_v4();

        // 随机选择作者名
        let author_name = get_random_author();

        let drawing: Drawing = sqlx::query_as(
            r#"
            INSERT INTO drawings (
                id, room_id, is_ai, image_data, name, description, author_name,
                position_x, position_y, velocity_x, velocity_y, flip_x
            )
            VALUES ($1, $2, TRUE, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *
            "#,
        )
        .bind(drawing_id)
        .bind(room_id)
        .bind(&image_data)
        .bind(&name)
        .bind(&description)
        .bind(author_name)
        .bind(position_x)
        .bind(position_y)
        .bind(velocity_x)
        .bind(velocity_y)
        .bind(flip_x)
        .fetch_one(&self.db)
        .await
        .ok()?;

        // 更新 room 的 ai_count 和 total_items
        let _ = sqlx::query(
            "UPDATE rooms SET ai_count = ai_count + 1, total_items = total_items + 1, updated_at = NOW() WHERE id = $1"
        )
        .bind(room_id)
        .execute(&self.db)
        .await;

        tracing::info!("n8n AI fish spawned for room {}", room_id);
        Some(drawing)
    }
}

/// API 错误类型
#[derive(Debug)]
pub enum ApiError {
    NotFound(String),
    BadRequest(String),
    Internal(String),
}

impl From<sqlx::Error> for ApiError {
    fn from(e: sqlx::Error) -> Self {
        tracing::error!("Database error: {}", e);
        ApiError::Internal("Database error".to_string())
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, message) = match self {
            ApiError::NotFound(msg) => (StatusCode::NOT_FOUND, msg),
            ApiError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg),
            ApiError::Internal(msg) => (StatusCode::INTERNAL_SERVER_ERROR, msg),
        };

        let body = serde_json::json!({ "error": message });
        (status, Json(body)).into_response()
    }
}

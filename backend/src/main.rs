use anyhow::Result;
use axum::{
    routing::{get, post},
    Extension, Router,
};
use socketioxide::SocketIo;
use sqlx::postgres::PgPoolOptions;
use std::{net::SocketAddr, sync::Arc};
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod config;
mod db;
mod models;
mod routes;
mod services;
mod ws;

use config::Config;
use services::AppState;

#[tokio::main]
async fn main() -> Result<()> {
    // 初始化日志
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,mimic_backend=debug,socketioxide=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    // 加载配置
    dotenvy::dotenv().ok();
    let config = Config::from_env()?;

    tracing::info!("Starting mimic-backend on {}:{}", config.host, config.port);

    // 数据库连接池
    let pool = PgPoolOptions::new()
        .max_connections(10)
        .connect(&config.database_url)
        .await?;

    tracing::info!("Connected to PostgreSQL");

    // Redis 连接池
    let redis_cfg = deadpool_redis::Config::from_url(&config.redis_url);
    let redis_pool = redis_cfg.create_pool(Some(deadpool_redis::Runtime::Tokio1))?;

    // 测试 Redis 连接
    {
        let mut conn = redis_pool.get().await?;
        let _: String = deadpool_redis::redis::cmd("PING")
            .query_async(&mut conn)
            .await?;
    }
    tracing::info!("Connected to Redis");

    // 应用状态
    let state = Arc::new(
        AppState::new(pool, redis_pool, config.clone())
            .map_err(|e| anyhow::anyhow!("Failed to init app state: {:?}", e))?,
    );

    // Socket.IO 设置
    let (sio_layer, io) = SocketIo::builder().with_state(state.clone()).build_layer();

    // 注册 Socket.IO 事件处理器
    io.ns("/", ws::socketio_handler::on_connect);

    // CORS 配置
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // 路由
    let app = Router::new()
        // 健康检查
        .route("/health", get(|| async { "OK" }))
        // REST API
        .nest("/api", api_routes(state.clone(), io.clone()))
        // 中间件层
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .layer(sio_layer);

    // 启动服务器
    let addr = SocketAddr::from(([0, 0, 0, 0], config.port));
    let listener = tokio::net::TcpListener::bind(addr).await?;
    tracing::info!("Server listening on {}", addr);

    axum::serve(listener, app).await?;

    Ok(())
}

fn api_routes(state: Arc<AppState>, io: SocketIo) -> Router {
    Router::new()
        // Themes
        .route("/themes", get(routes::themes::list_themes))
        .route("/themes/:theme_id", get(routes::themes::get_theme))
        .route(
            "/themes/:theme_id/room",
            get(routes::themes::get_or_create_room_by_theme),
        )
        // Rooms
        .route("/rooms", post(routes::rooms::create_room))
        .route("/rooms/:room_code", get(routes::rooms::get_room))
        // Drawings - 合并 GET 和 POST 到同一路径
        .route(
            "/rooms/:room_code/drawings",
            get(routes::rooms::list_drawings).post(routes::drawings::create_drawing),
        )
        .route("/drawings/:drawing_id", get(routes::drawings::get_drawing))
        .route(
            "/drawings/:drawing_id/image",
            get(routes::drawings::get_drawing_image),
        )
        .route(
            "/drawings/:drawing_id/vote",
            post(routes::drawings::vote_drawing),
        )
        .route(
            "/drawings/:drawing_id/report",
            post(routes::drawings::report_drawing),
        )
        .route("/auth/wechat_mp/login", post(routes::auth::wechat_mp_login))
        .route("/auth/dev/login", post(routes::dev_auth::dev_login))
        .route("/auth/me", get(routes::auth::me))
        .route("/auth/logout", post(routes::auth::logout))
        .route("/game/start", post(routes::game::start_game))
        .route("/game/catch", post(routes::game::catch_fish))
        .route("/game/submit", post(routes::game::submit_game))
        .route(
            "/game/fish/:fish_instance_id/image",
            get(routes::game::get_fish_image),
        )
        // n8n callback
        .route("/n8n/callback", post(routes::n8n_callback::callback))
        .with_state(state)
        .layer(Extension(io))
}

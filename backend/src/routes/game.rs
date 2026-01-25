use axum::{
    extract::{Path, State},
    http::{header, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use chrono::{Duration, Utc};
use rand::{rngs::StdRng, seq::SliceRandom, SeedableRng};
use std::sync::Arc;
use uuid::Uuid;

use crate::models::{single_player_fish_image_url, SinglePlayerRun, SinglePlayerRunFish};
use crate::services::{image_store::decode_image_data, ApiError, AppState};

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartGameRequest {
    pub session_id: String,
    pub level: i32,
    #[serde(default)]
    pub theme_id: Option<String>,
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StartGameResponse {
    pub run_id: String,
    pub ends_at: chrono::DateTime<chrono::Utc>,
    pub lives_remaining: i32,
    pub target_total: i32,
    pub targets_found: i32,
    pub fish: Vec<FishCard>,
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FishCard {
    pub fish_instance_id: String,
    pub image_url: String,
    pub difficulty_level: i32,
    pub metadata: serde_json::Value,
}

#[derive(Clone, Copy)]
struct LevelConfig {
    total: i32,
    ai: i32,
    seconds: i32,
    max_mistakes: i32,
    target_total: i32,
    difficulty_level: i32,
}

fn level_config(level: i32) -> Option<LevelConfig> {
    match level {
        1 => Some(LevelConfig {
            total: 10,
            ai: 3,
            seconds: 60,
            max_mistakes: 3,
            target_total: 3,
            difficulty_level: 1,
        }),
        2 => Some(LevelConfig {
            total: 20,
            ai: 5,
            seconds: 60,
            max_mistakes: 3,
            target_total: 3,
            difficulty_level: 2,
        }),
        3 => Some(LevelConfig {
            total: 30,
            ai: 7,
            seconds: 60,
            max_mistakes: 3,
            target_total: 3,
            difficulty_level: 3,
        }),
        _ => None,
    }
}

#[derive(Clone, sqlx::FromRow)]
struct FishLibraryRow {
    id: Uuid,
    difficulty_level: i32,
    metadata: serde_json::Value,
}

pub async fn start_game(
    State(state): State<Arc<AppState>>,
    Json(req): Json<StartGameRequest>,
) -> Result<Json<StartGameResponse>, ApiError> {
    let cfg = level_config(req.level).ok_or(ApiError::BadRequest("Invalid level".to_string()))?;
    let allow_duplicates = req.level <= state.config.single_player_allow_duplicates_max_level;

    let human_needed = cfg.total - cfg.ai;
    if human_needed < 0 {
        return Err(ApiError::BadRequest("Invalid level config".to_string()));
    }

    let ends_at = Utc::now() + Duration::seconds(cfg.seconds as i64);

    let mut tx = state.db.begin().await?;
    let mut rng = StdRng::from_entropy();

    let theme_uuid: Option<Uuid> = if let Some(theme_id) = req.theme_id.as_ref() {
        let theme_uuid: Option<Uuid> =
            sqlx::query_scalar("SELECT id FROM themes WHERE theme_id = $1")
                .bind(theme_id)
                .fetch_optional(&mut *tx)
                .await?;
        theme_uuid
    } else {
        None
    };

    let run_id = Uuid::new_v4();
    let run: SinglePlayerRun = sqlx::query_as(
        r#"
        INSERT INTO single_player_runs (
            id, session_id, theme_id, level, status,
            max_mistakes, mistakes, target_total, targets_found, ends_at
        )
        VALUES ($1, $2, $3, $4, 'active', $5, 0, $6, 0, $7)
        RETURNING *
        "#,
    )
    .bind(run_id)
    .bind(&req.session_id)
    .bind(theme_uuid)
    .bind(req.level)
    .bind(cfg.max_mistakes)
    .bind(cfg.target_total)
    .bind(ends_at)
    .fetch_one(&mut *tx)
    .await?;

    let mut humans: Vec<FishLibraryRow> = sqlx::query_as(
        r#"
        SELECT id, difficulty_level, metadata
        FROM human_fish
        WHERE is_active = TRUE AND difficulty_level = $1
        ORDER BY (-LN(random()) / GREATEST(weight, 1)) ASC
        LIMIT $2
        "#,
    )
    .bind(cfg.difficulty_level)
    .bind(human_needed)
    .fetch_all(&mut *tx)
    .await?;

    let mut ais: Vec<FishLibraryRow> = sqlx::query_as(
        r#"
        SELECT id, difficulty_level, metadata
        FROM ai_fish
        WHERE is_active = TRUE AND difficulty_level = $1
        ORDER BY (-LN(random()) / GREATEST(weight, 1)) ASC
        LIMIT $2
        "#,
    )
    .bind(cfg.difficulty_level)
    .bind(cfg.ai)
    .fetch_all(&mut *tx)
    .await?;

    if human_needed > 0 && humans.is_empty() {
        return Err(ApiError::BadRequest(
            "Not enough human fish library data".to_string(),
        ));
    }
    if cfg.ai > 0 && ais.is_empty() {
        return Err(ApiError::BadRequest(
            "Not enough ai fish library data".to_string(),
        ));
    }

    if humans.len() < human_needed as usize || ais.len() < cfg.ai as usize {
        if !allow_duplicates {
            return Err(ApiError::BadRequest(
                "Not enough fish library data".to_string(),
            ));
        }

        while humans.len() < human_needed as usize {
            let picked = humans
                .choose(&mut rng)
                .cloned()
                .ok_or(ApiError::BadRequest(
                    "Not enough human fish library data".to_string(),
                ))?;
            humans.push(picked);
        }
        while ais.len() < cfg.ai as usize {
            let picked = ais.choose(&mut rng).cloned().ok_or(ApiError::BadRequest(
                "Not enough ai fish library data".to_string(),
            ))?;
            ais.push(picked);
        }
    }

    enum Kind {
        Human,
        Ai,
    }

    struct SelectedFish {
        kind: Kind,
        id: Uuid,
        difficulty_level: i32,
        metadata: serde_json::Value,
    }

    let mut selected: Vec<SelectedFish> = Vec::with_capacity(cfg.total as usize);
    selected.extend(humans.drain(..).map(|f| SelectedFish {
        kind: Kind::Human,
        id: f.id,
        difficulty_level: f.difficulty_level,
        metadata: f.metadata,
    }));
    selected.extend(ais.drain(..).map(|f| SelectedFish {
        kind: Kind::Ai,
        id: f.id,
        difficulty_level: f.difficulty_level,
        metadata: f.metadata,
    }));

    selected.shuffle(&mut rng);

    let mut fish_cards: Vec<FishCard> = Vec::with_capacity(selected.len());

    for (order_index, fish) in selected.into_iter().enumerate() {
        let fish_instance_id = Uuid::new_v4();
        let fish_kind = match fish.kind {
            Kind::Human => "HUMAN",
            Kind::Ai => "AI",
        };

        let _run_fish: SinglePlayerRunFish = sqlx::query_as(
            r#"
            INSERT INTO single_player_run_fish (
                id, run_id, fish_kind, fish_id, order_index, is_caught
            )
            VALUES ($1, $2, $3, $4, $5, FALSE)
            RETURNING *
            "#,
        )
        .bind(fish_instance_id)
        .bind(run.id)
        .bind(fish_kind)
        .bind(fish.id)
        .bind(order_index as i32)
        .fetch_one(&mut *tx)
        .await?;

        fish_cards.push(FishCard {
            fish_instance_id: fish_instance_id.to_string(),
            image_url: single_player_fish_image_url(fish_instance_id),
            difficulty_level: fish.difficulty_level,
            metadata: fish.metadata,
        });
    }

    tx.commit().await?;

    Ok(Json(StartGameResponse {
        run_id: run.id.to_string(),
        ends_at: run.ends_at,
        lives_remaining: run.max_mistakes - run.mistakes,
        target_total: run.target_total,
        targets_found: run.targets_found,
        fish: fish_cards,
    }))
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CatchRequest {
    pub session_id: String,
    pub run_id: String,
    pub fish_instance_id: String,
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CatchResponse {
    pub correct: Option<bool>,
    pub caught_already: bool,
    pub lives_remaining: i32,
    pub mistakes: i32,
    pub targets_found: i32,
    pub target_total: i32,
    pub status: String,
    pub ends_at: chrono::DateTime<chrono::Utc>,
}

pub async fn catch_fish(
    State(state): State<Arc<AppState>>,
    Json(req): Json<CatchRequest>,
) -> Result<Json<CatchResponse>, ApiError> {
    let run_id = Uuid::parse_str(&req.run_id)
        .map_err(|_| ApiError::BadRequest("Invalid runId".to_string()))?;
    let fish_instance_id = Uuid::parse_str(&req.fish_instance_id)
        .map_err(|_| ApiError::BadRequest("Invalid fishInstanceId".to_string()))?;

    let mut tx = state.db.begin().await?;

    let mut run: SinglePlayerRun =
        sqlx::query_as("SELECT * FROM single_player_runs WHERE id = $1 FOR UPDATE")
            .bind(run_id)
            .fetch_optional(&mut *tx)
            .await?
            .ok_or(ApiError::NotFound("Run not found".to_string()))?;

    if run.session_id != req.session_id {
        return Err(ApiError::NotFound("Run not found".to_string()));
    }

    let now = Utc::now();
    if run.status == "active" && now > run.ends_at {
        run = sqlx::query_as(
            "UPDATE single_player_runs SET status = 'expired' WHERE id = $1 RETURNING *",
        )
        .bind(run.id)
        .fetch_one(&mut *tx)
        .await?;
    }

    if run.status != "active" {
        tx.commit().await?;
        return Ok(Json(CatchResponse {
            correct: None,
            caught_already: false,
            lives_remaining: run.max_mistakes - run.mistakes,
            mistakes: run.mistakes,
            targets_found: run.targets_found,
            target_total: run.target_total,
            status: run.status,
            ends_at: run.ends_at,
        }));
    }

    let run_fish: SinglePlayerRunFish = sqlx::query_as(
        "SELECT * FROM single_player_run_fish WHERE id = $1 AND run_id = $2 FOR UPDATE",
    )
    .bind(fish_instance_id)
    .bind(run.id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(ApiError::NotFound("Fish not found".to_string()))?;

    if run_fish.is_caught {
        tx.commit().await?;
        return Ok(Json(CatchResponse {
            correct: None,
            caught_already: true,
            lives_remaining: run.max_mistakes - run.mistakes,
            mistakes: run.mistakes,
            targets_found: run.targets_found,
            target_total: run.target_total,
            status: run.status,
            ends_at: run.ends_at,
        }));
    }

    let correct = run_fish.fish_kind.to_uppercase() == "AI";

    let _ = sqlx::query(
        "UPDATE single_player_run_fish SET is_caught = TRUE, caught_at = NOW() WHERE id = $1",
    )
    .bind(run_fish.id)
    .execute(&mut *tx)
    .await?;

    let _ = sqlx::query(
        "INSERT INTO single_player_catches (id, run_id, run_fish_id, correct) VALUES ($1, $2, $3, $4)",
    )
    .bind(Uuid::new_v4())
    .bind(run.id)
    .bind(run_fish.id)
    .bind(correct)
    .execute(&mut *tx)
    .await?;

    let new_mistakes = if correct {
        run.mistakes
    } else {
        run.mistakes + 1
    };
    let new_targets_found = if correct {
        run.targets_found + 1
    } else {
        run.targets_found
    };

    let new_status = if new_targets_found >= run.target_total {
        "victory"
    } else if new_mistakes >= run.max_mistakes {
        "defeat"
    } else {
        "active"
    };

    run = sqlx::query_as(
        r#"
        UPDATE single_player_runs
        SET mistakes = $2, targets_found = $3, status = $4
        WHERE id = $1
        RETURNING *
        "#,
    )
    .bind(run.id)
    .bind(new_mistakes)
    .bind(new_targets_found)
    .bind(new_status)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(CatchResponse {
        correct: Some(correct),
        caught_already: false,
        lives_remaining: run.max_mistakes - run.mistakes,
        mistakes: run.mistakes,
        targets_found: run.targets_found,
        target_total: run.target_total,
        status: run.status,
        ends_at: run.ends_at,
    }))
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubmitRequest {
    pub session_id: String,
    pub run_id: String,
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SubmitResponse {
    pub run_id: String,
    pub status: String,
    pub started_at: chrono::DateTime<chrono::Utc>,
    pub ends_at: chrono::DateTime<chrono::Utc>,
    pub submitted_at: chrono::DateTime<chrono::Utc>,
    pub mistakes: i32,
    pub max_mistakes: i32,
    pub targets_found: i32,
    pub target_total: i32,
}

pub async fn submit_game(
    State(state): State<Arc<AppState>>,
    Json(req): Json<SubmitRequest>,
) -> Result<Json<SubmitResponse>, ApiError> {
    let run_id = Uuid::parse_str(&req.run_id)
        .map_err(|_| ApiError::BadRequest("Invalid runId".to_string()))?;

    let mut tx = state.db.begin().await?;

    let mut run: SinglePlayerRun =
        sqlx::query_as("SELECT * FROM single_player_runs WHERE id = $1 FOR UPDATE")
            .bind(run_id)
            .fetch_optional(&mut *tx)
            .await?
            .ok_or(ApiError::NotFound("Run not found".to_string()))?;

    if run.session_id != req.session_id {
        return Err(ApiError::NotFound("Run not found".to_string()));
    }

    let now = Utc::now();
    let finished = run.status != "active"
        || now >= run.ends_at
        || run.targets_found >= run.target_total
        || run.mistakes >= run.max_mistakes;

    if !finished {
        return Err(ApiError::BadRequest("Game not finished".to_string()));
    }

    let final_status = if run.targets_found >= run.target_total {
        "victory"
    } else if run.mistakes >= run.max_mistakes {
        "defeat"
    } else if now >= run.ends_at {
        "expired"
    } else {
        run.status.as_str()
    };

    run = sqlx::query_as(
        r#"
        UPDATE single_player_runs
        SET status = $2, submitted_at = COALESCE(submitted_at, NOW())
        WHERE id = $1
        RETURNING *
        "#,
    )
    .bind(run.id)
    .bind(final_status)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    let submitted_at = run
        .submitted_at
        .ok_or(ApiError::Internal("Submit failed".to_string()))?;

    Ok(Json(SubmitResponse {
        run_id: run.id.to_string(),
        status: run.status,
        started_at: run.started_at,
        ends_at: run.ends_at,
        submitted_at,
        mistakes: run.mistakes,
        max_mistakes: run.max_mistakes,
        targets_found: run.targets_found,
        target_total: run.target_total,
    }))
}

pub async fn get_fish_image(
    State(state): State<Arc<AppState>>,
    Path(fish_instance_id): Path<Uuid>,
) -> Result<Response, ApiError> {
    #[derive(sqlx::FromRow)]
    struct RunFishRow {
        fish_kind: String,
        fish_id: Uuid,
    }

    let run_fish: RunFishRow =
        sqlx::query_as("SELECT fish_kind, fish_id FROM single_player_run_fish WHERE id = $1")
            .bind(fish_instance_id)
            .fetch_optional(&state.db)
            .await?
            .ok_or(ApiError::NotFound("Fish not found".to_string()))?;

    let image_data: Option<String> = match run_fish.fish_kind.to_uppercase().as_str() {
        "AI" => {
            sqlx::query_scalar("SELECT image_data FROM ai_fish WHERE id = $1 AND is_active = TRUE")
                .bind(run_fish.fish_id)
                .fetch_optional(&state.db)
                .await?
                .flatten()
        }
        "HUMAN" => sqlx::query_scalar(
            "SELECT image_data FROM human_fish WHERE id = $1 AND is_active = TRUE",
        )
        .bind(run_fish.fish_id)
        .fetch_optional(&state.db)
        .await?
        .flatten(),
        _ => None,
    };

    let Some(image_data) = image_data else {
        return Err(ApiError::NotFound("Fish not found".to_string()));
    };

    let img = decode_image_data(&image_data)?;
    let mut resp = (StatusCode::OK, img.bytes).into_response();
    resp.headers_mut().insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static(img.content_type),
    );
    resp.headers_mut().insert(
        header::CACHE_CONTROL,
        HeaderValue::from_static("public, max-age=31536000, immutable"),
    );
    Ok(resp)
}

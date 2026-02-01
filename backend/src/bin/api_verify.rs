use anyhow::{anyhow, Context, Result};
use reqwest::StatusCode;
use serde_json::json;

const TEST_IMAGE_DATA_URL_1X1_PNG: &str = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/6XK7xkAAAAASUVORK5CYII=";

#[tokio::main]
async fn main() -> Result<()> {
    let base_url = std::env::var("API_BASE_URL").unwrap_or_else(|_| "http://localhost:3001".into());
    let api_url = format!("{}/api", base_url.trim_end_matches('/'));

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()?;

    health_check(&client, &base_url).await?;

    let theme_id = pick_theme_id(&client, &api_url).await?;
    let room_code = get_or_create_room(&client, &api_url, &theme_id).await?;
    assert_room_exists(&client, &api_url, &room_code, &theme_id).await?;
    let drawing_id = create_drawing(&client, &api_url, &room_code).await?;
    get_drawing_image(&client, &api_url, &drawing_id).await?;
    vote_twice_should_fail(&client, &api_url, &drawing_id).await?;
    report_twice_should_fail(&client, &api_url, &drawing_id).await?;

    single_player_smoke(&client, &api_url).await?;
    auth_smoke(&client, &api_url).await?;

    println!("OK");
    Ok(())
}

async fn health_check(client: &reqwest::Client, base_url: &str) -> Result<()> {
    let url = format!("{}/health", base_url.trim_end_matches('/'));
    let resp = client.get(&url).send().await.context("GET /health")?;
    ensure_status(resp, StatusCode::OK, "GET /health").await?;
    Ok(())
}

async fn pick_theme_id(client: &reqwest::Client, api_url: &str) -> Result<String> {
    let url = format!("{}/themes", api_url);
    let resp = client.get(&url).send().await.context("GET /api/themes")?;
    let body = ensure_status(resp, StatusCode::OK, "GET /api/themes").await?;
    let themes: Vec<serde_json::Value> = serde_json::from_slice(&body)?;
    let first = themes
        .first()
        .ok_or_else(|| anyhow!("No themes returned"))?;
    let theme_id = first
        .get("theme_id")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow!("Missing theme_id in /api/themes response"))?;
    Ok(theme_id.to_string())
}

async fn get_or_create_room(
    client: &reqwest::Client,
    api_url: &str,
    theme_id: &str,
) -> Result<String> {
    let url = format!("{}/themes/{}/room", api_url, theme_id);
    let resp = client
        .get(&url)
        .send()
        .await
        .with_context(|| format!("GET /api/themes/{}/room", theme_id))?;
    let body = ensure_status(resp, StatusCode::OK, "GET /api/themes/:theme_id/room").await?;
    let v: serde_json::Value = serde_json::from_slice(&body)?;
    let room_code = v
        .get("roomCode")
        .and_then(|x| x.as_str())
        .ok_or_else(|| anyhow!("Missing roomCode in room response"))?;
    Ok(room_code.to_string())
}

async fn assert_room_exists(
    client: &reqwest::Client,
    api_url: &str,
    room_code: &str,
    theme_id: &str,
) -> Result<()> {
    let url = format!("{}/rooms/{}", api_url, room_code);
    let resp = client
        .get(&url)
        .send()
        .await
        .with_context(|| format!("GET /api/rooms/{}", room_code))?;
    let body = ensure_status(resp, StatusCode::OK, "GET /api/rooms/:room_code").await?;
    let v: serde_json::Value = serde_json::from_slice(&body)?;

    let got_room_code = v
        .get("room")
        .and_then(|x| x.get("roomId"))
        .and_then(|x| x.as_str())
        .ok_or_else(|| anyhow!("Missing room.roomId in room response"))?;
    if got_room_code != room_code {
        return Err(anyhow!(
            "GET /api/rooms/:room_code roomId mismatch expected={} got={}",
            room_code,
            got_room_code
        ));
    }

    let got_theme_id = v
        .get("theme")
        .and_then(|x| x.get("theme_id"))
        .and_then(|x| x.as_str())
        .ok_or_else(|| anyhow!("Missing theme.theme_id in room response"))?;
    if got_theme_id != theme_id {
        return Err(anyhow!(
            "GET /api/rooms/:room_code theme_id mismatch expected={} got={}",
            theme_id,
            got_theme_id
        ));
    }

    Ok(())
}

async fn create_drawing(
    client: &reqwest::Client,
    api_url: &str,
    room_code: &str,
) -> Result<String> {
    let url = format!("{}/rooms/{}/drawings", api_url, room_code);
    let body = json!({
        "image_data": TEST_IMAGE_DATA_URL_1X1_PNG,
        "name": "test",
        "description": null,
        "session_id": "api-verify-session",
        "author_name": "api-verify",
    });

    let resp = client
        .post(&url)
        .json(&body)
        .send()
        .await
        .with_context(|| format!("POST /api/rooms/{}/drawings", room_code))?;
    let bytes = ensure_status(resp, StatusCode::OK, "POST /api/rooms/:room_code/drawings").await?;
    let v: serde_json::Value = serde_json::from_slice(&bytes)?;
    let id = v
        .get("id")
        .and_then(|x| x.as_str())
        .ok_or_else(|| anyhow!("Missing id in create drawing response"))?;
    Ok(id.to_string())
}

async fn get_drawing_image(
    client: &reqwest::Client,
    api_url: &str,
    drawing_id: &str,
) -> Result<()> {
    let url = format!("{}/drawings/{}/image", api_url, drawing_id);
    let resp = client
        .get(&url)
        .send()
        .await
        .with_context(|| format!("GET /api/drawings/{}/image", drawing_id))?;
    let status = resp.status();
    let content_type = resp
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();
    let body = resp.bytes().await.unwrap_or_default().to_vec();
    if status != StatusCode::OK {
        return Err(anyhow!(
            "GET /api/drawings/:id/image expected 200, got {} body={}",
            status,
            String::from_utf8_lossy(&body)
        ));
    }
    if !content_type.starts_with("image/png") {
        return Err(anyhow!(
            "GET /api/drawings/:id/image expected Content-Type image/png, got {}",
            content_type
        ));
    }
    if body.is_empty() {
        return Err(anyhow!(
            "GET /api/drawings/:id/image expected non-empty body"
        ));
    }
    Ok(())
}

async fn vote_twice_should_fail(
    client: &reqwest::Client,
    api_url: &str,
    drawing_id: &str,
) -> Result<()> {
    let url = format!("{}/drawings/{}/vote", api_url, drawing_id);
    let body = json!({ "session_id": "api-verify-session" });

    let resp1 = client.post(&url).json(&body).send().await?;
    ensure_status(resp1, StatusCode::OK, "POST /api/drawings/:id/vote first").await?;

    let resp2 = client.post(&url).json(&body).send().await?;
    ensure_status(
        resp2,
        StatusCode::BAD_REQUEST,
        "POST /api/drawings/:id/vote second",
    )
    .await?;
    Ok(())
}

async fn report_twice_should_fail(
    client: &reqwest::Client,
    api_url: &str,
    drawing_id: &str,
) -> Result<()> {
    let url = format!("{}/drawings/{}/report", api_url, drawing_id);
    let body = json!({ "session_id": "api-verify-session", "reason": "test" });

    let resp1 = client.post(&url).json(&body).send().await?;
    ensure_status(resp1, StatusCode::OK, "POST /api/drawings/:id/report first").await?;

    let resp2 = client.post(&url).json(&body).send().await?;
    ensure_status(
        resp2,
        StatusCode::BAD_REQUEST,
        "POST /api/drawings/:id/report second",
    )
    .await?;
    Ok(())
}

async fn single_player_smoke(client: &reqwest::Client, api_url: &str) -> Result<()> {
    let start_url = format!("{}/game/start", api_url);
    let req = json!({ "sessionId": "api-verify-session", "level": 1 });
    let resp = client.post(&start_url).json(&req).send().await?;
    let bytes = ensure_status(resp, StatusCode::OK, "POST /api/game/start").await?;
    let v: serde_json::Value = serde_json::from_slice(&bytes)?;
    let run_id = v
        .get("runId")
        .and_then(|x| x.as_str())
        .ok_or_else(|| anyhow!("Missing runId in start response"))?
        .to_string();
    let fish = v
        .get("fish")
        .and_then(|x| x.as_array())
        .ok_or_else(|| anyhow!("Missing fish array in start response"))?;

    let catch_url = format!("{}/game/catch", api_url);
    let mut finished = false;
    for item in fish {
        let fish_instance_id = item
            .get("fishInstanceId")
            .and_then(|x| x.as_str())
            .ok_or_else(|| anyhow!("Missing fishInstanceId in start response fish entry"))?;

        let req = json!({
            "sessionId": "api-verify-session",
            "runId": run_id.clone(),
            "fishInstanceId": fish_instance_id,
        });
        let resp = client.post(&catch_url).json(&req).send().await?;
        let bytes = ensure_status(resp, StatusCode::OK, "POST /api/game/catch").await?;
        let v: serde_json::Value = serde_json::from_slice(&bytes)?;
        let status = v.get("status").and_then(|x| x.as_str()).unwrap_or("active");
        if status != "active" {
            finished = true;
            break;
        }
    }
    if !finished {
        return Err(anyhow!(
            "Single player run still active after catching all fish"
        ));
    }

    let submit_url = format!("{}/game/submit", api_url);
    let req = json!({ "sessionId": "api-verify-session", "runId": run_id });
    let resp = client.post(&submit_url).json(&req).send().await?;
    ensure_status(resp, StatusCode::OK, "POST /api/game/submit").await?;

    Ok(())
}

async fn auth_smoke(client: &reqwest::Client, api_url: &str) -> Result<()> {
    let login_url = format!("{}/auth/dev/login", api_url);
    let resp = client.post(&login_url).json(&json!({})).send().await?;
    if resp.status() == StatusCode::NOT_FOUND || resp.status() == StatusCode::FORBIDDEN {
        return Ok(());
    }
    let bytes = ensure_status(resp, StatusCode::OK, "POST /api/auth/dev/login").await?;
    let v: serde_json::Value = serde_json::from_slice(&bytes)?;
    let token = v
        .get("token")
        .and_then(|x| x.as_str())
        .ok_or_else(|| anyhow!("Missing token in dev login response"))?
        .to_string();

    let me_url = format!("{}/auth/me", api_url);
    let resp = client
        .get(&me_url)
        .bearer_auth(&token)
        .send()
        .await
        .context("GET /api/auth/me")?;
    ensure_status(resp, StatusCode::OK, "GET /api/auth/me").await?;

    let logout_url = format!("{}/auth/logout", api_url);
    let resp = client
        .post(&logout_url)
        .bearer_auth(&token)
        .send()
        .await
        .context("POST /api/auth/logout")?;
    ensure_status(resp, StatusCode::OK, "POST /api/auth/logout").await?;

    let resp = client
        .get(&me_url)
        .bearer_auth(&token)
        .send()
        .await
        .context("GET /api/auth/me after logout")?;
    ensure_status(
        resp,
        StatusCode::UNAUTHORIZED,
        "GET /api/auth/me after logout",
    )
    .await?;

    Ok(())
}

async fn ensure_status(
    resp: reqwest::Response,
    expected: StatusCode,
    name: &str,
) -> Result<Vec<u8>> {
    let status = resp.status();
    let body = resp.bytes().await.unwrap_or_default().to_vec();
    if status != expected {
        return Err(anyhow!(
            "{} expected {}, got {} body={}",
            name,
            expected,
            status,
            String::from_utf8_lossy(&body)
        ));
    }
    Ok(body)
}

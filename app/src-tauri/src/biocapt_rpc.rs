//! Tauri commands that proxy to the bioCAPT cognitive service.
//!
//! These commands are thin wrappers over the bioCAPT HTTP API so the
//! frontend can call bioCAPT without CORS issues.

use serde_json::Value;

const DEFAULT_BIOCAPT_URL: &str = "http://127.0.0.1:8787";

fn biocapt_url() -> String {
    std::env::var("BIOCAPT_API_URL").unwrap_or_else(|_| DEFAULT_BIOCAPT_URL.to_string())
}

async fn biocapt_get(path: &str) -> Result<Value, String> {
    let url = format!("{}{path}", biocapt_url());
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("client build: {e}"))?;

    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("bioCAPT GET {path}: {e}"))?;

    if !resp.status().is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("bioCAPT {path} returned error: {text}"));
    }

    resp.json::<Value>()
        .await
        .map_err(|e| format!("bioCAPT {path} parse error: {e}"))
}

async fn biocapt_post(path: &str, body: Value) -> Result<Value, String> {
    let url = format!("{}{path}", biocapt_url());
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("client build: {e}"))?;

    let resp = client
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("bioCAPT POST {path}: {e}"))?;

    if !resp.status().is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("bioCAPT {path} returned error: {text}"));
    }

    resp.json::<Value>()
        .await
        .map_err(|e| format!("bioCAPT {path} parse error: {e}"))
}

#[tauri::command]
pub async fn capt_health() -> Result<Value, String> {
    biocapt_get("/health").await
}

#[tauri::command]
pub async fn capt_status() -> Result<Value, String> {
    biocapt_get("/status").await
}

#[tauri::command]
pub async fn capt_ingest(text: String, source: String) -> Result<Value, String> {
    biocapt_post(
        "/ingest",
        serde_json::json!({
            "text": text,
            "source": source,
            "event_type": "memory_store",
            "metadata": {}
        }),
    )
    .await
}

#[tauri::command]
pub async fn capt_sweep(max_events: usize) -> Result<Value, String> {
    biocapt_post("/sweep", serde_json::json!({"max_events": max_events})).await
}

#[tauri::command]
pub async fn capt_cogitate(query: String) -> Result<Value, String> {
    biocapt_post(
        "/cogitate",
        serde_json::json!({
            "query": query,
            "module_context": {}
        }),
    )
    .await
}

#[tauri::command]
pub async fn capt_query_memory(wing: String, query: Option<String>) -> Result<Value, String> {
    let path = match query {
        Some(q) => format!("/memory/{wing}?query={}", urlencoding::encode(&q)),
        None => format!("/memory/{wing}"),
    };
    biocapt_get(&path).await
}

#[tauri::command]
pub async fn capt_consolidate() -> Result<Value, String> {
    biocapt_post("/consolidate", serde_json::json!({})).await
}

#[tauri::command]
pub async fn capt_evals() -> Result<Value, String> {
    biocapt_get("/evals").await
}

#[tauri::command]
pub async fn capt_reflect(minutes: u32, deep: bool) -> Result<Value, String> {
    biocapt_post(
        "/reflect",
        serde_json::json!({"minutes": minutes, "deep": deep}),
    )
    .await
}

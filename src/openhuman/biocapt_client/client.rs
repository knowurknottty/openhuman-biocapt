//! HTTP client for the bioCAPT cognitive service.
//!
//! Communicates with the local bioCAPT API server (default port 8787).
//! All methods are async and return `anyhow::Result`.
//!
//! The client is cheaply cloneable (holds an `Arc<reqwest::Client>`).

use std::sync::Arc;
use std::time::Duration;

use anyhow::{Context, Result};
use serde::de::DeserializeOwned;
use serde_json::json;

use super::types::*;

const DEFAULT_BASE_URL: &str = "http://127.0.0.1:8787";
const DEFAULT_TIMEOUT: Duration = Duration::from_secs(30);
const LONG_TIMEOUT: Duration = Duration::from_secs(120);

/// High-level client for bioCAPT HTTP API.
#[derive(Clone)]
pub struct BiocaptClient {
    http: Arc<reqwest::Client>,
    base_url: String,
}

impl BiocaptClient {
    /// Create a new client pointing at `base_url`.
    pub fn new(base_url: impl Into<String>) -> Result<Self> {
        let http = reqwest::Client::builder()
            .timeout(DEFAULT_TIMEOUT)
            .connect_timeout(Duration::from_secs(5))
            .build()
            .context("Failed to build reqwest client for bioCAPT")?;

        Ok(Self {
            http: Arc::new(http),
            base_url: base_url.into(),
        })
    }

    /// Default client for localhost:8787.
    pub fn default_local() -> Result<Self> {
        Self::new(DEFAULT_BASE_URL)
    }

    /// Check if bioCAPT is reachable and healthy.
    pub async fn health(&self) -> Result<HealthResponse> {
        self.get("/health").await
    }

    /// Full CAPT status including module counts and sweep stats.
    pub async fn status(&self) -> Result<CaptStatus> {
        self.get("/status").await
    }

    /// Ingest text into ECHO memory palace.
    pub async fn ingest(&self, request: IngestRequest) -> Result<IngestResponse> {
        self.post("/ingest", &request).await
    }

    /// Convenience: ingest a plain text string.
    pub async fn ingest_text(
        &self,
        text: impl Into<String>,
        source: impl Into<String>,
    ) -> Result<IngestResponse> {
        self.ingest(IngestRequest::new(text).with_source(source)).await
    }

    /// Run a cognitive sweep over recent events.
    pub async fn sweep(&self, max_events: usize) -> Result<SweepResponse> {
        self.post("/sweep", &SweepRequest { max_events }).await
    }

    /// Run a full CAPT cogitation (all 46+ modules).
    ///
    /// Uses a longer timeout because cogitation may invoke an LLM.
    pub async fn cogitate(&self, query: impl Into<String>) -> Result<CogitateResponse> {
        self.post_with_timeout(
            "/cogitate",
            &CogitateRequest {
                query: query.into(),
                module_context: json!({}),
            },
            LONG_TIMEOUT,
        )
        .await
    }

    /// Query ECHO memory for traces in a wing/room.
    pub async fn query_memory(
        &self,
        wing: impl AsRef<str>,
        room: Option<&str>,
        query: Option<&str>,
    ) -> Result<MemoryQueryResponse> {
        let wing = wing.as_ref();
        let path = match room {
            Some(r) => format!("/memory/{wing}/{r}"),
            None => format!("/memory/{wing}"),
        };
        let mut url = format!("{}{path}", self.base_url);
        if let Some(q) = query {
            url = format!("{url}?query={}", urlencoding::encode(q));
        }
        self.get_raw(&url).await
    }

    /// Trigger memory consolidation (dream-mode).
    pub async fn consolidate(&self) -> Result<ConsolidateResponse> {
        self.post("/consolidate", &serde_json::Value::Object(Default::default()))
            .await
    }

    /// Get latest CAPT eval reports.
    pub async fn evals(&self) -> Result<EvalsResponse> {
        self.get("/evals").await
    }

    /// Run deep reflection on recent activity.
    pub async fn reflect(&self, minutes: u32, deep: bool) -> Result<ReflectResponse> {
        self.post(
            "/reflect",
            &ReflectRequest { minutes, deep },
        )
        .await
    }

    /// Submit a file to the CAPT inbox.
    pub async fn inbox_submit(
        &self,
        filename: impl Into<String>,
        content: impl Into<String>,
    ) -> Result<serde_json::Value> {
        self.post(
            "/inbox/submit",
            &InboxSubmitRequest {
                filename: filename.into(),
                content: content.into(),
                source: "openhuman".to_string(),
            },
        )
        .await
    }

    /// List files in CAPT inbox.
    pub async fn inbox_list(&self) -> Result<InboxListResponse> {
        self.get("/inbox/list").await
    }

    /// List files in CAPT outbox.
    pub async fn outbox_list(&self) -> Result<OutboxListResponse> {
        self.get("/outbox/list").await
    }

    // ── Low-level helpers ───────────────────────────────────────────────

    async fn get<T: DeserializeOwned>(&self, path: &str) -> Result<T> {
        let url = format!("{}{path}", self.base_url);
        tracing::debug!("[biocapt] GET {url}");
        let resp = self
            .http
            .get(&url)
            .send()
            .await
            .with_context(|| format!("bioCAPT GET {path} failed"))?;

        let status = resp.status();
        if !status.is_success() {
            let text = resp.text().await.unwrap_or_default();
            anyhow::bail!("bioCAPT {path} returned {status}: {text}");
        }

        resp.json::<T>()
            .await
            .with_context(|| format!("Failed to parse bioCAPT {path} response"))
    }

    async fn get_raw<T: DeserializeOwned>(&self, url: &str) -> Result<T> {
        tracing::debug!("[biocapt] GET {url}");
        let resp = self
            .http
            .get(url)
            .send()
            .await
            .with_context(|| format!("bioCAPT GET {url} failed"))?;

        let status = resp.status();
        if !status.is_success() {
            let text = resp.text().await.unwrap_or_default();
            anyhow::bail!("bioCAPT {url} returned {status}: {text}");
        }

        resp.json::<T>()
            .await
            .with_context(|| format!("Failed to parse bioCAPT {url} response"))
    }

    async fn post<T: DeserializeOwned>(
        &self,
        path: &str,
        body: &impl serde::Serialize,
    ) -> Result<T> {
        self.post_with_timeout(path, body, DEFAULT_TIMEOUT).await
    }

    async fn post_with_timeout<T: DeserializeOwned>(
        &self,
        path: &str,
        body: &impl serde::Serialize,
        timeout: Duration,
    ) -> Result<T> {
        let url = format!("{}{path}", self.base_url);
        tracing::debug!("[biocapt] POST {path}");
        let resp = self
            .http
            .post(&url)
            .timeout(timeout)
            .json(body)
            .send()
            .await
            .with_context(|| format!("bioCAPT POST {path} failed"))?;

        let status = resp.status();
        if !status.is_success() {
            let text = resp.text().await.unwrap_or_default();
            anyhow::bail!("bioCAPT {path} returned {status}: {text}");
        }

        resp.json::<T>()
            .await
            .with_context(|| format!("Failed to parse bioCAPT POST {path} response"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn client_constructs() {
        let client = BiocaptClient::default_local();
        assert!(client.is_ok());
    }

    #[test]
    fn client_custom_url() {
        let client = BiocaptClient::new("http://localhost:9999");
        assert!(client.is_ok());
    }
}

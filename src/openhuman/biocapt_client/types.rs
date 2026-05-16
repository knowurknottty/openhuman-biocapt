//! Request/response types for the bioCAPT HTTP API.
//!
//! Mirrors the Pydantic models in `capt_symbiote/api_server.py`.

use serde::{Deserialize, Serialize};

// ── Health ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthResponse {
    pub status: String,
    pub uptime_seconds: f64,
    pub daemon_attached: bool,
}

// ── Status ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaptStatus {
    pub daemon_running: bool,
    pub events_ingested: u64,
    pub insights_generated: u64,
    pub alerts_generated: u64,
    pub capt_healthy: bool,
    pub modules_active: usize,
    pub sweeps_completed: u64,
    pub last_sweep_age_seconds: Option<f64>,
    pub latest_sweep: Option<serde_json::Value>,
    pub file_feed: FileFeedStatus,
    pub timestamp: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileFeedStatus {
    pub inbox: String,
    pub outbox: String,
    pub processed_files: u64,
}

// ── Ingest ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IngestRequest {
    pub text: String,
    #[serde(default = "default_source")]
    pub source: String,
    #[serde(default = "default_event_type")]
    pub event_type: String,
    #[serde(default)]
    pub metadata: serde_json::Value,
}

impl IngestRequest {
    pub fn new(text: impl Into<String>) -> Self {
        Self {
            text: text.into(),
            source: default_source(),
            event_type: default_event_type(),
            metadata: serde_json::Value::Object(Default::default()),
        }
    }

    pub fn with_source(mut self, source: impl Into<String>) -> Self {
        self.source = source.into();
        self
    }

    pub fn with_metadata(mut self, metadata: serde_json::Value) -> Self {
        self.metadata = metadata;
        self
    }
}

fn default_source() -> String {
    "openhuman".to_string()
}

fn default_event_type() -> String {
    "memory_store".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IngestResponse {
    pub success: bool,
    pub event_id: Option<String>,
    pub wing: Option<String>,
    pub room: Option<String>,
    #[serde(default)]
    pub error: Option<String>,
}

// ── Sweep ───────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SweepRequest {
    #[serde(default = "default_max_events")]
    pub max_events: usize,
}

fn default_max_events() -> usize {
    50
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SweepResponse {
    pub success: bool,
    pub modules_scanned: usize,
    pub insights: Vec<SweepInsight>,
    pub duration_ms: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SweepInsight {
    pub module: String,
    pub confidence: f64,
    pub observation: String,
}

// ── Cogitate ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CogitateRequest {
    pub query: String,
    #[serde(default)]
    pub module_context: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CogitateResponse {
    pub success: bool,
    pub pulse: Option<PulseResult>,
    #[serde(default)]
    pub module_insights: Vec<ModuleInsight>,
    pub duration_ms: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PulseResult {
    pub content: String,
    pub backend: String,
    pub model: String,
    pub input_tokens: Option<u64>,
    pub output_tokens: Option<u64>,
    pub duration_ms: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModuleInsight {
    pub module: String,
    pub insight: String,
    pub confidence: f64,
}

// ── Memory Query ────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryTrace {
    pub trace_id: String,
    pub content: String,
    pub wing: String,
    pub room: Option<String>,
    pub salience: f64,
    pub created_at: f64,
    pub rehearsal_count: u32,
    #[serde(default)]
    pub metadata: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryQueryResponse {
    pub traces: Vec<MemoryTrace>,
    pub count: usize,
}

// ── Consolidate ─────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConsolidateResponse {
    pub success: bool,
    pub memories_consolidated: usize,
    pub new_insights: Vec<String>,
}

// ── Evals ───────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvalsResponse {
    pub accuracy: f64,
    pub security: f64,
    pub governance: f64,
    pub boundaries: f64,
    pub overall: f64,
    pub last_eval: Option<String>,
}

// ── Reflect ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReflectRequest {
    #[serde(default = "default_reflect_minutes")]
    pub minutes: u32,
    #[serde(default)]
    pub deep: bool,
}

fn default_reflect_minutes() -> u32 {
    30
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReflectResponse {
    pub success: bool,
    pub insights: Vec<String>,
    pub patterns: Vec<String>,
    pub duration_ms: f64,
}

// ── Inbox / Outbox ──────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InboxSubmitRequest {
    pub filename: String,
    pub content: String,
    #[serde(default = "default_source")]
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InboxListResponse {
    pub files: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OutboxListResponse {
    pub files: Vec<OutboxFile>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OutboxFile {
    pub filename: String,
    pub created_at: f64,
    pub size_bytes: u64,
}

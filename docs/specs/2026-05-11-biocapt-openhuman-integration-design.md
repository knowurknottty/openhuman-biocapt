# bioCAPT ↔ OpenHuman Integration Design

**Date:** 2026-05-11  
**Scope:** Replace OpenHuman's SQLite Memory Tree with bioCAPT cognitive architecture (HMC, ECHO, NEDA, QIPC, IMMU, ENGRAM)  
**Approach:** Hybrid bridge — bioCAPT runs as local cognitive service, OpenHuman consumes via HTTP API + MCP + optional native rlib

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    OpenHuman (Tauri Desktop)                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │  Next.js UI  │  │  Rust Core  │  │    bioCAPT Client       │ │
│  │  (React)     │◄─┤  (Tauri)    │◄─┤  (REST + MCP + rlib)   │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
│           ▲                                    │                 │
│           │ Tauri IPC                          │ HTTP / MCP      │
│           ▼                                    ▼                 │
│  ┌────────────────────────────────────────────────────────────┐│
│  │              bioCAPT Cognitive Service                      ││
│  │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────────────┐ ││
│  │  │ HMC │ │ECHO │ │NEDA │ │QIPC │ │IMMU │ │   PULSE     │ ││
│  │  │     │ │     │ │     │ │     │ │     │ │  (ollama)   │ ││
│  │  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────────────┘ ││
│  │       REST API :8787  │  MCP stdio  │  File Feed          ││
│  └────────────────────────────────────────────────────────────┘│
│                              │                                   │
│                              ▼ (optional)                        │
│  ┌────────────────────────────────────────────────────────────┐│
│  │           Cloudflare Brains (capt-brain-01..05)            ││
│  └────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

**Key decision:** bioCAPT runs as a **separate local process** (not embedded in Rust). OpenHuman communicates via HTTP REST and MCP. This avoids PyO3 complexity, keeps bioCAPT's Python ecosystem intact, and allows independent scaling/restart.

---

## 2. Subsystem A: Memory Backend (`BiocaptMemory`)

### 2.1 Trait Implementation

New file: `src/openhuman/memory/biocapt/mod.rs`

```rust
pub struct BiocaptMemory {
    api_base: String,          // http://127.0.0.1:8787
    http: reqwest::Client,
    cache: Arc<RwLock<LruCache<String, Vec<MemoryEntry>>>>,
}

#[async_trait]
impl Memory for BiocaptMemory {
    async fn store(&self, namespace: &str, key: &str, content: &str, 
                   category: MemoryCategory, session_id: Option<&str>) -> Result<()> {
        // 1. IMMU scan via /evals or MCP capt_evals
        // 2. QIPC consensus via /cogitate (lightweight, no LLM)
        // 3. Ingest to ECHO via /ingest
    }
    
    async fn recall(&self, query: &str, limit: usize, opts: RecallOpts<'_>) -> Result<Vec<MemoryEntry>> {
        // 1. NEDA attention ranking via /memory query
        // 2. HMC holographic decode if vector match weak
        // 3. Return scored MemoryEntry vec
    }
    // ... get, list, forget, namespace_summaries, count, health_check
}
```

### 2.2 Namespace → bioCAPT Wing Mapping

| OpenHuman Namespace | bioCAPT Wing | Module |
|---------------------|-------------|--------|
| `global` | `openclaw` | ECHO |
| `background` | `background` | ECHO |
| `autocomplete` | `autocomplete` | ECHO |
| `skill-*` | `skill:{id}` | ECHO |
| `conversation` | `conversation` | ECHO |

### 2.3 Category → Salience Mapping

| MemoryCategory | ENGRAM Salience | HMC Priority |
|----------------|-----------------|--------------|
| `Core` | 0.9 | High (permanent trace) |
| `Daily` | 0.5 | Medium (time-decay) |
| `Conversation` | 0.3 | Low (ephemeral, compress) |
| `Custom` | 0.6 | Configurable |

### 2.4 Error Handling

- bioCAPT unreachable → fallback to SQLite `UnifiedMemory` (read-only mode)
- QIPC consensus rejects → return `ToolResult::error("Constitutional gate blocked")`
- IMMU scan flags secret → same path as existing `has_likely_secret`

---

## 3. Subsystem B: Rust Bridge (`biocapt-client`)

### 3.1 Client Crate

New crate: `src/openhuman/biocapt_client/`

```rust
// lib.rs
pub struct BiocaptClient {
    http: reqwest::Client,
    base_url: String,
    mcp: Option<McpConnection>, // optional stdio MCP
}

impl BiocaptClient {
    pub async fn health(&self) -> Result<HealthResponse>;
    pub async fn ingest(&self, text: &str, source: &str, metadata: Value) -> Result<IngestResponse>;
    pub async fn sweep(&self, max_events: usize) -> Result<SweepResult>;
    pub async fn cogitate(&self, query: &str) -> Result<CogitateResponse>;
    pub async fn query_memory(&self, wing: &str, room: Option<&str>, query: &str) -> Result<Vec<MemoryTrace>>;
    pub async fn consolidate(&self) -> Result<ConsolidateResponse>;
    pub async fn evals(&self) -> Result<EvalsResponse>;
    pub async fn reflect(&self, minutes: u32, deep: bool) -> Result<ReflectResponse>;
}
```

### 3.2 Lifecycle Management

- **Tauri sidecar:** bioCAPT API server spawned as Tauri sidecar process on app startup
- **Health polling:** Every 30s, fallback to SQLite if bioCAPT down > 3 attempts
- **Graceful shutdown:** SIGTERM on app quit, 5s timeout

### 3.3 Configuration

```toml
# openhuman config extension
[biocapt]
enabled = true
api_url = "http://127.0.0.1:8787"
mcp_enabled = true
mcp_command = "python3 -m capt_symbiote.mcp_server"
data_dir = "~/.biocapt"
ollama_url = "http://localhost:11434"
default_model = "llama3.2:3b"
cloud_sync = false  # opt-in to Cloudflare brains
```

---

## 4. Subsystem C: Frontend Visualization

### 4.1 New Page: `app/src/pages/Cognition.tsx`

Route: `/cognition` (add to Settings nav or top-level tab)

#### Panel 1: Memory Palace (`CognitionMemoryPalace`)
- Tree view: Wings → Rooms → Traces
- Search bar queries `/memory` API
- Click trace → detail panel with metadata, salience, relationships

#### Panel 2: Attention Map (`CognitionAttentionMap`)
- NEDA spike visualization (heatmap or sparkline)
- Shows what topics are currently "hot" in memory
- Updates in real-time via polling or SSE

#### Panel 3: Consensus Log (`CognitionConsensusLog`)
- QIPC vote history for recent memory writes
- Shows: query, risk level, variance, consensus outcome
- Green = accepted, Red = blocked, Yellow = fallback

#### Panel 4: Constitutional Gate (`CognitionConstitutionalGate`)
- IMMU scan results: recent violations, patterns detected
- Threat score timeline
- Amendment reference for each flag

### 4.2 Reused Components

- `MemoryDebugPanel` → extended with bioCAPT-specific fields (salience, wing, provenance)
- `SettingsHeader` → same pattern for Cognition page header
- Existing Tauri command pattern → new commands in `utils/tauriCommands.ts`

### 4.3 New Tauri Commands

```typescript
// utils/tauriCommands.ts additions
export async function captHealth(): Promise<CaptHealth>;
export async function captIngest(text: string, source: string): Promise<CaptIngestResult>;
export async function captQueryMemory(wing: string, query: string): Promise<CaptMemoryResult>;
export async function captSweep(maxEvents?: number): Promise<CaptSweepResult>;
export async function captConsolidate(): Promise<CaptConsolidateResult>;
export async function captEvals(): Promise<CaptEvalsResult>;
export async function captStatus(): Promise<CaptStatus>;
```

---

## 5. Data Flow: Memory Store (Happy Path)

```
Agent calls memory_store tool
         │
         ▼
┌─────────────────┐
│ SecurityPolicy  │───► rate limit check (existing)
└─────────────────┘
         │
         ▼
┌─────────────────┐
│   IMMU scan     │───► MCP call: capt_evals or local rlib PatternScanner
│  (local/fast)   │     Blocks: injection, exfil, structural anomalies
└─────────────────┘
         │
         ▼
┌─────────────────┐
│  QIPC consensus │───► Lightweight consensus (no LLM for simple stores)
│   (optional)    │     Skip for low-risk, run for Core category
└─────────────────┘
         │
         ▼
┌─────────────────┐
│  ECHO ingest    │───► HTTP POST /ingest
│  + ENGRAM score │     wing = namespace, room = category
└─────────────────┘
         │
         ▼
┌─────────────────┐
│  HMC encode     │───► If Core memory: also encode holographic trace
│  (async/bg)     │     via biocapt_rust rlib or HTTP
└─────────────────┘
         │
         ▼
   Return success
```

---

## 6. Data Flow: Memory Recall (Happy Path)

```
Agent calls memory_recall tool
         │
         ▼
┌─────────────────┐
│  NEDA attention │───► Rank query tokens by attention weights
│    scoring      │     Boost recent + frequently rehearsed traces
└─────────────────┘
         │
         ▼
┌─────────────────┐
│  ECHO semantic  │───► HTTP GET /memory/{wing}?query=...
│     search      │     ChromaDB/SQLite vector search
└─────────────────┘
         │
         ▼
┌─────────────────┐
│  HMC decode     │───► If semantic match < threshold, try holographic decode
│  (fallback)     │     Key = query embedding, decode from composite trace
└─────────────────┘
         │
         ▼
┌─────────────────┐
│  Format results │───► Map ECHO traces → MemoryEntry structs
│                 │     Score = ENGRAM salience × NEDA attention × semantic sim
└─────────────────┘
         │
         ▼
   Return Vec<MemoryEntry>
```

---

## 7. Implementation Order

| Phase | Subsystem | Files | Est. Effort |
|-------|-----------|-------|-------------|
| 1 | `biocapt-client` crate | `src/openhuman/biocapt_client/` | Medium |
| 2 | `BiocaptMemory` trait impl | `src/openhuman/memory/biocapt/` | Medium |
| 3 | Tauri sidecar + lifecycle | `src/openhuman/biocapt_client/lifecycle.rs` | Small |
| 4 | Config extension | `src/openhuman/config.rs`, `app/` | Small |
| 5 | Cognition page (basic) | `app/src/pages/Cognition.tsx` | Medium |
| 6 | Memory panels | `app/src/components/cognition/` | Medium |
| 7 | Integration tests | `src/openhuman/memory/biocapt/tests.rs` | Medium |
| 8 | Cloudflare sync bridge | `src/openhuman/biocapt_client/sync.rs` | Large (future) |

---

## 8. Testing Strategy

- **Unit:** Mock bioCAPT API server (wiremock or local test server)
- **Integration:** Spin up real bioCAPT + ollama, run store/recall cycles
- **E2E:** Tauri test harness navigates to Cognition page, verifies panels render

---

## 9. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| bioCAPT startup slow (Python + model load) | Spawn on app launch with splash screen; cache health status |
| ollama not installed on user machine | Graceful fallback to SQLite-only mode; prompt user to install |
| MCP stdio unstable | Prefer HTTP API; MCP as optional enhancement |
| Memory incompatibility (Core vs core, etc.) | Normalization layer in `BiocaptMemory::store()` |
| Cloud sync privacy concerns | Default off; explicit opt-in per namespace |

---

## 10. Open Questions

1. Should `forget()` be hard-delete (OpenHuman behavior) or soft-delete (bioCAPT append-only)?
2. Should we embed the `biocapt_rust` rlib for zero-overhead HMC, or always use HTTP?
3. Should the Cognition page be top-level navigation or nested under Settings?

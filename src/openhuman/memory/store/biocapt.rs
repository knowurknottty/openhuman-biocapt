//! bioCAPT-backed memory store implementing the `Memory` trait.
//!
//! Bridges OpenHuman's memory operations to the bioCAPT cognitive service
//! via HTTP API. Falls back to SQLite `UnifiedMemory` when bioCAPT is
//! unreachable.

use std::sync::Arc;

use async_trait::async_trait;
use chrono::Utc;
use serde_json::json;

use crate::openhuman::biocapt_client::{BiocaptClient, IngestRequest, MemoryTrace};
use crate::openhuman::memory::store::unified::UnifiedMemory;
use crate::openhuman::memory::traits::{
    Memory, MemoryCategory, MemoryEntry, NamespaceSummary, RecallOpts,
};

/// bioCAPT-backed memory implementation.
///
/// Uses the local bioCAPT API server for storage, recall, and cognitive
/// operations. When bioCAPT is unavailable, gracefully degrades to the
/// SQLite `UnifiedMemory` fallback.
pub struct BiocaptMemory {
    client: BiocaptClient,
    fallback: Option<Arc<UnifiedMemory>>,
}

impl BiocaptMemory {
    /// Create a new bioCAPT memory backend from a base URL.
    pub fn new(base_url: impl Into<String>) -> anyhow::Result<Self> {
        let client = BiocaptClient::new(base_url)?;
        Ok(Self {
            client,
            fallback: None,
        })
    }

    /// Attach a SQLite fallback for when bioCAPT is unreachable.
    pub fn with_fallback(mut self, fallback: Arc<UnifiedMemory>) -> Self {
        self.fallback = Some(fallback);
        self
    }

    /// Check if bioCAPT is currently reachable.
    pub async fn is_connected(&self) -> bool {
        self.client.health().await.is_ok()
    }

    /// Access the underlying bioCAPT client.
    pub fn client(&self) -> &BiocaptClient {
        &self.client
    }
}

/// Map OpenHuman `MemoryCategory` to bioCAPT salience score (0.0–1.0).
fn category_to_salience(category: &MemoryCategory) -> f64 {
    match category {
        MemoryCategory::Core => 0.9,
        MemoryCategory::Daily => 0.5,
        MemoryCategory::Conversation => 0.3,
        MemoryCategory::Custom(_) => 0.6,
    }
}

/// Convert a bioCAPT `MemoryTrace` to OpenHuman `MemoryEntry`.
fn trace_to_entry(trace: MemoryTrace) -> MemoryEntry {
    let category = match trace.room.as_deref() {
        Some("core") => MemoryCategory::Core,
        Some("daily") => MemoryCategory::Daily,
        Some("conversation") => MemoryCategory::Conversation,
        Some(other) => MemoryCategory::Custom(other.to_string()),
        None => MemoryCategory::Core,
    };

    MemoryEntry {
        id: trace.trace_id,
        key: trace
            .metadata
            .get("key")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown")
            .to_string(),
        content: trace.content,
        namespace: Some(trace.wing),
        category,
        timestamp: Utc::now().to_rfc3339(),
        session_id: trace
            .metadata
            .get("session_id")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        score: Some(trace.salience),
    }
}

#[async_trait]
impl Memory for BiocaptMemory {
    fn name(&self) -> &str {
        "biocapt"
    }

    async fn store(
        &self,
        namespace: &str,
        key: &str,
        content: &str,
        category: MemoryCategory,
        session_id: Option<&str>,
    ) -> anyhow::Result<()> {
        let salience = category_to_salience(&category);
        let mut metadata = json!({
            "key": key,
            "salience": salience,
            "category": category.to_string(),
        });

        if let Some(sid) = session_id {
            metadata["session_id"] = json!(sid);
        }

        let req = IngestRequest::new(content)
            .with_source("openhuman")
            .with_metadata(metadata);

        match self.client.ingest(req).await {
            Ok(resp) if resp.success => Ok(()),
            Ok(resp) => Err(anyhow::anyhow!(
                "bioCAPT ingest failed: {}",
                resp.error.unwrap_or_default()
            )),
            Err(e) => {
                tracing::warn!("[biocapt:store] bioCAPT unreachable, using fallback: {e}");
                if let Some(ref fallback) = self.fallback {
                    fallback.store(namespace, key, content, category, session_id).await
                } else {
                    Err(e)
                }
            }
        }
    }

    async fn recall(
        &self,
        query: &str,
        limit: usize,
        opts: RecallOpts<'_>,
    ) -> anyhow::Result<Vec<MemoryEntry>> {
        let wing = opts.namespace.unwrap_or("global");

        match self.client.query_memory(wing, None, Some(query)).await {
            Ok(resp) => {
                let mut entries: Vec<MemoryEntry> = resp
                    .traces
                    .into_iter()
                    .take(limit)
                    .map(trace_to_entry)
                    .collect();

                // Filter by category if specified
                if let Some(ref cat) = opts.category {
                    let want = cat.to_string();
                    entries.retain(|e| e.category.to_string() == want);
                }

                Ok(entries)
            }
            Err(e) => {
                tracing::warn!("[biocapt:recall] bioCAPT unreachable, using fallback: {e}");
                if let Some(ref fallback) = self.fallback {
                    fallback.recall(query, limit, opts).await
                } else {
                    Err(e)
                }
            }
        }
    }

    async fn get(&self, namespace: &str, key: &str) -> anyhow::Result<Option<MemoryEntry>> {
        // bioCAPT doesn't have a direct "get by key" endpoint;
        // query the wing with the key as the query string.
        match self.client.query_memory(namespace, None, Some(key)).await {
            Ok(resp) => {
                let hit = resp
                    .traces
                    .into_iter()
                    .find(|t| {
                        t.metadata
                            .get("key")
                            .and_then(|v| v.as_str())
                            == Some(key)
                    })
                    .map(trace_to_entry);
                Ok(hit)
            }
            Err(e) => {
                tracing::warn!("[biocapt:get] bioCAPT unreachable, using fallback: {e}");
                if let Some(ref fallback) = self.fallback {
                    fallback.get(namespace, key).await
                } else {
                    Err(e)
                }
            }
        }
    }

    async fn list(
        &self,
        namespace: Option<&str>,
        category: Option<&MemoryCategory>,
        _session_id: Option<&str>,
    ) -> anyhow::Result<Vec<MemoryEntry>> {
        let wing = namespace.unwrap_or("global");

        match self.client.query_memory(wing, None, None).await {
            Ok(resp) => {
                let mut entries: Vec<MemoryEntry> =
                    resp.traces.into_iter().map(trace_to_entry).collect();

                if let Some(ref cat) = category {
                    let want = cat.to_string();
                    entries.retain(|e| e.category.to_string() == want);
                }

                Ok(entries)
            }
            Err(e) => {
                tracing::warn!("[biocapt:list] bioCAPT unreachable, using fallback: {e}");
                if let Some(ref fallback) = self.fallback {
                    fallback.list(namespace, category, _session_id).await
                } else {
                    Err(e)
                }
            }
        }
    }

    async fn forget(&self, namespace: &str, key: &str) -> anyhow::Result<bool> {
        // bioCAPT is append-only. We implement soft-delete by ingesting
        // a tombstone marker. The trace remains in memory but is marked
        // as deleted for recall purposes.
        let tombstone = json!({
            "action": "delete",
            "namespace": namespace,
            "key": key,
            "deleted_at": Utc::now().to_rfc3339(),
        });

        let req = IngestRequest::new(tombstone.to_string())
            .with_source("openhuman:tombstone")
            .with_metadata(json!({
                "namespace": namespace,
                "key": key,
                "is_tombstone": true,
            }));

        match self.client.ingest(req).await {
            Ok(resp) if resp.success => Ok(true),
            Ok(resp) => Err(anyhow::anyhow!(
                "bioCAPT tombstone failed: {}",
                resp.error.unwrap_or_default()
            )),
            Err(e) => {
                tracing::warn!("[biocapt:forget] bioCAPT unreachable, using fallback: {e}");
                if let Some(ref fallback) = self.fallback {
                    fallback.forget(namespace, key).await
                } else {
                    Err(e)
                }
            }
        }
    }

    async fn namespace_summaries(&self) -> anyhow::Result<Vec<NamespaceSummary>> {
        match self.client.status().await {
            Ok(status) => {
                // bioCAPT status doesn't break down by namespace natively.
                // Return a single summary for the active system.
                Ok(vec![NamespaceSummary {
                    namespace: "biocapt".to_string(),
                    count: status.events_ingested as usize,
                    last_updated: Some(Utc::now().to_rfc3339()),
                }])
            }
            Err(e) => {
                tracing::warn!("[biocapt:namespace_summaries] bioCAPT unreachable, using fallback: {e}");
                if let Some(ref fallback) = self.fallback {
                    fallback.namespace_summaries().await
                } else {
                    Err(e)
                }
            }
        }
    }

    async fn count(&self) -> anyhow::Result<usize> {
        match self.client.status().await {
            Ok(status) => Ok(status.events_ingested as usize),
            Err(e) => {
                tracing::warn!("[biocapt:count] bioCAPT unreachable, using fallback: {e}");
                if let Some(ref fallback) = self.fallback {
                    fallback.count().await
                } else {
                    Err(e)
                }
            }
        }
    }

    async fn health_check(&self) -> bool {
        self.client.health().await.is_ok()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn category_salience_mapping() {
        assert_eq!(category_to_salience(&MemoryCategory::Core), 0.9);
        assert_eq!(category_to_salience(&MemoryCategory::Daily), 0.5);
        assert_eq!(category_to_salience(&MemoryCategory::Conversation), 0.3);
        assert_eq!(
            category_to_salience(&MemoryCategory::Custom("project".into())),
            0.6
        );
    }
}

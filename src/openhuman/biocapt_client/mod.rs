//! bioCAPT cognitive service client.
//!
//! Provides an HTTP client for the local bioCAPT API server, plus
//! request/response types that mirror the Python Pydantic models.
//!
//! ## Usage
//!
//! ```rust,no_run
//! use openhuman_core::openhuman::biocapt_client::BiocaptClient;
//!
//! # async fn example() -> anyhow::Result<()> {
//! let client = BiocaptClient::default_local()?;
//! let health = client.health().await?;
//! println!("bioCAPT status: {}", health.status);
//! # Ok(())
//! # }
//! ```

pub mod client;
pub mod types;

pub use client::BiocaptClient;
pub use types::*;

/// Default base URL for the bioCAPT cognitive API server.
/// Points to Cloudflare Worker deployment; override for local development.
pub const DEFAULT_BIOCAPT_URL: &str = "https://biocapt-api-proxy.knowurknottty.workers.dev";

/// Returns the documented default base URL for the bioCAPT daemon
/// (`http://127.0.0.1:8787`). Exposed for log lines / errors so callers
/// don't have to import the constant by name.
pub fn biocapt_default_url() -> &'static str {
    DEFAULT_BIOCAPT_URL
}

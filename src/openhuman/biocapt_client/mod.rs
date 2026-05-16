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

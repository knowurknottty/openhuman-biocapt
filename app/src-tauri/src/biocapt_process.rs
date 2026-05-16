//! bioCAPT cognitive service lifecycle manager.
//!
//! Spawns the bioCAPT Python API server as a child process, polls health,
//! and gracefully terminates on app shutdown.

use std::process::{Child, Command, Stdio};
use std::sync::Arc;
use std::time::Duration;

use parking_lot::Mutex;
use tokio::time::{interval, timeout};

const DEFAULT_PORT: u16 = 8787;
const HEALTH_POLL_INTERVAL: Duration = Duration::from_secs(30);
const HEALTH_TIMEOUT: Duration = Duration::from_secs(5);
const STARTUP_TIMEOUT: Duration = Duration::from_secs(30);
const SHUTDOWN_TIMEOUT: Duration = Duration::from_secs(5);

/// Handle to the running bioCAPT child process.
pub struct BiocaptProcess {
    child: Arc<Mutex<Option<Child>>>,
    port: u16,
    api_url: String,
}

impl BiocaptProcess {
    pub fn new(port: u16) -> Self {
        let api_url = format!("http://127.0.0.1:{port}");
        Self {
            child: Arc::new(Mutex::new(None)),
            port,
            api_url,
        }
    }

    /// Spawn the bioCAPT API server if not already running.
    ///
    /// Looks for `python3` and the bioCAPT main script in the following order:
    /// 1. `BIOCAPT_HOME` env var → `${BIOCAPT_HOME}/main.py`
    /// 2. `~/.biocapt/biocapt-v2-desktop/main.py`
    /// 3. Relative path `../biocapt-v2-desktop/main.py` (dev layout)
    pub fn ensure_running(&self) -> Result<(), String> {
        let mut guard = self.child.lock();
        if let Some(ref mut child) = *guard {
            match child.try_wait() {
                Ok(None) => return Ok(()), // still running
                Ok(Some(status)) => {
                    log::warn!("[biocapt] previous process exited with {status}");
                }
                Err(e) => {
                    log::warn!("[biocapt] failed to check child status: {e}");
                }
            }
        }

        let script = Self::find_script()?;
        log::info!("[biocapt] spawning: python3 {} api-server --port {}", script.display(), self.port);

        let child = Command::new("python3")
            .arg(&script)
            .arg("api-server")
            .arg("--port")
            .arg(self.port.to_string())
            .env("CAPT_INBOX", &format!("{}/capt_inbox", std::env::temp_dir().display()))
            .env("CAPT_OUTBOX", &format!("{}/capt_outbox", std::env::temp_dir().display()))
            .env("CAPT_MODEL_LOCAL", "llama3.2:3b")
            .env("OPENAI_BASE_URL", "http://localhost:11434/v1")
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("failed to spawn bioCAPT: {e}"))?;

        *guard = Some(child);
        Ok(())
    }

    /// Gracefully terminate the bioCAPT process.
    pub fn shutdown(&self) {
        let mut guard = self.child.lock();
        if let Some(mut child) = guard.take() {
            #[cfg(unix)]
            {
                use nix::sys::signal::{kill, Signal};
                use nix::unistd::Pid;
                let _ = kill(Pid::from_raw(child.id() as i32), Signal::SIGTERM);
            }
            #[cfg(not(unix))]
            {
                let _ = child.kill();
            }

            let start = std::time::Instant::now();
            loop {
                match child.try_wait() {
                    Ok(Some(_)) => {
                        log::info!("[biocapt] process exited gracefully");
                        break;
                    }
                    Ok(None) if start.elapsed() > SHUTDOWN_TIMEOUT => {
                        log::warn!("[biocapt] SIGTERM timed out, force-killing");
                        let _ = child.kill();
                        let _ = child.wait();
                        break;
                    }
                    _ => std::thread::sleep(Duration::from_millis(100)),
                }
            }
        }
    }

    /// Poll health in a background tokio task.
    pub fn spawn_health_poll(self: Arc<Self>) -> tokio::task::JoinHandle<()> {
        tokio::spawn(async move {
            let mut ticker = interval(HEALTH_POLL_INTERVAL);
            loop {
                ticker.tick().await;
                match Self::check_health(&self.api_url).await {
                    Ok(true) => log::debug!("[biocapt] health check passed"),
                    Ok(false) => {
                        log::warn!("[biocapt] health check failed — attempting restart");
                        if let Err(e) = self.ensure_running() {
                            log::error!("[biocapt] restart failed: {e}");
                        }
                    }
                    Err(e) => log::warn!("[biocapt] health check error: {e}"),
                }
            }
        })
    }

    async fn check_health(api_url: &str) -> Result<bool, reqwest::Error> {
        let client = reqwest::Client::builder()
            .timeout(HEALTH_TIMEOUT)
            .build()?;
        let resp = client
            .get(format!("{}/health", api_url))
            .send()
            .await?;
        Ok(resp.status().is_success())
    }

    fn find_script() -> Result<std::path::PathBuf, String> {
        // 1. Explicit env override
        if let Ok(home) = std::env::var("BIOCAPT_HOME") {
            let path = std::path::PathBuf::from(home).join("main.py");
            if path.exists() {
                return Ok(path);
            }
        }

        // 2. User home install
        if let Some(home) = dirs::home_dir() {
            let path = home.join(".biocapt").join("biocapt-v2-desktop").join("main.py");
            if path.exists() {
                return Ok(path);
            }
        }

        // 3. Dev layout: sibling to openhuman repo
        let dev_path = std::path::PathBuf::from("../biocapt-v2-desktop/main.py");
        if dev_path.exists() {
            return Ok(dev_path);
        }

        Err("bioCAPT main.py not found. Set BIOCAPT_HOME or install to ~/.biocapt/biocapt-v2-desktop".into())
    }
}

impl Default for BiocaptProcess {
    fn default() -> Self {
        Self::new(DEFAULT_PORT)
    }
}

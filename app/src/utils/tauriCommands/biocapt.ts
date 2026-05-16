/**
 * bioCAPT cognitive service client.
 *
 * Dual-mode: uses Tauri commands in the desktop app, direct HTTP
 * calls when running as a PWA (web target).
 */
import { invoke } from '@tauri-apps/api/core';

// Cloudflare Worker endpoint — bioCAPT brain for jenn-AI
const CLOUDFLARE_BIOCAPT_URL = 'https://biocapt-api-proxy.knowurknottty.workers.dev';

function isTauri(): boolean {
  return typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__;
}

function getBaseUrl(): string {
  // In Tauri desktop, commands proxy to local server
  // In web/PWA, hit Cloudflare directly
  return isTauri() ? '' : CLOUDFLARE_BIOCAPT_URL;
}

async function apiGet<T>(path: string): Promise<T> {
  const base = getBaseUrl();
  if (isTauri()) {
    // Tauri commands don't use HTTP — they're RPC
    throw new Error(`Tauri GET for ${path} not implemented — use invoke()`);
  }
  const res = await fetch(`${base}${path}`);
  if (!res.ok) throw new Error(`bioCAPT GET ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const base = getBaseUrl();
  if (isTauri()) {
    throw new Error(`Tauri POST for ${path} not implemented — use invoke()`);
  }
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`bioCAPT POST ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export interface CaptHealth {
  status: string;
  service?: string;
  version?: string;
}

export interface CaptStatus {
  daemon_running: boolean;
  events_ingested: number;
  insights_generated: number;
  alerts_generated: number;
  capt_healthy: boolean;
  modules_active: number;
  sweeps_completed: number;
  file_feed: {
    inbox: string;
    outbox: string;
    processed_files: number;
  };
  timestamp: number;
}

export interface CaptIngestResult {
  success: boolean;
  ingested?: {
    stored: boolean;
    prediction_error: number;
    mode: string;
    echo_trace_id: string;
  };
}

export interface CaptSweepResult {
  success: boolean;
  result?: {
    timestamp: number;
    events_analyzed: number;
    prediction_error_avg: number;
    insight: string;
    confidence: number;
    stress_level: string;
    ethics_approved: boolean;
    recommended_actions: string[];
  };
}

export interface CaptCogitateResult {
  success: boolean;
  result?: Record<string, unknown>;
}

export interface CaptMemoryTrace {
  trace_id: string;
  content: string;
  wing: string;
  room?: string;
  salience: number;
  created_at: number;
  metadata: Record<string, unknown>;
}

export interface CaptMemoryResult {
  traces: CaptMemoryTrace[];
  count: number;
}

export interface CaptEvalsResult {
  success: boolean;
  evals: Array<{
    category: string;
    score: number;
    details?: string;
  }>;
}

export interface CaptBriefingResult {
  success: boolean;
  briefing?: string;
}

export interface CaptAgentRouteResult {
  success: boolean;
  mode?: string;
  reasoning?: string;
  recommended_tools?: string[];
  prepared_query?: string;
}

// ── Health ──
export async function captHealth(): Promise<CaptHealth> {
  if (isTauri()) {
    return invoke<CaptHealth>('capt_health');
  }
  return apiGet<CaptHealth>('/health');
}

// ── Status ──
export async function captStatus(): Promise<CaptStatus> {
  if (isTauri()) {
    return invoke<CaptStatus>('capt_status');
  }
  return apiGet<CaptStatus>('/status');
}

// ── Ingest ──
export async function captIngest(text: string, source = 'jenn-ai'): Promise<CaptIngestResult> {
  if (isTauri()) {
    return invoke<CaptIngestResult>('capt_ingest', { text, source });
  }
  return apiPost<CaptIngestResult>('/ingest', { text, source });
}

// ── Sweep ──
export async function captSweep(maxEvents = 50): Promise<CaptSweepResult> {
  if (isTauri()) {
    return invoke<CaptSweepResult>('capt_sweep', { maxEvents });
  }
  return apiPost<CaptSweepResult>('/sweep', { max_events: maxEvents });
}

// ── Cogitate ──
export async function captCogitate(query: string, context?: string): Promise<CaptCogitateResult> {
  if (isTauri()) {
    return invoke<CaptCogitateResult>('capt_cogitate', { query });
  }
  return apiPost<CaptCogitateResult>('/cogitate', { query, context });
}

// ── Query Memory ──
export async function captQueryMemory(
  wing: string,
  query?: string,
  limit = 10
): Promise<CaptMemoryResult> {
  if (isTauri()) {
    return invoke<CaptMemoryResult>('capt_query_memory', { wing, query });
  }
  return apiPost<CaptMemoryResult>('/memory/query', { wing, query, limit });
}

// ── Consolidate ──
export async function captConsolidate(): Promise<{ success: boolean; memories_consolidated?: number }> {
  if (isTauri()) {
    return invoke('capt_consolidate');
  }
  return apiPost('/consolidate', {});
}

// ── Evals ──
export async function captEvals(): Promise<CaptEvalsResult> {
  if (isTauri()) {
    return invoke<CaptEvalsResult>('capt_evals');
  }
  return apiGet<CaptEvalsResult>('/evals');
}

// ── Briefing ──
export async function captBriefing(): Promise<CaptBriefingResult> {
  if (isTauri()) {
    return invoke<CaptBriefingResult>('capt_briefing');
  }
  return apiGet<CaptBriefingResult>('/briefing');
}

// ── Agent Team Route ──
export async function captAgentRoute(query: string): Promise<CaptAgentRouteResult> {
  if (isTauri()) {
    return invoke<CaptAgentRouteResult>('capt_agent_route', { query });
  }
  return apiPost<CaptAgentRouteResult>('/agent_team/route', { query });
}

// ── Reflect ──
export async function captReflect(minutes = 30, deep = false): Promise<{ success: boolean; insights?: string[] }> {
  if (isTauri()) {
    return invoke('capt_reflect', { minutes, deep });
  }
  return apiPost('/reflect', { minutes, deep });
}

// ── Delta ──
export async function captDelta(): Promise<{ success: boolean; delta?: unknown }> {
  if (isTauri()) {
    return invoke('capt_delta');
  }
  return apiGet('/delta');
}

// ── Knowledge ──
export async function captKnowledge(): Promise<{ success: boolean; knowledge?: unknown }> {
  if (isTauri()) {
    return invoke('capt_knowledge');
  }
  return apiGet('/knowledge');
}

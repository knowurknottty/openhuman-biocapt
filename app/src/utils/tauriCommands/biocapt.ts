/**
 * bioCAPT cognitive service commands.
 *
 * Thin wrappers over Tauri commands that proxy to the local bioCAPT API.
 */
import { invoke } from '@tauri-apps/api/core';

export interface CaptHealth {
  status: string;
  uptime_seconds: number;
  daemon_attached: boolean;
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
  event_id?: string;
  wing?: string;
  room?: string;
  error?: string;
}

export interface CaptSweepResult {
  success: boolean;
  modules_scanned: number;
  insights: Array<{
    module: string;
    confidence: number;
    observation: string;
  }>;
  duration_ms: number;
}

export interface CaptCogitateResult {
  success: boolean;
  pulse?: {
    content: string;
    backend: string;
    model: string;
    input_tokens?: number;
    output_tokens?: number;
    duration_ms: number;
  };
  duration_ms: number;
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
  accuracy: number;
  security: number;
  governance: number;
  boundaries: number;
  overall: number;
  last_eval?: string;
}

export async function captHealth(): Promise<CaptHealth> {
  return invoke<CaptHealth>('capt_health');
}

export async function captStatus(): Promise<CaptStatus> {
  return invoke<CaptStatus>('capt_status');
}

export async function captIngest(text: string, source = 'openhuman'): Promise<CaptIngestResult> {
  return invoke<CaptIngestResult>('capt_ingest', { text, source });
}

export async function captSweep(maxEvents = 50): Promise<CaptSweepResult> {
  return invoke<CaptSweepResult>('capt_sweep', { maxEvents });
}

export async function captCogitate(query: string): Promise<CaptCogitateResult> {
  return invoke<CaptCogitateResult>('capt_cogitate', { query });
}

export async function captQueryMemory(
  wing: string,
  query?: string
): Promise<CaptMemoryResult> {
  return invoke<CaptMemoryResult>('capt_query_memory', { wing, query });
}

export async function captConsolidate(): Promise<{ success: boolean; memories_consolidated: number }> {
  return invoke('capt_consolidate');
}

export async function captEvals(): Promise<CaptEvalsResult> {
  return invoke<CaptEvalsResult>('capt_evals');
}

export async function captReflect(minutes = 30, deep = false): Promise<{ success: boolean; insights: string[] }> {
  return invoke('capt_reflect', { minutes, deep });
}

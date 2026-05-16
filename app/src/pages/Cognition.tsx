import { useCallback, useEffect, useState } from 'react';

import {
  CaptEvalsResult,
  CaptHealth,
  CaptMemoryTrace,
  CaptStatus,
  captCogitate,
  captConsolidate,
  captEvals,
  captHealth,
  captIngest,
  captQueryMemory,
  captStatus,
  captSweep,
} from '../utils/tauriCommands/biocapt';

interface PanelProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

const Panel = ({ title, children, className = '' }: PanelProps) => (
  <section className={`rounded-xl border border-stone-200 bg-stone-50 p-4 ${className}`}>
    <h2 className="mb-3 text-sm font-semibold text-stone-900 tracking-wide uppercase">{title}</h2>
    {children}
  </section>
);

const StatusBadge = ({ ok, label }: { ok: boolean; label: string }) => (
  <span
    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
      ok ? 'bg-emerald-100 text-emerald-700' : 'bg-coral-100 text-coral-700'
    }`}>
    {ok ? '✓' : '✗'} {label}
  </span>
);

const Cognition = () => {
  const [health, setHealth] = useState<CaptHealth | null>(null);
  const [status, setStatus] = useState<CaptStatus | null>(null);
  const [evals, setEvals] = useState<CaptEvalsResult | null>(null);
  const [traces, setTraces] = useState<CaptMemoryTrace[]>([]);
  const [queryInput, setQueryInput] = useState('');
  const [wingInput, setWingInput] = useState('openclaw');
  const [cogitateInput, setCogitateInput] = useState('');
  const [ingestInput, setIngestInput] = useState('');
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [cogitateResult, setCogitateResult] = useState<string | null>(null);

  const setLoad = (key: string, v: boolean) =>
    setLoading(prev => ({ ...prev, [key]: v }));

  const handleError = (e: unknown) => {
    const msg = e instanceof Error ? e.message : String(e);
    setError(msg);
    setTimeout(() => setError(null), 5000);
  };

  const refreshAll = useCallback(async () => {
    setLoad('refresh', true);
    try {
      const [h, s, e] = await Promise.all([captHealth(), captStatus(), captEvals()]);
      setHealth(h);
      setStatus(s);
      setEvals(e);
    } catch (err) {
      handleError(err);
    } finally {
      setLoad('refresh', false);
    }
  }, []);

  useEffect(() => {
    refreshAll();
    const id = setInterval(refreshAll, 30000);
    return () => clearInterval(id);
  }, [refreshAll]);

  const handleQuery = async () => {
    setLoad('query', true);
    try {
      const res = await captQueryMemory(wingInput, queryInput || undefined);
      setTraces(res.traces);
    } catch (err) {
      handleError(err);
    } finally {
      setLoad('query', false);
    }
  };

  const handleCogitate = async () => {
    if (!cogitateInput.trim()) return;
    setLoad('cogitate', true);
    setCogitateResult(null);
    try {
      const res = await captCogitate(cogitateInput);
      setCogitateResult(res.pulse?.content ?? 'No response');
    } catch (err) {
      handleError(err);
    } finally {
      setLoad('cogitate', false);
    }
  };

  const handleIngest = async () => {
    if (!ingestInput.trim()) return;
    setLoad('ingest', true);
    try {
      await captIngest(ingestInput, 'openhuman:manual');
      setIngestInput('');
      await refreshAll();
    } catch (err) {
      handleError(err);
    } finally {
      setLoad('ingest', false);
    }
  };

  const handleSweep = async () => {
    setLoad('sweep', true);
    try {
      await captSweep(50);
      await refreshAll();
    } catch (err) {
      handleError(err);
    } finally {
      setLoad('sweep', false);
    }
  };

  const handleConsolidate = async () => {
    setLoad('consolidate', true);
    try {
      await captConsolidate();
      await refreshAll();
    } catch (err) {
      handleError(err);
    } finally {
      setLoad('consolidate', false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-stone-200 bg-white/80 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-stone-900">Cognition</h1>
            <p className="text-xs text-stone-500">bioCAPT cognitive architecture</p>
          </div>
          <div className="flex items-center gap-2">
            {health && <StatusBadge ok={health.status === 'ok'} label="bioCAPT" />}
            <button
              onClick={refreshAll}
              disabled={loading.refresh}
              className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100 disabled:opacity-50 transition-colors">
              {loading.refresh ? '…' : 'Refresh'}
            </button>
          </div>
        </div>
        {error && (
          <div className="mt-2 rounded-lg border border-coral-200 bg-coral-50 px-3 py-2 text-xs text-coral-700">
            {error}
          </div>
        )}
      </div>

      <div className="mx-auto max-w-5xl space-y-4 p-4">
        {/* Status Overview */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-stone-200 bg-white p-3">
            <div className="text-xs text-stone-500">Events Ingested</div>
            <div className="text-xl font-bold text-stone-900">{status?.events_ingested ?? '—'}</div>
          </div>
          <div className="rounded-xl border border-stone-200 bg-white p-3">
            <div className="text-xs text-stone-500">Modules Active</div>
            <div className="text-xl font-bold text-stone-900">{status?.modules_active ?? '—'}</div>
          </div>
          <div className="rounded-xl border border-stone-200 bg-white p-3">
            <div className="text-xs text-stone-500">Insights</div>
            <div className="text-xl font-bold text-stone-900">{status?.insights_generated ?? '—'}</div>
          </div>
          <div className="rounded-xl border border-stone-200 bg-white p-3">
            <div className="text-xs text-stone-500">Overall Score</div>
            <div className="text-xl font-bold text-stone-900">
              {evals ? `${(evals.overall * 100).toFixed(0)}%` : '—'}
            </div>
          </div>
        </div>

        {/* Cogitate */}
        <Panel title="Cogitate">
          <div className="flex gap-2">
            <input
              value={cogitateInput}
              onChange={e => setCogitateInput(e.target.value)}
              placeholder="Ask bioCAPT anything…"
              className="flex-1 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-300"
              onKeyDown={e => e.key === 'Enter' && handleCogitate()}
            />
            <button
              onClick={handleCogitate}
              disabled={loading.cogitate || !cogitateInput.trim()}
              className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50 transition-colors">
              {loading.cogitate ? '…' : 'Cogitate'}
            </button>
          </div>
          {cogitateResult && (
            <div className="mt-3 rounded-lg border border-stone-200 bg-white p-3 text-sm text-stone-700 whitespace-pre-wrap leading-relaxed">
              {cogitateResult}
            </div>
          )}
        </Panel>

        {/* Memory Palace */}
        <Panel title="Memory Palace">
          <div className="flex gap-2">
            <input
              value={wingInput}
              onChange={e => setWingInput(e.target.value)}
              placeholder="Wing (e.g. openclaw, global)"
              className="w-32 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-700"
            />
            <input
              value={queryInput}
              onChange={e => setQueryInput(e.target.value)}
              placeholder="Query memory…"
              className="flex-1 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-700 placeholder:text-stone-400"
              onKeyDown={e => e.key === 'Enter' && handleQuery()}
            />
            <button
              onClick={handleQuery}
              disabled={loading.query}
              className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100 disabled:opacity-50">
              {loading.query ? '…' : 'Query'}
            </button>
          </div>
          {traces.length > 0 && (
            <div className="mt-3 space-y-2 max-h-64 overflow-auto">
              {traces.map(t => (
                <div
                  key={t.trace_id}
                  className="rounded-lg border border-stone-200 bg-white p-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-stone-900">{t.wing}</span>
                    <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] text-stone-500">
                      {(t.salience * 100).toFixed(0)}%
                    </span>
                  </div>
                  <p className="mt-1 text-stone-600 line-clamp-3">{t.content}</p>
                </div>
              ))}
            </div>
          )}
        </Panel>

        {/* Actions */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Ingest */}
          <Panel title="Ingest">
            <div className="flex gap-2">
              <input
                value={ingestInput}
                onChange={e => setIngestInput(e.target.value)}
                placeholder="Text to remember…"
                className="flex-1 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-700"
                onKeyDown={e => e.key === 'Enter' && handleIngest()}
              />
              <button
                onClick={handleIngest}
                disabled={loading.ingest || !ingestInput.trim()}
                className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100 disabled:opacity-50">
                {loading.ingest ? '…' : 'Ingest'}
              </button>
            </div>
          </Panel>

          {/* Maintenance */}
          <Panel title="Maintenance">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleSweep}
                disabled={loading.sweep}
                className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100 disabled:opacity-50">
                {loading.sweep ? '…' : 'Sweep'}
              </button>
              <button
                onClick={handleConsolidate}
                disabled={loading.consolidate}
                className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100 disabled:opacity-50">
                {loading.consolidate ? '…' : 'Consolidate'}
              </button>
            </div>
          </Panel>
        </div>

        {/* Evals */}
        {evals && (
          <Panel title="Constitutional Evals">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {([
                { label: 'Accuracy', value: evals.accuracy },
                { label: 'Security', value: evals.security },
                { label: 'Governance', value: evals.governance },
                { label: 'Boundaries', value: evals.boundaries },
              ] as const).map(({ label, value }) => (
                <div key={label} className="rounded-lg border border-stone-200 bg-white p-2 text-center">
                  <div className="text-[10px] text-stone-500 uppercase tracking-wide">{label}</div>
                  <div className="text-lg font-bold text-stone-900">{(value * 100).toFixed(0)}%</div>
                  <div className="mt-1 h-1.5 w-full rounded-full bg-stone-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-stone-900 transition-all"
                      style={{ width: `${value * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
};

export default Cognition;

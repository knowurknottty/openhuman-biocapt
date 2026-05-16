/**
 * Frankencapt Module Picker
 *
 * Jenn's control panel for activating cognitive modules.
 * Each module can be toggled on/off. Selections persist in localStorage.
 */
import { useCallback, useEffect, useState } from 'react';

export interface ModuleDef {
  id: string;
  name: string;
  description: string;
  category: string;
  brain: string;
  icon: string;
}

const ALL_MODULES: ModuleDef[] = [
  // Perception
  { id: 'SENS', name: 'SENS', description: 'Sensory input processing — detects anomalies and signal fusions', category: 'Perception', brain: 'capt-brain-01', icon: '👁' },
  { id: 'IRIS', name: 'IRIS', description: 'Information retrieval and indexing system', category: 'Perception', brain: 'capt-brain-01', icon: '🔍' },
  { id: 'PCFE', name: 'PCFE', description: 'Predictive coding front end — signal suppression and deep processing', category: 'Perception', brain: 'capt-brain-01', icon: '🧿' },
  { id: 'FILT', name: 'FILT', description: 'Channel filter — estimates and filters incoming data streams', category: 'Perception', brain: 'capt-brain-01', icon: '🌊' },
  { id: 'AIM', name: 'AIM', description: 'Active inference model — predicts and minimizes surprise', category: 'Perception', brain: 'capt-brain-01', icon: '🎯' },

  // Memory
  { id: 'ECHO', name: 'ECHO', description: 'Episodic memory palace — stores and retrieves traces', category: 'Memory', brain: 'capt-brain-02', icon: '🏛' },
  { id: 'HMC', name: 'HMC', description: 'Holographic memory codec — encodes and decodes distributed memories', category: 'Memory', brain: 'capt-brain-02', icon: '💿' },
  { id: 'ENGRAM', name: 'ENGRAM', description: 'Long-term memory consolidation and retrieval', category: 'Memory', brain: 'capt-brain-02', icon: '🧬' },
  { id: 'SEM', name: 'SEM', description: 'Semantic memory — conceptual knowledge graph', category: 'Memory', brain: 'capt-brain-02', icon: '🕸' },
  { id: 'ABSTR', name: 'ABSTR', description: 'Abstraction layer — generalizes patterns across memories', category: 'Memory', brain: 'capt-brain-02', icon: '🎭' },
  { id: 'CONSOLIDATE', name: 'Consolidate', description: 'Sleep-like memory consolidation across ECHO palace', category: 'Memory', brain: 'capt-brain-02', icon: '💤' },

  // Attention
  { id: 'NEDA', name: 'NEDA', description: 'Neural energy dynamics attention — allocates focus', category: 'Attention', brain: 'capt-brain-01', icon: '⚡' },
  { id: 'ATTN', name: 'ATTN', description: 'Attention mechanism — selective focus on salient inputs', category: 'Attention', brain: 'capt-brain-01', icon: '🔦' },
  { id: 'INHIB', name: 'INHIB', description: 'Inhibitory control — suppresses distractions', category: 'Attention', brain: 'capt-brain-01', icon: '🛑' },
  { id: 'CURIOSITY', name: 'CURIOSITY', description: 'Curiosity drive — explores novel stimuli', category: 'Attention', brain: 'capt-brain-01', icon: '❓' },

  // Reasoning
  { id: 'QIPC', name: 'QIPC', description: 'Quorum intelligence with predictive consensus — multi-model voting', category: 'Reasoning', brain: 'capt-brain-05', icon: '🗳' },
  { id: 'CAUSAL_RSN', name: 'CAUSAL_RSN', description: 'Causal reasoning — infers cause and effect', category: 'Reasoning', brain: 'capt-brain-05', icon: '⛓' },
  { id: 'ANALOGICAL', name: 'ANALOGICAL', description: 'Analogical reasoning — maps patterns across domains', category: 'Reasoning', brain: 'capt-brain-05', icon: '🔗' },
  { id: 'TEMPORAL_RSN', name: 'TEMPORAL_RSN', description: 'Temporal reasoning — sequences events through time', category: 'Reasoning', brain: 'capt-brain-05', icon: '⏳' },
  { id: 'EPISTEMIC', name: 'EPISTEMIC', description: 'Epistemic reasoning — evaluates confidence and uncertainty', category: 'Reasoning', brain: 'capt-brain-05', icon: '📐' },
  { id: 'CONCEPT_ALG', name: 'CONCEPT_ALG', description: 'Concept algebra — manipulates abstract concepts', category: 'Reasoning', brain: 'capt-brain-05', icon: '🧮' },
  { id: 'ACTIVE_INF', name: 'ACTIVE_INF', description: 'Active inference — minimizes prediction error', category: 'Reasoning', brain: 'capt-brain-05', icon: '🔄' },

  // Governance
  { id: 'IMMU', name: 'IMMU', description: 'Immunology module — constitutional scanning and violation detection', category: 'Governance', brain: 'capt-brain-05', icon: '🛡' },
  { id: 'CIG', name: 'CIG', description: 'Constitutional integrity gate — enforces bioCAPT laws', category: 'Governance', brain: 'capt-brain-05', icon: '⚖' },
  { id: 'VALUE_ALIGN', name: 'VALUE_ALIGN', description: 'Value alignment — ensures actions match Jenn\'s values', category: 'Governance', brain: 'capt-brain-05', icon: '💎' },
  { id: 'ETHICS', name: 'ETHICS', description: 'Ethical reasoning — evaluates moral implications', category: 'Governance', brain: 'capt-brain-05', icon: '🕊' },

  // Social
  { id: 'TOM', name: 'TOM', description: 'Theory of mind — models others\' mental states', category: 'Social', brain: 'capt-brain-03', icon: '🧠' },
  { id: 'EMPTH', name: 'EMPTH', description: 'Empathy — emotional resonance and understanding', category: 'Social', brain: 'capt-brain-03', icon: '💗' },
  { id: 'TRUST', name: 'TRUST', description: 'Trust evaluation — assesses reliability of sources', category: 'Social', brain: 'capt-brain-03', icon: '🤝' },
  { id: 'COMM', name: 'COMM', description: 'Communication — natural language generation and comprehension', category: 'Social', brain: 'capt-brain-03', icon: '💬' },

  // Creativity
  { id: 'CREAT', name: 'CREAT', description: 'Creativity — generates novel ideas and solutions', category: 'Creativity', brain: 'capt-brain-03', icon: '✨' },
  { id: 'DREAM', name: 'DREAM', description: 'Dream synthesis — creative recombination during rest', category: 'Creativity', brain: 'capt-brain-03', icon: '🌙' },
  { id: 'TOOL_SYNTH', name: 'TOOL_SYNTH', description: 'Tool synthesis — invents new capabilities on demand', category: 'Creativity', brain: 'capt-brain-03', icon: '🔧' },
  { id: 'SWARM_DECOMP', name: 'SWARM_DECOMP', description: 'Swarm decomposition — breaks problems into parallel tasks', category: 'Creativity', brain: 'capt-brain-03', icon: '🐝' },

  // Meta-Cognition
  { id: 'META', name: 'META', description: 'Meta-cognition — thinks about thinking', category: 'Meta', brain: 'capt-brain-04', icon: '🪞' },
  { id: 'META_REFLECTION', name: 'META_REFLECTION', description: 'Meta-reflection — evaluates own performance', category: 'Meta', brain: 'capt-brain-04', icon: '🔮' },
  { id: 'SELF_MODEL', name: 'SELF_MODEL', description: 'Self-model — maintains coherent identity', category: 'Meta', brain: 'capt-brain-04', icon: '🪪' },
  { id: 'BUG_BOUNTY', name: 'BUG_BOUNTY', description: 'Bug bounty — finds and fixes internal errors', category: 'Meta', brain: 'capt-brain-04', icon: '🐛' },

  // Homeostasis
  { id: 'STRESS', name: 'STRESS', description: 'Stress monitoring — detects overload and fatigue', category: 'Homeostasis', brain: 'capt-brain-04', icon: '📊' },
  { id: 'HOMEO', name: 'HOMEO', description: 'Homeostasis — maintains internal balance', category: 'Homeostasis', brain: 'capt-brain-04', icon: '⚖' },
  { id: 'HEALING_PULSE', name: 'HEALING_PULSE', description: 'Healing pulse — recovery and regeneration cycles', category: 'Homeostasis', brain: 'capt-brain-04', icon: '💚' },
  { id: 'PLAST', name: 'PLAST', description: 'Plasticity — adapts and learns from experience', category: 'Homeostasis', brain: 'capt-brain-04', icon: '🌱' },
  { id: 'RECOV', name: 'RECOV', description: 'Recovery — restores from errors and setbacks', category: 'Homeostasis', brain: 'capt-brain-04', icon: '🩹' },

  // Integration
  { id: 'SYNC', name: 'SYNC', description: 'Synchronization — coordinates across modules', category: 'Integration', brain: 'capt-brain-04', icon: '🔁' },
  { id: 'COGNITIVE_LOOP', name: 'COGNITIVE_LOOP', description: 'Cognitive loop — perception → reasoning → action cycle', category: 'Integration', brain: 'capt-brain-04', icon: '♻' },
  { id: 'AGENT_ROUTER', name: 'AGENT_ROUTER', description: 'Agent router — delegates to specialist modules', category: 'Integration', brain: 'capt-brain-04', icon: '📡' },
  { id: 'EXEC', name: 'EXEC', description: 'Executive function — prioritizes and schedules actions', category: 'Integration', brain: 'capt-brain-04', icon: '📋' },
  { id: 'MOTOR', name: 'MOTOR', description: 'Motor output — executes planned actions', category: 'Integration', brain: 'capt-brain-04', icon: '🦾' },
];

const STORAGE_KEY = 'jenn-ai:active-modules';

const DEFAULT_ACTIVE = new Set([
  'SENS', 'IRIS', 'AIM', 'ECHO', 'HMC', 'ENGRAM', 'NEDA', 'ATTN',
  'QIPC', 'CAUSAL_RSN', 'IMMU', 'CIG', 'TOM', 'EMPTH', 'COMM',
  'CREAT', 'META', 'META_REFLECTION', 'STRESS', 'HOMEO', 'SYNC',
  'COGNITIVE_LOOP', 'AGENT_ROUTER', 'EXEC', 'PULSE', 'FILT',
]);

function loadActiveModules(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch { /* ignore */ }
  return new Set(DEFAULT_ACTIVE);
}

function saveActiveModules(active: Set<string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...active]));
}

const CATEGORY_COLORS: Record<string, string> = {
  Perception: 'bg-blue-100 text-blue-700 border-blue-200',
  Memory: 'bg-purple-100 text-purple-700 border-purple-200',
  Attention: 'bg-amber-100 text-amber-700 border-amber-200',
  Reasoning: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Governance: 'bg-red-100 text-red-700 border-red-200',
  Social: 'bg-pink-100 text-pink-700 border-pink-200',
  Creativity: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  Meta: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  Homeostasis: 'bg-green-100 text-green-700 border-green-200',
  Integration: 'bg-stone-100 text-stone-700 border-stone-200',
};

export default function FrankencaptModulePicker() {
  const [active, setActive] = useState<Set<string>>(loadActiveModules);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState('');

  useEffect(() => {
    saveActiveModules(active);
  }, [active]);

  const toggleModule = useCallback((id: string) => {
    setActive(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleCategory = useCallback((cat: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  const grouped = ALL_MODULES.reduce<Record<string, ModuleDef[]>>((acc, m) => {
    if (filter && !m.name.toLowerCase().includes(filter.toLowerCase()) &&
        !m.description.toLowerCase().includes(filter.toLowerCase())) return acc;
    acc[m.category] = acc[m.category] || [];
    acc[m.category].push(m);
    return acc;
  }, {});

  const activeCount = active.size;
  const totalCount = ALL_MODULES.length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-stone-900">Frankencapt Modules</h2>
          <p className="text-xs text-stone-500">
            {activeCount} of {totalCount} modules active
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActive(new Set(DEFAULT_ACTIVE))}
            className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100"
          >
            Reset Defaults
          </button>
          <button
            onClick={() => setActive(new Set(ALL_MODULES.map(m => m.id)))}
            className="rounded-lg bg-stone-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-stone-800"
          >
            Activate All
          </button>
        </div>
      </div>

      {/* Search */}
      <input
        value={filter}
        onChange={e => setFilter(e.target.value)}
        placeholder="Search modules…"
        className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-300"
      />

      {/* Efficiency meter */}
      <div className="rounded-lg border border-stone-200 bg-white p-3">
        <div className="flex items-center justify-between text-xs text-stone-500">
          <span>Cognitive Load</span>
          <span>{Math.round((activeCount / totalCount) * 100)}%</span>
        </div>
        <div className="mt-1.5 h-2 w-full rounded-full bg-stone-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-violet-500 transition-all"
            style={{ width: `${(activeCount / totalCount) * 100}%` }}
          />
        </div>
        <p className="mt-1 text-[10px] text-stone-400">
          {activeCount < 15
            ? 'Lean mode — fast responses, limited depth'
            : activeCount < 35
            ? 'Balanced — good coverage without bloat'
            : 'Full capacity — maximum cognition, higher latency'}
        </p>
      </div>

      {/* Module categories */}
      <div className="space-y-3">
        {Object.entries(grouped).map(([category, modules]) => {
          const catActive = modules.filter(m => active.has(m.id)).length;
          const isExpanded = expanded.has(category);
          const colorClass = CATEGORY_COLORS[category] || 'bg-stone-100 text-stone-700 border-stone-200';

          return (
            <div key={category} className="rounded-xl border border-stone-200 bg-white overflow-hidden">
              <button
                onClick={() => toggleCategory(category)}
                className="flex w-full items-center justify-between px-4 py-3 hover:bg-stone-50"
              >
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide border ${colorClass}`}>
                    {category}
                  </span>
                  <span className="text-xs text-stone-500">
                    {catActive}/{modules.length}
                  </span>
                </div>
                <span className="text-stone-400 text-sm">
                  {isExpanded ? '▼' : '▶'}
                </span>
              </button>

              {isExpanded && (
                <div className="border-t border-stone-100 px-4 py-3 space-y-2">
                  {modules.map(mod => {
                    const isOn = active.has(mod.id);
                    return (
                      <div
                        key={mod.id}
                        className={`flex items-center gap-3 rounded-lg border p-2.5 transition-colors ${
                          isOn
                            ? 'border-violet-200 bg-violet-50'
                            : 'border-stone-100 bg-stone-50 opacity-60'
                        }`}
                      >
                        <span className="text-lg">{mod.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-stone-900">{mod.name}</span>
                            <span className="text-[10px] text-stone-400">{mod.brain}</span>
                          </div>
                          <p className="text-xs text-stone-500 truncate">{mod.description}</p>
                        </div>
                        <button
                          onClick={() => toggleModule(mod.id)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            isOn ? 'bg-violet-500' : 'bg-stone-300'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              isOn ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

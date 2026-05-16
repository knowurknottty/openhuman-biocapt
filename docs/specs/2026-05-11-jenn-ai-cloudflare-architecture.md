# jenn-AI Architecture: Cloudflare-First bioCAPT

## Overview
jenn-AI is a PWA assistant for Jenn's iPhone, backed by bioCAPT cognitive architecture running on Cloudflare Workers. No Apple Developer account required.

## Architecture

```
┌─────────────────────┐         HTTPS          ┌──────────────────────────────┐
│   jenn-AI PWA       │  ◄──────────────────►  │  biocapt-api-proxy           │
│   (Jenn's iPhone)   │    anytime, anywhere   │  (Cloudflare Worker)         │
│                     │                        │                              │
│  • React + Vite     │                        │  • 46 cognitive modules      │
│  • PWA offline      │                        │  • QIPC consensus            │
│  • Service Worker   │                        │  • IMMU constitutional scan  │
│  • Web Push (later) │                        │  • ECHO memory query         │
└─────────────────────┘                        │  • NEDA attention            │
                                               │  • HMC holographic decode    │
                                               └──────────────────────────────┘
                                                          │
                              ┌───────────────────────────┼───────────────────────────┐
                              │                           │                           │
                              ▼                           ▼                           ▼
                    ┌─────────────────┐        ┌─────────────────┐        ┌─────────────────┐
                    │  capt-brain-01  │        │  capt-brain-02  │        │  capt-brain-03  │
                    │  (CAPT Core)    │        │  (bioCAPT)      │        │  (frankencapt)  │
                    │  D1 + KV        │        │  D1 + KV        │        │  D1 + KV        │
                    └─────────────────┘        └─────────────────┘        └─────────────────┘
                              │                           │                           │
                              └───────────────────────────┼───────────────────────────┘
                                                          │
                                               ┌─────────────────┐
                                               │  capt-brain-04  │
                                               │  (synthesis)    │
                                               │  + capt-brain-05│
                                               │  (council)      │
                                               └─────────────────┘
```

## Cloudflare Resources

| Resource | ID/Name | Purpose |
|----------|---------|---------|
| **API Proxy** | `biocapt-api-proxy` | Main entrypoint for jenn-AI |
| **Universal Worker** | `biocapt-universal-worker` | Core bioCAPT runtime |
| **Brain 01** | `capt-brain-01` | CAPT Core Alpha (46 modules) |
| **Brain 02** | `capt-brain-02-biocapt` | bioCAPT specialization |
| **Brain 03** | `capt-brain-03-frankencapt` | frankencapt variant |
| **Brain 04** | `capt-brain-04-synthesis` | Synthesis layer |
| **Brain 05** | `capt-brain-05-council` | Council arbitration |
| **D1 DBs** | 7 databases | Per-brain structured storage |
| **KV Stores** | 7 namespaces | Per-brain key-value cache |
| **Domain** | `knowurknottty.workers.dev` | Workers.dev subdomain |
| **Custom Domain** | `clawroulette.live` | Primary domain (zone) |

## API Endpoints (biocapt-api-proxy)

```
GET  /health              → Health check
GET  /status              → Full CAPT status
POST /cogitate            → Full cognitive analysis
POST /sweep               → Event sweep
POST /reflect             → Deep reflection
POST /memory/query        → ECHO memory search
POST /consolidate         → Memory consolidation
POST /agent_team/route    → Route to specialist
POST /agent_team/execute  → Execute with specialist
GET  /briefing            → Intelligence briefing
GET  /delta               → Change detection
GET  /evals               → Constitutional evals
GET  /knowledge           → Knowledge engine status
```

## jenn-AI PWA Endpoints

```
GET  /cogitate            → Cognitive State panel
GET  /memory              → Memory Palace panel
POST /query               → Consensus Query
POST /scan                → Constitutional Scan
GET  /metrics             → Cognitive Metrics
```

## Deployment

### PWA Build
```bash
cd app/
npm run build:web
# Output: dist-web/
# Deploy to: Cloudflare Pages, Vercel, or static host
```

### Add to Home Screen (Jenn's iPhone)
1. Open Safari → `https://jenn-ai.clawroulette.live` (or Pages URL)
2. Tap Share → "Add to Home Screen"
3. jenn-AI appears as full-screen app

## Security

- HTTPS only (Cloudflare handles TLS)
- No local server needed on iPhone
- API token scoped to this account only
- CORS configured on worker for PWA origin

## Future: captlang → WASM

When captlang compiles bioCAPT modules to WASM:
- PWA downloads `.wasm` module once
- bioCAPT runs client-side in Safari's WASM engine
- Zero network dependency for cognition
- Cloudflare worker becomes sync/backup only

## Status
- ✅ Cloudflare bioCAPT operational
- ✅ 46 modules active
- ✅ API proxy responding
- ✅ 5-brain council deployed
- 🔄 PWA build in progress
- 🔄 jenn-AI branding pending

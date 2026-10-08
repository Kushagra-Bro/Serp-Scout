<div id="top">

<!-- HEADER STYLE: CLASSIC / MODERN -->
<div align="center">

<img src="./assets/logo.svg" width="110" height="110" alt="Serp-Scout Logo"/>

# <code>SERP-SCOUT</code>

<em>Autonomous Competitive Intelligence & SEO Action Engine for Local Businesses</em>

<p><strong>"Success is measured by real business outcomes rather than a 'visibility score.'"</strong></p>

<!-- BADGES -->
<p>
  <img src="https://img.shields.io/badge/Next.js%2014-000000?style=for-the-badge&logo=nextdotjs&logoColor=white" alt="Next.js 14">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express">
  <img src="https://img.shields.io/badge/LangGraph-1C3C3C?style=for-the-badge&logo=langchain&logoColor=white" alt="LangGraph">
  <img src="https://img.shields.io/badge/Groq%20LLM-F05A24?style=for-the-badge&logo=fastapi&logoColor=white" alt="Groq LLM">
  <img src="https://img.shields.io/badge/SerpApi-4285F4?style=for-the-badge&logo=google&logoColor=white" alt="SerpApi">
  <img src="https://img.shields.io/badge/Neon%20Postgres-00E599?style=for-the-badge&logo=postgresql&logoColor=black" alt="Neon Postgres">
  <img src="https://img.shields.io/badge/Drizzle%20ORM-C5F74F?style=for-the-badge&logo=drizzle&logoColor=black" alt="Drizzle ORM">
  <img src="https://img.shields.io/badge/Upstash%20Redis-00E599?style=for-the-badge&logo=redis&logoColor=black" alt="Upstash Redis">
  <img src="https://img.shields.io/badge/BullMQ-CC3534?style=for-the-badge&logo=npm&logoColor=white" alt="BullMQ">
  <img src="https://img.shields.io/badge/JWT%20Auth-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white" alt="JWT Auth">
  <img src="https://img.shields.io/badge/Turborepo-EF4444?style=for-the-badge&logo=turborepo&logoColor=white" alt="Turborepo">
</p>

</div>
<br>

---

## 📑 Table of Contents

- [Overview](#-overview)
- [Project Submission](#-project-submission)
- [Key Features](#-key-features)
- [System Architecture](#-system-architecture)
- [Monorepo Structure](#-monorepo-structure)
- [Project Index & Modules](#-project-index--modules)
- [Agent Roster](#-agent-roster)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Environment Configuration](#environment-configuration)
  - [Installation & Setup](#installation--setup)
  - [Running the Applications](#running-the-applications)
  - [Verification & Testing](#verification--testing)
- [Security & Compliance Guardrails](#-security--compliance-guardrails)
- [License](#-license)

---

## 💡 Overview

Small business owners don't need vanity SEO metrics (Domain Authority, Page Authority, or arbitrary "Visibility Indexes"). They need to know:
1. **Who is taking revenue, patients, or appointments from them right now?**
2. **Where are the concrete gaps in services, location coverage, and keyword queries?**
3. **What specific, prioritized actions (maximum 3 to 5) should they take this week to drive real calls and bookings?**

**Serp-Scout** is an autonomous multi-agent intelligence platform that continuously analyzes local search engine result pages (Google Web, Local Map Packs, and News), identifies direct local rivals, tracks striking-distance ranking opportunities, and delivers human-readable, evidence-grounded action plans directly to the business owner via interactive web dashboards, downloadable PDF reports, and automated email briefings.

---

## 📝 Project Submission

### Project description

Serp-Scout is an AI-powered competitive intelligence and local SEO platform for small businesses. It continuously researches local search results, discovers nearby competitors, uncovers keyword and content opportunities, and turns the evidence into a short list of prioritized actions. Business owners can monitor rankings and market changes through a dashboard, downloadable reports, and email briefings—without needing to interpret raw SEO data themselves.

### How the project uses SerpApi

Serp-Scout uses SerpApi to retrieve and normalize Google Organic, Google Maps Local Pack, and Google News results, along with People Also Ask and related-search data. It uses SerpApi's location registry to resolve locations into canonical search parameters. These results power competitor discovery, local ranking and Google Business Profile audits, keyword opportunity analysis, and ongoing detection of ranking or market changes. Search runs are recorded and subject to workspace quotas. Tavily supplements the search workflow with multi-query web-search backfills.

### AI tools used

- **LangGraph** orchestrates the research workflow, including parallel analysis stages for content gaps, competitor positioning, reviews, and news signals.
- **Groq-hosted `openai/gpt-oss-120b`** extracts structured business profiles and helps analyze content gaps, messaging, customer feedback, and evidence-grounded recommendations. The model is configurable through `GROQ_MODEL`.
- **Deterministic heuristics and rule-based checks** support competitor scoring, Google Business Profile audits, and market-shift alerts, and provide fallbacks when an LLM call fails.
- **SerpApi and Tavily** supply the live search evidence that grounds the analysis.

### Track

**Primary track: AI Agents** — the core product is a LangGraph-orchestrated multi-agent system that turns live search evidence into actionable research and recommendations.

**Also relevant: Commerce & Market Intelligence** — the platform helps local businesses understand competitors, market shifts, and commercial search opportunities.

---

## 🚀 Key Features

* **Autonomous Website Extraction & Enrichment**: Scrapes business homepages, parses metadata, headings, detected services, and schema markup, then uses Groq-hosted LLMs to extract structured business profiles.
* **SerpApi + Tavily Hybrid Search Layer**: Normalizes Google Organic, Google Maps (Local 3-Pack), People Also Ask (PAA), Related Searches, and Google News results with token-conserving multi-query sweep fallbacks.
* **Location Autocomplete & Canonical Disambiguation**: Resolves city, postal code, and clinic queries into verified geographical search parameters via SerpApi's `locations.json` registry.
* **Google Business Profile (GBP) 4-Point Live Audit Protocol**: Live audit engine evaluating Google 3-Pack placement, Canonical NAP & Domain Linkage, Voice of Customer review velocity, and Territory Radius Targeting with 12 interactive checklist tasks and progress tracking.
* **Competitor Discovery & Threat Matrix**: Automatically discovers local business rivals without requiring the owner to know competitor names in advance. Classifies domains as `direct_competitor`, `indirect_competitor`, or `directory_aggregator` with human-in-the-loop review.
* **Opportunity Radar & Keyword Ranking Deltas**: Discovers high-conversion keywords, scores them using a multi-factor formula (Business Relevance, Commercial Intent, Ranking Potential, Local Market Fit, Content Gap), and calculates historical rank deltas ($\Delta \text{rank}$).
* **Action-Oriented Recommendation Engine**: Groq-hosted LLMs synthesize all competitive evidence into 3 to 5 prioritized actions (P0 to P3). Each recommendation includes 3–4 practical sub-task check-off steps with real-time percentage progress bars.
* **Tangible Outcome & Win Tracker**: Correlates completed recommendations with subsequent SERP rank sweeps to compute exact position improvements (e.g. `Climbed +4 spots for "dentist near me"`).
* **Client & White-Label Web Sharing**: Generates tokenized, read-only public links (`/shared/[token]`) for external stakeholders with dual-view mode toggles (Executive vs Specialist view) and PDF print styling.
* **Triggered Emergency Market Shift Alerts**: Out-of-cycle flash alerts detecting Google 3-Pack displacement, sharp rank drops ($\ge 3$ spots), competitor sponsored Google Ads campaigns, and negative review spikes, paired with transactional email alerts.
* **Automated Scheduling & Notifications**: BullMQ repeat queues running on Upstash Redis TLS dispatch daily, weekly, or monthly scheduled runs for **every business** in a workspace, perform background stale data checks, and deliver deduplicated transactional emails via Resend. Because repeat jobs only execute while a worker process is running, a **catch-up reconciliation** pass (`src/jobs/catchup.ts`) runs on boot and every 6 hours: it compares `lastAnalyzedAt` against each workspace's cadence in Postgres and enqueues whatever is overdue, so occurrences missed by downtime or a Redis flush are repaired instead of silently skipped. Manual refreshes are deduplicated via BullMQ's `deduplication` option to prevent duplicate jobs from repeated clicks.
* **Enterprise Multi-Tenant Security**: Zero cross-workspace data leakage, strict monthly search quotas (HTTP 429), and robust SSRF filtering preventing internal network probes.

---

## 🏗 System Architecture

```mermaid
flowchart TD
    subgraph Client["Client Tier (apps/web)"]
        UI["Next.js 14 App Router\n(Tailwind CSS + SWR)"]
        NativeAuth["Native JWT Auth\n(Session & Multi-Tenant State)"]
        PublicShare["Client Share Portal\n(/shared/[token])"]
    end

    subgraph API["Backend Tier (apps/api)"]
        Express["Express 4 REST API"]
        Middleware["Auth & Quota Middleware\n(Tenant Scoping & 429 Limiter)"]
        MarketShift["Market Shift Engine\n(Emergency Displacement Alerts)"]
        PuppeteerEngine["Puppeteer PDF Service\n(Executive Report Rendering)"]
        ResendService["Resend Email Service\n(Transactional Delivery)"]
    end

    subgraph Worker["Queue & Jobs Tier"]
        BullMQ["BullMQ Workers\n(Research, Reports, Stale Checks)"]
        Redis["Upstash Redis TLS\n(Task State & Rate Limiting)"]
    end

    subgraph AI["AI & Search Tier"]
        Groq["Groq LLM Engine\n(gpt-oss-120b default, configurable)"]
        LangGraph["LangGraph Research Graph\n(11 nodes, parallel fan-out)"]
        SerpApi["SerpApi Engine\n(Google Organic, Maps, News, Locations)"]
        Tavily["Tavily Search Engine\n(Parallel Sweep Backfill)"]
    end

    subgraph DB["Database Tier (packages/db)"]
        Neon["Neon Serverless PostgreSQL\n(Drizzle ORM — 18 Relational Tables)"]
    end

    UI -->|HTTPS / API Requests| Middleware
    PublicShare -->|Public Token Access| Express
    Middleware --> Express
    Express --> Neon
    Express --> MarketShift
    Express --> BullMQ
    BullMQ --> Redis
    BullMQ --> AI
    Express --> AI
    Express --> PuppeteerEngine
    Express --> ResendService
```

### Research Pipeline (`@serp-scout/agents`)
The platform's intelligence pipeline is a real LangGraph `StateGraph` that fans
out to the analysis agents in parallel:

```
START → analyze_website → plan_queries → search_sweep
     → discover_competitors → discover_keywords
     → [content_gap | messaging | review | news_signals]   ← parallel fan-out
     → recommendation_engine → report_generator → END
```

* Every SERP query is injected via a `ResearchSearchGateway`; `apps/api`
  supplies the SerpApi-backed implementation, which records each query as a
  `search_runs` row and increments the workspace quota.
* Nodes **never throw**: a failed node appends to the `errors` channel (append
  reducer) and the run continues, so a partial pass still yields a usable
  report when an upstream API is down or out of quota.
* The parallel fan-out is safe because every channel it writes to uses an
  append reducer; the fan-in at `recommendation_engine` is a barrier LangGraph
  resolves by waiting on all incoming edges.
* Trigger with `POST /api/businesses/:id/analysis/run` (queued on BullMQ, or
  `{"sync": true}` to run inline) and read the latest output from
  `GET /api/businesses/:id/analysis/run/status`.

---

## 📦 Monorepo Structure

```sh
└── serp-scout/
    ├── apps/
    │   ├── api/                       # Express 4 backend server & background jobs
    │   │   ├── src/
    │   │   │   ├── config/            # Environment parsing & validation (Zod)
    │   │   │   ├── db/                # Neon database client & schema exports
    │   │   │   ├── jobs/              # BullMQ queue definitions, workers & schedulers
    │   │   │   ├── middleware/        # JWT auth, workspace isolation, rate limiting
    │   │   │   ├── routes/            # REST API endpoints (businesses, reports, searches)
    │   │   │   └── services/          # Market shift, PDF, notifications, SerpApi research gateway
    │   │   ├── scripts/               # Dev/verification scripts (excluded from prod build)
    │   │   └── package.json
    │   └── web/                       # Next.js 14 App Router web application
    │       ├── src/
    │       │   ├── app/               # Routes (dashboard, competitors, keywords, local, reports, shared)
    │       │   ├── components/        # UI components (sidebar, navigation, cards, badges)
    │       │   ├── lib/               # API client, utility functions
    │       │   └── middleware.ts      # Authentication & route protection middleware
    │       └── package.json
    ├── packages/
    │   ├── agents/                    # Multi-agent intelligence & recommendation pipelines
    │   │   ├── src/
    │   │   │   ├── orchestrator/          # LangGraph state, research graph & pipeline runner
    │   │   │   ├── competitor-discovery/  # Extraction, profiler, threat matrix
    │   │   │   ├── opportunity-radar/     # Keyword scoring formula, intent mapping
    │   │   │   ├── recommendation-engine/ # Prioritized P0-P3 action generation with sub-tasks
    │   │   │   └── report-generator/      # Executive summaries & visibility change builder
    │   ├── db/                        # Drizzle ORM schema, relations & Neon connection
    │   │   ├── src/schema/            # 18 relational PostgreSQL table definitions
    │   │   └── drizzle.config.ts
    │   ├── serpapi/                   # SerpApi & Tavily API integration client
    │   │   └── src/                   # Google Organic, Maps, News & normalizers
    │   └── types/                     # Shared TypeScript interfaces across all packages
    ├── docker-compose.yml             # Local Redis container setup
    ├── package.json                   # Monorepo scripts & dependencies
    ├── pnpm-workspace.yaml            # PNPM workspace configuration
    └── turbo.json                     # Turborepo build pipeline configuration
```

---

## 🔍 Project Index & Modules

<details>
<summary><b>⦿ apps/api (Express Backend & Workers)</b></summary>
<blockquote>

| Module / File | Responsibility |
| :--- | :--- |
| `src/index.ts` | Server entrypoint, CORS, auth routes mounting, and public shared router registration. |
| `src/routes/research-graph.ts` | LangGraph pipeline trigger (`POST .../analysis/run`) and latest-run status endpoint. |
| `src/routes/reports.ts` | Report CRUD, sub-task checklist toggles, outcome metrics, and tokenized share links. |
| `src/routes/businesses.ts` | Business management, location autocomplete (`/locations/search`), and service profiles. |
| `src/routes/search-runs.ts` | Multi-engine search trigger (Google, Maps, News) with quota and cost tracking. |
| `src/services/market-shift.service.ts` | Live detection for 3-Pack displacement, rank drops, competitor ads, and review spikes. |
| `src/services/research-gateway.service.ts` | SerpApi-backed `ResearchSearchGateway` for the graph; records runs & applies quota. |
| `src/services/pdf.service.ts` | Headless Chromium Puppeteer engine rendering pixel-perfect executive PDF briefings. |
| `src/services/notification.service.ts` | Resend transactional email service with weekly briefs and emergency market alerts. |
| `src/jobs/workers/` | BullMQ background workers (`research.worker.ts`, `report.worker.ts`, `stale-check.worker.ts`, `research-graph.worker.ts`). |
| `src/jobs/catchup.ts` | Cadence reconciliation: enqueues a refresh for any business whose `lastAnalyzedAt` is older than its `refreshCadence` (runs on boot + every 6h). |
| `src/jobs/scheduler.ts` | BullMQ repeatable job registration for all businesses per workspace, stale-check and catch-up timers, and deduplicated manual refresh triggers. |
| `src/routes/schedules.ts` | Schedule settings API: cadence, notification email, stale threshold, per-business schedule status, and multi-business immediate refresh. |
| `scripts/` | Dev verification scripts (`test-milestone*.ts`, `generate-milestones-pdf.ts`); excluded from the prod build via tsconfig. |

</blockquote>
</details>

<details>
<summary><b>⦿ apps/web (Next.js 14 Frontend)</b></summary>
<blockquote>

| Module / File | Responsibility |
| :--- | :--- |
| `src/app/(app)/reports/page.tsx` | Executive reports dashboard with sub-task checklists, outcome tracking, and share modal. |
| `src/app/shared/[token]/page.tsx` | Public client-facing report portal with Executive and Specialist view toggles. |
| `src/app/(app)/local/page.tsx` | Local SEO command center: Google Maps radar, review sentiment, and 4-Point Live Audit. |
| `src/app/(app)/competitors/page.tsx` | Competitor discovery directory with threat matrix and human-in-the-loop review. |
| `src/app/(app)/keywords/page.tsx` | Keyword Opportunity Radar with multi-factor scoring and ranking trajectory tracking. |
| `src/app/(app)/onboarding/page.tsx` | Instant onboarding flow with website extraction and location autocomplete. |
| `src/components/` | Shared UI (ErrorBanner) plus extracted page sections (`content/`, `local/`). |
| `src/middleware.ts` | Route security middleware with protected application routes and public share access. |

</blockquote>
</details>

<details>
<summary><b>⦿ packages (Shared Monorepo Libraries)</b></summary>
<blockquote>

| Package | Responsibility |
| :--- | :--- |
| `@serp-scout/agents` | LangGraph-orchestrated multi-agent system (Competitor Discovery, Content Gaps, Recommendations, Research Graph). |
| `@serp-scout/db` | Neon Serverless PostgreSQL client with 18 Drizzle ORM relational tables. |
| `@serp-scout/serpapi` | Normalization layer for SerpApi (Web, Maps, News, Locations) and Tavily search backfills. |
| `@serp-scout/types` | Centralized TypeScript contracts for search, agents, recommendations, and reports. |

</blockquote>
</details>

---

## 🤖 Agent Roster

| Agent Name | Engine | Responsibility |
| :--- | :--- | :--- |
| **Research Orchestrator** | `LangGraph StateGraph` | Compiles website analysis, SERP sweep, competitor/keyword discovery and the parallel analysis fan-out into one resilient run with error accumulation. |
| **Website Extractor** | `Cheerio` + `Groq (gpt-oss-120b)` | Ingests business URL, strips boilerplates, detects core services, and extracts structured schema. |
| **Competitor Discovery Agent** | `SerpApi` + `Heuristic Scorer` | Discovers organic and local 3-Pack rivals, scores overlap, and filters non-competitor directories. |
| **Content Gap Agent** | `Groq (gpt-oss-120b)` | Discovers missing commercial and transactional topics where competitors capture high-intent searches. |
| **Messaging & Positioning Agent** | `Groq (gpt-oss-120b)` | Analyzes competitor value propositions, guarantees, pricing cues, and call-to-actions. |
| **Review & Voice of Customer Agent** | `Groq (gpt-oss-120b)` | Evaluates sentiment patterns, customer friction points, and recurring complaints for copy angles. |
| **GBP Live Audit Protocol** | `Rule Engine` + `SerpApi` | Audits 3-Pack rank, domain linkage, review velocity, and hyper-local geographical radius targeting. |
| **Recommendation Engine** | `Groq (gpt-oss-120b)` | Synthesizes all intelligence into 3–5 high-ROI actions with step-by-step implementation sub-tasks. |
| **Market Shift Engine** | `Heuristic Classifier` | Detects emergency market shifts (3-Pack displacement, competitor ad campaigns, review surges). |

> The Groq inference model is configurable via `GROQ_MODEL` (default
> `openai/gpt-oss-120b`). When an LLM call fails, agents fall back to
> deterministic heuristics so the pipeline still produces evidence-grounded
> output.

---

## ⚡ Getting Started

### Prerequisites

- **Node.js**: `v20.x` or higher
- **PNPM**: `v9.x` or higher
- **Docker**: For running local Redis (or an [Upstash Redis](https://upstash.com) instance)
- **External Services & APIs**:
  - [Neon](https://neon.tech) (Serverless PostgreSQL)
  - [Groq](https://groq.com) (High-speed LLM inference)
  - [SerpApi](https://serpapi.com) (Search engine results & Google Maps)
  - [Tavily](https://tavily.com) (Fast multi-query web sweep search)
  - [Resend](https://resend.com) (Transactional email notifications)

### Environment Configuration

Copy the example environment files and populate your API credentials:

```sh
# Configure backend API environment
cp apps/api/.env.example apps/api/.env

# Configure frontend web environment
cp apps/web/.env.example apps/web/.env.local
```

#### Backend API (`apps/api/.env`)

```env
NODE_ENV=development
PORT=3001

# Neon PostgreSQL Database
DATABASE_URL=postgresql://user:pass@ep-xyz.neon.tech/neondb?sslmode=require

# Redis (Local Docker or Upstash TLS)
REDIS_URL=redis://localhost:6379

# Native Authentication (Bcrypt + HS256 JWT)
JWT_SECRET=your-secure-jwt-secret-key-at-least-32-chars

# SerpApi (Google Organic, Maps, News, Locations)
SERPAPI_KEY=your_serpapi_key

# Groq LLM Inference
GROQ_API_KEY=gsk_your_groq_api_key
GROQ_MODEL=openai/gpt-oss-120b

# Resend Transactional Email
RESEND_API_KEY=re_your_resend_api_key
EMAIL_FROM=noreply@serp-scout.app

# Cross-Origin Frontend & Limits
FRONTEND_URL=http://localhost:3000
DEFAULT_MONTHLY_QUOTA=500
```

#### Frontend Web (`apps/web/.env.local`)

```env
# Backend API Base URL
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### Installation & Setup

1. **Clone the repository:**
   ```sh
   git clone https://github.com/SHADOW-0602/Serp-Scout.git
   cd Serp-Scout
   ```

2. **Install monorepo dependencies:**
   ```sh
   pnpm install
   ```

3. **Start local Redis (if not using Upstash):**
   ```sh
   docker-compose up -d
   ```

4. **Verify database schema migrations:**
   ```sh
   pnpm --filter @serp-scout/db build
   node packages/db/dist/migrate-upgrades.js
   ```

### Running the Applications

Start all applications in development mode simultaneously via Turborepo:

```sh
pnpm dev
```

* **Frontend Web App**: [http://localhost:3000](http://localhost:3000)
* **Backend API Server**: [http://localhost:3001](http://localhost:3001)
* **API Health Check**: [http://localhost:3001/health](http://localhost:3001/health)

### Verification & Testing

Verify that all packages and applications compile cleanly:

```sh
# Build all packages & apps
pnpm build

# Typecheck the entire monorepo
pnpm run typecheck
```

---

## 🔒 Security & Compliance Guardrails

* **Tenant Isolation**: Every database query enforces multi-tenant boundary checks (`workspace_id` verification). Users can never view or modify data outside their authorized workspace.
* **SSRF Protection**: Outgoing HTTP requests validate target IP addresses against private and internal subnets (`127.0.0.0/8`, `10.0.0.0/8`, `192.168.0.0/16`, AWS/GCP metadata endpoints `169.254.169.254`), preventing server-side request forgery attacks.
* **Monthly Quota Enforcement**: Atomic quota counters reject search requests exceeding the workspace's monthly limit with HTTP 429 (`QUOTA_EXCEEDED`).
* **Tokenized Public Sharing**: Public shared reports use high-entropy cryptographic tokens with automatic 30-day expiration and 1-click revocation.
* **Deduplicated Transactional Alerts**: Notifications and emergency market alerts use 24-hour deduplication hashing to ensure stakeholders are never spammed.

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](./LICENSE) for more information.

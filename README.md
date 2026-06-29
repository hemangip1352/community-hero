# Community Hero AI

**AI-powered civic issue resolution platform built with Next.js 15, Supabase, and Google Gemini.**

Citizens report infrastructure problems. Gemini AI triages, verifies, assigns, and tracks resolution — automatically.

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy environment template
cp .env.example .env.local
# Fill in your Supabase and Google AI keys

# 3. Run the database migration
# → Paste docs/schema.sql into Supabase SQL Editor and run

# 4. Start dev server
npm run dev

# 5. Seed departments (one-time)
curl -X POST http://localhost:3000/api/seed
```

Open **http://localhost:3000** → Sign up → Report an issue → Watch the AI work.

---

## 📖 Documentation

| Document | Purpose |
|----------|---------|
| [RUN_PROJECT.md](./RUN_PROJECT.md) | Complete beginner-friendly setup guide (15 steps) |
| [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) | Database migration, auth, storage, RLS |
| [GOOGLE_AI_SETUP.md](./GOOGLE_AI_SETUP.md) | Gemini API key, models, testing |
| [BUILD_STATUS.md](./BUILD_STATUS.md) | Build verification, issues fixed |
| [TEST_REPORT.md](./TEST_REPORT.md) | End-to-end test results |
| [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) | Full implementation summary |
| [docs/schema.sql](./docs/schema.sql) | Complete database schema |

---

## 🏗️ Architecture

```
citizen reports issue
        │
        ▼
POST /api/issues
        │
        ▼
┌───────────────────────────────────────┐
│         4-Node AI Pipeline            │
│                                       │
│  1. TRIAGE   (Gemini 1.5 Flash)      │
│     → classify, detect duplicates    │
│                                       │
│  2. VERIFY   (rule-based + threshold) │
│     → auto-verify if confident        │
│                                       │
│  3. RESOLVE  (Gemini 1.5 Pro)        │
│     → action plan + dept assignment   │
│                                       │
│  4. PRODUCTIVITY ESCALATE            │
│     → Day 3 reminder                 │
│     → Day 7 follow-up               │
│     → Day 14 escalation             │
└───────────────────────────────────────┘
        │
        ▼
   Supabase DB
   agent_logs (streamable to UI)
```

Every node writes ENTRY + EXIT logs to `agent_logs` — visible in real-time on the issue detail page.

---

## 🔑 Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Database connection |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Public client auth |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Agent log writes (bypasses RLS) |
| `GOOGLE_AI_API_KEY` | ⚡ Optional | Gemini AI features (rule-based fallback) |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | ⚡ Optional | Google Maps (SVG fallback) |

---

## 📋 Key Features

### For Citizens
- 📝 **Report issues** in 3 steps with GPS auto-detect
- 🎙️ **Voice reporting** — speak your issue, Gemini structures it
- 📍 **Map view** — see all issues near you with severity markers
- 🔔 **Track progress** — real-time status updates

### For Officials
- 🤖 **AI Triage** — automatic category, severity, duplicate detection
- 📋 **Resolution plans** — step-by-step action plans per issue
- 🏢 **Auto-assignment** — issues routed to correct department
- ⏰ **Productivity tracking** — SLA deadlines, reminders, escalations

### For Administrators
- 📊 **Dashboard** — real-time charts, trends, resolution rates
- 🔄 **Productivity sweep** — batch process all overdue issues
- 🤖 **Agent health** — per-node success rates and timing
- 📜 **Audit logs** — every AI decision recorded with reasoning

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.2 (App Router, Turbopack) |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (email + session) |
| AI | Google Gemini 1.5 Flash + Pro |
| UI | Tailwind CSS v4 + shadcn/ui |
| Charts | Recharts |
| Animations | Framer Motion |
| Forms | React Hook Form + Zod |
| State | Zustand |
| Deployment | Google AI Studio Starter Tier (Cloud Run) |

---

## 🧪 Scripts

```bash
npm run dev          # Start development server (http://localhost:3000)
npm run build        # Production build
npm run start        # Start production server
npm run typecheck    # TypeScript type check (tsc --noEmit)
npm run lint         # ESLint
```

---

## 🚀 Deployment

This application is deployed directly from Google AI Studio Build Mode using the **Publish** button to provision a Google Cloud Run service via the Starter Tier.

---

## 📂 Project Structure

```
civic-issue-platform/
├── app/                    # Root layout (Next.js)
├── src/
│   ├── app/
│   │   ├── api/            # All API routes
│   │   │   ├── issues/     # CRUD + AI pipeline trigger
│   │   │   ├── map/        # Map markers endpoint
│   │   │   ├── agents/     # Agent logs + sweep
│   │   │   ├── voice/      # Gemini voice structuring
│   │   │   ├── dashboard/  # Real stats aggregation
│   │   │   └── seed/       # Department seeding
│   │   ├── dashboard/      # Analytics dashboard
│   │   ├── issue/[id]/     # Issue detail + AI timeline
│   │   ├── map/            # Interactive issue map
│   │   ├── report/         # Issue reporting form
│   │   └── auth/           # Login / signup
│   ├── lib/
│   │   ├── ai/
│   │   │   ├── agent-orchestrator.ts  # 4-node state machine
│   │   │   ├── gemini-client.ts       # Flash/Pro factory
│   │   │   ├── issue-classifier.ts    # Keyword classifier
│   │   │   └── duplicate-detector.ts # Levenshtein + Haversine
│   │   ├── supabase/       # Browser + server clients
│   │   └── validation/     # Zod schemas
│   └── types/              # TypeScript interfaces
├── docs/
│   └── schema.sql          # Complete database schema
├── .env.example            # Environment template
└── BUILD_STATUS.md         # Build verification report
```

---

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Run `npm run typecheck` before committing
4. Open a pull request

---

## 📄 License

MIT — see LICENSE file.

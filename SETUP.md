# Community Hero AI - Developer Setup & Handoff Guide

This document provides a complete technical handoff for extending Community Hero AI with AI coding agents (Antigravity, Cursor, Claude Code, GitHub Copilot).

## 🎯 Project Overview

**Community Hero AI** is an Autonomous Civic Resolution Platform that automates the complete issue lifecycle:

```
Citizen Reports → AI Analyzes → Community Verifies → Department Assigned 
→ Status Tracked → Reminders Sent → Escalations Managed → Issue Resolved
```

**Technology:**
- Next.js 15 (App Router)
- Supabase PostgreSQL
- Google Gemini AI
- Framer Motion
- shadcn/ui + Tailwind CSS

## 📁 Project Architecture

### Core Directories

```
src/
├── app/                          # Next.js pages & API routes
│   ├── page.tsx                  # Landing page (DONE)
│   ├── dashboard/page.tsx        # Dashboard (DONE)
│   ├── report/page.tsx           # Issue reporting (DONE)
│   ├── auth/                     # Authentication (DONE)
│   └── api/
│       ├── issues/route.ts       # Issue API (DONE)
│       ├── verification/route.ts # Verification API (DONE)
│       └── dashboard/stats/      # Analytics API (DONE)
│
├── lib/
│   ├── ai/                       # AI AGENTS - Core Innovation
│   │   ├── image-analysis.ts     # Image recognition (PLACEHOLDER)
│   │   ├── issue-classifier.ts   # Categorization (IMPLEMENTED)
│   │   ├── duplicate-detector.ts # Similarity matching (IMPLEMENTED)
│   │   ├── verification-agent.ts # Verification logic (PLACEHOLDER)
│   │   ├── resolution-agent.ts   # Action plan generation (PLACEHOLDER)
│   │   ├── escalation-agent.ts   # Timeout management (PLACEHOLDER)
│   │   ├── reminder-agent.ts     # Alert scheduling (PLACEHOLDER)
│   │   └── agent-orchestrator.ts # Workflow coordination (IMPLEMENTED)
│   ├── supabase/
│   │   ├── client.ts             # Browser client
│   │   └── server.ts             # Server client
│   └── validation/
│       └── schemas.ts            # Zod validation schemas
│
├── components/
│   └── ui/                       # shadcn/ui components
│
├── store/
│   ├── auth-store.ts             # Auth state (Zustand)
│   └── issue-store.ts            # Issue state (Zustand)
│
├── types/
│   └── index.ts                  # TypeScript definitions
│
└── docs/
    ├── schema.sql                # Database schema
    └── agents.md                 # Agent architecture
```

## 🗄️ Database Setup

### Complete Schema

All tables are defined in `docs/schema.sql`. Key tables:

**Authentication:**
- `users` - User profiles with roles and scoring

**Core Data:**
- `issues` - Issue reports with AI analysis results
- `issue_media` - Uploaded photos/videos
- `departments` - Department profiles

**Workflow:**
- `issue_verifications` - Verification records
- `assignments` - Department assignments
- `issue_status_history` - Status timeline
- `reminders` - Alert scheduling
- `escalations` - Escalation tracking
- `agent_logs` - Agent execution audit trail

### Creating Tables

```bash
# Method 1: Using Supabase CLI
pnpm supabase db push

# Method 2: Manual SQL in Supabase Console
# Copy contents of docs/schema.sql into SQL Editor
```

### RLS Policies

Row-Level Security is configured for:
- Users can only view their own data
- Public can view all issues
- Role-based access control
- Admin-only agent logs

## 🤖 AI Agent Architecture

### Current Implementation Status

| Agent | Status | Location | Notes |
|-------|--------|----------|-------|
| Image Analysis | PLACEHOLDER | `lib/ai/image-analysis.ts` | Needs Google Gemini integration |
| Issue Classifier | IMPLEMENTED | `lib/ai/issue-classifier.ts` | Keyword-based, production-ready |
| Duplicate Detector | IMPLEMENTED | `lib/ai/duplicate-detector.ts` | Levenshtein + geospatial |
| Verification | PLACEHOLDER | `lib/ai/verification-agent.ts` | Needs confidence logic |
| Resolution | PLACEHOLDER | `lib/ai/resolution-agent.ts` | Templates ready, needs ML |
| Assignment | TODO | Needs creation | Route to departments |
| Reminder | PLACEHOLDER | `lib/ai/reminder-agent.ts` | Schedule structure ready |
| Escalation | PLACEHOLDER | `lib/ai/escalation-agent.ts` | Logic structure ready |
| Orchestrator | IMPLEMENTED | `lib/ai/agent-orchestrator.ts` | Coordinates all agents |

### Extending Agents

Each agent service follows this pattern:

```typescript
// 1. Define input/output types
export interface AgentInput {
  // Input parameters
}

export interface AgentOutput {
  // Output results
}

// 2. Implement main function
export async function agentFunction(input: AgentInput): Promise<AgentOutput> {
  try {
    // Implementation
    return result;
  } catch (error) {
    console.error('[AI] Agent error:', error);
    throw error;
  }
}

// 3. Log execution for audit trail
// Agent is automatically called in orchestrator with logging
```

### Adding Google Gemini Integration

**Current Placeholder:**
```typescript
// src/lib/ai/image-analysis.ts
export async function analyzeImage(imageBase64: string): Promise<AIAnalysisResult> {
  // Placeholder implementation
  return { category: 'Pothole', ... };
}
```

**Replace with:**
```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function analyzeImage(imageBase64: string): Promise<AIAnalysisResult> {
  const client = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
  const model = client.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const result = await model.generateContent([
    { inlineData: { data: imageBase64, mimeType: 'image/jpeg' } },
    { text: 'Analyze this civic issue image...' }
  ]);

  // Parse and return result
}
```

## 🔧 API Routes - Extension Points

### Existing Routes (DONE)

```
GET  /api/issues              # List issues
POST /api/issues              # Create issue (triggers AI pipeline)
GET  /api/verification        # List verifications
POST /api/verification        # Create verification
GET  /api/dashboard/stats     # Dashboard statistics
```

### Routes to Add (TODO)

```
GET    /api/issues/[id]                   # Get issue details
PUT    /api/issues/[id]                   # Update issue status
DELETE /api/issues/[id]                   # Delete issue (admin)

POST   /api/issues/[id]/comments          # Add comment
GET    /api/issues/[id]/comments          # List comments

POST   /api/issues/[id]/verify            # Community verify
GET    /api/issues/[id]/escalations       # Get escalation history

POST   /api/assignments                    # Create assignment
PUT    /api/assignments/[id]               # Update assignment

POST   /api/reminders                      # Schedule reminder
GET    /api/reminders/upcoming             # Get pending reminders

GET    /api/map/markers                    # Get map markers (with filters)
GET    /api/map/heatmap                    # Get heatmap data

GET    /api/users/[id]                     # User profile
PUT    /api/users/[id]                     # Update profile

POST   /api/agents/process                 # Manual agent trigger
GET    /api/agents/logs                    # Agent execution logs
```

## 📄 Validation & Types

### Zod Schemas

All input validation is in `src/lib/validation/schemas.ts`:

```typescript
export const reportIssueSchema = z.object({
  title: z.string().min(5).max(200),
  description: z.string().min(10).max(2000),
  category: z.enum(['Pothole', 'Garbage', ...]),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

// Usage in API routes:
const data = reportIssueSchema.parse(req.body);
```

### TypeScript Types

All types in `src/types/index.ts`:

```typescript
export interface Issue {
  id: string;
  user_id: string;
  title: string;
  category: IssueCategory;
  status: IssueStatus;
  ai_category?: string;
  ai_confidence_score?: number;
  // ... more fields
}
```

## 🔐 Authentication Flow

### Supabase Auth Integration

**Client Setup:**
```typescript
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();
const { data, error } = await supabase.auth.signInWithPassword({
  email,
  password
});
```

**Server Setup:**
```typescript
import { createClient } from '@/lib/supabase/server';

const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();
```

### Protected Routes

Wrap pages with auth check:
```typescript
'use client';
import { useAuthStore } from '@/store/auth-store';
import { useEffect } from 'react';

export default function ProtectedPage() {
  const { isAuthenticated } = useAuthStore();
  
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login');
    }
  }, []);
  
  // Page content
}
```

## 📊 State Management (Zustand)

### Auth Store
```typescript
import { useAuthStore } from '@/store/auth-store';

const { user, isAuthenticated, setUser, logout } = useAuthStore();
```

### Issue Store
```typescript
import { useIssueStore } from '@/store/issue-store';

const { 
  issues, 
  setIssues, 
  addIssue, 
  getFilteredIssues 
} = useIssueStore();
```

## 🎨 UI Components

All UI components are from shadcn/ui:
- Button
- Card
- Input
- Select
- Form components (React Hook Form)

Located in `src/components/ui/`.

## 🚀 Deployment

### Google Cloud Run Deployment

This application is deployed directly from Google AI Studio Build Mode using the **Publish** button to provision a Google Cloud Run service via the Starter Tier. Vercel is strictly not permitted for deployment in this project.

## ⚙️ Development Workflow

### Running Locally

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build
pnpm start
```

### Running Tests

```bash
# Unit tests (when added)
pnpm test

# Linting
pnpm lint

# Type checking
pnpm type-check
```

## 🔗 Integration Points for AI Agents

### 1. Adding New Pages

Create page in `src/app/[section]/page.tsx`:
```typescript
'use client';

import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

export default function NewPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      {/* Page content */}
    </div>
  );
}
```

### 2. Creating API Endpoints

Create route in `src/app/api/[section]/route.ts`:
```typescript
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    // Implementation
    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json({ error: 'Error message' }, { status: 500 });
  }
}
```

### 3. Adding AI Agent Logic

Enhance `src/lib/ai/[agent-name].ts`:
```typescript
export async function enhancedAgentFunction(input) {
  // Add Google Gemini calls
  // Add ML model integration
  // Add caching logic
  return result;
}
```

### 4. Extending Database

Add migrations or update `docs/schema.sql`:
```sql
-- Add new table
CREATE TABLE new_feature (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- columns
);

-- Then push with: pnpm supabase db push
```

## 📖 Key Files Reference

| File | Purpose |
|------|---------|
| `docs/schema.sql` | Complete database schema |
| `src/types/index.ts` | All TypeScript interfaces |
| `src/lib/validation/schemas.ts` | Zod validation schemas |
| `src/lib/ai/agent-orchestrator.ts` | Main AI coordination |
| `src/store/auth-store.ts` | Authentication state |
| `src/app/api/issues/route.ts` | Issue API endpoint |

## 🛠️ Known Placeholders & TODOs

### High Priority
- [ ] Full Google Gemini API integration for image analysis
- [ ] Real-time WebSocket notifications
- [ ] Email/SMS notification service
- [ ] Google Maps integration for markers and heatmaps
- [ ] PDF report generation

### Medium Priority
- [ ] User profile pages
- [ ] Notification center
- [ ] Advanced filtering and search
- [ ] Export functionality
- [ ] Admin user management dashboard

### Low Priority
- [ ] Mobile app (React Native)
- [ ] Blockchain audit trail
- [ ] AI-generated weekly reports
- [ ] Predictive analytics

## 💡 Extension Guidelines

### For Antigravity/Cursor/Claude Code

1. **Always maintain API contracts** - Don't change existing function signatures
2. **Add agent logs** - Every action should be logged to `agent_logs` table
3. **Validate input** - Use Zod schemas before processing
4. **Handle errors gracefully** - Return meaningful error messages
5. **Follow the pattern** - New features should match existing code style
6. **Document changes** - Update this file when adding new endpoints
7. **Test locally** - Always test before deployment

### Code Style

- TypeScript with strict mode
- Tailwind CSS for styling
- Framer Motion for animations
- shadcn/ui for components
- Zod for validation
- Zustand for state

## 🔗 External Resources

- [Next.js 15 Docs](https://nextjs.org/)
- [Supabase Docs](https://supabase.com/docs)
- [Google Gemini API](https://ai.google.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [shadcn/ui](https://ui.shadcn.com/)

## 📞 Support

For questions about the architecture:
1. Check `README.md` for overview
2. Review `docs/agents.md` for AI workflow
3. Examine existing API routes for patterns
4. Check TypeScript types for data structures

---

**Last Updated:** 2024
**Status:** Production-Ready Foundation
**Ready for AI Agent Extension:** YES ✅

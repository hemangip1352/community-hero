# Supabase Setup Guide

> Complete setup instructions for the Community Hero AI database.

---

## Step 1 — Create a Supabase Project

1. Go to **https://supabase.com** and sign in
2. Click **"New project"**
3. Fill in:
   - **Project name**: `civic-hero-ai`
   - **Database password**: Choose a strong password (save it!)
   - **Region**: Choose closest to your users
4. Click **"Create new project"** and wait ~2 minutes

---

## Step 2 — Run the Database Migration

1. In the Supabase dashboard, click **"SQL Editor"** (left sidebar)
2. Click **"New query"**
3. Open `docs/schema.sql` from this project
4. Copy the **entire file** contents
5. Paste into the SQL editor
6. Click **▶ Run** (or press Ctrl+Enter / Cmd+Enter)

You should see: `Success. No rows returned`

> **Note:** The schema creates all tables, indexes, RLS policies, and triggers in one shot. If you see an error about `departments` already existing, the schema was already applied — that's fine.

---

## Step 3 — Configure Authentication

### Enable Email Auth

1. Go to **Authentication → Providers**
2. Ensure **Email** is enabled (it is by default)
3. For development: optionally disable **"Confirm email"** under Email provider settings

### Set Redirect URLs

1. Go to **Authentication → URL Configuration**
2. Set **Site URL**: `http://localhost:3000`
3. Add to **Redirect URLs**:
   - `http://localhost:3000/auth/callback`
   - `https://your-prod-domain.vercel.app/auth/callback` (for production)

---

## Step 4 — Get API Keys

1. Go to **Settings → API** in your project dashboard
2. Copy these values into your `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...   ← "anon public" key
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...       ← "service_role" key (keep secret!)
```

---

## Step 5 — Configure Storage (for Issue Media)

1. Go to **Storage** in the left sidebar
2. Click **"New bucket"**
3. Name it: `issue-media`
4. Set to **Public** (so images are accessible without auth)
5. Click **Create bucket**

### Add Storage Policy

In the SQL Editor, run:

```sql
-- Allow authenticated users to upload to issue-media bucket
CREATE POLICY "Authenticated users can upload media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'issue-media');

-- Allow public read access to issue media
CREATE POLICY "Public can view issue media"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'issue-media');
```

---

## Step 6 — Verify Tables

In the **Table Editor**, confirm these tables exist:

| Table | Purpose |
|-------|---------|
| `users` | User profiles linked to auth.users |
| `departments` | Government departments (seed with /api/seed) |
| `issues` | Civic issue reports |
| `issue_media` | Photos/videos attached to issues |
| `issue_comments` | Community comments |
| `issue_verifications` | AI and community verifications |
| `assignments` | Department assignments per issue |
| `issue_status_history` | Status change audit log |
| `reminders` | Government productivity reminders |
| `escalations` | Escalation records for overdue issues |
| `notifications` | User notification inbox |
| `agent_logs` | AI agent execution logs (the "thought process") |
| `analytics_daily` | Aggregated daily metrics |

---

## Step 7 — RLS Policy Overview

Row Level Security is enabled on all tables. Key policies:

| Table | Policy | Rule |
|-------|--------|------|
| `issues` | SELECT | Public — anyone can read |
| `issues` | INSERT | Auth user only, must own the row |
| `agent_logs` | SELECT | Admin role only |
| `notifications` | SELECT | User can only see their own |
| `users` | SELECT | Own profile or any authenticated user |

> **Important for agent writes:** The AI orchestrator uses `SUPABASE_SERVICE_ROLE_KEY` which bypasses RLS. This is intentional — agents need to write logs even when running without a user session.

---

## Step 8 — Seed Departments

After starting the dev server:

```bash
curl -X POST http://localhost:3000/api/seed
```

This creates 5 departments:
- Roads Department (`roads`)
- Sanitation Department (`sanitation`)
- Electrical Department (`electrical`)
- Water Department (`water`)
- General Affairs Department (`other`)

These are required for the AI Resolve node to populate `assignments`.

---

## Step 9 — Verify Supabase Integration

Test each integration:

### Test Auth
```bash
# Register a user via the app at /auth/signup
# Then check Supabase → Authentication → Users
# Your email should appear
```

### Test Issue Creation
```bash
# Submit an issue via /report
# Then check Table Editor → issues
# A new row should appear
```

### Test Agent Logs
```bash
# After submitting an issue (with SUPABASE_SERVICE_ROLE_KEY set)
# Check Table Editor → agent_logs
# Should see ~8 rows per issue (ENTRY + EXIT for each node)
```

### Test Notifications
```bash
# Update an issue status via PUT /api/issues/<id>
# Check Table Editor → notifications
# A row should appear for the issue owner
```

---

## Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `relation "departments" does not exist` | Schema not run | Run docs/schema.sql in SQL Editor |
| `new row violates row-level security` | Wrong client used | Use service role key for agent writes |
| `JWT expired` | Session expired | User needs to log in again |
| `duplicate key value violates unique constraint` | Seeding twice | Safe — `/api/seed` uses upsert |
| `permission denied for table users` | RLS blocks service role | This shouldn't happen — service role bypasses RLS |

---

## Production Checklist

- [ ] Run `docs/schema.sql` in production Supabase project
- [ ] Set all 3 Supabase env vars in Vercel/deployment
- [ ] Configure auth redirect URL to production domain
- [ ] Create `issue-media` storage bucket
- [ ] Call `POST /api/seed` once to create departments
- [ ] Enable email confirmation in production auth settings

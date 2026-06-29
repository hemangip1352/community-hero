# Community Hero AI — Complete Local Run Guide

> **Audience:** First-time developers, hackathon judges, contributors.  
> **Time:** ~20 minutes with accounts already created.

---

## Prerequisites

### 1. Install Node.js (v20 or v22 LTS)

```bash
# Check your current version
node --version

# If not installed, download from:
# https://nodejs.org/en/download (choose LTS)
# OR use nvm (recommended):

# Windows (PowerShell — run as admin)
winget install CoreyButler.NVMforWindows

# Then install Node 20:
nvm install 20
nvm use 20
```

### 2. Install pnpm (optional — npm works too)

```bash
# Using npm (comes with Node.js)
npm install -g pnpm

# Verify
pnpm --version   # should be 9+
```

---

## Step 1 — Get the Code

```bash
# If you have the zip file, extract it. Otherwise clone:
git clone https://github.com/your-org/civic-issue-platform.git
cd civic-issue-platform-main
```

---

## Step 2 — Install Dependencies

```bash
# Using npm
npm install

# OR using pnpm
pnpm install
```

Expected output:
```
added 436 packages, and audited 437 packages in ~2m
2 moderate severity vulnerabilities  ← safe to ignore
```

---

## Step 3 — Configure Supabase

### 3a. Create a Supabase Project

1. Go to **https://supabase.com** → Sign up / Log in
2. Click **"New project"**
3. Choose a region close to you
4. Save your database password — you'll need it

### 3b. Run the Database Migration

1. In your Supabase dashboard, click **SQL Editor** (left sidebar)
2. Click **"New query"**
3. Copy the entire contents of `docs/schema.sql` from this project
4. Paste it into the SQL editor
5. Click **"Run"** (Ctrl+Enter)

You should see: `Success. No rows returned`

### 3c. Get your API Keys

1. In your Supabase dashboard, go to **Settings → API**
2. Copy these three values:
   - **Project URL** (looks like `https://abcdef.supabase.co`)
   - **anon public key** (long JWT string)
   - **service_role key** (keep this secret!)

### 3d. Configure Supabase Auth

1. Go to **Authentication → Providers**
2. Ensure **Email** provider is enabled (it is by default)
3. Go to **Authentication → URL Configuration**
4. Set **Site URL** to: `http://localhost:3000`
5. Add to **Redirect URLs**: `http://localhost:3000/auth/callback`

---

## Step 4 — Configure Google AI Studio (Gemini)

1. Go to **https://aistudio.google.com/app/apikey**
2. Sign in with a Google account
3. Click **"Create API key"**
4. Copy the key (starts with `AIza...`)

> **Without this key:** The app still works — all AI nodes fall back to rule-based keyword logic. You'll see results, but without Gemini intelligence.

---

## Step 5 — Configure Google Maps (Optional)

1. Go to **https://console.cloud.google.com**
2. Create a project (or use existing)
3. Go to **APIs & Services → Library**
4. Enable: **Maps JavaScript API**
5. Go to **APIs & Services → Credentials → Create Credentials → API Key**
6. Copy the key

> **Without this key:** The `/map` page uses a built-in SVG canvas fallback. All markers still display correctly.

---

## Step 6 — Create Your .env.local File

In the project root, create a file called `.env.local`:

```bash
# Windows PowerShell
copy .env.example .env.local

# Mac/Linux
cp .env.example .env.local
```

Now edit `.env.local` with your real values:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6Ikp...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6Ikp...

GOOGLE_AI_API_KEY=AIzaSy...

NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSy...   # optional
```

---

## Step 7 — Start the Development Server

```bash
npm run dev
```

Expected output:
```
▲ Next.js 16.2.6 (Turbopack)
- Local: http://localhost:3000
- Network: http://192.168.x.x:3000
✓ Ready in 2.3s
```

Open **http://localhost:3000** in your browser.

---

## Step 8 — Seed the Departments

This creates the 5 government departments that the AI uses when assigning issues.

**Option A — Using curl (terminal):**
```bash
curl -X POST http://localhost:3000/api/seed
```

**Option B — Using your browser:**  
Open: http://localhost:3000/api/seed (GET request shows current departments)  
Then use Postman or any REST client to POST to the same URL.

**Option C — From the dashboard:**  
Go to `http://localhost:3000/dashboard` and click **"Seed Departments"** button at the bottom.

Expected response:
```json
{
  "message": "Seeded 5 departments successfully.",
  "data": [...]
}
```

---

## Step 9 — Create a User Account

1. Go to **http://localhost:3000/auth/signup**
2. Enter your email and password
3. Choose role: **Citizen** (for testing issue reporting)
4. Click **Sign Up**

> Check your email for a confirmation link if Supabase email confirmation is enabled.

---

## Step 10 — Test Issue Reporting

1. Go to **http://localhost:3000/report**
2. Allow location access when prompted
3. Fill in:
   - Title: `Deep pothole on MG Road near bus stop 14`
   - Category: `Pothole`
   - Urgency: `High`
   - Description: `There is a large pothole approximately 30cm deep...`
4. Click **Review & Submit**
5. Click **Submit Report**

After submission, you'll be redirected to `/issue/<uuid>`. This means the 4-node AI pipeline ran.

---

## Step 11 — Test Voice Reporting

1. Go to **http://localhost:3000/report**
2. Click **"Start Voice Report"**
3. Speak clearly: *"There is a broken streetlight on Park Avenue near the school. It has been dark for 3 nights and it's dangerous."*
4. Watch the form fill in automatically — title, category (Streetlight Failure), urgency (high), and description

---

## Step 12 — Test the AI Pipeline

After submitting an issue:

1. Go to `/issue/<uuid>`
2. Click the **"AI Timeline"** tab
3. You should see 8 log entries:
   - `triage_node` ENTRY
   - `triage_node` EXIT (classified category, confidence, severity)
   - `verify_node` ENTRY
   - `verify_node` EXIT (auto-verified or flagged)
   - `resolve_node` ENTRY
   - `resolve_node` EXIT (department assigned, action plan)
   - `productivity_escalate_node` ENTRY
   - `productivity_escalate_node` EXIT (deadline set, reminder scheduled)

> If `GOOGLE_AI_API_KEY` is not set, you'll still see all 8 entries — the content will be rule-based instead of Gemini-generated.

---

## Step 13 — Test the Dashboard

1. Go to **http://localhost:3000/dashboard**
2. You should see:
   - Total issues count (non-zero after submitting)
   - 7-day trend chart
   - Category distribution pie chart
   - **Government Productivity Panel** (shows the issue if it's old enough)
   - **AI Agent Health** panel (shows triage/verify/resolve/productivity stats)
   - Department performance (shows if departments are assigned)

3. Click **"Run Sweep"** in the Productivity Panel to trigger the productivity agent on all active issues

---

## Step 14 — Test the Map Page

1. Go to **http://localhost:3000/map**
2. You should see your submitted issue as a coloured dot on the canvas
3. Try the filters: filter by **Category** and **Status**
4. Click a dot to see the issue popup
5. Click **"View Full Details"** to go to the issue detail page

---

## Step 15 — Verify Agent Logs in Supabase

1. In your Supabase dashboard, go to **Table Editor**
2. Open the `agent_logs` table
3. You should see rows with:
   - `agent_name`: `triage_node`, `verify_node`, etc.
   - `agent_action`: `ENTRY: ...` and `EXIT: ...`
   - `status`: `success` or `failed`
   - `execution_time_ms`: actual milliseconds

---

## Common Issues & Fixes

| Problem | Fix |
|---------|-----|
| `Supabase URL is required` error | Check `.env.local` — no quotes needed |
| `Unauthorized` on issue submission | Sign up and log in first |
| No departments seeded | POST to `/api/seed` first |
| AI timeline shows 0 logs | Check `SUPABASE_SERVICE_ROLE_KEY` — agent logs need service role |
| Voice button does nothing | Use Chrome — Safari/Firefox have limited SpeechRecognition support |
| Map shows "No issues" | Submit at least one issue and wait for a full page refresh |
| Build fails with font error | Already fixed — update from the latest version of the repo |

---

## Production Deployment

This application is deployed directly from Google AI Studio Build Mode using the **Publish** button to provision a Google Cloud Run service via the Starter Tier.

Vercel is strictly not permitted for deployment in this project.

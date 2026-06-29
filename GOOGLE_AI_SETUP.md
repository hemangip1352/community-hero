# Google AI (Gemini) Setup Guide

> Community Hero AI uses Google's Gemini models for its 4-node AI pipeline.

---

## Installation

The SDK is already in `package.json`. To install:

```bash
npm install
# or
pnpm install
```

The package installed is:

```json
"@google/generative-ai": "^0.24.1"
```

This is the **official Google Generative AI SDK** — the latest stable version as of June 2026.

---

## Getting an API Key

1. Go to **https://aistudio.google.com/app/apikey**
2. Sign in with any Google account
3. Click **"Create API key"**
4. Choose **"Create API key in new project"**
5. Copy the key (format: `AIzaSy...`)

> Google AI Studio provides **free tier** access with generous rate limits suitable for hackathon and development use.

---

## Configuring the API Key

Add to your `.env.local`:

```env
GOOGLE_AI_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

**Never commit this key to git.** The `.gitignore` already excludes `.env.local`.

---

## Models Used

| Model | Node | Use Case |
|-------|------|---------|
| `gemini-1.5-flash` | Triage (Node 1) | Fast classification, keyword extraction, duplicate detection |
| `gemini-1.5-flash` | Voice Structuring | Transcript → structured issue fields |
| `gemini-1.5-pro` | Resolve (Node 3) | Deep reasoning for action plans and department routing |
| `gemini-1.5-pro` | Productivity Escalate (Node 4) | SLA analysis, escalation summaries, reminder text |

---

## How the Client Works

**File:** `src/lib/ai/gemini-client.ts`

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';

// Returns null when key is absent — never throws
export function getFlashModel(): GenerativeModel | null {
  if (!process.env.GOOGLE_AI_API_KEY) return null;
  const client = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
  return client.getGenerativeModel({ model: 'gemini-1.5-flash' });
}
```

Every AI node checks for `null` and falls back to rule-based logic:

```typescript
const model = getFlashModel();
if (!model) {
  // Use keyword-based fallback — app still works
  return keywordClassify(issue);
}
// Use Gemini
const result = await model.generateContent(prompt);
```

---

## Testing the Integration

### 1. Test API Key is Working

```bash
# Start dev server
npm run dev

# Submit a test issue via the /report page
# Then check /issue/<uuid> → AI Timeline tab

# You should see:
# triage_node EXIT: "Classified as 'Pothole' (89% confidence)"
# resolve_node EXIT: "Assigned to Roads Department"
```

### 2. Test Voice Structuring

```bash
curl -X POST http://localhost:3000/api/voice/structure \
  -H "Content-Type: application/json" \
  -d '{"transcript": "There is a huge pothole on the main road near the market, very dangerous for bikes"}'
```

Expected response with key set:
```json
{
  "data": {
    "title": "Dangerous Pothole on Main Road Near Market",
    "description": "A significant pothole on the main road near the market poses a serious safety hazard for motorcyclists and cyclists.",
    "category": "Pothole",
    "urgency": "high"
  },
  "gemini_used": true
}
```

Expected response **without** key (fallback):
```json
{
  "data": {
    "title": "There is a huge pothole on the main road...",
    "category": "Pothole",
    "urgency": "medium"
  },
  "gemini_used": false
}
```

### 3. Verify Agent Logs

After submitting an issue, check the `agent_logs` table in Supabase. You should see 8 rows per issue (ENTRY + EXIT for each of the 4 nodes).

---

## Rate Limits & Quotas (Free Tier)

| Model | Requests/min | Tokens/min |
|-------|-------------|------------|
| `gemini-1.5-flash` | 15 | 1,000,000 |
| `gemini-1.5-pro` | 2 | 32,000 |

For a hackathon demo, the free tier is more than sufficient.

---

## Upgrading the SDK (Future)

When Google releases a new SDK version:

```bash
npm install @google/generative-ai@latest
```

Check the [Google AI SDK changelog](https://github.com/google-gemini/generative-ai-js/releases) for breaking changes. The client factory in `gemini-client.ts` is the only file that needs updating for model name or API changes.

---

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `API key not valid` | Wrong key or project disabled | Re-generate key in AI Studio |
| `429 Too Many Requests` | Rate limit hit | Wait 60s or upgrade to paid tier |
| `model not found` | Model name changed | Update `gemini-client.ts` model strings |
| `gemini_used: false` in response | Key not in `.env.local` | Check env var name exactly: `GOOGLE_AI_API_KEY` |

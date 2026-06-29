# Getting Started - Community Hero AI

Quick start guide to run Community Hero AI locally.

## 📋 Prerequisites

- Node.js 18+
- pnpm (recommended) or npm
- Git
- Supabase account (free tier OK)

## ⚡ Quick Start (5 minutes)

### 1. Clone & Setup

```bash
# Install dependencies
pnpm install

# Copy environment template
cp .env.example .env.local
```

### 2. Configure Supabase

Visit [supabase.com](https://supabase.com):
1. Create new project
2. Copy these from Project Settings → API:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Copy Service Role Key:
   - `SUPABASE_SERVICE_ROLE_KEY`

Paste into `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx
SUPABASE_SERVICE_ROLE_KEY=eyJxxx
```

### 3. Initialize Database

#### Option A: Supabase Web Console

1. In Supabase, go to SQL Editor
2. Copy contents from `docs/schema.sql`
3. Paste and run the query
4. ✅ Database created

#### Option B: Supabase CLI

```bash
# Install Supabase CLI
npm i -g @supabase/cli

# Login
supabase login

# Link project
supabase link

# Push schema
supabase db push
```

### 4. Run Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000)

You should see the landing page! 🎉

## 🧭 Next Steps

### Try the App

1. **Visit Landing Page** - See features and overview
2. **Sign Up** - Create account at `/auth/signup`
3. **Report Issue** - Go to `/report` and submit a test issue
4. **View Dashboard** - See `/dashboard` with stats
5. **Check API** - Visit `/api/issues` to see reported issues

### Test the AI Pipeline

The AI agent orchestrator automatically processes new issues:

```bash
# Submit an issue via the form or API
curl -X POST http://localhost:3000/api/issues \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Large pothole on Main Street",
    "description": "Dangerous pothole near the library",
    "category": "Pothole",
    "latitude": 40.7128,
    "longitude": -74.0060,
    "urgency": "high"
  }'

# Response includes AI analysis:
# - Classified category
# - Confidence score
# - Duplicate detection results
# - Resolution plan
# - Agent logs
```

## 🗄️ Database Schema

Key tables created:

```
users              - User accounts and roles
issues             - Issue reports
issue_media        - Photos/videos
issue_verifications - Verification records
assignments        - Department routing
departments        - Department profiles
reminders          - Follow-up alerts
escalations        - Overdue issue escalations
agent_logs         - AI agent audit trail
```

See `docs/schema.sql` for complete details.

## 🤖 AI Agents

Currently Implemented:
- ✅ Issue Classifier
- ✅ Duplicate Detector
- ✅ Orchestrator

Ready for Enhancement:
- 🔄 Image Analysis (needs Google Gemini)
- 🔄 Verification (needs ML model)
- 🔄 Reminders & Escalations
- 🔄 Resolution Plans

See `docs/agents.md` for architecture.

## 📝 Example Workflows

### Submit an Issue

```
1. User: Click "Report Issue" or go to /report
2. System: Request location permission
3. User: Fill form with issue details
4. User: Optionally upload photo or use voice input
5. System: Store issue in database
6. AI: Analyze and classify automatically
7. Result: Issue appears on dashboard with AI insights
```

### Verify an Issue

```
1. User: Visit /verify (when implemented)
2. System: Show issues needing community verification
3. User: Review AI analysis
4. User: Vote confirm/reject
5. System: Update issue status based on votes
6. Result: Issue marked as verified or rejected
```

### Track Resolution

```
1. User: View issue details on /issue/[id]
2. System: Show full timeline
3. System: Display assigned department
4. System: Show estimated completion
5. System: Allow community comments
6. Result: Real-time tracking until resolved
```

## 🔑 Environment Variables

### Required

```env
NEXT_PUBLIC_SUPABASE_URL=          # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=     # Supabase anon key
SUPABASE_SERVICE_ROLE_KEY=         # Service role key
```

### Optional (for AI features)

```env
GOOGLE_AI_API_KEY=                 # For Gemini image analysis
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=   # For maps and heatmaps
```

## 🐛 Troubleshooting

### Port 3000 Already in Use

```bash
# Use different port
pnpm dev -- -p 3001
```

### Database Connection Error

1. Check `.env.local` has correct URL and keys
2. Verify Supabase project is active
3. Run schema SQL again in Supabase console

### Auth Error

1. Ensure Google OAuth is configured (if using)
2. Check callback URLs in Supabase Auth settings
3. Verify JWT secret is set

### Build Error

```bash
# Clean and rebuild
rm -rf .next
pnpm build
```

## 📚 Documentation

- **README.md** - Project overview
- **SETUP.md** - Complete developer guide
- **docs/schema.sql** - Database schema
- **docs/agents.md** - AI agent architecture
- **docs/PAGES.md** - Pages to implement

## 🚀 Deployment

### Deploy to Vercel

```bash
# Connect GitHub repo
vercel link

# Set environment variables
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY

# Deploy
vercel deploy
```

### Production Checklist

- [ ] Environment variables set in Vercel
- [ ] Database schema deployed
- [ ] Supabase Auth configured
- [ ] Google Maps API enabled (if using maps)
- [ ] Email notifications configured
- [ ] Error tracking setup (optional)
- [ ] Analytics setup (optional)

## 🎯 What's Implemented

✅ **Done:**
- Landing page with full features showcase
- User authentication (Supabase + Google)
- Issue reporting form with voice input
- Dashboard with stats and charts
- Database schema and API routes
- AI agent orchestrator framework
- Issue classifier & duplicate detector
- Zustand state management
- Framer Motion animations

🔄 **In Progress:**
- Additional pages (map, verify, profile, admin)
- Full AI agent implementation
- Google Maps integration
- Real-time notifications
- Department routing

## 📞 Support

### Getting Help

1. Check documentation files (README, SETUP, docs/)
2. Review existing code in `src/app` for patterns
3. Check API routes for data access examples
4. Review types in `src/types/index.ts`

### Common Issues

**Q: How do I add a new page?**
A: Create file in `src/app/[name]/page.tsx`, follow existing patterns in `/dashboard` or `/report`

**Q: How do I fetch data?**
A: Use `/api/` routes or Supabase client from `src/lib/supabase/client.ts`

**Q: How do I add authentication?**
A: Check `useAuthStore()` or examine `/auth/login` page

**Q: How do I extend AI agents?**
A: See `docs/agents.md` and add functions to `src/lib/ai/[agent].ts`

## 🎓 Learning Resources

- [Next.js 15 Docs](https://nextjs.org/docs)
- [Supabase Getting Started](https://supabase.com/docs/guides/getting-started)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [shadcn/ui Components](https://ui.shadcn.com/)
- [Framer Motion](https://www.framer.com/motion/)

## 🎉 Ready to Build!

You now have a working Community Hero AI instance. Next steps:

1. Explore the landing page
2. Create an account
3. Submit a test issue
4. View it on the dashboard
5. Check the database for AI analysis results
6. Read SETUP.md for architecture details
7. Start implementing missing features!

---

**Happy coding! 🚀**

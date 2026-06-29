# Community Hero AI - Pages & Routes

## Implemented Pages ✅

### Authentication
- **`/auth/login`** - User login with email/password and Google OAuth
- **`/auth/signup`** - User registration with role selection

### Core Pages
- **`/`** - Landing page with features, workflow, testimonials, CTA
- **`/dashboard`** - Main dashboard with stats, charts, department performance
- **`/report`** - Multi-step issue reporting form with voice input

### API Routes
- **`GET /api/issues`** - List issues with filters
- **`POST /api/issues`** - Create new issue (triggers AI pipeline)
- **`GET /api/verification`** - List verifications
- **`POST /api/verification`** - Create verification record
- **`GET /api/dashboard/stats`** - Dashboard statistics

## Todo Pages (For AI Agents to Implement)

### Issue Management
- **`/issue/[id]`** - Issue details page with full tracking
  - Display issue information and metadata
  - Show AI analysis results
  - Timeline of status changes
  - Comments and discussions
  - Verification history
  - Escalation history
  - Resolution plan
  - Edit/update capabilities

- **`/issue/[id]/track`** - Issue tracking and progress
  - Status timeline
  - Department updates
  - Community comments
  - Estimated completion

### Verification
- **`/verify`** - Verification center for community
  - List issues needing verification
  - Verify/reject interface
  - Add evidence
  - View confidence scores

### Maps & Analytics
- **`/map`** - Community heatmap with Google Maps
  - Issue markers with filters
  - Category heatmaps
  - Status-based coloring
  - Date range filtering
  - Area filtering
  - Cluster view

- **`/analytics`** - Advanced analytics dashboard
  - Trend analysis
  - Category breakdowns
  - Department performance
  - Community engagement metrics

### User & Admin Panels
- **`/profile`** - User profile page
  - Personal information
  - Reported issues
  - Verified issues
  - Contribution score
  - Badges/ranks

- **`/profile/edit`** - Edit profile

- **`/notifications`** - Notification center
  - Issue updates
  - Verification requests
  - Escalation alerts
  - Community responses

- **`/admin/dashboard`** - Admin dashboard
  - User management
  - Issue moderation
  - Department management
  - Analytics overview

- **`/admin/users`** - User management
  - List all users
  - Edit roles
  - Ban/restrict users
  - View activity

- **`/admin/issues`** - Issue moderation
  - Review all issues
  - Delete inappropriate
  - Merge duplicates
  - Manual categorization

- **`/admin/departments`** - Department management
  - Create/edit departments
  - Assign officers
  - View performance

- **`/admin/ai-logs`** - AI agent monitoring
  - View agent execution logs
  - Monitor performance
  - Debug agent decisions
  - Review audit trail

### Department Views
- **`/department/dashboard`** - Department-specific dashboard
  - Assigned issues
  - Pending items
  - Performance metrics
  - Reminders

### Settings
- **`/settings`** - User settings
  - Email preferences
  - Notification settings
  - Privacy settings
  - Account management

- **`/settings/preferences`** - Category preferences
- **`/settings/notifications`** - Notification configuration

## Page Implementation Guidelines

### Route Structure

Each page should follow this structure:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/auth-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function PageName() {
  const { isAuthenticated } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login');
      return;
    }
    // Fetch data
  }, [isAuthenticated]);

  if (loading) {
    return <LoadingState />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 px-4 py-8">
      {/* Page content */}
    </div>
  );
}
```

### Common Components

Each page typically includes:
- Header with title and description
- Loading state
- Error handling
- Animations (Framer Motion)
- shadcn/ui components
- Responsive design

### Data Fetching

Data should be fetched from:
- `/api/issues` - For issue data
- `/api/dashboard/stats` - For dashboard metrics
- `/api/verification` - For verification data
- Supabase client for real-time data

### State Management

Use Zustand stores for:
- `useAuthStore()` - User authentication
- `useIssueStore()` - Issue list and filtering

### Styling

- Tailwind CSS v4 with semantic design tokens
- Dark gradient backgrounds (slate-900 to slate-800)
- Blue/cyan accent colors (#3b82f6, #06b6d4)
- Consistent spacing and typography
- Responsive breakpoints (sm, md, lg)

## Navigation Structure

```
Home (/)
├── Landing Page
└── [User logged out]
    ├── /auth/login
    └── /auth/signup

Dashboard (/dashboard)
├── Overview stats
├── Charts
└── Actions
    ├── Report Issue
    └── View Map

Report Issue (/report)
├── Location step
├── Form step
└── Review step

Issue Details (/issue/[id])
├── Issue info
├── AI Analysis
├── Timeline
└── Comments

Verification (/verify)
├── Issue list
├── Verify interface
└── Confidence display

Maps (/map)
├── Google Maps
├── Markers
└── Heatmap layers

Admin (/admin/dashboard)
├── User management
├── Issue moderation
├── Department management
└── AI monitoring

User Profile (/profile)
├── Statistics
├── Reported issues
└── Verified issues
```

## API Integration Checklist

For each page, implement:
- [ ] Data fetching with proper error handling
- [ ] Loading states
- [ ] Empty states
- [ ] Pagination if needed
- [ ] Filtering/sorting
- [ ] Real-time updates where needed
- [ ] Proper TypeScript types
- [ ] Input validation with Zod
- [ ] User auth checks

## Performance Considerations

- Use `motion.div` for animations (not <Animated/>)
- Lazy load images and heavy components
- Memoize expensive computations
- Limit API calls with debouncing
- Cache data appropriately
- Use responsive images

## Accessibility

- Proper heading hierarchy
- Alt text for images
- ARIA labels for custom components
- Keyboard navigation support
- Color contrast compliance
- Screen reader tested

---

**Last Updated:** 2024
**Total Pages Implemented:** 5/25
**Estimated AI Agent Implementation Time:** 40-60 hours

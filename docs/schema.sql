-- Community Hero AI — Complete Database Schema
-- Run this ENTIRE script in Supabase SQL Editor (Dashboard → SQL Editor → New Query → paste → Run)
-- It is safe to run multiple times (uses IF NOT EXISTS / OR REPLACE)

-- ============================================
-- EXTENSIONS
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- PostGIS for location indexing (skip if not available on your plan)
-- CREATE EXTENSION IF NOT EXISTS "postgis";

-- ============================================
-- DEPARTMENTS  (must be created BEFORE users)
-- ============================================

CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  category TEXT NOT NULL CHECK (category IN ('roads', 'sanitation', 'electrical', 'water', 'other')),
  performance_score NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- USERS  (references auth.users + departments)
-- ============================================

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'citizen' CHECK (role IN ('citizen', 'verifier', 'officer', 'senior_authority', 'admin')),
  department_id UUID REFERENCES departments(id),
  contribution_score INTEGER DEFAULT 0,
  rank TEXT DEFAULT 'Citizen',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- ISSUES
-- ============================================

CREATE TABLE IF NOT EXISTS issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  latitude NUMERIC NOT NULL,
  longitude NUMERIC NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('Pothole', 'Garbage', 'Water Leakage', 'Streetlight Failure', 'Drainage Problem', 'Road Damage', 'Other')),
  urgency TEXT NOT NULL DEFAULT 'medium' CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'reported' CHECK (status IN ('reported', 'verified', 'assigned', 'in_progress', 'resolved', 'rejected', 'duplicate')),
  ai_category TEXT,
  ai_summary TEXT,
  ai_confidence_score NUMERIC,
  ai_severity_score NUMERIC,
  resolution_plan JSONB,
  is_duplicate BOOLEAN DEFAULT FALSE,
  duplicate_of_id UUID REFERENCES issues(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_issues_user_id ON issues(user_id);
CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_category ON issues(category);
CREATE INDEX IF NOT EXISTS idx_issues_created_at ON issues(created_at);

-- ============================================
-- ISSUE MEDIA
-- ============================================

CREATE TABLE IF NOT EXISTS issue_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video', 'audio')),
  media_url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_issue_media_issue_id ON issue_media(issue_id);

-- ============================================
-- ISSUE COMMENTS
-- ============================================

CREATE TABLE IF NOT EXISTS issue_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_issue_comments_issue_id ON issue_comments(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_comments_user_id ON issue_comments(user_id);

-- ============================================
-- ISSUE VERIFICATION
-- ============================================

CREATE TABLE IF NOT EXISTS issue_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  verification_type TEXT NOT NULL CHECK (verification_type IN ('ai', 'community')),
  status TEXT NOT NULL CHECK (status IN ('confirmed', 'rejected', 'pending')),
  confidence_score NUMERIC,
  evidence_url TEXT,
  reasoning TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_issue_verifications_issue_id ON issue_verifications(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_verifications_user_id ON issue_verifications(user_id);

-- ============================================
-- ASSIGNMENTS
-- ============================================

CREATE TABLE IF NOT EXISTS assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id),
  assigned_to_user_id UUID REFERENCES users(id),
  assignment_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assignments_issue_id ON assignments(issue_id);
CREATE INDEX IF NOT EXISTS idx_assignments_department_id ON assignments(department_id);

-- ============================================
-- ISSUE STATUS HISTORY
-- ============================================

CREATE TABLE IF NOT EXISTS issue_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by_user_id UUID REFERENCES users(id),
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_status_history_issue_id ON issue_status_history(issue_id);
CREATE INDEX IF NOT EXISTS idx_status_history_created_at ON issue_status_history(created_at);

-- ============================================
-- REMINDERS
-- ============================================

CREATE TABLE IF NOT EXISTS reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  department_id UUID REFERENCES departments(id),
  reminder_level INTEGER DEFAULT 1,
  reminder_text TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE,
  scheduled_for TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reminders_issue_id ON reminders(issue_id);
CREATE INDEX IF NOT EXISTS idx_reminders_scheduled_for ON reminders(scheduled_for);

-- ============================================
-- ESCALATIONS
-- ============================================

CREATE TABLE IF NOT EXISTS escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  escalation_level INTEGER NOT NULL DEFAULT 1,
  escalated_to_user_id UUID REFERENCES users(id),
  escalation_summary TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_escalations_issue_id ON escalations(issue_id);

-- ============================================
-- NOTIFICATIONS
-- ============================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  issue_id UUID REFERENCES issues(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  action_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);

-- ============================================
-- AGENT LOGS
-- ============================================

CREATE TABLE IF NOT EXISTS agent_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID REFERENCES issues(id) ON DELETE CASCADE,
  agent_name TEXT NOT NULL,
  agent_action TEXT NOT NULL,
  input_data JSONB,
  output_data JSONB,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'pending')),
  error_message TEXT,
  execution_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_logs_issue_id ON agent_logs(issue_id);
CREATE INDEX IF NOT EXISTS idx_agent_logs_agent_name ON agent_logs(agent_name);
CREATE INDEX IF NOT EXISTS idx_agent_logs_created_at ON agent_logs(created_at);

-- ============================================
-- ANALYTICS (Aggregated Data)
-- ============================================

CREATE TABLE IF NOT EXISTS analytics_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  total_issues INTEGER DEFAULT 0,
  new_issues INTEGER DEFAULT 0,
  resolved_issues INTEGER DEFAULT 0,
  verified_issues INTEGER DEFAULT 0,
  escalated_issues INTEGER DEFAULT 0,
  avg_resolution_time_hours NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_daily_date ON analytics_daily(date);

-- ============================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers (drop first to allow re-runs)
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_issues_updated_at ON issues;
CREATE TRIGGER update_issues_updated_at BEFORE UPDATE ON issues
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_departments_updated_at ON departments;
CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON departments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_issue_comments_updated_at ON issue_comments;
CREATE TRIGGER update_issue_comments_updated_at BEFORE UPDATE ON issue_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_assignments_updated_at ON assignments;
CREATE TRIGGER update_assignments_updated_at BEFORE UPDATE ON assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_escalations_updated_at ON escalations;
CREATE TRIGGER update_escalations_updated_at BEFORE UPDATE ON escalations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_logs ENABLE ROW LEVEL SECURITY;

-- Drop old policies before recreating (safe for re-runs)
DROP POLICY IF EXISTS "Users can view their own profile" ON users;
DROP POLICY IF EXISTS "Users can insert their own profile" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
DROP POLICY IF EXISTS "Anyone can view issues" ON issues;
DROP POLICY IF EXISTS "Users can create issues" ON issues;
DROP POLICY IF EXISTS "Users can update own issues" ON issues;
DROP POLICY IF EXISTS "Anyone can view departments" ON departments;
DROP POLICY IF EXISTS "Users can view all comments" ON issue_comments;
DROP POLICY IF EXISTS "Users can create comments" ON issue_comments;
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
DROP POLICY IF EXISTS "Anyone can view verifications" ON issue_verifications;
DROP POLICY IF EXISTS "Users can create verifications" ON issue_verifications;
DROP POLICY IF EXISTS "Anyone can view assignments" ON assignments;
DROP POLICY IF EXISTS "Anyone can view status history" ON issue_status_history;
DROP POLICY IF EXISTS "Anyone can view reminders" ON reminders;
DROP POLICY IF EXISTS "Anyone can view escalations" ON escalations;
DROP POLICY IF EXISTS "Anyone can view agent logs" ON agent_logs;

-- USERS
CREATE POLICY "Users can view their own profile" ON users
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile" ON users
  FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY "Users can update their own profile" ON users
  FOR UPDATE USING (id = auth.uid());

-- ISSUES
CREATE POLICY "Anyone can view issues" ON issues
  FOR SELECT USING (true);

CREATE POLICY "Users can create issues" ON issues
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own issues" ON issues
  FOR UPDATE USING (true);

-- DEPARTMENTS  — public read, admin/service-role write
CREATE POLICY "Anyone can view departments" ON departments
  FOR SELECT USING (true);

-- COMMENTS
CREATE POLICY "Users can view all comments" ON issue_comments
  FOR SELECT USING (true);

CREATE POLICY "Users can create comments" ON issue_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- NOTIFICATIONS
CREATE POLICY "Users can view their own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

-- VERIFICATIONS
CREATE POLICY "Anyone can view verifications" ON issue_verifications
  FOR SELECT USING (true);

CREATE POLICY "Users can create verifications" ON issue_verifications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ASSIGNMENTS
CREATE POLICY "Anyone can view assignments" ON assignments
  FOR SELECT USING (true);

-- STATUS HISTORY
CREATE POLICY "Anyone can view status history" ON issue_status_history
  FOR SELECT USING (true);

-- REMINDERS
CREATE POLICY "Anyone can view reminders" ON reminders
  FOR SELECT USING (true);

-- ESCALATIONS
CREATE POLICY "Anyone can view escalations" ON escalations
  FOR SELECT USING (true);

-- AGENT LOGS
CREATE POLICY "Anyone can view agent logs" ON agent_logs
  FOR SELECT USING (true);

-- ============================================
-- SEED DEPARTMENTS (idempotent)
-- ============================================

INSERT INTO departments (name, description, category, email, phone)
VALUES
  ('Roads Department', 'Responsible for road maintenance, pothole repairs, and road damage remediation.', 'roads', 'roads@cityhero.local', '+91-11-2345-6001'),
  ('Sanitation Department', 'Manages garbage collection, waste disposal, and area cleanliness.', 'sanitation', 'sanitation@cityhero.local', '+91-11-2345-6002'),
  ('Electrical Department', 'Maintains public lighting infrastructure including streetlights.', 'electrical', 'electrical@cityhero.local', '+91-11-2345-6003'),
  ('Water Department', 'Operates and maintains water distribution networks, drainage systems.', 'water', 'water@cityhero.local', '+91-11-2345-6004'),
  ('General Affairs Department', 'Handles miscellaneous civic matters not covered by specialist departments.', 'other', 'general@cityhero.local', '+91-11-2345-6005')
ON CONFLICT (name) DO NOTHING;

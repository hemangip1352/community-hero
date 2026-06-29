export type UserRole = 'citizen' | 'verifier' | 'officer' | 'senior_authority' | 'admin';

export type IssueCategory = 'Pothole' | 'Garbage' | 'Water Leakage' | 'Streetlight Failure' | 'Drainage Problem' | 'Road Damage' | 'Other';

export type IssueStatus = 'reported' | 'verified' | 'assigned' | 'in_progress' | 'resolved' | 'rejected' | 'duplicate';

export type UrgencyLevel = 'low' | 'medium' | 'high' | 'critical';

export type DepartmentCategory = 'roads' | 'sanitation' | 'electrical' | 'water' | 'other';

export type VerificationType = 'ai' | 'community';

export type VerificationStatus = 'confirmed' | 'rejected' | 'pending';

export interface User {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  role: UserRole;
  department_id?: string;
  contribution_score: number;
  rank: string;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: string;
  name: string;
  description?: string;
  email?: string;
  phone?: string;
  address?: string;
  category: DepartmentCategory;
  performance_score: number;
  created_at: string;
  updated_at: string;
}

export interface Issue {
  id: string;
  user_id: string;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  category: IssueCategory;
  urgency: UrgencyLevel;
  status: IssueStatus;
  ai_category?: string;
  ai_summary?: string;
  ai_confidence_score?: number;
  ai_severity_score?: number;
  resolution_plan?: Record<string, any>;
  is_duplicate: boolean;
  duplicate_of_id?: string;
  created_at: string;
  updated_at: string;
}

export interface IssueMedia {
  id: string;
  issue_id: string;
  media_type: 'image' | 'video' | 'audio';
  media_url: string;
  storage_path: string;
  created_at: string;
}

export interface IssueComment {
  id: string;
  issue_id: string;
  user_id: string;
  comment: string;
  created_at: string;
  updated_at: string;
}

export interface IssueVerification {
  id: string;
  issue_id: string;
  user_id: string;
  verification_type: VerificationType;
  status: VerificationStatus;
  confidence_score?: number;
  evidence_url?: string;
  reasoning?: string;
  created_at: string;
  updated_at: string;
}

export interface Assignment {
  id: string;
  issue_id: string;
  department_id: string;
  assigned_to_user_id?: string;
  assignment_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface IssueStatusHistory {
  id: string;
  issue_id: string;
  old_status?: string;
  new_status: string;
  changed_by_user_id?: string;
  reason?: string;
  created_at: string;
}

export interface Reminder {
  id: string;
  issue_id: string;
  department_id?: string;
  reminder_level: number;
  reminder_text: string;
  sent_at?: string;
  scheduled_for?: string;
  created_at: string;
}

export interface Escalation {
  id: string;
  issue_id: string;
  escalation_level: number;
  escalated_to_user_id?: string;
  escalation_summary: string;
  reason?: string;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  issue_id?: string;
  notification_type: string;
  title: string;
  message: string;
  is_read: boolean;
  action_url?: string;
  created_at: string;
}

export interface AgentLog {
  id: string;
  issue_id?: string;
  agent_name: string;
  agent_action: string;
  input_data?: Record<string, any>;
  output_data?: Record<string, any>;
  status: 'success' | 'failed' | 'pending';
  error_message?: string;
  execution_time_ms?: number;
  created_at: string;
}

export interface AnalyticsDaily {
  id: string;
  date: string;
  total_issues: number;
  new_issues: number;
  resolved_issues: number;
  verified_issues: number;
  escalated_issues: number;
  avg_resolution_time_hours?: number;
  created_at: string;
}

export interface AIAnalysisResult {
  category: IssueCategory;
  summary: string;
  confidence_score: number;
  severity_score: number;
  reasoning: string;
}

export interface DuplicateCheckResult {
  is_potential_duplicate: boolean;
  duplicate_issue_ids: string[];
  similarity_scores: number[];
  reasoning: string;
}

export interface ResolutionPlan {
  category: IssueCategory;
  steps: string[];
  estimated_time_hours: number;
  required_resources: string[];
  success_criteria: string[];
}

export interface IssueFull extends Issue {
  user?: User;
  media?: IssueMedia[];
  comments?: IssueComment[];
  verifications?: IssueVerification[];
  assignment?: Assignment;
  status_history?: IssueStatusHistory[];
  reminders?: Reminder[];
  escalations?: Escalation[];
}

export interface DashboardStats {
  totalIssues: number;
  resolvedIssues: number;
  pendingIssues: number;
  averageResolutionTime: number;
  departmentPerformance: Array<{
    department: string;
    assigned: number;
    resolved: number;
    avgTime: number;
  }>;
}

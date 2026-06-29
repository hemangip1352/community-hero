'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft, MapPin, Clock, CheckCircle, AlertCircle, AlertTriangle,
  Bot, ChevronDown, ChevronUp, Zap, Building2, Calendar, Bell,
  TrendingUp, Shield, ClipboardList, RefreshCw
} from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

// ─── Types ──────────────────────────────────────────────────────────────────

interface AgentLog {
  id: string;
  agent_name: string;
  agent_action: string;
  status: 'success' | 'failed' | 'pending';
  output_data?: Record<string, any>;
  error_message?: string;
  execution_time_ms?: number;
  created_at: string;
}

interface Reminder {
  id: string;
  reminder_level: number;
  reminder_text: string;
  sent_at?: string;
  created_at: string;
}

interface Escalation {
  id: string;
  escalation_level: number;
  escalation_summary: string;
  reason?: string;
  created_at: string;
}

interface IssueFull {
  id: string;
  title: string;
  description: string;
  category: string;
  urgency: string;
  status: string;
  latitude: number;
  longitude: number;
  ai_category?: string;
  ai_summary?: string;
  ai_confidence_score?: number;
  ai_severity_score?: number;
  resolution_plan?: {
    steps: string[];
    estimated_hours: number;
    required_resources: string[];
    success_criteria: string[];
  };
  is_duplicate: boolean;
  duplicate_of_id?: string;
  created_at: string;
  updated_at: string;
  users?: { full_name?: string; email: string; role: string };
  issue_media?: Array<{ id: string; media_type: string; media_url: string }>;
  issue_verifications?: Array<{ id: string; verification_type: string; status: string; reasoning?: string; created_at: string }>;
  assignments?: Array<{ id: string; departments?: { name: string; category: string }; assignment_reason?: string; created_at: string }>;
  issue_status_history?: Array<{ id: string; old_status?: string; new_status: string; reason?: string; created_at: string }>;
  reminders?: Reminder[];
  escalations?: Escalation[];
  agent_logs?: AgentLog[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  reported:   { color: 'text-slate-300',  bg: 'bg-slate-700',          label: 'Reported' },
  verified:   { color: 'text-blue-300',   bg: 'bg-blue-900/40',        label: 'Verified' },
  assigned:   { color: 'text-purple-300', bg: 'bg-purple-900/40',      label: 'Assigned' },
  in_progress:{ color: 'text-amber-300',  bg: 'bg-amber-900/40',       label: 'In Progress' },
  resolved:   { color: 'text-green-300',  bg: 'bg-green-900/40',       label: 'Resolved' },
  rejected:   { color: 'text-red-300',    bg: 'bg-red-900/40',         label: 'Rejected' },
  duplicate:  { color: 'text-orange-300', bg: 'bg-orange-900/40',      label: 'Duplicate' },
};

const URGENCY_COLOR: Record<string, string> = {
  low: 'text-green-400',  medium: 'text-amber-400',
  high: 'text-orange-400', critical: 'text-red-400',
};

const NODE_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  triage_node:               { label: 'Triage Agent',              icon: <Zap className="w-4 h-4" />,         color: 'text-cyan-400'   },
  verify_node:               { label: 'Verification Agent',        icon: <Shield className="w-4 h-4" />,      color: 'text-blue-400'   },
  resolve_node:              { label: 'Resolution Agent',          icon: <ClipboardList className="w-4 h-4" />,color: 'text-purple-400' },
  productivity_escalate_node:{ label: 'Productivity Agent',        icon: <TrendingUp className="w-4 h-4" />,  color: 'text-amber-400'  },
};

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG['reported'];
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${cfg.bg} ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function ScoreBar({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs text-slate-400 mb-1">
        <span>{label}</span>
        <span className={color}>{(value * 100).toFixed(0)}%</span>
      </div>
      <div className="w-full bg-slate-700 rounded-full h-1.5">
        <motion.div
          className={`h-1.5 rounded-full bg-gradient-to-r ${color === 'text-blue-400' ? 'from-blue-500 to-cyan-500' : 'from-orange-500 to-red-500'}`}
          initial={{ width: 0 }}
          animate={{ width: `${value * 100}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

function AgentLogCard({ log, index }: { log: AgentLog; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const meta = NODE_META[log.agent_name] ?? { label: log.agent_name, icon: <Bot className="w-4 h-4" />, color: 'text-slate-400' };
  const isEntry = log.agent_action.startsWith('ENTRY:');
  const isExit  = log.agent_action.startsWith('EXIT:');
  const thought = log.agent_action.replace(/^(ENTRY:|EXIT:)\s*/, '');

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="flex gap-3"
    >
      {/* Timeline line */}
      <div className="flex flex-col items-center">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border ${
          log.status === 'success' ? 'border-green-500/50 bg-green-900/30' :
          log.status === 'failed'  ? 'border-red-500/50  bg-red-900/30'   :
          'border-slate-600 bg-slate-800'
        } ${meta.color}`}>
          {meta.icon}
        </div>
        <div className="w-px flex-1 bg-slate-700 mt-1" />
      </div>

      {/* Content */}
      <div className="pb-4 flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-xs font-semibold ${meta.color}`}>{meta.label}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded ${
            isEntry ? 'bg-slate-700 text-slate-400' : 'bg-slate-700 text-slate-300'
          }`}>{isEntry ? 'ENTRY' : isExit ? 'EXIT' : 'LOG'}</span>
          {log.execution_time_ms && (
            <span className="text-xs text-slate-500">{log.execution_time_ms}ms</span>
          )}
          <span className="text-xs text-slate-500 ml-auto">{timeAgo(log.created_at)}</span>
        </div>
        <p className="text-sm text-slate-300 leading-relaxed">{thought}</p>

        {log.output_data && Object.keys(log.output_data).length > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-2 flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expanded ? 'Hide' : 'Show'} output
          </button>
        )}
        <AnimatePresence>
          {expanded && log.output_data && (
            <motion.pre
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-2 p-3 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-400 overflow-x-auto"
            >
              {JSON.stringify(log.output_data, null, 2)}
            </motion.pre>
          )}
        </AnimatePresence>
        {log.error_message && (
          <p className="mt-1 text-xs text-red-400 bg-red-900/20 px-2 py-1 rounded">{log.error_message}</p>
        )}
      </div>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function IssueDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [issue, setIssue] = useState<IssueFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'agent' | 'history'>('overview');
  const [currentUser, setCurrentUser] = useState<{ id: string; role: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchIssue = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/issues/${id}`);
      if (!res.ok) throw new Error('Issue not found');
      const { data } = await res.json();
      setIssue(data);

      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from('users').select('id, role').eq('id', user.id).single();
        if (profile) setCurrentUser(profile);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchIssue(); }, [fetchIssue]);

  const handleVerify = async (status: 'confirmed' | 'rejected') => {
    if (!issue || !currentUser) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issue_id: issue.id,
          verification_type: 'community',
          status,
          confidence_score: 1.0,
          reasoning: `Community verifier manually ${status} this issue.`
        })
      });
      if (!res.ok) throw new Error('Verification failed');
      fetchIssue();
    } catch (err) {
      console.error(err);
      alert('Failed to verify issue.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStatusUpdate = async (status: string) => {
    if (!issue || !currentUser) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/issues/${issue.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          reason: `Officer manually updated status to ${status}`
        })
      });
      if (!res.ok) throw new Error('Status update failed');
      fetchIssue();
    } catch (err) {
      console.error(err);
      alert('Failed to update status.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCitizenConfirm = async (reopen: boolean) => {
    if (!issue || !currentUser) return;
    if (!reopen) {
      alert("Thank you for confirming!");
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(`/api/issues/${issue.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'in_progress', // Reopen
          reason: `Citizen reported the issue is not actually resolved.`
        })
      });
      if (!res.ok) throw new Error('Reopen failed');
      fetchIssue();
    } catch (err) {
      console.error(err);
      alert('Failed to reopen issue.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-sm">Loading issue...</p>
      </div>
    </div>
  );

  if (error || !issue) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
      <div className="text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <p className="text-white text-lg mb-2">Issue not found</p>
        <p className="text-slate-400 text-sm mb-6">{error}</p>
        <Button onClick={() => router.back()} variant="outline" className="border-slate-600">Go Back</Button>
      </div>
    </div>
  );

  const agentLogs = issue.agent_logs || [];
  const hasEscalation = (issue.escalations?.length ?? 0) > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 pb-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Back + Refresh */}
        <div className="flex items-center justify-between mb-6">
          <Link href="/dashboard">
            <Button variant="outline" size="sm" className="border-slate-600 hover:bg-slate-700 gap-2">
              <ArrowLeft className="w-4 h-4" /> Back to Dashboard
            </Button>
          </Link>
          <Button onClick={fetchIssue} variant="outline" size="sm" className="border-slate-600 hover:bg-slate-700 gap-2">
            <RefreshCw className="w-4 h-4" /> Refresh
          </Button>
        </div>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="flex flex-wrap items-start gap-3 mb-2">
            <StatusBadge status={issue.status} />
            {hasEscalation && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-red-900/40 text-red-300">
                <AlertTriangle className="w-3.5 h-3.5" /> Escalated
              </span>
            )}
            <span className={`text-sm font-medium ${URGENCY_COLOR[issue.urgency] ?? 'text-slate-300'}`}>
              {issue.urgency.charAt(0).toUpperCase() + issue.urgency.slice(1)} Urgency
            </span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">{issue.title}</h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400">
            <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" />{issue.latitude.toFixed(4)}, {issue.longitude.toFixed(4)}</span>
            <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" />{new Date(issue.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" />{timeAgo(issue.created_at)}</span>
            {issue.users && <span>by {issue.users.full_name || issue.users.email}</span>}
          </div>
        </motion.div>

        {/* Role-Based Actions */}
        {currentUser?.role === 'verifier' && (issue.status === 'reported' || issue.status === 'verified') && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 p-4 bg-purple-900/30 border border-purple-800/50 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-purple-300 font-semibold text-sm">Verifier Actions</p>
              <p className="text-slate-400 text-xs mt-0.5">Please confirm or reject this issue based on community guidelines.</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => handleVerify('confirmed')} disabled={actionLoading} size="sm" className="bg-green-600 hover:bg-green-700">Confirm Issue</Button>
              <Button onClick={() => handleVerify('rejected')} disabled={actionLoading} size="sm" className="bg-red-600 hover:bg-red-700">Reject Issue</Button>
            </div>
          </motion.div>
        )}

        {(currentUser?.role === 'officer' || currentUser?.role === 'senior_authority' || currentUser?.role === 'admin') && issue.status !== 'resolved' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 p-4 bg-amber-900/30 border border-amber-800/50 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-amber-300 font-semibold text-sm">Officer Actions</p>
              <p className="text-slate-400 text-xs mt-0.5">Update the resolution status of this issue.</p>
            </div>
            <div className="flex gap-2">
              {issue.status !== 'in_progress' && (
                <Button onClick={() => handleStatusUpdate('in_progress')} disabled={actionLoading} size="sm" className="bg-blue-600 hover:bg-blue-700">Mark In Progress</Button>
              )}
              <Button onClick={() => handleStatusUpdate('resolved')} disabled={actionLoading} size="sm" className="bg-green-600 hover:bg-green-700">Mark Resolved</Button>
            </div>
          </motion.div>
        )}

        {currentUser?.id === issue.user_id && issue.status === 'resolved' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 p-4 bg-blue-900/30 border border-blue-800/50 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-blue-300 font-semibold text-sm">Has this issue actually been resolved?</p>
              <p className="text-slate-400 text-xs mt-0.5">Your confirmation helps us keep track of department performance.</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => handleCitizenConfirm(false)} disabled={actionLoading} size="sm" className="bg-green-600 hover:bg-green-700">✔ Confirm</Button>
              <Button onClick={() => handleCitizenConfirm(true)} disabled={actionLoading} size="sm" className="bg-slate-700 hover:bg-slate-600">✖ Reopen</Button>
            </div>
          </motion.div>
        )}

        {/* AI Summary Banner */}
        {issue.ai_summary && (
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="mb-6 p-4 bg-gradient-to-r from-blue-900/30 to-cyan-900/30 border border-blue-800/50 rounded-xl flex gap-3"
          >
            <Bot className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-cyan-400 mb-0.5">AI Analysis Summary</p>
              <p className="text-slate-200 text-sm leading-relaxed">{issue.ai_summary}</p>
            </div>
          </motion.div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-slate-800/50 p-1 rounded-lg w-fit">
          {(['overview', 'agent', 'history'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === tab
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab === 'overview' ? 'Overview' : tab === 'agent' ? `AI Timeline (${agentLogs.length})` : 'History'}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid lg:grid-cols-3 gap-6">

              {/* Left column */}
              <div className="lg:col-span-2 space-y-6">
                {/* Description */}
                <Card className="bg-slate-800 border-slate-700">
                  <CardHeader><CardTitle className="text-white text-base">Description</CardTitle></CardHeader>
                  <CardContent>
                    <p className="text-slate-300 leading-relaxed">{issue.description}</p>
                    {issue.is_duplicate && issue.duplicate_of_id && (
                      <div className="mt-3 p-3 bg-orange-900/20 border border-orange-800/50 rounded-lg">
                        <p className="text-orange-300 text-sm">⚠️ This is a duplicate of issue <Link href={`/issue/${issue.duplicate_of_id}`} className="underline">{issue.duplicate_of_id.slice(0, 8)}…</Link></p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Resolution Plan */}
                {issue.resolution_plan && (
                  <Card className="bg-slate-800 border-slate-700">
                    <CardHeader>
                      <CardTitle className="text-white text-base flex items-center gap-2">
                        <ClipboardList className="w-4 h-4 text-purple-400" /> AI Resolution Plan
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        {issue.resolution_plan.steps.map((step, i) => (
                          <div key={i} className="flex gap-3 text-sm">
                            <span className="w-6 h-6 rounded-full bg-purple-900/50 border border-purple-700 flex items-center justify-center text-purple-300 text-xs flex-shrink-0 mt-0.5">{i + 1}</span>
                            <span className="text-slate-300">{step}</span>
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-700">
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Est. Time</p>
                          <p className="text-white font-semibold">{issue.resolution_plan.estimated_hours}h</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 mb-2">Resources Needed</p>
                          <div className="flex flex-wrap gap-1">
                            {issue.resolution_plan.required_resources.map((r, i) => (
                              <span key={i} className="text-xs px-2 py-0.5 bg-slate-700 text-slate-300 rounded">{r}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Reminders / Escalations */}
                {(issue.reminders?.length || issue.escalations?.length) ? (
                  <Card className="bg-slate-800 border-slate-700">
                    <CardHeader><CardTitle className="text-white text-base flex items-center gap-2"><Bell className="w-4 h-4 text-amber-400" />Government Productivity</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      {issue.reminders?.map((r) => (
                        <div key={r.id} className="p-3 bg-amber-900/20 border border-amber-800/40 rounded-lg">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-amber-400">Level {r.reminder_level} Reminder</span>
                            <span className="text-xs text-slate-500">{timeAgo(r.created_at)}</span>
                          </div>
                          <p className="text-sm text-slate-300">{r.reminder_text}</p>
                        </div>
                      ))}
                      {issue.escalations?.map((e) => (
                        <div key={e.id} className="p-3 bg-red-900/20 border border-red-800/40 rounded-lg">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-red-400">Level {e.escalation_level} Escalation</span>
                            <span className="text-xs text-slate-500">{timeAgo(e.created_at)}</span>
                          </div>
                          <p className="text-sm text-slate-300">{e.escalation_summary}</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ) : null}
              </div>

              {/* Right column */}
              <div className="space-y-4">
                {/* AI Scores */}
                {(issue.ai_confidence_score !== undefined || issue.ai_severity_score !== undefined) && (
                  <Card className="bg-slate-800 border-slate-700">
                    <CardHeader><CardTitle className="text-white text-sm flex items-center gap-2"><Zap className="w-4 h-4 text-cyan-400" />AI Analysis</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      {issue.ai_category && (
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Detected Category</p>
                          <p className="text-white font-medium">{issue.ai_category}</p>
                        </div>
                      )}
                      {issue.ai_confidence_score !== undefined && (
                        <ScoreBar value={issue.ai_confidence_score} label="AI Confidence" color="text-blue-400" />
                      )}
                      {issue.ai_severity_score !== undefined && (
                        <ScoreBar value={issue.ai_severity_score} label="Severity Score" color="text-orange-400" />
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Assignment */}
                {issue.assignments?.[0] && (
                  <Card className="bg-slate-800 border-slate-700">
                    <CardHeader><CardTitle className="text-white text-sm flex items-center gap-2"><Building2 className="w-4 h-4 text-purple-400" />Assigned To</CardTitle></CardHeader>
                    <CardContent>
                      <p className="text-white font-medium">{issue.assignments[0].departments?.name ?? 'Unknown'}</p>
                      {issue.assignments[0].assignment_reason && (
                        <p className="text-slate-400 text-xs mt-1">{issue.assignments[0].assignment_reason}</p>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Verifications */}
                {(issue.issue_verifications?.length ?? 0) > 0 && (
                  <Card className="bg-slate-800 border-slate-700">
                    <CardHeader><CardTitle className="text-white text-sm flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-400" />Verifications</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                      {issue.issue_verifications!.map((v) => (
                        <div key={v.id} className="text-sm">
                          <div className="flex items-center justify-between">
                            <span className={`font-medium ${v.status === 'confirmed' ? 'text-green-400' : v.status === 'rejected' ? 'text-red-400' : 'text-amber-400'}`}>{v.status}</span>
                            <span className="text-slate-500 text-xs capitalize">{v.verification_type}</span>
                          </div>
                          {v.reasoning && <p className="text-slate-400 text-xs mt-0.5">{v.reasoning}</p>}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Media */}
                {(issue.issue_media?.length ?? 0) > 0 && (
                  <Card className="bg-slate-800 border-slate-700">
                    <CardHeader><CardTitle className="text-white text-sm">Media</CardTitle></CardHeader>
                    <CardContent>
                      {issue.issue_media!.filter(m => m.media_type === 'image').map((m) => (
                        <img key={m.id} src={m.media_url} alt="Issue media" className="w-full rounded-lg max-h-40 object-cover" />
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'agent' && (
            <motion.div key="agent" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {agentLogs.length === 0 ? (
                <div className="text-center py-16 text-slate-500">
                  <Bot className="w-12 h-12 mx-auto mb-3 opacity-40" />
                  <p>No agent logs yet. They appear as the issue is processed.</p>
                </div>
              ) : (
                <Card className="bg-slate-800 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <Bot className="w-5 h-5 text-cyan-400" /> Agent Thought Process
                      <span className="ml-auto text-xs font-normal text-slate-500">{agentLogs.length} events</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-0">
                      {agentLogs.map((log, i) => (
                        <AgentLogCard key={log.id} log={log} index={i} />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          )}

          {activeTab === 'history' && (
            <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader><CardTitle className="text-white">Status History</CardTitle></CardHeader>
                <CardContent>
                  {(issue.issue_status_history?.length ?? 0) === 0 ? (
                    <p className="text-slate-500 text-sm">No status changes recorded yet.</p>
                  ) : (
                    <div className="space-y-4">
                      {[...( issue.issue_status_history ?? [])].reverse().map((h, i) => {
                        const cfg = STATUS_CONFIG[h.new_status] ?? STATUS_CONFIG['reported'];
                        return (
                          <div key={h.id} className="flex gap-3">
                            <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${cfg.bg.replace('bg-', 'bg-').replace('/40', '')} border ${cfg.color.replace('text-', 'border-')}`} />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`text-sm font-medium ${cfg.color}`}>{cfg.label}</span>
                                {h.old_status && <span className="text-slate-500 text-xs">from {STATUS_CONFIG[h.old_status]?.label ?? h.old_status}</span>}
                              </div>
                              {h.reason && <p className="text-slate-400 text-xs mt-0.5">{h.reason}</p>}
                              <p className="text-slate-500 text-xs mt-0.5">{timeAgo(h.created_at)}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import {
  ArrowUp, ArrowDown, Clock, CheckCircle, AlertCircle, TrendingUp,
  Bot, Bell, AlertTriangle, RefreshCw, Zap, Building2, ChevronRight,
  User, Shield, Briefcase, LogOut, MapPin, Plus
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserProfile {
  id: string;
  full_name?: string;
  email: string;
  role: 'citizen' | 'verifier' | 'officer' | 'senior_authority' | 'admin';
  rank?: string;
  contribution_score?: number;
}

interface AgeBucketIssue {
  id: string;
  title: string;
  category: string;
  urgency: string;
  days_old: number;
  ai_severity_score?: number;
}

interface DashboardData {
  totalIssues: number;
  resolvedIssues: number;
  pendingIssues: number;
  averageResolutionTime: number;
  departmentPerformance: Array<{ department: string; assigned: number; resolved: number; avgTime: number }>;
  trendData: Array<{ date: string; issues: number; resolved: number }>;
  categoryData: Array<{ name: string; value: number }>;
  productivity: {
    ageBuckets: { day3: AgeBucketIssue[]; day7: AgeBucketIssue[]; day14: AgeBucketIssue[] };
    escalationCount: number;
    reminderCount: number;
  };
  agentSummary: Record<string, { runs: number; success: number; avg_ms: number }>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const COLORS = ['#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#a78bfa', '#f472b6'];

const URGENCY_COLOR: Record<string, string> = {
  low: 'text-green-400', medium: 'text-amber-400',
  high: 'text-orange-400', critical: 'text-red-400',
};

const NODE_LABELS: Record<string, string> = {
  triage_node: 'Triage', verify_node: 'Verify',
  resolve_node: 'Resolve', productivity_escalate_node: 'Productivity',
};

const ROLE_CONFIG: Record<string, { label: string; icon: any; color: string; badge: string }> = {
  citizen: { label: 'Citizen', icon: User, color: 'from-blue-500 to-cyan-500', badge: 'bg-blue-500/20 text-blue-300 border border-blue-500/30' },
  verifier: { label: 'Community Verifier', icon: Shield, color: 'from-purple-500 to-pink-500', badge: 'bg-purple-500/20 text-purple-300 border border-purple-500/30' },
  officer: { label: 'Department Officer', icon: Briefcase, color: 'from-amber-500 to-orange-500', badge: 'bg-amber-500/20 text-amber-300 border border-amber-500/30' },
  senior_authority: { label: 'Senior Authority', icon: Building2, color: 'from-red-500 to-rose-500', badge: 'bg-red-500/20 text-red-300 border border-red-500/30' },
  admin: { label: 'Admin', icon: Zap, color: 'from-green-500 to-emerald-500', badge: 'bg-green-500/20 text-green-300 border border-green-500/30' },
};

// ─── Shared: Stat Card ────────────────────────────────────────────────────────

function StatCard({ title, value, change, positive, icon: Icon, color, delay }: {
  title: string; value: string | number; change: string;
  positive: boolean; icon: any; color: string; delay: number;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
      <Card className="bg-slate-800 border-slate-700 hover:border-slate-600 transition-colors">
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-slate-400 text-sm font-medium">{title}</p>
              <p className="text-3xl font-bold text-white mt-2">{value}</p>
            </div>
            <div className={`p-3 rounded-lg bg-gradient-to-br ${color}`}>
              <Icon className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            {positive
              ? <ArrowUp className="w-4 h-4 text-green-400" />
              : <ArrowDown className="w-4 h-4 text-red-400" />}
            <span className={`text-sm font-medium ${positive ? 'text-green-400' : 'text-red-400'}`}>{change}</span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Citizen Dashboard ────────────────────────────────────────────────────────

function CitizenDashboard({ data, user }: { data: DashboardData | null; user: UserProfile }) {
  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <motion.div
        className="bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border border-blue-500/30 rounded-2xl p-6"
        initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
      >
        <h2 className="text-xl font-semibold text-white mb-1">
          Welcome back, {user.full_name || user.email.split('@')[0]} 👋
        </h2>
        <p className="text-slate-400 text-sm">You're making your community better. Report issues and track your impact below.</p>
        <div className="mt-4 flex gap-3 flex-wrap">
          <Link href="/report">
            <Button className="bg-blue-600 hover:bg-blue-700 gap-2">
              <Plus className="w-4 h-4" /> Report Issue
            </Button>
          </Link>
          <Link href="/map">
            <Button variant="outline" className="border-slate-600 hover:bg-slate-700 text-white gap-2">
              <MapPin className="w-4 h-4" /> View Map
            </Button>
          </Link>
        </div>
      </motion.div>

      {/* Quick stats */}
      <div className="grid md:grid-cols-3 gap-4">
        <StatCard title="Total Issues Reported" value={data?.totalIssues ?? 0} change="Community total" positive={true} icon={AlertCircle} color="from-blue-500 to-cyan-500" delay={0} />
        <StatCard title="Resolved" value={data?.resolvedIssues ?? 0} change="Successfully closed" positive={true} icon={CheckCircle} color="from-green-500 to-emerald-500" delay={0.1} />
        <StatCard title="Pending Action" value={data?.pendingIssues ?? 0} change="Awaiting resolution" positive={false} icon={Clock} color="from-amber-500 to-orange-500" delay={0.2} />
      </div>

      {/* Category breakdown */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Issue Categories</CardTitle>
            <CardDescription>What's being reported in your community</CardDescription>
          </CardHeader>
          <CardContent>
            {(data?.categoryData?.length ?? 0) === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-slate-500 text-sm">
                No issues reported yet. Be the first to report one!
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data?.categoryData ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#9ca3af" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
                  <Bar dataKey="value" name="Issues" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

// ─── Verifier Dashboard ───────────────────────────────────────────────────────

function VerifierDashboard({ data, user }: { data: DashboardData | null; user: UserProfile }) {
  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <motion.div
        className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 border border-purple-500/30 rounded-2xl p-6"
        initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
      >
        <h2 className="text-xl font-semibold text-white mb-1">
          Community Verifier Panel — {user.full_name || user.email.split('@')[0]}
        </h2>
        <p className="text-slate-400 text-sm">Review and verify reported issues to keep the platform accurate and trustworthy.</p>
        <div className="mt-4 flex gap-3">
          <Link href="/map">
            <Button className="bg-purple-600 hover:bg-purple-700 gap-2">
              <MapPin className="w-4 h-4" /> Open Issue Map
            </Button>
          </Link>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid md:grid-cols-4 gap-4">
        <StatCard title="Total Issues" value={data?.totalIssues ?? 0} change="In system" positive={true} icon={AlertCircle} color="from-blue-500 to-cyan-500" delay={0} />
        <StatCard title="Pending Verification" value={data?.pendingIssues ?? 0} change="Need your review" positive={false} icon={Shield} color="from-purple-500 to-pink-500" delay={0.1} />
        <StatCard title="Resolved" value={data?.resolvedIssues ?? 0} change="Verified & closed" positive={true} icon={CheckCircle} color="from-green-500 to-emerald-500" delay={0.2} />
        <StatCard title="Avg Resolution" value={`${(data ? (data.averageResolutionTime / 24) : 0).toFixed(1)}d`} change="Speed matters" positive={true} icon={TrendingUp} color="from-amber-500 to-orange-500" delay={0.3} />
      </div>

      {/* Trend chart */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Issue Trend (7 Days)</CardTitle>
            <CardDescription>Reports vs resolutions in real-time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={data?.trendData ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" stroke="#9ca3af" tick={{ fontSize: 12 }} />
                <YAxis stroke="#9ca3af" tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
                <Legend />
                <Line type="monotone" dataKey="issues" stroke="#a78bfa" strokeWidth={2} name="Reported" dot={{ r: 3 }} />
                <Line type="monotone" dataKey="resolved" stroke="#10b981" strokeWidth={2} name="Resolved" dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

// ─── Officer / Admin Dashboard ────────────────────────────────────────────────

function OfficerDashboard({
  data, user, sweeping, sweepResult, onTriggerSweep, onRefresh, loading
}: {
  data: DashboardData | null;
  user: UserProfile;
  sweeping: boolean;
  sweepResult: string | null;
  onTriggerSweep: () => void;
  onRefresh: () => void;
  loading: boolean;
}) {
  const resolutionDays = data ? (data.averageResolutionTime / 24).toFixed(1) : '0';

  return (
    <div className="space-y-6">
      {/* Sweep result toast */}
      {sweepResult && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-green-900/30 border border-green-800/50 rounded-xl text-green-300 text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          {sweepResult}
        </motion.div>
      )}

      {/* Stat Cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Issues" value={data?.totalIssues ?? 0} change="+12% this week" positive={true} icon={AlertCircle} color="from-blue-500 to-cyan-500" delay={0} />
        <StatCard title="Resolved" value={data?.resolvedIssues ?? 0} change="+8% this week" positive={true} icon={CheckCircle} color="from-green-500 to-emerald-500" delay={0.1} />
        <StatCard title="Pending" value={data?.pendingIssues ?? 0} change="Needs attention" positive={false} icon={Clock} color="from-amber-500 to-orange-500" delay={0.2} />
        <StatCard title="Avg Resolution" value={`${resolutionDays}d`} change="-0.3d improved" positive={true} icon={TrendingUp} color="from-purple-500 to-pink-500" delay={0.3} />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-3 gap-6">
        <motion.div className="lg:col-span-2" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">7-Day Issue Trend</CardTitle>
              <CardDescription>Reports vs resolutions — live from database</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={data?.trendData ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="date" stroke="#9ca3af" tick={{ fontSize: 12 }} />
                  <YAxis stroke="#9ca3af" tick={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
                  <Legend />
                  <Line type="monotone" dataKey="issues" stroke="#3b82f6" strokeWidth={2} name="Reported" dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="resolved" stroke="#10b981" strokeWidth={2} name="Resolved" dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">By Category</CardTitle>
              <CardDescription>Issue distribution</CardDescription>
            </CardHeader>
            <CardContent>
              {(data?.categoryData?.length ?? 0) === 0 ? (
                <div className="h-[250px] flex items-center justify-center text-slate-500 text-sm">No data yet</div>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={data?.categoryData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ value }) => `${value}`} labelLine={false}>
                      {(data?.categoryData ?? []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Productivity Panel */}
      <div className="grid lg:grid-cols-3 gap-6">
        <motion.div className="lg:col-span-2" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-white flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-400" /> Government Productivity
                </CardTitle>
                <CardDescription>SLA tracking — issues overdue by age bracket</CardDescription>
              </div>
              <Button
                onClick={onTriggerSweep}
                disabled={sweeping}
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 gap-2 text-xs"
              >
                {sweeping ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Bot className="w-3 h-3" />}
                {sweeping ? 'Running…' : 'Run AI Sweep'}
              </Button>
            </CardHeader>
            <CardContent>
              {data?.productivity && (() => {
                const buckets = [
                  { key: 'day3', label: '3+ Days Old', issues: data.productivity.ageBuckets.day3, icon: <Bell className="w-4 h-4 text-amber-400" />, badge: 'bg-amber-500/20 text-amber-300' },
                  { key: 'day7', label: '7+ Days Old', issues: data.productivity.ageBuckets.day7, icon: <AlertTriangle className="w-4 h-4 text-orange-400" />, badge: 'bg-orange-500/20 text-orange-300' },
                  { key: 'day14', label: '14+ Days (Escalate)', issues: data.productivity.ageBuckets.day14, icon: <AlertCircle className="w-4 h-4 text-red-400" />, badge: 'bg-red-500/20 text-red-300' },
                ];
                const total = buckets.reduce((a, b) => a + b.issues.length, 0);
                if (total === 0) return (
                  <div className="text-center py-6 text-slate-500">
                    <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-400 opacity-50" />
                    <p className="text-sm">All issues within SLA. No action needed.</p>
                  </div>
                );
                return (
                  <div className="space-y-4">
                    {buckets.filter(b => b.issues.length > 0).map(({ key, label, issues, icon, badge }) => (
                      <div key={key} className="bg-slate-700/40 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-3">
                          {icon}
                          <p className="text-sm font-semibold text-white">{label}</p>
                          <span className={`ml-auto px-2 py-0.5 rounded-full text-xs font-bold ${badge}`}>{issues.length}</span>
                        </div>
                        <div className="space-y-2">
                          {issues.slice(0, 3).map(issue => (
                            <Link key={issue.id} href={`/issue/${issue.id}`}>
                              <div className="flex items-center gap-3 p-2 bg-slate-800/60 rounded-lg hover:bg-slate-700/60 transition-colors">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-white truncate">{issue.title}</p>
                                  <p className="text-xs text-slate-400">{issue.category} · {issue.days_old}d old</p>
                                </div>
                                <span className={`text-xs ${URGENCY_COLOR[issue.urgency] ?? 'text-slate-400'}`}>{issue.urgency}</span>
                                <ChevronRight className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </motion.div>

        {/* AI Agent Health */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          {data?.agentSummary && Object.keys(data.agentSummary).length > 0 && (
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Bot className="w-5 h-5 text-cyan-400" /> AI Agent Health
                </CardTitle>
                <CardDescription>Execution stats across all 4 workflow nodes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(data.agentSummary).map(([name, stats]) => {
                    const label = NODE_LABELS[name] ?? name.replace('_node', '');
                    const rate = stats.runs > 0 ? Math.round((stats.success / stats.runs) * 100) : 0;
                    return (
                      <div key={name} className="flex items-center gap-4">
                        <div className="w-20 flex-shrink-0">
                          <p className="text-xs text-slate-300 font-medium">{label}</p>
                          <p className="text-xs text-slate-500">{stats.runs} runs</p>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className={rate >= 90 ? 'text-green-400' : rate >= 70 ? 'text-amber-400' : 'text-red-400'}>
                              {rate}% success
                            </span>
                            <span className="text-slate-500">{stats.avg_ms}ms</span>
                          </div>
                          <div className="w-full bg-slate-700 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full ${rate >= 90 ? 'bg-green-500' : rate >= 70 ? 'bg-amber-500' : 'bg-red-500'}`}
                              style={{ width: `${rate}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </div>

      {/* Department Performance */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-purple-400" /> Department Performance
            </CardTitle>
            <CardDescription>Resolution rates by assigned department</CardDescription>
          </CardHeader>
          <CardContent>
            {(data?.departmentPerformance?.length ?? 0) === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <p className="text-sm">No department assignments yet.</p>
                <p className="text-xs text-slate-600 mt-1">Submit and process issues to see department stats here.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {data!.departmentPerformance.map((dept, i) => {
                  const pct = dept.assigned > 0 ? Math.round((dept.resolved / dept.assigned) * 100) : 0;
                  return (
                    <div key={i} className="flex items-center justify-between p-4 bg-slate-700/50 rounded-xl hover:bg-slate-700 transition-colors">
                      <div>
                        <p className="font-semibold text-white">{dept.department}</p>
                        <p className="text-sm text-slate-400">{dept.resolved} of {dept.assigned} resolved</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="w-32 bg-slate-600 rounded-full h-2">
                          <motion.div
                            className="bg-gradient-to-r from-blue-500 to-cyan-500 h-2 rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.8, delay: i * 0.1 }}
                          />
                        </div>
                        <span className="text-white font-semibold w-10 text-right">{pct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Action Buttons */}
      <motion.div className="flex flex-wrap gap-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
        <Link href="/report">
          <Button className="bg-blue-600 hover:bg-blue-700">Report New Issue</Button>
        </Link>
        <Link href="/map">
          <Button variant="outline" className="border-slate-600 hover:bg-slate-700 text-white">View Map</Button>
        </Link>
        <Button
          variant="outline"
          className="border-slate-600 hover:bg-slate-700 text-slate-300 text-sm"
          onClick={async () => {
            const res = await fetch('/api/seed', { method: 'POST' });
            const json = await res.json();
            if (json.error) alert('Seed failed: ' + json.error);
            else alert('Departments seeded: ' + json.message);
          }}
        >
          Seed Departments
        </Button>
      </motion.div>
    </div>
  );
}

// ─── Main Dashboard Page ──────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [sweeping, setSweeping] = useState(false);
  const [sweepResult, setSweepResult] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/dashboard/stats');
      const { data: d } = await res.json();
      setData(d);
    } catch (err) {
      console.error('[Dashboard] Error fetching stats:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load current user profile
  useEffect(() => {
    const loadUser = async () => {
      const supabase = createClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) { router.push('/auth/login'); return; }

      // Try to get full profile with role from users table
      const { data: profile } = await supabase
        .from('users')
        .select('id, full_name, email, role, rank, contribution_score')
        .eq('id', authUser.id)
        .single();

      if (profile) {
        setUser(profile as UserProfile);
      } else {
        // Fallback: use auth user data with default role
        setUser({
          id: authUser.id,
          email: authUser.email ?? '',
          full_name: authUser.user_metadata?.full_name,
          role: (authUser.user_metadata?.role as UserProfile['role']) ?? 'citizen',
          rank: 'Citizen',
          contribution_score: 0,
        });
      }
    };
    loadUser();
    fetchStats();
  }, [fetchStats, router]);

  const triggerSweep = async () => {
    setSweeping(true);
    setSweepResult(null);
    try {
      const res = await fetch('/api/agents/process', { method: 'POST' });
      const json = await res.json();
      setSweepResult(json.message ?? 'Sweep complete');
      await fetchStats();
    } catch {
      setSweepResult('Sweep failed — check logs');
    } finally {
      setSweeping(false);
    }
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
  };

  if (loading || !user) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-sm">Loading dashboard…</p>
      </div>
    </div>
  );

  const roleConf = ROLE_CONFIG[user.role] ?? ROLE_CONFIG.citizen;
  const RoleIcon = roleConf.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-7xl mx-auto">

        {/* Top navigation bar */}
        <motion.div
          className="mb-8 flex items-center justify-between flex-wrap gap-4"
          initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
        >
          <div>
            <h1 className="text-4xl font-bold text-white mb-1">Dashboard</h1>
            <p className="text-slate-400 text-sm">Real-time civic issue tracking and AI analytics</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Role badge */}
            <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${roleConf.badge}`}>
              <RoleIcon className="w-3.5 h-3.5" />
              {roleConf.label}
            </span>
            <Button onClick={fetchStats} variant="outline" size="sm" className="border-slate-600 hover:bg-slate-700 text-white gap-2">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            <Button onClick={handleLogout} variant="outline" size="sm" className="border-red-800 hover:bg-red-900/30 text-red-400 gap-2">
              <LogOut className="w-3.5 h-3.5" /> Logout
            </Button>
          </div>
        </motion.div>

        {/* Role-based content */}
        {user.role === 'citizen' && (
          <CitizenDashboard data={data} user={user} />
        )}
        {user.role === 'verifier' && (
          <VerifierDashboard data={data} user={user} />
        )}
        {(user.role === 'officer' || user.role === 'senior_authority' || user.role === 'admin') && (
          <OfficerDashboard
            data={data}
            user={user}
            sweeping={sweeping}
            sweepResult={sweepResult}
            onTriggerSweep={triggerSweep}
            onRefresh={fetchStats}
            loading={loading}
          />
        )}

      </div>
    </div>
  );
}

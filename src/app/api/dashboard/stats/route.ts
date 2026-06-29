import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server' ;

export async function GET(_req: NextRequest) {
  try {
    const supabase = await createClient();

    // ── Core counts ──────────────────────────────────────────────────────────
    const [{ count: totalIssues }, { count: resolvedIssues }, { count: pendingIssues }] =
      await Promise.all([
        supabase.from('issues').select('*', { count: 'exact', head: true }),
        supabase.from('issues').select('*', { count: 'exact', head: true }).eq('status', 'resolved'),
        supabase
          .from('issues')
          .select('*', { count: 'exact', head: true })
          .in('status', ['reported', 'verified', 'assigned', 'in_progress']),
      ]);

    // ── Real average resolution time (hours between created_at → resolved) ───
    const { data: resolvedWithHistory } = await supabase
      .from('issue_status_history')
      .select('issue_id, created_at')
      .eq('new_status', 'resolved')
      .order('created_at', { ascending: false })
      .limit(200);

    let avgResolutionHours = 0;
    if (resolvedWithHistory && resolvedWithHistory.length > 0) {
      const { data: issueCreatedAts } = await supabase
        .from('issues')
        .select('id, created_at')
        .in('id', resolvedWithHistory.map(r => r.issue_id));

      const createdMap = new Map((issueCreatedAts || []).map(i => [i.id, i.created_at]));
      const diffs = resolvedWithHistory
        .map(r => {
          const created = createdMap.get(r.issue_id);
          if (!created) return null;
          return (new Date(r.created_at).getTime() - new Date(created).getTime()) / (1000 * 60 * 60);
        })
        .filter((d): d is number => d !== null && d > 0);

      if (diffs.length > 0) {
        avgResolutionHours = Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length * 10) / 10;
      }
    }

    // ── Real 7-day trend (issues reported + resolved per day) ─────────────────
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const { data: recentIssues } = await supabase
      .from('issues')
      .select('created_at, status')
      .gte('created_at', sevenDaysAgo.toISOString());

    const trendMap: Record<string, { date: string; issues: number; resolved: number }> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString('en-US', { weekday: 'short' });
      trendMap[key] = { date: label, issues: 0, resolved: 0 };
    }
    for (const issue of recentIssues || []) {
      const key = issue.created_at.slice(0, 10);
      if (trendMap[key]) {
        trendMap[key].issues++;
        if (issue.status === 'resolved') trendMap[key].resolved++;
      }
    }
    const trendData = Object.values(trendMap);

    // ── Real category distribution ────────────────────────────────────────────
    const { data: allIssues } = await supabase
      .from('issues')
      .select('category');

    const categoryMap: Record<string, number> = {};
    for (const issue of allIssues || []) {
      categoryMap[issue.category] = (categoryMap[issue.category] || 0) + 1;
    }
    const categoryData = Object.entries(categoryMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // ── Department performance ────────────────────────────────────────────────
    const { data: departmentStats } = await supabase
      .from('assignments')
      .select('department_id, departments(name), issue_id, issues(status)')
      .limit(1000);

    const deptMap = new Map<string, { department: string; assigned: number; resolved: number; avgTime: number }>();
    for (const stat of (departmentStats as any[]) || []) {
      const deptId = stat.department_id;
      if (!deptMap.has(deptId)) {
        deptMap.set(deptId, { department: stat.departments?.name || 'Unknown', assigned: 0, resolved: 0, avgTime: 0 });
      }
      const d = deptMap.get(deptId)!;
      d.assigned++;
      if (stat.issues?.status === 'resolved') d.resolved++;
    }

    // ── Productivity panel data (age buckets) ─────────────────────────────────
    const { data: activeIssues } = await supabase
      .from('issues')
      .select('id, title, category, urgency, created_at, status, ai_severity_score')
      .in('status', ['reported', 'verified', 'assigned', 'in_progress'])
      .order('created_at', { ascending: true });

    const now = Date.now();
    const ageBuckets = { day3: [] as any[], day7: [] as any[], day14: [] as any[] };
    for (const issue of activeIssues || []) {
      const days = Math.floor((now - new Date(issue.created_at).getTime()) / (1000 * 60 * 60 * 24));
      if (days >= 14) ageBuckets.day14.push({ ...issue, days_old: days });
      else if (days >= 7) ageBuckets.day7.push({ ...issue, days_old: days });
      else if (days >= 3) ageBuckets.day3.push({ ...issue, days_old: days });
    }

    // ── Escalation counts ─────────────────────────────────────────────────────
    const { count: escalationCount } = await supabase
      .from('escalations')
      .select('*', { count: 'exact', head: true });

    const { count: reminderCount } = await supabase
      .from('reminders')
      .select('*', { count: 'exact', head: true });

    // ── Agent execution stats ─────────────────────────────────────────────────
    const { data: agentStats } = await supabase
      .from('agent_logs')
      .select('agent_name, status, execution_time_ms')
      .order('created_at', { ascending: false })
      .limit(500);

    const agentSummary: Record<string, { runs: number; success: number; avg_ms: number }> = {};
    for (const log of agentStats || []) {
      if (!agentSummary[log.agent_name]) agentSummary[log.agent_name] = { runs: 0, success: 0, avg_ms: 0 };
      agentSummary[log.agent_name].runs++;
      if (log.status === 'success') agentSummary[log.agent_name].success++;
      if (log.execution_time_ms) agentSummary[log.agent_name].avg_ms += log.execution_time_ms;
    }
    for (const name of Object.keys(agentSummary)) {
      if (agentSummary[name].runs > 0)
        agentSummary[name].avg_ms = Math.round(agentSummary[name].avg_ms / agentSummary[name].runs);
    }

    return NextResponse.json({
      data: {
        totalIssues: totalIssues || 0,
        resolvedIssues: resolvedIssues || 0,
        pendingIssues: pendingIssues || 0,
        averageResolutionTime: avgResolutionHours,
        departmentPerformance: Array.from(deptMap.values()),
        trendData,
        categoryData,
        productivity: {
          ageBuckets,
          escalationCount: escalationCount || 0,
          reminderCount: reminderCount || 0,
        },
        agentSummary,
      },
    });
  } catch (error) {
    console.error('[API] GET /api/dashboard/stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard stats' }, { status: 500 });
  }
}

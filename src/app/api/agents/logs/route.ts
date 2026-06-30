import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
//some changes
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(req.url);
    const issueId   = searchParams.get('issue_id');
    const agentName = searchParams.get('agent_name');
    const status    = searchParams.get('status');
    const limit     = Math.min(parseInt(searchParams.get('limit') || '100'), 500);
    const offset    = parseInt(searchParams.get('offset') || '0');

    let query = supabase
      .from('agent_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (issueId)   query = query.eq('issue_id', issueId);
    if (agentName) query = query.ilike('agent_name', `%${agentName}%`);
    if (status)    query = query.eq('status', status);

    const { data, error, count } = await query;
    if (error) throw error;

    // Aggregate stats across all logs
    const { data: stats } = await supabase
      .from('agent_logs')
      .select('agent_name, status, execution_time_ms');

    const agentStats: Record<string, { total: number; success: number; failed: number; avg_ms: number }> = {};
    for (const row of stats || []) {
      if (!agentStats[row.agent_name]) {
        agentStats[row.agent_name] = { total: 0, success: 0, failed: 0, avg_ms: 0 };
      }
      agentStats[row.agent_name].total++;
      if (row.status === 'success') agentStats[row.agent_name].success++;
      if (row.status === 'failed')  agentStats[row.agent_name].failed++;
      if (row.execution_time_ms)    agentStats[row.agent_name].avg_ms += row.execution_time_ms;
    }
    for (const name of Object.keys(agentStats)) {
      agentStats[name].avg_ms = Math.round(agentStats[name].avg_ms / agentStats[name].total);
    }

    return NextResponse.json({ data, total: count, agent_stats: agentStats });
  } catch (error) {
    console.error('[API] GET /api/agents/logs error:', error);
    return NextResponse.json({ error: 'Failed to fetch agent logs' }, { status: 500 });
  }
}

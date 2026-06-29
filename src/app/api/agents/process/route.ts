import { NextRequest, NextResponse } from 'next/server';
import { runProductivitySweep } from '@/lib/ai/agent-orchestrator';

/**
 * POST /api/agents/process
 * Manually trigger the Government Productivity Agent sweep.
 * Processes all active (non-resolved) issues and generates reminders / escalations.
 */
export async function POST(_req: NextRequest) {
  try {
    console.log('[API] Productivity sweep triggered manually');
    const result = await runProductivitySweep();
    return NextResponse.json({
      data: result,
      message: `Processed ${result.processed} active issues. ${result.actions.length} action(s) taken.`,
    });
  } catch (error) {
    console.error('[API] POST /api/agents/process error:', error);
    return NextResponse.json({ error: 'Failed to run agent sweep' }, { status: 500 });
  }
}

/** GET — status check / last run stats */
export async function GET(_req: NextRequest) {
  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();

  const { data: lastRun } = await supabase
    .from('agent_logs')
    .select('created_at, status, output_data')
    .ilike('agent_name', '%productivity%')
    .order('created_at', { ascending: false })
    .limit(10);

  const { count: pending } = await supabase
    .from('issues')
    .select('*', { count: 'exact', head: true })
    .in('status', ['reported', 'verified', 'assigned', 'in_progress']);

  return NextResponse.json({
    pending_issues: pending || 0,
    last_runs: lastRun || [],
  });
}

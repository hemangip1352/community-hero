import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { updateIssueStatusSchema } from '@/lib/validation/schemas';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    const { data: issue, error } = await supabase
      .from('issues')
      .select(`
        *,
        users!issues_user_id_fkey(id, full_name, email, role, rank),
        issue_media(*),
        issue_comments(*, users!issue_comments_user_id_fkey(full_name, role)),
        issue_verifications(*),
        assignments(*, departments(id, name, category)),
        issue_status_history(*),
        reminders(*),
        escalations(*)
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
      }
      throw error;
    }

    // Fetch agent logs for this issue
    const { data: agentLogs } = await supabase
      .from('agent_logs')
      .select('*')
      .eq('issue_id', id)
      .order('created_at', { ascending: true });

    return NextResponse.json({ data: { ...issue, agent_logs: agentLogs || [] } });
  } catch (error) {
    console.error('[API] GET /api/issues/[id] error:', error);
    return NextResponse.json({ error: 'Failed to fetch issue' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  try {
    const supabase = await createClient();
    const { id } = await params;
    const body = await req.json();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const parsed = updateIssueStatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    // Get current issue status for history
    const { data: current } = await supabase
      .from('issues')
      .select('status')
      .eq('id', id)
      .single();

    const { data: updated, error } = await supabase
      .from('issues')
      .update({ status: parsed.data.status })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Record status change in history
    await supabase.from('issue_status_history').insert({
      issue_id: id,
      old_status: current?.status,
      new_status: parsed.data.status,
      changed_by_user_id: user.id,
      reason: parsed.data.reason,
    });

    // Create notification for issue reporter
    await supabase.from('notifications').insert({
      user_id: updated.user_id,
      issue_id: id,
      notification_type: 'status_update',
      title: `Issue status updated to "${parsed.data.status}"`,
      message: parsed.data.reason || `Your issue has been updated to ${parsed.data.status}.`,
      action_url: `/issue/${id}`,
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error('[API] PUT /api/issues/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update issue' }, { status: 500 });
  }
}

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { processNewIssue } from '@/lib/ai/agent-orchestrator';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = supabase
      .from('issues')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq('status', status);
    if (category) query = query.eq('category', category);

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error) {
    console.error('[API] GET /api/issues error:', error);
    return NextResponse.json({ error: 'Failed to fetch issues' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await req.json();

    // Validate required fields
    if (!body.title || !body.description || !body.latitude || !body.longitude) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 },
      );
    }

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Create issue
    const { data: issue, error: insertError } = await supabase
      .from('issues')
      .insert({
        user_id: user.id,
        title: body.title,
        description: body.description,
        latitude: body.latitude,
        longitude: body.longitude,
        category: body.category || 'Other',
        urgency: body.urgency || 'medium',
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Get existing issues for duplicate checking
    const { data: existingIssues } = await supabase
      .from('issues')
      .select('id, title, description, latitude, longitude, created_at')
      .neq('id', issue.id)
      .order('created_at', { ascending: false })
      .limit(100);

    // Process through the 4-node AI workflow
    try {
      const workflowState = await processNewIssue(issue, existingIssues || [], body.image_base64, body.mime_type);

      // Persist AI analysis results back to the issue row
      await supabase
        .from('issues')
        .update({
          ai_category: workflowState.triage?.ai_category,
          ai_summary: workflowState.triage?.ai_summary,
          ai_confidence_score: workflowState.triage?.ai_confidence_score,
          ai_severity_score: workflowState.triage?.ai_severity_score,
          is_duplicate: workflowState.halt_as_duplicate,
          duplicate_of_id: workflowState.triage?.duplicate_of_id ?? null,
          resolution_plan: workflowState.resolve?.action_plan ?? null,
          // Update status based on workflow decisions
          status: workflowState.halt_as_duplicate
            ? 'duplicate'
            : workflowState.verify?.auto_verified
              ? 'verified'
              : 'reported',
        })
        .eq('id', issue.id);

      // Persist status history entry if status changed
      if (workflowState.halt_as_duplicate || workflowState.verify?.auto_verified) {
        await supabase.from('issue_status_history').insert({
          issue_id: issue.id,
          old_status: 'reported',
          new_status: workflowState.halt_as_duplicate ? 'duplicate' : 'verified',
          reason: workflowState.halt_as_duplicate
            ? `Duplicate of ${workflowState.triage?.duplicate_of_id}`
            : workflowState.verify?.reasoning,
        });
      }

      // Persist department assignment if resolved
      if (workflowState.resolve?.department_id) {
        await supabase.from('assignments').insert({
          issue_id: issue.id,
          department_id: workflowState.resolve.department_id,
          assignment_reason: workflowState.resolve.assignment_reason,
        });
      }
    } catch (agentError) {
      console.error('[API] Agent processing error:', agentError);
      // Never block the response — the issue is already saved
    }

    return NextResponse.json({ data: issue }, { status: 201 });
  } catch (error) {
    console.error('[API] POST /api/issues error:', error);
    return NextResponse.json({ error: 'Failed to create issue' }, { status: 500 });
  }
}

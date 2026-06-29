import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(req.url);
    const issueId = searchParams.get('issue_id');

    let query = supabase
      .from('issue_verifications')
      .select('*');

    if (issueId) {
      query = query.eq('issue_id', issueId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error) {
    console.error('[API] GET /api/verification error:', error);
    return NextResponse.json({ error: 'Failed to fetch verifications' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await req.json();

    if (!body.issue_id || !body.verification_type || !body.status) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 },
      );
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Create verification record
    const { data: verification, error: insertError } = await supabase
      .from('issue_verifications')
      .insert({
        issue_id: body.issue_id,
        user_id: user.id,
        verification_type: body.verification_type,
        status: body.status,
        confidence_score: body.confidence_score,
        evidence_url: body.evidence_url,
        reasoning: body.reasoning,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Check if verification status should be updated
    if (body.verification_type === 'ai' && body.status === 'confirmed') {
      await supabase
        .from('issues')
        .update({ status: 'verified' })
        .eq('id', body.issue_id);
    }

    return NextResponse.json({ data: verification }, { status: 201 });
  } catch (error) {
    console.error('[API] POST /api/verification error:', error);
    return NextResponse.json({ error: 'Failed to create verification' }, { status: 500 });
  }
}

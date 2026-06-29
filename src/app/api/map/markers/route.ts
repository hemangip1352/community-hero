import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const status = searchParams.get('status');
    const from = searchParams.get('from'); // ISO date
    const to = searchParams.get('to');     // ISO date
    const limit = Math.min(parseInt(searchParams.get('limit') || '500'), 1000);

    let query = supabase
      .from('issues')
      .select('id, title, category, urgency, status, latitude, longitude, ai_severity_score, ai_confidence_score, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (category) query = query.eq('category', category);
    if (status)   query = query.eq('status', status);
    if (from)     query = query.gte('created_at', from);
    if (to)       query = query.lte('created_at', to);

    const { data, error } = await query;
    if (error) throw error;

    // Shape into GeoJSON-style markers for the map component
    const markers = (data || []).map(issue => ({
      id: issue.id,
      title: issue.title,
      category: issue.category,
      urgency: issue.urgency,
      status: issue.status,
      lat: Number(issue.latitude),
      lng: Number(issue.longitude),
      severity: issue.ai_severity_score ?? 0.5,
      confidence: issue.ai_confidence_score ?? 0.5,
      created_at: issue.created_at,
    }));

    return NextResponse.json({ data: markers, total: markers.length });
  } catch (error) {
    console.error('[API] GET /api/map/markers error:', error);
    return NextResponse.json({ error: 'Failed to fetch map markers' }, { status: 500 });
  }
}

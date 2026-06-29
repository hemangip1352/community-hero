import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

const DEPARTMENTS = [
  {
    name: 'Roads Department',
    description: 'Responsible for road maintenance, pothole repairs, and road damage remediation across the city.',
    category: 'roads',
    email: 'roads@cityhero.local',
    phone: '+91-11-2345-6001',
  },
  {
    name: 'Sanitation Department',
    description: 'Manages garbage collection, waste disposal, and area cleanliness operations.',
    category: 'sanitation',
    email: 'sanitation@cityhero.local',
    phone: '+91-11-2345-6002',
  },
  {
    name: 'Electrical Department',
    description: 'Maintains public lighting infrastructure including streetlights and electrical street assets.',
    category: 'electrical',
    email: 'electrical@cityhero.local',
    phone: '+91-11-2345-6003',
  },
  {
    name: 'Water Department',
    description: 'Operates and maintains water distribution networks, drainage systems, and pipe infrastructure.',
    category: 'water',
    email: 'water@cityhero.local',
    phone: '+91-11-2345-6004',
  },
  {
    name: 'General Affairs Department',
    description: 'Handles miscellaneous civic matters not covered by specialist departments.',
    category: 'other',
    email: 'general@cityhero.local',
    phone: '+91-11-2345-6005',
  },
];

/** POST /api/seed — seeds departments table (idempotent via upsert on name) */
export async function POST(_req: NextRequest) {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('departments')
      .upsert(DEPARTMENTS, { onConflict: 'name', ignoreDuplicates: false })
      .select();

    if (error) throw error;

    return NextResponse.json({
      message: `Seeded ${data?.length ?? 0} departments successfully.`,
      data,
    });
  } catch (error) {
    console.error('[API] POST /api/seed error:', error);
    return NextResponse.json({ error: 'Seeding failed' }, { status: 500 });
  }
}

/** GET — read current departments */
export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const { data, error } = await supabase.from('departments').select('*').order('name');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

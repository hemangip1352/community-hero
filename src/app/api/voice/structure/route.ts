import { NextRequest, NextResponse } from 'next/server';
import { getFlashModel } from '@/lib/ai/gemini-client';

const CATEGORIES = ['Pothole', 'Garbage', 'Water Leakage', 'Streetlight Failure', 'Drainage Problem', 'Road Damage', 'Other'] as const;
const URGENCY_LEVELS = ['low', 'medium', 'high', 'critical'] as const;

function ruleBasedStructure(transcript: string) {
  const lower = transcript.toLowerCase();
  let category: string = 'Other';
  let urgency: string = 'medium';

  if (lower.includes('pothole') || lower.includes('hole in the road')) category = 'Pothole';
  else if (lower.includes('garbage') || lower.includes('trash') || lower.includes('waste') || lower.includes('rubbish')) category = 'Garbage';
  else if (lower.includes('water') && (lower.includes('leak') || lower.includes('pipe') || lower.includes('flood'))) category = 'Water Leakage';
  else if (lower.includes('light') || lower.includes('streetlight') || lower.includes('lamp')) category = 'Streetlight Failure';
  else if (lower.includes('drain') || lower.includes('drainage') || lower.includes('sewage')) category = 'Drainage Problem';
  else if (lower.includes('road') || lower.includes('pavement') || lower.includes('crack')) category = 'Road Damage';

  if (lower.includes('urgent') || lower.includes('dangerous') || lower.includes('critical') || lower.includes('emergency')) urgency = 'critical';
  else if (lower.includes('serious') || lower.includes('bad') || lower.includes('severe')) urgency = 'high';
  else if (lower.includes('minor') || lower.includes('small') || lower.includes('little')) urgency = 'low';

  // Capitalise first letter for title
  const title = transcript.charAt(0).toUpperCase() + transcript.slice(1, 80);

  return { title, description: transcript, category, urgency };
}

export async function POST(req: NextRequest) {
  let transcript = '';
  try {
    const body = await req.json();
    transcript = body.transcript ?? '';

    if (!transcript || typeof transcript !== 'string' || transcript.trim().length < 5) {
      return NextResponse.json({ error: 'Transcript too short' }, { status: 400 });
    }

    const flash = getFlashModel();
    if (!flash) {
      // Graceful fallback — rule-based structure
      return NextResponse.json({ data: ruleBasedStructure(transcript), gemini_used: false });
    }

    const prompt = `You are a civic issue intake assistant. A citizen spoke the following voice report:

"${transcript}"

Extract and structure this into a formal issue report. Respond ONLY with valid JSON:
{
  "title": "<concise 5-10 word title for the issue>",
  "description": "<full description, expanded and grammatically correct, 1-3 sentences>",
  "category": "<exactly one of: Pothole, Garbage, Water Leakage, Streetlight Failure, Drainage Problem, Road Damage, Other>",
  "urgency": "<exactly one of: low, medium, high, critical>"
}

Rules:
- title must be specific and location-aware if the citizen mentioned a place
- description must be complete and professional
- category must match the civic infrastructure issue type precisely
- urgency: critical=life-threatening, high=safety risk, medium=nuisance, low=cosmetic`;

    const result = await flash.generateContent(prompt);
    const text = result.response.text();

    // Extract JSON from possible markdown fences
    const cleaned = text.replace(/```(?:json)?\n?/g, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error('No JSON in response');

    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as {
      title: string;
      description: string;
      category: string;
      urgency: string;
    };

    // Validate enums — fall back to rule-based if Gemini returned invalid values
    const validCategory = CATEGORIES.includes(parsed.category as (typeof CATEGORIES)[number]) 
      ? parsed.category 
      : ruleBasedStructure(transcript).category;
    const validUrgency  = URGENCY_LEVELS.includes(parsed.urgency as (typeof URGENCY_LEVELS)[number]) 
      ? parsed.urgency 
      : 'medium';

    return NextResponse.json({
      data: {
        title: parsed.title || ruleBasedStructure(transcript).title,
        description: parsed.description || transcript,
        category: validCategory,
        urgency: validUrgency,
      },
      gemini_used: true,
    });
  } catch (error) {
    console.error('[API] POST /api/voice/structure error:', error);
    // Always return something usable — transcript captured above
    return NextResponse.json({ data: ruleBasedStructure(transcript), gemini_used: false });
  }
}

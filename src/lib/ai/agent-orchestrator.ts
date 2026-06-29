/**
 * Community Hero AI — State-Machine Orchestrator
 *
 * Implements a typed, 4-node workflow that mirrors the LangGraph pattern
 * natively in TypeScript for a Next.js / Vercel serverless environment.
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │                    Issue Reported by Citizen                     │
 * └──────────────────────────┬──────────────────────────────────────┘
 *                            │
 *                     ┌──────▼──────┐
 *                     │   TRIAGE    │  ← Gemini 1.5 Flash
 *                     │  (Node 1)   │    Image analysis + classification
 *                     └──────┬──────┘    + duplicate detection
 *                            │
 *              ┌─────────────▼─────────────┐
 *              │ is_duplicate?             │
 *              │ YES → mark duplicate, END │
 *              │ NO  → continue            │
 *              └─────────────┬─────────────┘
 *                            │
 *                     ┌──────▼──────┐
 *                     │   VERIFY    │  ← Rule-based + Gemini confidence
 *                     │  (Node 2)   │    AI auto-verify or community gate
 *                     └──────┬──────┘
 *                            │
 *                     ┌──────▼──────┐
 *                     │   RESOLVE   │  ← Gemini 1.5 Pro
 *                     │  (Node 3)   │    Department assignment + action plan
 *                     └──────┬──────┘
 *                            │
 *              ┌─────────────▼─────────────────────┐
 *              │   PRODUCTIVITY_ESCALATE  (Node 4) │  ← Gemini 1.5 Pro
 *              │   Government Productivity Agent   │    Deadlines + reminders
 *              │   Escalation flags                │    + escalation decisions
 *              └───────────────────────────────────┘
 *
 * Design guarantees:
 *  - Every node writes an ENTRY log to agent_logs before doing any work.
 *  - Every node writes an EXIT log (success | failed) after completing.
 *  - Each node retries its Gemini call up to MAX_RETRIES times with
 *    exponential back-off before falling back to rule-based defaults.
 *  - The full WorkflowState is the single source of truth; it is returned
 *    to the caller so that POST /api/issues can persist it in one shot.
 *  - No node throws — errors are captured in state.errors and logged.
 */

import { createClient } from '@supabase/supabase-js';
import { getFlashModel, getProModel } from './gemini-client';
import { classifyIssue } from './issue-classifier';
import { checkForDuplicates } from './duplicate-detector';
import { Issue, IssueCategory } from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 500;

/** Days since report thresholds for the Government Productivity Agent */
const PRODUCTIVITY_THRESHOLDS = {
  REMINDER_DAY: 3,
  FOLLOWUP_DAY: 7,
  ESCALATION_DAY: 14,
} as const;

// ─── Supabase admin client (server-side only) ─────────────────────────────────

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// ─── WorkflowState — the single shared state object ──────────────────────────

export type WorkflowNodeName = 'triage' | 'verify' | 'resolve' | 'productivity_escalate';

export type NodeStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped';

/** One entry in the per-node execution log persisted to Supabase. */
export interface NodeExecutionLog {
  /** Supabase row id — populated after the DB write succeeds */
  log_id?: string;
  node: WorkflowNodeName;
  phase: 'entry' | 'exit';
  status: NodeStatus;
  /** Human-readable description of what this node is doing / did */
  thought: string;
  /** Arbitrary structured output from the node */
  output?: Record<string, unknown>;
  error?: string;
  execution_time_ms?: number;
  timestamp: string;
}

// ── Triage output ─────────────────────────────────────────────────────────────
export interface TriageResult {
  ai_category: IssueCategory;
  ai_confidence_score: number;
  ai_severity_score: number;
  ai_summary: string;
  reasoning: string;
  is_duplicate: boolean;
  duplicate_of_id?: string;
  duplicate_candidates: string[];
  similarity_scores: number[];
}

// ── Verify output ─────────────────────────────────────────────────────────────
export interface VerifyResult {
  verification_required: boolean;
  /** true → AI auto-verified;  false → community gate */
  auto_verified: boolean;
  verification_confidence: number;
  reasoning: string;
}

// ── Resolve output ────────────────────────────────────────────────────────────
export interface ResolveResult {
  assigned_department: string;
  department_id?: string;
  assignment_reason: string;
  priority_level: 'low' | 'medium' | 'high' | 'critical';
  action_plan: {
    steps: string[];
    estimated_hours: number;
    required_resources: string[];
    success_criteria: string[];
  };
  gemini_used: boolean;
}

// ── Productivity / Escalation output ─────────────────────────────────────────

export type ProductivityAction = 'none' | 'reminder' | 'follow_up' | 'escalation';

export interface ProductivityResult {
  days_since_report: number;
  action_taken: ProductivityAction;
  /** Level 0 = no escalation, 1 = dept reminder, 2 = senior authority */
  escalation_level: 0 | 1 | 2;
  should_escalate: boolean;
  reminder_text?: string;
  escalation_summary?: string;
  next_check_day: number;
  gemini_used: boolean;
}

// ── Master WorkflowState ──────────────────────────────────────────────────────

export interface WorkflowState {
  /** The issue being processed */
  issue: Issue;
  /** All nearby issues passed in for duplicate checking */
  nearby_issues: Array<Pick<Issue, 'id' | 'title' | 'description' | 'latitude' | 'longitude' | 'created_at'>>;

  // ── Per-node outputs ──────────────────────────────────────────────────────
  triage?: TriageResult;
  verify?: VerifyResult;
  resolve?: ResolveResult;
  productivity?: ProductivityResult;

  // ── Routing flags set by edge logic ──────────────────────────────────────
  /** Set to true by triage when a high-confidence duplicate is found */
  halt_as_duplicate: boolean;
  /** Set to true by verify when community verification is required */
  awaiting_community_verification: boolean;

  // ── Execution metadata ────────────────────────────────────────────────────
  /** Ordered list of node execution events written to Supabase */
  execution_logs: NodeExecutionLog[];
  /** Any non-fatal errors accumulated during the run */
  errors: Array<{ node: WorkflowNodeName; message: string }>;
  /** ISO timestamp of when processIssueWorkflow() was called */
  started_at: string;
  /** ISO timestamp of when the last node finished */
  finished_at?: string;
  /** Total wall-clock ms for the whole workflow */
  total_time_ms?: number;
}

// ─── Internal helpers ──────────────────────────────────────────────────────────

/** Exponential back-off delay */
function delay(attempt: number): Promise<void> {
  return new Promise((r) => setTimeout(r, RETRY_BASE_DELAY_MS * Math.pow(2, attempt)));
}

/**
 * Retry wrapper — calls `fn` up to MAX_RETRIES+1 times.
 * Returns `null` (not throws) when all attempts fail.
 */
async function withRetry<T>(fn: () => Promise<T>): Promise<T | null> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt < MAX_RETRIES) {
        await delay(attempt);
      } else {
        console.error('[Orchestrator] All retry attempts exhausted:', err);
      }
    }
  }
  return null;
}

/**
 * Writes one NodeExecutionLog row to Supabase agent_logs and returns the
 * generated row id.  Silently no-ops if Supabase is unavailable so that
 * the workflow is never blocked by a DB write failure.
 */
async function persistLog(
  issueId: string,
  log: NodeExecutionLog,
): Promise<string | undefined> {
  const db = getServiceClient();
  if (!db) return undefined;

  const { data, error } = await db
    .from('agent_logs')
    .insert({
      issue_id: issueId,
      agent_name: `${log.node}_node`,
      agent_action: `${log.phase.toUpperCase()}: ${log.thought}`,
      status: log.status === 'success' ? 'success' : log.status === 'failed' ? 'failed' : 'pending',
      input_data: { phase: log.phase, node: log.node },
      output_data: log.output ?? null,
      error_message: log.error ?? null,
      execution_time_ms: log.execution_time_ms ?? null,
    })
    .select('id')
    .single();

  if (error) {
    console.warn('[Orchestrator] agent_logs write failed (non-fatal):', error.message);
    return undefined;
  }
  return (data as { id: string }).id;
}

/**
 * Convenience: append a log entry to state AND fire-and-forget the DB write.
 * Returns a function you call on exit to patch the same entry with final
 * status + execution time.
 */
function makeNodeLogger(state: WorkflowState, node: WorkflowNodeName) {
  return {
    async entry(thought: string): Promise<void> {
      const log: NodeExecutionLog = {
        node,
        phase: 'entry',
        status: 'running',
        thought,
        timestamp: new Date().toISOString(),
      };
      state.execution_logs.push(log);
      log.log_id = await persistLog(state.issue.id, log);
    },

    async exit(
      status: 'success' | 'failed' | 'skipped',
      thought: string,
      output?: Record<string, unknown>,
      error?: string,
      execution_time_ms?: number,
    ): Promise<void> {
      const log: NodeExecutionLog = {
        node,
        phase: 'exit',
        status,
        thought,
        output,
        error,
        execution_time_ms,
        timestamp: new Date().toISOString(),
      };
      state.execution_logs.push(log);
      log.log_id = await persistLog(state.issue.id, log);
    },
  };
}

// ─── Department routing map ───────────────────────────────────────────────────

const CATEGORY_TO_DEPARTMENT: Record<IssueCategory, { name: string; key: string }> = {
  Pothole: { name: 'Roads Department', key: 'roads' },
  'Road Damage': { name: 'Roads Department', key: 'roads' },
  Garbage: { name: 'Sanitation Department', key: 'sanitation' },
  'Streetlight Failure': { name: 'Electrical Department', key: 'electrical' },
  'Water Leakage': { name: 'Water Department', key: 'water' },
  'Drainage Problem': { name: 'Water Department', key: 'water' },
  Other: { name: 'General Affairs Department', key: 'other' },
};

/** Look up department row id from the departments table. */
async function lookupDepartmentId(departmentKey: string): Promise<string | undefined> {
  const db = getServiceClient();
  if (!db) return undefined;
  const { data } = await db
    .from('departments')
    .select('id')
    .eq('category', departmentKey)
    .limit(1)
    .single();
  return (data as { id: string } | null)?.id;
}

// ─── JSON extraction helper ───────────────────────────────────────────────────

/**
 * Extracts a JSON object from a Gemini response that may contain markdown
 * fences (```json ... ```) or raw JSON.
 */
function extractJson<T>(text: string): T | null {
  try {
    // Strip markdown code fences
    const cleaned = text.replace(/```(?:json)?\n?/g, '').trim();
    // Find the outermost { } block
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1) return null;
    return JSON.parse(cleaned.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// NODE 1 — TRIAGE
// Uses Gemini 1.5 Flash for speed.
// Responsibilities: image analysis, issue classification, duplicate detection.
// ═══════════════════════════════════════════════════════════════════════════════

async function runTriageNode(state: WorkflowState): Promise<void> {
  const logger = makeNodeLogger(state, 'triage');
  const t0 = Date.now();

  await logger.entry(
    'Analysing issue: classifying category, estimating severity, and scanning for duplicates.',
  );

  try {
    // ── Step 1: Run keyword classifier (always available, fast) ───────────
    const keywordResult = await classifyIssue(state.issue.title, state.issue.description);

    // ── Step 2: Run duplicate detector ────────────────────────────────────
    const dupResult = await checkForDuplicates(
      state.issue.title,
      state.issue.description,
      state.issue.latitude,
      state.issue.longitude,
      state.nearby_issues,
    );

    // ── Step 3: Attempt Gemini Flash for richer analysis ──────────────────
    let geminiAnalysis: {
      category: string;
      confidence_score: number;
      severity_score: number;
      summary: string;
      reasoning: string;
    } | null = null;

    const flash = getFlashModel();
    if (flash) {
      geminiAnalysis = await withRetry(async () => {
        const prompt = `You are a civic issue analysis AI. Analyse this issue report.

ISSUE TITLE: ${state.issue.title}
ISSUE DESCRIPTION: ${state.issue.description}
CITIZEN URGENCY RATING: ${state.issue.urgency}
LOCATION: lat=${state.issue.latitude}, lng=${state.issue.longitude}
KEYWORD CLASSIFIER SUGGESTION: ${keywordResult.category} (confidence: ${(keywordResult.confidence * 100).toFixed(0)}%)

Determine:
1. The most accurate category from: Pothole, Garbage, Water Leakage, Streetlight Failure, Drainage Problem, Road Damage, Other
2. A confidence score (0.0–1.0) for your category choice
3. A severity score (0.0–1.0) where 1.0 is life-threatening
4. A concise 1-sentence summary of the civic issue for the dashboard
5. Your reasoning (2-3 sentences)

Respond ONLY with valid JSON — no markdown, no commentary:
{
  "category": "<category>",
  "confidence_score": <number>,
  "severity_score": <number>,
  "summary": "<sentence>",
  "reasoning": "<sentences>"
}`;

        const result = await flash.generateContent(prompt);
        const text = result.response.text();
        return extractJson(text);
      });
    }

    // ── Step 4: Merge results — Gemini wins if available ──────────────────
    const finalCategory: IssueCategory =
      (geminiAnalysis?.category as IssueCategory) ?? keywordResult.category;
    const finalConfidence = geminiAnalysis?.confidence_score ?? keywordResult.confidence;
    const finalSeverity =
      geminiAnalysis?.severity_score ??
      (state.issue.urgency === 'critical'
        ? 0.9
        : state.issue.urgency === 'high'
          ? 0.7
          : state.issue.urgency === 'medium'
            ? 0.5
            : 0.3);
    const finalSummary =
      geminiAnalysis?.summary ?? `${finalCategory} issue: ${state.issue.title}`;
    const finalReasoning =
      geminiAnalysis?.reasoning ??
      `Keyword classifier matched "${finalCategory}" with ${(finalConfidence * 100).toFixed(0)}% confidence.`;

    // ── Step 5: Evaluate duplicate status ─────────────────────────────────
    // We auto-halt only when similarity is very high (> 0.85) to avoid false positives.
    const topScore = dupResult.similarity_scores[0] ?? 0;
    const isDuplicate = dupResult.is_potential_duplicate && topScore > 0.85;

    state.triage = {
      ai_category: finalCategory,
      ai_confidence_score: finalConfidence,
      ai_severity_score: finalSeverity,
      ai_summary: finalSummary,
      reasoning: finalReasoning,
      is_duplicate: isDuplicate,
      duplicate_of_id: isDuplicate ? dupResult.duplicate_issue_ids[0] : undefined,
      duplicate_candidates: dupResult.duplicate_issue_ids,
      similarity_scores: dupResult.similarity_scores,
    };

    // ── Conditional edge: halt if duplicate ───────────────────────────────
    if (isDuplicate) {
      state.halt_as_duplicate = true;
    }

    await logger.exit(
      'success',
      `Classified as "${finalCategory}" (${(finalConfidence * 100).toFixed(0)}% confidence, severity ${(finalSeverity * 100).toFixed(0)}%). ${isDuplicate ? 'DUPLICATE DETECTED — halting pipeline.' : 'No duplicate found. Proceeding to verify.'}`,
      { triage: state.triage, gemini_used: !!geminiAnalysis },
      undefined,
      Date.now() - t0,
    );
  } catch (err) {
    const message = String(err);
    state.errors.push({ node: 'triage', message });
    await logger.exit(
      'failed',
      'Triage node encountered an unexpected error.',
      undefined,
      message,
      Date.now() - t0,
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// NODE 2 — VERIFY
// Rule-based with Gemini confidence calibration.
// Responsibilities: decide AI auto-verify vs. community gate.
// ═══════════════════════════════════════════════════════════════════════════════

/** Confidence level above which we auto-verify without community input */
const AUTO_VERIFY_THRESHOLD = 0.80;

async function runVerifyNode(state: WorkflowState): Promise<void> {
  const logger = makeNodeLogger(state, 'verify');
  const t0 = Date.now();

  await logger.entry(
    'Evaluating AI confidence score to decide between auto-verification and community verification gate.',
  );

  try {
    const confidence = state.triage?.ai_confidence_score ?? 0.5;
    const severity = state.triage?.ai_severity_score ?? 0.5;
    const hasSimilarReports = (state.triage?.duplicate_candidates.length ?? 0) > 0;

    const autoVerified = confidence >= AUTO_VERIFY_THRESHOLD;

    // Build reasoning string
    let reasoning: string;
    if (autoVerified) {
      reasoning = `AI confidence is ${(confidence * 100).toFixed(0)}% (≥ ${AUTO_VERIFY_THRESHOLD * 100}% threshold). Issue is auto-verified and routed directly to resolution.`;
    } else {
      reasoning = `AI confidence is ${(confidence * 100).toFixed(0)}% (< ${AUTO_VERIFY_THRESHOLD * 100}% threshold). Community verification is required before department assignment.`;
    }

    if (hasSimilarReports && !state.halt_as_duplicate) {
      reasoning += ` ${state.triage!.duplicate_candidates.length} nearby similar report(s) found; cross-reference recommended.`;
    }
    if (severity >= 0.8) {
      reasoning += ` HIGH SEVERITY (${(severity * 100).toFixed(0)}%) — senior authority notified.`;
    }

    state.verify = {
      verification_required: !autoVerified,
      auto_verified: autoVerified,
      verification_confidence: confidence,
      reasoning,
    };

    state.awaiting_community_verification = !autoVerified;

    await logger.exit(
      'success',
      autoVerified
        ? `Auto-verified. Confidence ${(confidence * 100).toFixed(0)}% clears threshold. Proceeding to resolve.`
        : `Community verification gate set. Confidence ${(confidence * 100).toFixed(0)}% is below threshold. Issue status held at "reported".`,
      { verify: state.verify },
      undefined,
      Date.now() - t0,
    );
  } catch (err) {
    const message = String(err);
    state.errors.push({ node: 'verify', message });
    await logger.exit('failed', 'Verify node encountered an unexpected error.', undefined, message, Date.now() - t0);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// NODE 3 — RESOLVE
// Uses Gemini 1.5 Pro for reasoning.
// Responsibilities: department assignment, action plan generation.
// ═══════════════════════════════════════════════════════════════════════════════

async function runResolveNode(state: WorkflowState): Promise<void> {
  const logger = makeNodeLogger(state, 'resolve');
  const t0 = Date.now();

  await logger.entry(
    `Determining department assignment and generating step-by-step resolution plan for "${state.triage?.ai_category ?? state.issue.category}" issue.`,
  );

  try {
    const category: IssueCategory = state.triage?.ai_category ?? state.issue.category;
    const severity = state.triage?.ai_severity_score ?? 0.5;
    const dept = CATEGORY_TO_DEPARTMENT[category];

    // ── Lookup department id from DB ──────────────────────────────────────
    const deptId = await lookupDepartmentId(dept.key);

    // ── Determine priority ────────────────────────────────────────────────
    const priority: ResolveResult['priority_level'] =
      severity >= 0.85
        ? 'critical'
        : severity >= 0.65
          ? 'high'
          : severity >= 0.40
            ? 'medium'
            : 'low';

    // ── Attempt Gemini Pro for dynamic action plan ────────────────────────
    let geminiPlan: {
      steps: string[];
      estimated_hours: number;
      required_resources: string[];
      success_criteria: string[];
      assignment_reason: string;
    } | null = null;

    const pro = getProModel();
    if (pro) {
      geminiPlan = await withRetry(async () => {
        const prompt = `You are a municipal operations expert AI. Generate a concrete resolution plan.

CIVIC ISSUE:
  Title: ${state.issue.title}
  Description: ${state.issue.description}
  Category: ${category}
  AI Severity Score: ${(severity * 100).toFixed(0)}% (${priority} priority)
  Assigned Department: ${dept.name}
  Location: lat=${state.issue.latitude}, lng=${state.issue.longitude}

Generate a step-by-step resolution plan that a field crew can follow immediately.

Respond ONLY with valid JSON:
{
  "steps": ["<step 1>", "<step 2>", ...],
  "estimated_hours": <number>,
  "required_resources": ["<resource>", ...],
  "success_criteria": ["<criterion>", ...],
  "assignment_reason": "<1–2 sentences explaining why ${dept.name} is the right department>"
}

Rules:
- steps must be specific and actionable (5–8 steps)
- estimated_hours must be a realistic integer
- required_resources must name actual tools/materials
- success_criteria must be measurable outcomes`;

        const result = await pro.generateContent(prompt);
        const text = result.response.text();
        return extractJson(text);
      });
    }

    // ── Fallback templates ────────────────────────────────────────────────
    type FallbackPlan = {
      steps: string[];
      estimated_hours: number;
      required_resources: string[];
      success_criteria: string[];
      assignment_reason: string;
    };
    const fallbackPlans: Record<IssueCategory, FallbackPlan> = {
      Pothole: {
        steps: ['Mark hazard with cones and signs', 'Clear debris from pothole', 'Apply cold-patch asphalt', 'Tamp and compact fill', 'Level surface flush with road', 'Final safety inspection'],
        estimated_hours: 4,
        required_resources: ['Cold-patch asphalt (2 bags)', 'Plate compactor', 'Traffic cones (6)', 'Safety vests'],
        success_criteria: ['Surface flush with surrounding road', 'No loose material', 'Vehicle passes without jolt'],
        assignment_reason: `${dept.name} handles all road surface repairs including pothole patching.`,
      },
      Garbage: {
        steps: ['Assess waste volume and type', 'Don PPE', 'Collect all waste into skip bags', 'Separate recyclables', 'Transport to disposal facility', 'Sanitise area with disinfectant'],
        estimated_hours: 2,
        required_resources: ['Gloves and PPE', 'Skip bags (10)', 'Broom and dustpan', 'Disinfectant spray'],
        success_criteria: ['Area visually clear', 'No malodour', 'Photo evidence submitted'],
        assignment_reason: `${dept.name} is responsible for all solid waste removal and area sanitation.`,
      },
      'Water Leakage': {
        steps: ['Locate main shut-off valve', 'Shut off water supply', 'Excavate around pipe if underground', 'Identify leak source (crack, joint, valve)', 'Apply appropriate repair (clamp, epoxy, replacement)', 'Pressure-test at 1.5× operating pressure', 'Restore supply and monitor 30 min'],
        estimated_hours: 6,
        required_resources: ['Pipe clamp kit', 'Pressure gauge', 'Epoxy putty', 'Excavation tools'],
        success_criteria: ['Zero pressure drop over 30 min', 'No visible moisture', 'Pipe inspector sign-off'],
        assignment_reason: `${dept.name} manages all water distribution infrastructure repairs.`,
      },
      'Streetlight Failure': {
        steps: ['Confirm power supply at junction box', 'Inspect driver/ballast for fault codes', 'Test LED module continuity', 'Replace faulty component (lamp/driver/fuse)', 'Restore power and verify output (min 80% rated lumens)', 'Log repair in asset management system'],
        estimated_hours: 2,
        required_resources: ['Replacement LED module', 'Multimeter', 'Insulated tools', 'Cherry picker (if pole > 6m)'],
        success_criteria: ['Light operational at rated brightness', 'No flickering', 'Photocell response verified'],
        assignment_reason: `${dept.name} maintains all public lighting and electrical street assets.`,
      },
      'Drainage Problem': {
        steps: ['CCTV-inspect drain for blockage location', 'High-pressure jetting to clear obstruction', 'Manual removal of solid debris', 'Inspect downstream flow with dye test', 'Repair cracked gully pot if found', 'Restore grating and document clearance'],
        estimated_hours: 3,
        required_resources: ['CCTV drain camera', 'High-pressure jetter (2000 PSI)', 'Rodding rods', 'Skip for debris'],
        success_criteria: ['Unrestricted flow confirmed by dye test', 'CCTV shows clear bore', 'No standing water 30 min post-rain'],
        assignment_reason: `${dept.name} operates and maintains the surface water drainage network.`,
      },
      'Road Damage': {
        steps: ['Cordon off damaged section', 'Survey extent and cause of damage', 'Remove failed material by milling', 'Re-grade sub-base if required', 'Lay and compact new binder course', 'Apply surface dressing', 'Line-mark if applicable', 'Open to traffic after 2h cure'],
        estimated_hours: 8,
        required_resources: ['Asphalt milling machine', 'Roller compactor', 'Hot-mix asphalt (tonnes TBD)', 'Line-marking paint'],
        success_criteria: ['IRI (ride quality) within spec', 'No delamination', 'Surface drainage maintained'],
        assignment_reason: `${dept.name} undertakes all structural road maintenance works.`,
      },
      Other: {
        steps: ['Assess and photograph issue', 'Classify to appropriate sub-department', 'Assign field officer', 'Execute targeted remediation', 'Confirm resolution with photographic evidence'],
        estimated_hours: 4,
        required_resources: ['General tools', 'Camera'],
        success_criteria: ['Issue no longer poses public risk', 'Resident satisfied'],
        assignment_reason: `${dept.name} handles miscellaneous civic matters not covered by specialist departments.`,
      },
    };

    const plan = geminiPlan ?? fallbackPlans[category];

    state.resolve = {
      assigned_department: dept.name,
      department_id: deptId,
      assignment_reason: plan.assignment_reason,
      priority_level: priority,
      action_plan: {
        steps: plan.steps,
        estimated_hours: plan.estimated_hours,
        required_resources: plan.required_resources,
        success_criteria: plan.success_criteria,
      },
      gemini_used: !!geminiPlan,
    };

    await logger.exit(
      'success',
      `Assigned to ${dept.name} (${priority} priority). ${plan.steps.length}-step action plan generated. ${geminiPlan ? 'Gemini Pro reasoning applied.' : 'Fallback template used (no Gemini key).'}`,
      { resolve: state.resolve },
      undefined,
      Date.now() - t0,
    );
  } catch (err) {
    const message = String(err);
    state.errors.push({ node: 'resolve', message });
    await logger.exit('failed', 'Resolve node encountered an unexpected error.', undefined, message, Date.now() - t0);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// NODE 4 — PRODUCTIVITY_ESCALATE  (Main Innovation)
// Uses Gemini 1.5 Pro for escalation summaries.
//
// Government Productivity Agent — models the "Last Minute Life Saver" concept:
//   Day 3  → Reminder generated
//   Day 7  → Follow-up generated
//   Day 14 → Escalation flag raised
//
// Writes directly to `reminders` and `escalations` Supabase tables and creates
// a notification so the dashboard can surface the action in real-time.
// ═══════════════════════════════════════════════════════════════════════════════

async function runProductivityEscalateNode(state: WorkflowState): Promise<void> {
  const logger = makeNodeLogger(state, 'productivity_escalate');
  const t0 = Date.now();

  const daysSinceReport = Math.floor(
    (Date.now() - new Date(state.issue.created_at).getTime()) / (1000 * 60 * 60 * 24),
  );

  await logger.entry(
    `Government Productivity Agent activated. Issue is ${daysSinceReport} day(s) old. Evaluating deadline thresholds: Reminder@Day${PRODUCTIVITY_THRESHOLDS.REMINDER_DAY}, Follow-up@Day${PRODUCTIVITY_THRESHOLDS.FOLLOWUP_DAY}, Escalation@Day${PRODUCTIVITY_THRESHOLDS.ESCALATION_DAY}.`,
  );

  try {
    const db = getServiceClient();
    const severity = state.triage?.ai_severity_score ?? 0;
    const department = state.resolve?.assigned_department ?? 'Unassigned Department';

    let action: ProductivityAction = 'none';
    let escalationLevel: 0 | 1 | 2 = 0;
    let shouldEscalate = false;
    let reminderText: string | undefined;
    let escalationSummary: string | undefined;

    // ── Determine which threshold has been crossed ─────────────────────────
    if (daysSinceReport >= PRODUCTIVITY_THRESHOLDS.ESCALATION_DAY) {
      action = 'escalation';
      escalationLevel = severity >= 0.7 ? 2 : 1;
      shouldEscalate = true;
    } else if (daysSinceReport >= PRODUCTIVITY_THRESHOLDS.FOLLOWUP_DAY) {
      action = 'follow_up';
      escalationLevel = 0;
    } else if (daysSinceReport >= PRODUCTIVITY_THRESHOLDS.REMINDER_DAY) {
      action = 'reminder';
      escalationLevel = 0;
    }

    // ── Compute next check day ────────────────────────────────────────────
    const nextCheckDay =
      daysSinceReport < PRODUCTIVITY_THRESHOLDS.REMINDER_DAY
        ? PRODUCTIVITY_THRESHOLDS.REMINDER_DAY
        : daysSinceReport < PRODUCTIVITY_THRESHOLDS.FOLLOWUP_DAY
          ? PRODUCTIVITY_THRESHOLDS.FOLLOWUP_DAY
          : PRODUCTIVITY_THRESHOLDS.ESCALATION_DAY;

    // ── Generate message text using Gemini (with fallback) ────────────────
    let geminiUsed = false;

    if (action !== 'none') {
      const pro = getProModel();

      const fallbackMessages: Record<Exclude<ProductivityAction, 'none'>, string> = {
        reminder: `REMINDER (Day ${daysSinceReport}): Issue "${state.issue.title}" (${state.issue.category}) reported ${daysSinceReport} day(s) ago remains unresolved. Please confirm receipt and provide a status update to the citizen portal.`,
        follow_up: `FOLLOW-UP REQUIRED (Day ${daysSinceReport}): Issue "${state.issue.title}" has been pending for ${daysSinceReport} days. ${department} — immediate progress update required. Escalation will be triggered if not resolved by Day ${PRODUCTIVITY_THRESHOLDS.ESCALATION_DAY}.`,
        escalation: `ESCALATION (Day ${daysSinceReport}): Issue "${state.issue.title}" (${state.issue.category}, severity ${(severity * 100).toFixed(0)}%) has exceeded the ${PRODUCTIVITY_THRESHOLDS.ESCALATION_DAY}-day resolution deadline. ${escalationLevel === 2 ? 'Referred to Senior Authority.' : 'Department reminder issued.'} Immediate intervention required.`,
      };

      if (pro && action === 'escalation') {
        // For escalation, use Gemini Pro for a formal summary
        const summary = await withRetry(async () => {
          const prompt = `You are a senior government productivity officer. Write a formal escalation report.

ISSUE DETAILS:
  ID: ${state.issue.id}
  Title: ${state.issue.title}
  Category: ${state.issue.category}
  Description: ${state.issue.description}
  Severity Score: ${(severity * 100).toFixed(0)}%
  Days Since Report: ${daysSinceReport}
  Current Status: ${state.issue.status}
  Assigned Department: ${department}
  Priority: ${state.resolve?.priority_level ?? 'unknown'}

Write a 3-paragraph escalation summary:
1. Situation: What is the civic issue and why is it time-critical?
2. Resolution Failure: Why has this exceeded the ${PRODUCTIVITY_THRESHOLDS.ESCALATION_DAY}-day SLA?
3. Recommended Action: What should the senior authority do immediately?

Write in formal, professional English. Be concise. Do NOT use bullet points.`;

          const result = await pro.generateContent(prompt);
          return result.response.text().trim();
        });

        if (summary) {
          escalationSummary = summary;
          geminiUsed = true;
        } else {
          escalationSummary = fallbackMessages.escalation;
        }
        reminderText = fallbackMessages.escalation;
      } else if (pro && action === 'follow_up') {
        const msg = await withRetry(async () => {
          const prompt = `You are a government productivity officer. Write a follow-up message for a civic issue that is overdue.

ISSUE: "${state.issue.title}" (${state.issue.category}) — ${daysSinceReport} days old.
DEPARTMENT: ${department}
SEVERITY: ${(severity * 100).toFixed(0)}%

Write a concise, firm 2-sentence follow-up message addressed to the department head.
Mention the deadline and the consequence (escalation). Plain text only.`;

          const result = await pro.generateContent(prompt);
          return result.response.text().trim();
        });

        reminderText = msg ?? fallbackMessages.follow_up;
        geminiUsed = !!msg;
      } else {
        reminderText = fallbackMessages[action];
      }

      // ── Persist reminder to Supabase ──────────────────────────────────
      if (db && reminderText) {
        const reminderLevel = action === 'escalation' ? 3 : action === 'follow_up' ? 2 : 1;
        const scheduledFor = new Date();
        scheduledFor.setDate(scheduledFor.getDate() + (nextCheckDay - daysSinceReport));

        const { error: remError } = await db.from('reminders').insert({
          issue_id: state.issue.id,
          department_id: state.resolve?.department_id ?? null,
          reminder_level: reminderLevel,
          reminder_text: reminderText,
          scheduled_for: scheduledFor.toISOString(),
          sent_at: new Date().toISOString(),
        });
        if (remError) {
          console.warn('[Orchestrator] reminders write failed (non-fatal):', remError.message);
        }
      }

      // ── Persist escalation to Supabase ────────────────────────────────
      if (db && shouldEscalate && escalationSummary) {
        const { error: escError } = await db.from('escalations').insert({
          issue_id: state.issue.id,
          escalation_level: escalationLevel,
          escalation_summary: escalationSummary,
          reason: `Issue exceeded ${PRODUCTIVITY_THRESHOLDS.ESCALATION_DAY}-day resolution SLA. Severity: ${(severity * 100).toFixed(0)}%.`,
        });
        if (escError) {
          console.warn('[Orchestrator] escalations write failed (non-fatal):', escError.message);
        }
      }

      // ── Create notification record ─────────────────────────────────────
      if (db) {
        const notifTitle =
          action === 'escalation'
            ? `⚠️ Escalation: ${state.issue.title}`
            : action === 'follow_up'
              ? `🔔 Follow-up Required: ${state.issue.title}`
              : `📋 Reminder: ${state.issue.title}`;

        await db.from('notifications').insert({
          user_id: state.issue.user_id,
          issue_id: state.issue.id,
          notification_type: action,
          title: notifTitle,
          message: reminderText,
          action_url: `/issue/${state.issue.id}`,
        });
      }
    }

    state.productivity = {
      days_since_report: daysSinceReport,
      action_taken: action,
      escalation_level: escalationLevel,
      should_escalate: shouldEscalate,
      reminder_text: reminderText,
      escalation_summary: escalationSummary,
      next_check_day: nextCheckDay,
      gemini_used: geminiUsed,
    };

    const actionLabel: Record<ProductivityAction, string> = {
      none: `No action needed yet. Next check at Day ${nextCheckDay}.`,
      reminder: `Day-${daysSinceReport} REMINDER generated and stored.`,
      follow_up: `Day-${daysSinceReport} FOLLOW-UP generated and stored.`,
      escalation: `Day-${daysSinceReport} ESCALATION (Level ${escalationLevel}) flagged. ${escalationSummary ? 'Gemini Pro summary generated.' : 'Fallback summary used.'}`,
    };

    await logger.exit(
      'success',
      actionLabel[action],
      { productivity: state.productivity },
      undefined,
      Date.now() - t0,
    );
  } catch (err) {
    const message = String(err);
    state.errors.push({ node: 'productivity_escalate', message });
    await logger.exit('failed', 'Productivity/Escalate node encountered an unexpected error.', undefined, message, Date.now() - t0);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN ENTRY POINT — processIssueWorkflow
// Called by POST /api/issues after the issue row is inserted.
// Returns the full WorkflowState so the API route can persist ai_* columns.
// ═══════════════════════════════════════════════════════════════════════════════

export async function processIssueWorkflow(
  issue: Issue,
  nearbyIssues: Array<Pick<Issue, 'id' | 'title' | 'description' | 'latitude' | 'longitude' | 'created_at'>>,
): Promise<WorkflowState> {
  const globalStart = Date.now();

  const state: WorkflowState = {
    issue,
    nearby_issues: nearbyIssues,
    halt_as_duplicate: false,
    awaiting_community_verification: false,
    execution_logs: [],
    errors: [],
    started_at: new Date().toISOString(),
  };

  console.log(`[Orchestrator] ► Starting 4-node workflow for issue ${issue.id}`);

  // ── Node 1: TRIAGE (always runs) ──────────────────────────────────────────
  await runTriageNode(state);

  // ── Conditional edge: short-circuit if duplicate ──────────────────────────
  if (state.halt_as_duplicate) {
    console.log(`[Orchestrator] ✖ Issue ${issue.id} identified as duplicate. Pipeline halted after triage.`);
    state.finished_at = new Date().toISOString();
    state.total_time_ms = Date.now() - globalStart;
    return state;
  }

  // ── Node 2: VERIFY ────────────────────────────────────────────────────────
  await runVerifyNode(state);

  // ── Node 3: RESOLVE (runs regardless of verification gate) ───────────────
  // We still generate a plan so officers can act immediately after community
  // verification completes without re-triggering the workflow.
  await runResolveNode(state);

  // ── Node 4: PRODUCTIVITY_ESCALATE ─────────────────────────────────────────
  await runProductivityEscalateNode(state);

  state.finished_at = new Date().toISOString();
  state.total_time_ms = Date.now() - globalStart;

  console.log(
    `[Orchestrator] ✔ Workflow complete for issue ${issue.id} in ${state.total_time_ms}ms. ` +
    `Errors: ${state.errors.length}. Logs: ${state.execution_logs.length}.`,
  );

  return state;
}

// ─── Legacy compatibility shim ─────────────────────────────────────────────────
// The existing POST /api/issues route calls `processNewIssue`. Keep that
// export pointing to the new workflow so no API route changes are needed now.

export async function processNewIssue(
  issue: Issue,
  existingIssues: Array<any>,
): Promise<WorkflowState> {
  const narrowed = (existingIssues as any[]).map((i) => ({
    id: i.id as string,
    title: i.title as string,
    description: i.description as string,
    latitude: i.latitude as number,
    longitude: i.longitude as number,
    created_at: i.created_at as string,
  }));
  return processIssueWorkflow(issue, narrowed);
}

// ─── Periodic productivity runner ─────────────────────────────────────────────
// Called by POST /api/agents/process to sweep all active issues and apply
// the Government Productivity Agent without re-running triage/verify/resolve.

export async function runProductivitySweep(): Promise<{
  processed: number;
  actions: Array<{ issue_id: string; action: ProductivityAction }>;
  errors: string[];
}> {
  const db = getServiceClient();
  if (!db) return { processed: 0, actions: [], errors: ['No Supabase service key configured.'] };

  const { data: activeIssues, error } = await db
    .from('issues')
    .select('*')
    .in('status', ['reported', 'verified', 'assigned', 'in_progress'])
    .order('created_at', { ascending: true })
    .limit(100);

  if (error) return { processed: 0, actions: [], errors: [error.message] };

  const results: Array<{ issue_id: string; action: ProductivityAction }> = [];
  const sweepErrors: string[] = [];

  for (const rawIssue of activeIssues ?? []) {
    try {
      const issue = rawIssue as Issue;
      // Build a minimal state — we only need productivity node
      const state: WorkflowState = {
        issue,
        nearby_issues: [],
        halt_as_duplicate: false,
        awaiting_community_verification: false,
        execution_logs: [],
        errors: [],
        started_at: new Date().toISOString(),
        // Reconstruct triage/resolve stubs from stored DB values
        triage: issue.ai_severity_score !== undefined
          ? {
              ai_category: (issue.ai_category as IssueCategory) ?? issue.category,
              ai_confidence_score: issue.ai_confidence_score ?? 0.5,
              ai_severity_score: issue.ai_severity_score ?? 0.5,
              ai_summary: issue.ai_summary ?? '',
              reasoning: '',
              is_duplicate: issue.is_duplicate,
              duplicate_candidates: [],
              similarity_scores: [],
            }
          : undefined,
        resolve: undefined,
      };

      await runProductivityEscalateNode(state);

      if (state.productivity?.action_taken !== 'none') {
        results.push({ issue_id: issue.id, action: state.productivity!.action_taken });
      }
    } catch (err) {
      sweepErrors.push(`${rawIssue.id}: ${String(err)}`);
    }
  }

  return {
    processed: (activeIssues ?? []).length,
    actions: results,
    errors: sweepErrors,
  };
}

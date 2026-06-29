# AI Agent Architecture & LangGraph Design

## 🤖 Overview

Community Hero AI uses an **Agent Orchestration Pattern** to manage the complete civic issue lifecycle. The system is architected to be agnostic to the underlying execution engine, with prepared LangGraph integration points.

## 📊 Agent Workflow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Issue Reported by Citizen                         │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
              ┌────────────────────────────┐
              │  Image Analysis Agent      │
              │  (Analyze uploaded photos) │
              └────────┬───────────────────┘
                       │
                       ▼
              ┌────────────────────────────┐
              │  Classifier Agent          │
              │  (Determine category)      │
              └────────┬───────────────────┘
                       │
                       ▼
              ┌────────────────────────────┐
              │  Duplicate Detector        │
              │  (Check for similar)       │
              └────────┬───────────────────┘
                       │
              ┌────────┴────────┐
              │                 │
              ▼                 ▼
    ┌──────────────────┐  ┌──────────────────┐
    │ Support Existing │  │ Verification     │
    │ Report           │  │ Agent            │
    └──────────────────┘  └────────┬─────────┘
                                   │
                                   ▼
                          ┌──────────────────┐
                          │ Resolution Agent │
                          │ (Generate plan)  │
                          └────────┬─────────┘
                                   │
                                   ▼
                          ┌──────────────────┐
                          │ Assignment Agent │
                          │ (Route dept)     │
                          └────────┬─────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │   Issue Tracking Phase      │
                    │ (Periodic background jobs)  │
                    ├─────────────────────────────┤
                    │ • Reminder Agent (7-21 days)│
                    │ • Escalation Agent (21 days)│
                    │ • Status Monitor             │
                    └─────────────────────────────┘
                                   │
                                   ▼
                          ┌──────────────────┐
                          │  Issue Resolved  │
                          └──────────────────┘
```

## 🧠 Agent Specifications

### 1. Image Analysis Agent

**Purpose:** Extract visual information from uploaded images

**Input:**
```typescript
{
  image_base64: string;      // Base64 encoded image
  mime_type: string;         // "image/jpeg", "image/png", etc
  issue_context?: string;    // Optional: user description
}
```

**Output:**
```typescript
{
  category: IssueCategory;       // Detected category
  summary: string;               // What's visible in image
  confidence_score: number;      // 0-1 confidence
  severity_score: number;        // 0-1 severity
  reasoning: string;             // Why this classification
}
```

**Current Status:** PLACEHOLDER - Needs Google Gemini 1.5 Vision integration

**Future Implementation:**
```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function analyzeImage(imageBase64: string, mimeType: string): Promise<AIAnalysisResult> {
  const client = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
  const model = client.getGenerativeModel({ model: 'gemini-1.5-flash' });
  
  const result = await model.generateContent([
    {
      inlineData: {
        data: imageBase64,
        mimeType: mimeType,
      },
    },
    {
      text: `Analyze this civic infrastructure image. Identify:
        1. The type of civic issue (pothole, garbage, water leak, etc)
        2. Severity level (1-10)
        3. Confidence in your assessment (0-100%)
        4. Visible details that led to this assessment
        
        Format as JSON with keys: category, severity_score, confidence_score, reasoning`
    },
  ]);
  
  // Parse JSON response and return
}
```

### 2. Issue Classifier Agent

**Purpose:** Categorize issues by type and estimate severity

**Input:**
```typescript
{
  title: string;         // Issue title
  description: string;   // Full description
  category?: string;     // User-suggested category (optional)
}
```

**Output:**
```typescript
{
  category: IssueCategory;
  confidence: number;     // 0-1
  alternative_categories: Array<{
    category: IssueCategory;
    confidence: number;
  }>;
}
```

**Status:** ✅ IMPLEMENTED (Keyword-based)

**Algorithm:**
- Keyword matching against category vocabularies
- Calculates TF-based scoring
- Returns top 3 alternatives
- Production-ready

**Location:** `src/lib/ai/issue-classifier.ts`

### 3. Duplicate Detector Agent

**Purpose:** Identify similar or duplicate reports

**Input:**
```typescript
{
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  existing_issues: Array<{
    id: string;
    title: string;
    description: string;
    latitude: number;
    longitude: number;
    created_at: string;
  }>;
}
```

**Output:**
```typescript
{
  is_potential_duplicate: boolean;
  duplicate_issue_ids: string[];
  similarity_scores: number[];  // 0-1 for each match
  reasoning: string;
}
```

**Status:** ✅ IMPLEMENTED

**Algorithm:**
- Levenshtein distance for text similarity
- Haversine formula for geographic distance
- Time window filtering (24 hours)
- Composite scoring (60% text + 40% proximity)

**Location:** `src/lib/ai/duplicate-detector.ts`

### 4. Verification Agent

**Purpose:** Determine verification requirements

**Input:**
```typescript
{
  ai_confidence_score: number;    // From Image Analysis
  severity_score: number;          // From Classifier
  has_multiple_similar_reports: boolean;
}
```

**Output:**
```typescript
{
  requires_community_verification: boolean;
  reasoning: string;
  recommended_actions: string[];
}
```

**Status:** PLACEHOLDER - Needs ML confidence calibration

**Decision Tree:**
```
IF confidence_score >= 0.85
  THEN require_community_verification = FALSE
  ELSE require_community_verification = TRUE
```

**Location:** `src/lib/ai/verification-agent.ts`

### 5. Resolution Agent

**Purpose:** Generate resolution action plans

**Input:**
```typescript
{
  category: IssueCategory;
  description: string;
  severity: number;  // 0-1
}
```

**Output:**
```typescript
{
  steps: string[];           // Step-by-step actions
  estimated_time_hours: number;
  required_resources: string[];
  success_criteria: string[];
}
```

**Status:** PLACEHOLDER - Templates ready, needs ML enhancement

**Current Implementation:**
- Hardcoded templates for each category
- Category-based time estimation
- Severity multiplier for time adjustment

**Templates Covered:**
- Pothole repair (4-6 hours)
- Garbage cleanup (2-3 hours)
- Water leak repair (6-8 hours)
- Streetlight failure (2-3 hours)
- Drainage problem (3-4 hours)
- Road damage (8+ hours)

**Location:** `src/lib/ai/resolution-agent.ts`

### 6. Assignment Agent

**Purpose:** Route issues to appropriate departments

**Input:**
```typescript
{
  category: IssueCategory;
  severity: number;  // 0-1
  location: { lat: number; lng: number };
}
```

**Output:**
```typescript
{
  department_id: string;
  reasoning: string;
  backup_departments: string[];
}
```

**Status:** TODO - Not yet implemented

**Category → Department Mapping:**
```
Pothole           → Roads Department
Garbage           → Sanitation Department
Water Leakage     → Water Department
Streetlight Fail  → Electrical/Public Works
Drainage Problem  → Water Department
Road Damage       → Roads Department
```

**Future Implementation:**
- Query active departments
- Consider geographic zones
- Factor in current workload
- Suggest backup departments

### 7. Reminder Agent

**Purpose:** Schedule follow-up notifications

**Input:**
```typescript
{
  issue_id: string;
  days_since_report: number;
  department_name: string;
}
```

**Output:**
```typescript
{
  reminder_text: string;
  scheduled_for: Date;
  reminder_level: number;     // 1, 2, or 3
  recipients: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
}
```

**Status:** PLACEHOLDER - Structure ready, needs scheduler

**Reminder Schedule:**
```
Days Since Report | Reminder Level | Next Reminder
1-6               | NONE           | 7 days
7-13              | LEVEL 1        | 5 days later
14-20             | LEVEL 2        | 3 days later
21+               | LEVEL 3        | 2 days later (escalate)
```

**Location:** `src/lib/ai/reminder-agent.ts`

### 8. Escalation Agent

**Purpose:** Manage overdue issues and escalations

**Input:**
```typescript
{
  issue: Issue;
  days_since_report: number;
  days_since_assignment?: number;
}
```

**Output:**
```typescript
{
  should_escalate: boolean;
  reason: string;
  recommended_level: number;
}
```

**Status:** PLACEHOLDER - Logic structure ready

**Escalation Triggers:**
```
IF days_since_report > 14 THEN escalate
IF severity_score > 0.7 THEN escalate
IF days_since_assignment > 3 THEN escalate
```

**Location:** `src/lib/ai/escalation-agent.ts`

### 9. Agent Orchestrator

**Purpose:** Coordinate agents in proper sequence

**Key Function:** `processNewIssue(issue, existingIssues)`

**Execution Sequence:**
1. Classification Agent → Categorize issue
2. Duplicate Detector → Check for duplicates
3. Verification Agent → Determine verification path
4. Resolution Agent → Generate action plan
5. Store results and agent logs

**Async Execution:**
- Agents run sequentially (dependencies between them)
- Each agent call is logged with timestamp, status, result
- Failures don't stop pipeline (graceful degradation)

**State Management:**
```typescript
interface AgentState {
  issue: Issue;
  analysisResult?: ClassificationResult;
  duplicateResult?: DuplicateCheckResult;
  verificationDecision?: VerificationDecision;
  resolutionPlan?: ResolutionPlan;
  agentLogs: Array<{
    agent: string;
    action: string;
    status: 'pending' | 'completed' | 'failed';
    timestamp: Date;
    result?: any;
    error?: string;
  }>;
}
```

**Location:** `src/lib/ai/agent-orchestrator.ts`

## 🔗 LangGraph Integration Plan

### LangGraph Architecture (Ready for Implementation)

```python
# Future implementation in Python service or Vercel Functions

from langgraph.graph import Graph, END
from langgraph.checkpoint.memory import MemorySaver

# Define state schema
class AgentState(TypedDict):
    issue: dict
    analysis_result: Optional[dict]
    duplicate_result: Optional[dict]
    verification_decision: Optional[dict]
    resolution_plan: Optional[dict]
    agent_logs: list

# Define agent nodes
def image_analysis_node(state):
    """Node for image analysis"""
    result = run_image_analysis(state["issue"]["image"])
    state["analysis_result"] = result
    return state

def classifier_node(state):
    """Node for classification"""
    result = classify_issue(state["issue"])
    state["analysis_result"] = result
    return state

def duplicate_node(state):
    """Node for duplicate detection"""
    result = check_duplicates(state["issue"])
    state["duplicate_result"] = result
    
    # Conditional routing
    if result["is_potential_duplicate"]:
        return "support_existing"
    return "verification"

# Build graph
workflow = Graph(AgentState)

workflow.add_node("image_analysis", image_analysis_node)
workflow.add_node("classifier", classifier_node)
workflow.add_node("duplicate", duplicate_node)
workflow.add_node("verification", verification_node)
workflow.add_node("resolution", resolution_node)
workflow.add_node("assignment", assignment_node)

# Define edges
workflow.add_edge("image_analysis", "classifier")
workflow.add_edge("classifier", "duplicate")
workflow.add_conditional_edges(
    "duplicate",
    lambda x: "support_existing" if x["duplicate_result"]["is_potential_duplicate"] else "verification",
    {
        "support_existing": END,
        "verification": "verification"
    }
)
workflow.add_edge("verification", "resolution")
workflow.add_edge("resolution", "assignment")
workflow.add_edge("assignment", END)

# Compile with memory persistence
checkpointer = MemorySaver()
app = workflow.compile(checkpointer=checkpointer)

# Execute
result = app.invoke({"issue": issue_data})
```

### Transition from Current to LangGraph

**Phase 1: Current Implementation**
- Orchestrator calls agents sequentially
- Agent logs stored in database
- Suitable for Next.js API routes

**Phase 2: LangGraph Migration** (Future)
- Deploy LangGraph service on Vercel Edge Functions
- Next.js API routes call LangGraph service
- Persistent state in Supabase
- Graph visualization available
- Conditional routing for complex workflows

**Phase 3: Advanced Features** (Future)
- Human-in-the-loop verification
- Multi-model ensemble decisions
- A/B testing of agent configurations
- Real-time monitoring dashboard

## 📊 Data Flow Diagrams

### Issue Processing Pipeline

```
┌──────────────────┐
│  Issue Submitted │
└────────┬─────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ Extract Data:                       │
│ - title, description, location      │
│ - category (user suggested)         │
│ - media (image/video)               │
│ - urgency level                     │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ Store Issue in Database             │
│ - Create issues record              │
│ - Store media in Supabase Storage   │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ Trigger Agent Pipeline              │
│ (orchestrator.processNewIssue)      │
└────────┬────────────────────────────┘
         │
    ┌────┴────┬────────┬─────────┐
    ▼         ▼        ▼         ▼
┌────────┐ ┌──────┐ ┌──────┐ ┌────────┐
│ Image  │ │Class-│ │Dupli-│ │Verifi-│
│Analysis│ │ifier │ │cate  │ │cation │
└────┬───┘ └──┬───┘ └──┬───┘ └───┬───┘
     │        │       │          │
     └────────┴───────┴──────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ Generate Resolution Plan            │
│ - Step-by-step actions              │
│ - Estimated time                    │
│ - Required resources                │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ Assign to Department                │
│ - Select appropriate department     │
│ - Create assignment record          │
│ - Notify department                 │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ Update Issue Status to "Assigned"   │
│ - Store all AI analysis results     │
│ - Log agent decisions to audit trail│
└─────────────────────────────────────┘
```

## 🔄 Periodic Tracking Jobs

These agents run on scheduled intervals (e.g., every hour):

### Reminder Job
```
FOR each unresolved issue:
  IF days_since_report == 7 or 14 or 21:
    reminder = generateReminder(issue)
    schedule_notification(reminder)
```

### Escalation Job
```
FOR each assigned issue:
  IF shouldEscalate(issue):
    escalation = generateEscalation(issue)
    notify_senior_authority(escalation)
```

### Status Update Job
```
FOR each issue with updates:
  Update analytics tables
  Generate notifications
  Update community heatmap data
```

## 📈 Metrics & Monitoring

### Agent Performance Metrics

Track in `agent_logs` table:
- Execution time (ms)
- Success/failure status
- Input parameters
- Output results
- Error messages

### Analytics

```sql
-- Average agent execution time by agent type
SELECT agent_name, AVG(execution_time_ms) as avg_time
FROM agent_logs
GROUP BY agent_name;

-- Agent success rate
SELECT agent_name, 
  SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) / COUNT(*) as success_rate
FROM agent_logs
GROUP BY agent_name;

-- Issues reaching each stage
SELECT status, COUNT(*) as count
FROM issues
GROUP BY status;
```

## 🚀 Implementation Priority

### P0 (Critical)
1. ✅ Orchestrator framework
2. ✅ Classifier agent
3. ✅ Duplicate detector
4. 🔄 Assignment agent (Route to departments)
5. 🔄 Verification workflow UI

### P1 (High)
1. 🔄 Google Gemini image analysis
2. 🔄 Reminder scheduler
3. 🔄 Escalation logic
4. 🔄 Real-time notifications

### P2 (Medium)
1. 🔄 LangGraph migration
2. 🔄 Multi-model ensemble
3. 🔄 Performance optimization
4. 🔄 Advanced analytics

### P3 (Nice to Have)
1. Human-in-the-loop verification
2. Predictive resolution time
3. Agent configuration A/B testing
4. Custom agent creation UI

## 🔐 Error Handling

All agents implement graceful error handling:

```typescript
export async function agentFunction(input) {
  try {
    // Process input
    const result = await processInput(input);
    
    // Validate result
    if (!isValid(result)) {
      throw new Error('Invalid result format');
    }
    
    return result;
  } catch (error) {
    // Log error
    console.error('[AI] Agent error:', error);
    
    // Return safe default
    return getDefaultResult(input);
  }
}
```

## 📚 Resources for Implementation

- [LangGraph Documentation](https://langchain-ai.github.io/langgraph/)
- [Google Gemini API](https://ai.google.dev/)
- [Supabase Functions](https://supabase.com/docs/guides/functions)
- [Vercel Edge Functions](https://vercel.com/docs/functions/edge-functions)

---

**Status:** Architecture ready for LangGraph integration
**Last Updated:** 2024
**Implementation Path:** Current → LangGraph → Advanced Features

/**
 * Escalation Agent Service
 * 
 * Manages issue escalation workflow.
 * Determines when and how to escalate to senior authorities.
 * Tracks escalation history and reasoning.
 */

import { Issue } from '@/types';

export interface EscalationCriteria {
  age_days: number;
  severity_threshold: number;
  resolution_timeout_hours: number;
  escalation_levels: number;
}

const DEFAULT_ESCALATION_CRITERIA: EscalationCriteria = {
  age_days: 14,
  severity_threshold: 0.7,
  resolution_timeout_hours: 72,
  escalation_levels: 2,
};

export async function shouldEscalate(
  issue: Issue,
  daysSinceReport: number,
  daysSinceAssignment?: number,
): Promise<{ should_escalate: boolean; reason: string; recommended_level: number }> {
  try {
    const severity = issue.ai_severity_score || 0.5;

    // Escalation triggers
    const isAgeTriggered = daysSinceReport > DEFAULT_ESCALATION_CRITERIA.age_days;
    const isSeverityTriggered = severity > DEFAULT_ESCALATION_CRITERIA.severity_threshold;
    const isTimeoutTriggered: boolean =
      !!daysSinceAssignment &&
      daysSinceAssignment * 24 > DEFAULT_ESCALATION_CRITERIA.resolution_timeout_hours;

    const shouldEscalate: boolean = isAgeTriggered || isSeverityTriggered || isTimeoutTriggered;

    let reason = '';
    if (isAgeTriggered) reason += `Issue age (${daysSinceReport} days) exceeds threshold. `;
    if (isSeverityTriggered) reason += `High severity (${(severity * 100).toFixed(0)}%) requires escalation. `;
    if (isTimeoutTriggered)
      reason += `Resolution timeout (${daysSinceAssignment} days since assignment). `;

    const recommendedLevel = calculateEscalationLevel(isAgeTriggered, isSeverityTriggered, isTimeoutTriggered);

    return {
      should_escalate: shouldEscalate,
      reason: reason.trim() || 'No escalation needed at this time.',
      recommended_level: recommendedLevel,
    };
  } catch (error) {
    console.error('[AI] Escalation decision error:', error);
    throw error;
  }
}

function calculateEscalationLevel(
  isAgeTriggered: boolean,
  isSeverityTriggered: boolean,
  isTimeoutTriggered: boolean,
): number {
  let level = 0;

  if (isAgeTriggered) level += 1;
  if (isSeverityTriggered) level += 1;
  if (isTimeoutTriggered) level += 1;

  return Math.min(level, DEFAULT_ESCALATION_CRITERIA.escalation_levels);
}

export async function generateEscalationSummary(
  issue: Issue,
  daysSinceReport: number,
  assignedDepartment?: string,
  previousActions?: string[],
): Promise<string> {
  try {
    const severity = issue.ai_severity_score ? (issue.ai_severity_score * 100).toFixed(0) : 'N/A';

    let summary = `ESCALATION SUMMARY\n`;
    summary += `================\n\n`;
    summary += `Issue ID: ${issue.id}\n`;
    summary += `Title: ${issue.title}\n`;
    summary += `Category: ${issue.category}\n`;
    summary += `Severity: ${severity}%\n`;
    summary += `Days Since Report: ${daysSinceReport}\n`;
    summary += `Current Status: ${issue.status}\n`;
    summary += `Assigned Department: ${assignedDepartment || 'Unassigned'}\n\n`;

    if (previousActions && previousActions.length > 0) {
      summary += `Previous Actions:\n`;
      previousActions.forEach((action, i) => {
        summary += `  ${i + 1}. ${action}\n`;
      });
      summary += `\n`;
    }

    summary += `Escalation Reason:\n`;
    summary += `This issue requires escalation to senior authority due to:\n`;
    summary += `  - Extended resolution timeline\n`;
    summary += `  - High severity level\n`;
    summary += `  - Department responsiveness concerns\n\n`;

    summary += `Recommended Actions:\n`;
    summary += `  1. Senior authority review of issue\n`;
    summary += `  2. Department follow-up required\n`;
    summary += `  3. Community notification of escalation\n`;
    summary += `  4. Expedited resolution plan\n`;

    return summary;
  } catch (error) {
    console.error('[AI] Escalation summary generation error:', error);
    throw error;
  }
}

export async function determineEscalationRecipient(
  category: string,
  severity: number,
): Promise<{ recipient_title: string; recipient_department: string; urgency: string }> {
  try {
    let recipientTitle = 'Senior Authority';
    let urgency = 'High';

    if (severity > 0.85) {
      recipientTitle = 'Chief Officer';
      urgency = 'Critical';
    } else if (severity > 0.7) {
      recipientTitle = 'Deputy Chief';
      urgency = 'High';
    } else {
      urgency = 'Medium';
    }

    return {
      recipient_title: recipientTitle,
      recipient_department: 'Executive Office',
      urgency,
    };
  } catch (error) {
    console.error('[AI] Escalation recipient determination error:', error);
    throw error;
  }
}

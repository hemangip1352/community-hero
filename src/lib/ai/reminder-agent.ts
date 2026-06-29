/**
 * Reminder Agent Service
 * 
 * Manages reminder generation for unresolved issues.
 * Schedules follow-up notifications.
 * Tracks reminder history.
 */

import { Issue } from '@/types';

export interface ReminderSchedule {
  reminder_text: string;
  scheduled_for: Date;
  reminder_level: number;
  recipients: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export async function generateReminder(
  issue: Issue,
  daysSinceReport: number,
  departmentName: string,
): Promise<ReminderSchedule> {
  try {
    // Determine reminder level based on days since report
    let reminderLevel = 1;
    let daysUntilNext = 7;
    let priority: 'low' | 'medium' | 'high' | 'critical' = 'medium';

    if (daysSinceReport >= 21) {
      reminderLevel = 3;
      priority = 'critical';
      daysUntilNext = 2;
    } else if (daysSinceReport >= 14) {
      reminderLevel = 2;
      priority = 'high';
      daysUntilNext = 3;
    } else if (daysSinceReport >= 7) {
      reminderLevel = 1;
      priority = 'medium';
      daysUntilNext = 5;
    }

    const scheduledFor = new Date();
    scheduledFor.setDate(scheduledFor.getDate() + daysUntilNext);

    const reminderTexts: Record<number, string> = {
      1: `First reminder: Issue "${issue.title}" (${issue.category}) reported ${daysSinceReport} days ago remains unresolved. Please provide an update on progress.`,
      2: `Second reminder: Issue "${issue.title}" has been pending for ${daysSinceReport} days. Escalation is pending if not addressed. Please prioritize resolution.`,
      3: `Critical reminder: Issue "${issue.title}" has been escalated due to prolonged non-resolution (${daysSinceReport} days). Immediate action required from senior authority.`,
    };

    return {
      reminder_text: reminderTexts[reminderLevel],
      scheduled_for: scheduledFor,
      reminder_level: reminderLevel,
      recipients: ['department_head@' + departmentName.toLowerCase(), 'admin@cityhero.local'],
      priority,
    };
  } catch (error) {
    console.error('[AI] Reminder generation error:', error);
    throw error;
  }
}

export async function shouldSendReminder(
  lastReminderDate: Date | null,
  daysSinceReport: number,
): Promise<boolean> {
  try {
    if (!lastReminderDate) {
      // Send first reminder after 7 days
      return daysSinceReport >= 7;
    }

    const daysSinceLastReminder = Math.floor(
      (new Date().getTime() - lastReminderDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    // Send reminder based on reminder level
    if (daysSinceReport >= 21) {
      return daysSinceLastReminder >= 2; // Every 2 days for critical
    } else if (daysSinceReport >= 14) {
      return daysSinceLastReminder >= 3; // Every 3 days for high priority
    } else {
      return daysSinceLastReminder >= 5; // Every 5 days for normal
    }
  } catch (error) {
    console.error('[AI] Reminder check error:', error);
    throw error;
  }
}

export async function createReminderTemplate(
  issueCategory: string,
  urgency: string,
): Promise<string> {
  try {
    const templates: Record<string, Record<string, string>> = {
      Pothole: {
        low: 'Please repair the reported pothole at your earliest convenience.',
        medium: 'Road hazard present - pothole repair needed within 7 days.',
        high: 'Public safety concern - pothole repair required urgently.',
        critical: 'CRITICAL: Dangerous pothole requires immediate repair.',
      },
      Garbage: {
        low: 'Please clean up the reported trash at the location.',
        medium: 'Area cleanup needed within 3 days to maintain cleanliness.',
        high: 'Sanitation issue - urgent cleanup required.',
        critical: 'CRITICAL: Health hazard - immediate cleanup required.',
      },
      'Water Leakage': {
        low: 'Please inspect and address the reported water leak.',
        medium: 'Water loss reported - investigation and repair needed within 5 days.',
        high: 'Significant water waste detected - urgent repair required.',
        critical: 'CRITICAL: Major water loss - immediate action required.',
      },
      'Streetlight Failure': {
        low: 'Please repair the reported non-functional streetlight.',
        medium: 'Safety concern - streetlight repair needed within 7 days.',
        high: 'Public safety - streetlight repair urgent.',
        critical: 'CRITICAL: Safety hazard - immediate repair required.',
      },
      'Drainage Problem': {
        low: 'Please address the reported drainage issue.',
        medium: 'Drainage problem detected - repair or cleaning needed.',
        high: 'Flooding risk - urgent drainage repair required.',
        critical: 'CRITICAL: Flooding hazard - immediate action required.',
      },
      'Road Damage': {
        low: 'Please repair the reported road damage.',
        medium: 'Road integrity affected - repair needed within 7 days.',
        high: 'Public safety concern - urgent road repair needed.',
        critical: 'CRITICAL: Dangerous road hazard - immediate repair required.',
      },
    };

    return (
      templates[issueCategory]?.[urgency.toLowerCase()] ||
      `Please address the reported issue urgently as escalation is pending.`
    );
  } catch (error) {
    console.error('[AI] Reminder template creation error:', error);
    throw error;
  }
}

export async function calculateReminderSchedule(daysSinceReport: number): Promise<{
  next_reminder_days: number;
  reminder_level: number;
  escalation_days: number;
}> {
  try {
    let nextReminderDays = 7;
    let reminderLevel = 1;
    let escalationDays = 21;

    if (daysSinceReport >= 21) {
      nextReminderDays = 2;
      reminderLevel = 3;
    } else if (daysSinceReport >= 14) {
      nextReminderDays = 3;
      reminderLevel = 2;
    } else if (daysSinceReport >= 7) {
      nextReminderDays = 5;
      reminderLevel = 1;
    }

    return {
      next_reminder_days: nextReminderDays,
      reminder_level: reminderLevel,
      escalation_days: escalationDays,
    };
  } catch (error) {
    console.error('[AI] Reminder schedule calculation error:', error);
    throw error;
  }
}

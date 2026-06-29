/**
 * Issue Classifier Service
 * 
 * Classifies reported civic issues into standard categories.
 * Uses text analysis and metadata to determine issue type.
 * 
 * Categories:
 * - Pothole
 * - Garbage
 * - Water Leakage
 * - Streetlight Failure
 * - Drainage Problem
 * - Road Damage
 * - Other
 */

import { IssueCategory } from '@/types';

export interface ClassificationResult {
  category: IssueCategory;
  confidence: number;
  alternative_categories: Array<{ category: IssueCategory; confidence: number }>;
}

const CATEGORY_KEYWORDS: Record<IssueCategory, string[]> = {
  Pothole: ['pothole', 'hole', 'crater', 'pit', 'asphalt', 'road damage', 'uneven'],
  Garbage: ['garbage', 'trash', 'waste', 'litter', 'rubbish', 'debris', 'dump'],
  'Water Leakage': ['water', 'leak', 'leakage', 'pipe', 'flooding', 'wet', 'puddle'],
  'Streetlight Failure': ['light', 'streetlight', 'lamp', 'dark', 'broken', 'not working', 'electrical'],
  'Drainage Problem': ['drain', 'drainage', 'clogged', 'blocked', 'water flow', 'sewage'],
  'Road Damage': ['road', 'pavement', 'surface', 'crack', 'damage', 'broken', 'deteriorated'],
  Other: ['other', 'misc', 'issue'],
};

export async function classifyIssue(
  title: string,
  description: string,
): Promise<ClassificationResult> {
  try {
    const text = `${title} ${description}`.toLowerCase();
    const scores: Record<IssueCategory, number> = {} as Record<IssueCategory, number>;

    // Calculate scores based on keyword matches
    Object.entries(CATEGORY_KEYWORDS).forEach(([category, keywords]) => {
      const matches = keywords.filter(keyword => text.includes(keyword)).length;
      scores[category as IssueCategory] = (matches / keywords.length) * 100;
    });

    // Get top matches
    const sorted = Object.entries(scores)
      .sort(([, a], [, b]) => b - a)
      .map(([category, confidence]) => ({
        category: category as IssueCategory,
        confidence: Math.min(100, Math.max(0, confidence)) / 100,
      }));

    return {
      category: sorted[0].category,
      confidence: sorted[0].confidence,
      alternative_categories: sorted.slice(1, 3),
    };
  } catch (error) {
    console.error('[AI] Issue classification error:', error);
    throw error;
  }
}

export async function calculateSeverity(
  category: IssueCategory,
  description: string,
  urgency: 'low' | 'medium' | 'high' | 'critical',
): Promise<number> {
  try {
    // Severity multipliers by category
    const categoryMultipliers: Record<IssueCategory, number> = {
      Pothole: 0.8,
      Garbage: 0.5,
      'Water Leakage': 0.9,
      'Streetlight Failure': 0.6,
      'Drainage Problem': 0.7,
      'Road Damage': 0.75,
      Other: 0.4,
    };

    // Urgency multipliers
    const urgencyMultipliers: Record<string, number> = {
      low: 0.2,
      medium: 0.5,
      high: 0.8,
      critical: 1.0,
    };

    const baseScore = categoryMultipliers[category] || 0.5;
    const urgencyScore = urgencyMultipliers[urgency] || 0.5;

    return Math.min(1.0, (baseScore * 0.6 + urgencyScore * 0.4));
  } catch (error) {
    console.error('[AI] Severity calculation error:', error);
    throw error;
  }
}

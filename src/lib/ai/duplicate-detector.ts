/**
 * Duplicate Detection Service
 * 
 * Identifies potential duplicate reports by comparing:
 * - Geographic proximity
 * - Title/description similarity
 * - Category matching
 * - Temporal proximity
 */

import { DuplicateCheckResult } from '@/types';

const SIMILARITY_THRESHOLD = 0.7;
const DISTANCE_THRESHOLD_KM = 0.5;
const TIME_WINDOW_HOURS = 24;

export async function checkForDuplicates(
  title: string,
  description: string,
  latitude: number,
  longitude: number,
  existingIssues: Array<{
    id: string;
    title: string;
    description: string;
    latitude: number;
    longitude: number;
    created_at: string;
  }>,
): Promise<DuplicateCheckResult> {
  try {
    const duplicates = existingIssues
      .map(issue => {
        const titleSimilarity = calculateStringSimilarity(title, issue.title);
        const descriptionSimilarity = calculateStringSimilarity(description, issue.description);
        const locationDistance = calculateDistance(latitude, longitude, issue.latitude, issue.longitude);
        const isRecentEnough = isWithinTimeWindow(issue.created_at, TIME_WINDOW_HOURS);

        // Composite similarity score
        const textSimilarity = (titleSimilarity * 0.4 + descriptionSimilarity * 0.6);
        const proximityScore = locationDistance <= DISTANCE_THRESHOLD_KM ? 1.0 : 0;
        const compositeScore = textSimilarity * 0.6 + proximityScore * 0.4;

        return {
          id: issue.id,
          score: compositeScore,
          isRecent: isRecentEnough,
        };
      })
      .filter(item => item.score >= SIMILARITY_THRESHOLD || (item.isRecent && item.score >= 0.5))
      .sort((a, b) => b.score - a.score);

    return {
      is_potential_duplicate: duplicates.length > 0,
      duplicate_issue_ids: duplicates.map(d => d.id),
      similarity_scores: duplicates.map(d => d.score),
      reasoning: duplicates.length > 0
        ? `Found ${duplicates.length} similar report(s) in the area with similarity scores: ${duplicates.map(d => d.score.toFixed(2)).join(', ')}`
        : 'No duplicate reports found',
    };
  } catch (error) {
    console.error('[AI] Duplicate detection error:', error);
    throw error;
  }
}

function calculateStringSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();

  // Levenshtein distance-based similarity
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;

  if (longer.length === 0) return 1.0;

  const editDistance = getEditDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function getEditDistance(s1: string, s2: string): number {
  const costs = [];

  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }

  return costs[s2.length];
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  // Haversine formula for distance in kilometers
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function isWithinTimeWindow(createdAt: string, hoursWindow: number): boolean {
  const issueTime = new Date(createdAt).getTime();
  const nowTime = new Date().getTime();
  const diffHours = (nowTime - issueTime) / (1000 * 60 * 60);
  return diffHours <= hoursWindow;
}

/**
 * Verification Agent Service
 * 
 * Manages issue verification workflow.
 * Handles both AI and community verification.
 * Makes decisions on confidence thresholds.
 */

import { VerificationStatus } from '@/types';

export interface VerificationDecision {
  requires_community_verification: boolean;
  reasoning: string;
  recommended_actions: string[];
}

const CONFIDENCE_THRESHOLD_FOR_AUTO_VERIFY = 0.85;

export async function makeVerificationDecision(
  aiConfidenceScore: number,
  severityScore: number,
  hasMultipleSimilarReports: boolean,
): Promise<VerificationDecision> {
  try {
    const requiresCommunityVerification = aiConfidenceScore < CONFIDENCE_THRESHOLD_FOR_AUTO_VERIFY;

    const reasoning =
      aiConfidenceScore >= CONFIDENCE_THRESHOLD_FOR_AUTO_VERIFY
        ? `High confidence AI analysis (${(aiConfidenceScore * 100).toFixed(0)}%). Issue can proceed to verification.`
        : `Confidence score (${(aiConfidenceScore * 100).toFixed(0)}%) is below verification threshold. Community verification recommended.`;

    const actions: string[] = [];
    if (requiresCommunityVerification) {
      actions.push('Send verification request to community');
    }
    if (hasMultipleSimilarReports) {
      actions.push('Cross-reference with existing reports');
    }
    if (severityScore >= 0.8) {
      actions.push('Notify senior authority');
    }
    actions.push('Store verification details for audit trail');

    return {
      requires_community_verification: requiresCommunityVerification,
      reasoning,
      recommended_actions: actions,
    };
  } catch (error) {
    console.error('[AI] Verification decision error:', error);
    throw error;
  }
}

export async function evaluateVerificationEvidence(
  evidenceType: string,
  evidenceData: string,
): Promise<{ confidence: number; reasoning: string }> {
  try {
    // Placeholder for evidence evaluation logic
    // TODO: Implement machine learning-based evidence evaluation

    const confidenceByType: Record<string, number> = {
      photo: 0.8,
      video: 0.9,
      location_data: 0.6,
      timestamp: 0.5,
      user_reputation: 0.7,
    };

    const confidence = confidenceByType[evidenceType] || 0.5;

    return {
      confidence,
      reasoning: `${evidenceType} evidence evaluated with ${(confidence * 100).toFixed(0)}% confidence.`,
    };
  } catch (error) {
    console.error('[AI] Evidence evaluation error:', error);
    throw error;
  }
}

export async function determineVerificationStatus(
  aiVerified: boolean,
  communityVotes: number,
  communityVotesNeeded: number,
): Promise<VerificationStatus> {
  try {
    if (aiVerified) return 'confirmed';
    if (communityVotes >= communityVotesNeeded) return 'confirmed';
    if (communityVotes < 0 && Math.abs(communityVotes) > communityVotesNeeded / 2) return 'rejected';

    return 'pending';
  } catch (error) {
    console.error('[AI] Verification status determination error:', error);
    throw error;
  }
}

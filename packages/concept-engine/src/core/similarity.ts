import { SimilarityDecisionResult } from '../types';

export interface SimilarityThresholds {
  acceptMax: number;
  modifyMax: number;
}

const DEFAULT_THRESHOLDS: SimilarityThresholds = {
  acceptMax: 0.30,
  modifyMax: 0.60
};

export function decideSimilarity(
  score: number,
  thresholds: SimilarityThresholds = DEFAULT_THRESHOLDS
): SimilarityDecisionResult {
  if (score < 0 || score > 1) {
    throw new Error('Similarity score must be between 0 and 1');
  }

  if (score < thresholds.acceptMax) {
    return {
      score,
      decision: 'accept',
      reasons: ['Score is well below the similarity threshold, indicating a highly unique concept.']
    };
  }

  if (score <= thresholds.modifyMax) {
    return {
      score,
      decision: 'review', // equivalent to modify/review
      reasons: ['Score indicates moderate similarity to existing concepts. Review recommended to ensure distinction.']
    };
  }

  return {
    score,
    decision: 'reject',
    reasons: ['Score is too high, indicating this concept is fundamentally identical to an existing storyline.']
  };
}

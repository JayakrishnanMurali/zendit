import type {
  MLConfidence,
  MLServiceConfig,
} from '@/types';

// Default ML service configuration
export const DEFAULT_ML_CONFIG: MLServiceConfig = {
  useML: true,
  confidenceThreshold: 0.7,
  fallbackToRules: true,
};

// Utility functions for ML services
export function createMLConfidence(
  score: number,
  source: "ml" | "rules" | "hybrid" = "ml"
): MLConfidence {
  return {
    score: Math.max(0, Math.min(1, score)), // Clamp between 0 and 1
    source,
  };
}

export function shouldUseMlResult(
  confidence: MLConfidence,
  threshold: number = DEFAULT_ML_CONFIG.confidenceThreshold
): boolean {
  return confidence.score >= threshold;
}

export class MLServiceError extends Error {
  constructor(
    message: string,
    public readonly service: string,
    public readonly operation: string
  ) {
    super(`[${service}:${operation}] ${message}`);
    this.name = 'MLServiceError';
  }
}
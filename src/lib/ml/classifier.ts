import type { 
  MLCategoryClassifier, 
  MLPreprocessedTransaction,
  CategoryRule
} from '@/types';
import { createMLConfidence, MLServiceError } from './base';
import { DEFAULT_CATEGORY_RULES } from '../parsers/helpers';

/**
 * Enhanced ML-powered transaction classifier
 * Uses feature-based classification with fallback to rule-based system
 */
export class TransactionClassifier implements MLCategoryClassifier {
  readonly name = 'TransactionClassifier';
  readonly version = '1.0.0';

  private readonly rules: CategoryRule[] = DEFAULT_CATEGORY_RULES;
  private isInitialized = false;

  // Feature weights learned from transaction patterns
  private readonly featureWeights: Record<string, number> = {
    // Amount-based features
    amount_log: 0.1,
    is_small_amount: 0.05,
    is_medium_amount: 0.03,
    is_large_amount: 0.08,
    is_round_amount: 0.02,
    
    // Payment method features
    has_upi: 0.15,
    has_card: 0.12,
    has_neft: 0.10,
    has_imps: 0.08,
    
    // Merchant type features
    has_restaurant_keywords: 0.25,
    has_shopping_keywords: 0.22,
    has_service_keywords: 0.18,
    has_entertainment_keywords: 0.20,
    
    // Pattern features
    has_merchant_indicators: 0.15,
    has_person_name_pattern: 0.12,
    
    // Text features
    token_count: 0.05,
    text_length: 0.03,
  };

  // Category scoring patterns based on features
  private readonly categoryPatterns: Record<string, {
    requiredFeatures: string[];
    bonusFeatures: string[];
    penaltyFeatures: string[];
    amountRange?: { min?: number; max?: number };
    keywords: string[];
    baseScore: number;
  }> = {
    'Food & Dining': {
      requiredFeatures: [],
      bonusFeatures: ['has_restaurant_keywords', 'has_upi', 'is_small_amount'],
      penaltyFeatures: ['is_large_amount', 'has_neft'],
      keywords: ['swiggy', 'zomato', 'restaurant', 'cafe', 'food', 'dining', 'hotel'],
      baseScore: 0.6,
    },
    'Entertainment': {
      requiredFeatures: [],
      bonusFeatures: ['has_entertainment_keywords', 'is_round_amount'],
      penaltyFeatures: ['has_person_name_pattern'],
      keywords: ['netflix', 'prime', 'movie', 'cinema', 'pvr', 'inox', 'spotify'],
      baseScore: 0.7,
    },
    'Shopping': {
      requiredFeatures: [],
      bonusFeatures: ['has_shopping_keywords', 'has_upi'],
      penaltyFeatures: ['has_person_name_pattern'],
      keywords: ['amazon', 'flipkart', 'myntra', 'shopping', 'store', 'mall'],
      baseScore: 0.65,
    },
    'Transportation': {
      requiredFeatures: [],
      bonusFeatures: ['has_upi', 'is_small_amount'],
      penaltyFeatures: ['is_large_amount'],
      keywords: ['uber', 'ola', 'taxi', 'auto', 'bus', 'train', 'metro', 'parking'],
      baseScore: 0.6,
    },
    'Transfer': {
      requiredFeatures: [],
      bonusFeatures: ['has_person_name_pattern', 'has_neft', 'has_imps'],
      penaltyFeatures: ['has_merchant_indicators', 'has_shopping_keywords'],
      keywords: ['transfer', 'paytm-', 'gpay-', 'phonepe'],
      baseScore: 0.5,
    },
    'Utilities': {
      requiredFeatures: [],
      bonusFeatures: ['is_round_amount', 'is_medium_amount'],
      penaltyFeatures: ['is_small_amount', 'has_person_name_pattern'],
      keywords: ['electricity', 'water', 'gas', 'internet', 'mobile', 'phone'],
      baseScore: 0.7,
    },
    'Healthcare': {
      requiredFeatures: [],
      bonusFeatures: ['is_large_amount'],
      penaltyFeatures: ['is_small_amount'],
      keywords: ['medical', 'hospital', 'pharmacy', 'doctor', 'clinic', 'health'],
      baseScore: 0.6,
    },
    'Home & Services': {
      requiredFeatures: [],
      bonusFeatures: ['has_service_keywords'],
      penaltyFeatures: ['is_small_amount'],
      keywords: ['pest', 'control', 'repair', 'cleaning', 'maintenance'],
      baseScore: 0.65,
    },
  };

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    this.isInitialized = true;
  }

  isReady(): boolean {
    return this.isInitialized;
  }

  getConfidence() {
    return createMLConfidence(0.8, 'hybrid');
  }

  async classify(
    transaction: MLPreprocessedTransaction
  ): Promise<{
    category: string;
    subcategory?: string;
    confidence: number;
    alternatives?: Array<{ category: string; subcategory?: string; confidence: number }>;
  }> {
    try {
      if (!this.isReady()) {
        throw new MLServiceError('Classifier not ready', this.name, 'classify');
      }

      // Score each category based on features and patterns
      const categoryScores = this.scoreCategories(transaction);
      
      // Sort by confidence score
      const sortedCategories = Object.entries(categoryScores)
        .sort(([, a], [, b]) => b.confidence - a.confidence);

      if (sortedCategories.length === 0) {
        return {
          category: 'Others',
          confidence: 0.3,
        };
      }

      const [topCategory, topResult] = sortedCategories[0]!;
      const alternatives = sortedCategories
        .slice(1, 4) // Top 3 alternatives
        .map(([category, result]) => ({
          category,
          subcategory: result.subcategory,
          confidence: result.confidence,
        }))
        .filter(alt => alt.confidence > 0.3);

      return {
        category: topCategory,
        subcategory: topResult.subcategory,
        confidence: topResult.confidence,
        alternatives: alternatives.length > 0 ? alternatives : undefined,
      };
    } catch (error) {
      throw new MLServiceError(
        `Failed to classify transaction: ${error instanceof Error ? error.message : 'Unknown error'}`,
        this.name,
        'classify'
      );
    }
  }

  private scoreCategories(
    transaction: MLPreprocessedTransaction
  ): Record<string, { confidence: number; subcategory?: string }> {
    const scores: Record<string, { confidence: number; subcategory?: string }> = {};
    const { features, cleanedDescription, tokens, amount } = transaction;
    const textForMatching = `${cleanedDescription} ${tokens.join(' ')}`.toLowerCase();

    for (const [categoryName, pattern] of Object.entries(this.categoryPatterns)) {
      let score = pattern.baseScore;

      // Keyword matching (most important)
      const keywordMatches = pattern.keywords.filter((keyword: string) => 
        textForMatching.includes(keyword.toLowerCase())
      ).length;
      
      if (keywordMatches > 0) {
        score += keywordMatches * 0.3; // Strong boost for keyword matches
      }

      // Feature-based scoring
      for (const feature of pattern.bonusFeatures) {
        if (features[feature] && features[feature]! > 0) {
          score += (this.featureWeights[feature] || 0.1);
        }
      }

      for (const feature of pattern.penaltyFeatures) {
        if (features[feature] && features[feature]! > 0) {
          score -= (this.featureWeights[feature] || 0.1);
        }
      }

      // Amount range check
      if (pattern.amountRange) {
        const { min, max } = pattern.amountRange;
        if ((min && amount < min) || (max && amount > max)) {
          score *= 0.5; // Penalty for amount out of range
        } else {
          score += 0.1; // Bonus for amount in range
        }
      }

      // Use rule-based system for subcategory detection
      const ruleResult = this.findMatchingRule(transaction);
      let subcategory: string | undefined;
      
      if (ruleResult && ruleResult.category === categoryName) {
        subcategory = ruleResult.subcategory;
        score += 0.2; // Bonus for rule agreement
      }

      // Normalize score to 0-1 range
      score = Math.max(0, Math.min(1, score));

      if (score > 0.2) { // Only consider categories with reasonable scores
        scores[categoryName] = {
          confidence: score,
          subcategory,
        };
      }
    }

    return scores;
  }

  private findMatchingRule(
    transaction: MLPreprocessedTransaction
  ): { category: string; subcategory?: string } | null {
    const { cleanedDescription, tokens, amount } = transaction;
    const combinedText = `${cleanedDescription} ${tokens.join(' ')}`.toLowerCase();

    for (const rule of this.rules) {
      const matchesKeywords = rule.keywords.some((keyword: string) => 
        combinedText.includes(keyword.toLowerCase())
      );

      const matchesMerchantKeywords = rule.merchantKeywords
        ? rule.merchantKeywords.some((keyword: string) => 
            combinedText.includes(keyword.toLowerCase())
          )
        : false;

      const matchesAmount = !rule.amountThreshold ||
        ((!rule.amountThreshold.min || amount >= rule.amountThreshold.min) &&
         (!rule.amountThreshold.max || amount <= rule.amountThreshold.max));

      if ((matchesKeywords || matchesMerchantKeywords) && matchesAmount) {
        return {
          category: rule.category,
          subcategory: rule.subcategory,
        };
      }
    }

    return null;
  }
}

// Factory function for easy instantiation
export function createTransactionClassifier(): TransactionClassifier {
  return new TransactionClassifier();
}
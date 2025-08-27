import type {
  MLTransactionEnrichment,
  MLServiceConfig,
  MLCategoryPrediction,
  MLMerchantPrediction,
  MLConfidence,
} from "@/types";
import {
  DEFAULT_ML_CONFIG,
  createMLConfidence,
  shouldUseMlResult,
  MLServiceError,
} from "@/lib/ml/base";
import { TransactionTextPreprocessor } from "@/lib/ml/preprocessor";
import { TransactionClassifier } from "@/lib/ml/classifier";
import { EnhancedMerchantExtractor } from "@/lib/ml/merchant-extractor";
import {
  categorizeTransaction,
  determinePaymentMethod,
  generateTags,
  extractNotes,
  extractMerchant,
  normalizeMerchantName,
  MERCHANT_NORMALIZATIONS,
} from "@/lib/parsers/helpers";

/**
 * ML Pipeline orchestrator that combines all ML services
 * Provides intelligent fallback to rule-based systems
 */
export class MLTransactionPipeline {
  private readonly config: MLServiceConfig;
  private readonly preprocessor: TransactionTextPreprocessor;
  private readonly classifier: TransactionClassifier;
  private readonly merchantExtractor: EnhancedMerchantExtractor;

  constructor(config: Partial<MLServiceConfig> = {}) {
    this.config = { ...DEFAULT_ML_CONFIG, ...config };

    // Initialize ML services
    this.preprocessor = new TransactionTextPreprocessor();
    this.classifier = new TransactionClassifier();
    this.merchantExtractor = new EnhancedMerchantExtractor();
  }

  /**
   * Check if all ML services are ready
   */
  isReady(): boolean {
    return (
      this.preprocessor.isReady() &&
      this.classifier.isReady() &&
      this.merchantExtractor.isReady()
    );
  }

  /**
   * Main enrichment method that orchestrates all ML services
   */
  async enrichTransaction(
    description: string,
    amount: number,
    type: "debit" | "credit"
  ): Promise<MLTransactionEnrichment> {
    try {
      if (!this.isReady()) {
        return this.fallbackToRules(description, amount, type);
      }

      // Step 1: Preprocess transaction
      const preprocessed = this.preprocessor.preprocess(
        description,
        amount,
        type
      );

      // Step 2: Extract merchant information (in parallel with classification)
      const [mlMerchantResult, mlCategoryResult] = await Promise.all([
        this.extractMerchantWithFallback(description, amount),
        this.classifyWithFallback(preprocessed, description, amount),
      ]);

      // Step 3: Determine payment method and other attributes
      const paymentMethod = determinePaymentMethod(description);
      const isRecurring = this.determineRecurring(
        preprocessed,
        mlCategoryResult
      );
      const tags = this.generateEnhancedTags(
        description,
        mlMerchantResult.merchant,
        mlCategoryResult.category,
        amount,
        paymentMethod
      );
      const notes = extractNotes(description);

      // Step 4: Calculate overall confidence
      const overallConfidence = this.calculateOverallConfidence(
        mlMerchantResult.confidence,
        mlCategoryResult.confidence
      );

      return {
        category: mlCategoryResult,
        merchant: mlMerchantResult,
        paymentMethod,
        isRecurring,
        tags,
        notes,
        confidence: overallConfidence,
      };
    } catch (error) {
      console.warn("ML pipeline failed, falling back to rules:", error);
      return this.fallbackToRules(description, amount, type);
    }
  }

  /**
   * Extract merchant with intelligent fallback
   */
  private async extractMerchantWithFallback(
    description: string,
    amount?: number
  ): Promise<MLMerchantPrediction> {
    try {
      if (this.config.useML && this.merchantExtractor.isReady()) {
        const result = await this.merchantExtractor.extractMerchant(
          description,
          amount
        );

        if (
          shouldUseMlResult(
            { score: result.confidence, source: "ml" },
            this.config.confidenceThreshold
          )
        ) {
          return {
            merchant: result.merchant,
            normalizedMerchant: result.normalizedMerchant,
            confidence: createMLConfidence(result.confidence, "ml"),
            extractionMethod: result.extractionMethod,
          };
        }
      }
    } catch (error) {
      console.warn("ML merchant extraction failed:", error);
    }

    // Fallback to rule-based extraction
    if (this.config.fallbackToRules) {
      return this.fallbackMerchantExtraction(description);
    }

    return {
      merchant: "Unknown",
      normalizedMerchant: "Unknown",
      confidence: createMLConfidence(0.1, "rules"),
      extractionMethod: "fallback",
    };
  }

  /**
   * Classify transaction with intelligent fallback
   */
  private async classifyWithFallback(
    preprocessed: any,
    description: string,
    amount: number
  ): Promise<MLCategoryPrediction> {
    try {
      if (this.config.useML && this.classifier.isReady()) {
        const result = await this.classifier.classify(preprocessed);

        if (
          shouldUseMlResult(
            { score: result.confidence, source: "ml" },
            this.config.confidenceThreshold
          )
        ) {
          return {
            category: result.category,
            subcategory: result.subcategory,
            confidence: createMLConfidence(result.confidence, "ml"),
            alternativeCategories: result.alternatives,
          };
        }
      }
    } catch (error) {
      console.warn("ML classification failed:", error);
    }

    // Fallback to rule-based classification
    if (this.config.fallbackToRules) {
      return this.fallbackClassification(description, amount);
    }

    return {
      category: "Others",
      confidence: createMLConfidence(0.3, "rules"),
    };
  }

  /**
   * Fallback to complete rule-based processing
   */
  private fallbackToRules(
    description: string,
    amount: number,
    type: "debit" | "credit"
  ): MLTransactionEnrichment {
    // Use existing rule-based helpers
    const merchantResult = this.fallbackMerchantExtraction(description);
    const categoryResult = this.fallbackClassification(description, amount);

    const paymentMethod = determinePaymentMethod(description);
    const isRecurring = this.isTransactionRecurring(
      description,
      categoryResult.category
    );
    const tags = generateTags(
      description,
      merchantResult.merchant,
      categoryResult.category,
      amount
    );
    const notes = extractNotes(description);

    return {
      category: categoryResult,
      merchant: merchantResult,
      paymentMethod,
      isRecurring,
      tags,
      notes,
      confidence: createMLConfidence(0.6, "rules"),
    };
  }

  private fallbackMerchantExtraction(
    description: string
  ): MLMerchantPrediction {
    // Import and use existing merchant extraction logic

    const merchant = extractMerchant(description);
    const normalizedMerchant = normalizeMerchantName(
      merchant,
      MERCHANT_NORMALIZATIONS
    );

    return {
      merchant,
      normalizedMerchant,
      confidence: createMLConfidence(
        merchant === "Unknown" ? 0.3 : 0.6,
        "rules"
      ),
      extractionMethod: merchant === "Unknown" ? "fallback" : "pattern",
    };
  }

  private fallbackClassification(
    description: string,
    amount: number
  ): MLCategoryPrediction {
    const merchant = this.fallbackMerchantExtraction(description).merchant;
    const result = categorizeTransaction(description, merchant, amount);

    return {
      category: result.category,
      subcategory: result.subcategory,
      confidence: createMLConfidence(
        result.category === "Others" ? 0.4 : 0.7,
        "rules"
      ),
    };
  }

  private determineRecurring(
    preprocessed: any,
    categoryResult: MLCategoryPrediction
  ): boolean {
    // Check features for recurring patterns
    const features = preprocessed.features;

    // High confidence indicators of recurring transactions
    if (features.has_entertainment_keywords && features.is_round_amount)
      return true;
    if (features.has_service_keywords && features.is_medium_amount) return true;

    // Category-based recurring detection
    const recurringCategories = ["Utilities", "Finance"];
    if (recurringCategories.includes(categoryResult.category)) return true;

    // Entertainment subscriptions
    if (
      categoryResult.category === "Entertainment" &&
      categoryResult.subcategory === "Streaming Services"
    )
      return true;

    return false;
  }

  private isTransactionRecurring(
    description: string,
    category: string
  ): boolean {
    const recurringKeywords = [
      "monthly",
      "subscription",
      "emi",
      "loan",
      "netflix",
      "prime",
    ];
    const desc = description.toLowerCase();

    return (
      recurringKeywords.some((keyword) => desc.includes(keyword)) ||
      ["Utilities", "Finance"].includes(category)
    );
  }

  private generateEnhancedTags(
    description: string,
    merchant: string,
    category: string,
    amount: number,
    paymentMethod: string
  ): string[] {
    // Start with rule-based tags
    const baseTags = generateTags(description, merchant, category, amount);

    // Add ML-enhanced tags
    const enhancedTags = new Set(baseTags);

    // Add confidence-based tags
    enhancedTags.add("ml-enhanced");

    // Add payment method specific tags
    if (paymentMethod === "UPI") enhancedTags.add("digital-payment");
    if (paymentMethod === "Card") enhancedTags.add("card-payment");

    // Add amount-based insights
    if (amount > 10000) enhancedTags.add("high-value");
    if (amount % 100 === 0 && amount >= 1000)
      enhancedTags.add("round-amount-large");

    // Add merchant insights - keep it simple without assumptions
    if (merchant !== "Unknown" && merchant.length > 2) {
      enhancedTags.add("merchant-identified");
    }

    return Array.from(enhancedTags);
  }

  private calculateOverallConfidence(
    merchantConfidence: MLConfidence,
    categoryConfidence: MLConfidence
  ): MLConfidence {
    // Weighted average of confidences
    const merchantWeight = 0.4;
    const categoryWeight = 0.6;

    const overallScore =
      merchantConfidence.score * merchantWeight +
      categoryConfidence.score * categoryWeight;

    // Determine source based on components
    let source: "ml" | "rules" | "hybrid" = "hybrid";
    if (
      merchantConfidence.source === "ml" &&
      categoryConfidence.source === "ml"
    ) {
      source = "ml";
    } else if (
      merchantConfidence.source === "rules" &&
      categoryConfidence.source === "rules"
    ) {
      source = "rules";
    }

    return createMLConfidence(overallScore, source);
  }

  /**
   * Get pipeline statistics and health
   */
  getStats(): {
    isReady: boolean;
    config: MLServiceConfig;
    services: {
      preprocessor: boolean;
      classifier: boolean;
      merchantExtractor: boolean;
    };
  } {
    return {
      isReady: this.isReady(),
      config: this.config,
      services: {
        preprocessor: this.preprocessor.isReady(),
        classifier: this.classifier.isReady(),
        merchantExtractor: this.merchantExtractor.isReady(),
      },
    };
  }
}

// Factory function for easy instantiation
export function createMLPipeline(
  config?: Partial<MLServiceConfig>
): MLTransactionPipeline {
  return new MLTransactionPipeline(config);
}

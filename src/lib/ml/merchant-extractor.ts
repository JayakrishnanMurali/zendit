import compromise from "compromise";
import type { MLMerchantExtractor } from "@/types";
import { createMLConfidence, MLServiceError } from "./base";
import {
  UPI_MERCHANT_PATTERNS,
  MERCHANT_NORMALIZATIONS,
  extractMerchant as extractMerchantRules,
  normalizeMerchantName,
} from "../parsers/helpers";
import type { MerchantPattern } from "../parsers/helpers";

/**
 * Enhanced ML-powered merchant extractor
 * Combines pattern matching, NLP, and machine learning for better merchant identification
 */
export class EnhancedMerchantExtractor implements MLMerchantExtractor {
  readonly name = "EnhancedMerchantExtractor";
  readonly version = "1.0.0";

  private isInitialized = false;

  // Enhanced patterns for better merchant extraction
  private readonly enhancedPatterns: MerchantPattern[] = [
    // Original UPI patterns
    ...UPI_MERCHANT_PATTERNS,

    // Enhanced patterns for better extraction
    {
      regex: /(?:UPI\/|BHQR\/|GPAY-|PAYTM-)([^\/\s]+)(?:[\/\s].*)?$/i,
      extractGroup: 1,
      cleanup: (name) =>
        name
          .replace(/\s*(REST|H|CO|PVT|LTD|SOLUTIONS?|SOL|INDIA|IND)$/i, "")
          .trim(),
    },

    // Card payment patterns
    {
      regex: /CARD\s+PAYMENT\s+(?:TO\s+)?([^\/\n]+)(?:\/.*)?$/i,
      extractGroup: 1,
    },

    // Bill payment patterns
    {
      regex: /BIL\/([^\/]+)\/([^\/]+)/i,
      extractGroup: 2,
      cleanup: (name) => name.replace(/\s*(BILL|PAYMENT|PAY).*$/i, "").trim(),
    },

    // Online payment patterns
    {
      regex:
        /(?:ONLINE\s+)?PAYMENT\s+(?:TO\s+)?([A-Za-z][^\/\n]+?)(?:\s+(?:VIA|THROUGH).*)?$/i,
      extractGroup: 1,
    },

    // Transfer patterns
    {
      regex: /(?:TRANSFER\s+)?TO\s+([^\/\n]+?)(?:\s+(?:A\/C|ACCOUNT).*)?$/i,
      extractGroup: 1,
    },
  ];

  // ML-based merchant type classification
  private readonly merchantTypePatterns = {
    restaurant: {
      keywords: [
        "restaurant",
        "cafe",
        "hotel",
        "dining",
        "food",
        "kitchen",
        "canteen",
      ],
      suffixes: ["rest", "hotel", "cafe", "kitchen"],
      confidence: 0.8,
    },
    retail: {
      keywords: [
        "store",
        "shop",
        "mart",
        "market",
        "supermarket",
        "hypermarket",
      ],
      suffixes: ["store", "mart", "market"],
      confidence: 0.75,
    },
    service: {
      keywords: ["services", "solutions", "consulting", "tech", "software"],
      suffixes: ["services", "solutions", "tech", "sol"],
      confidence: 0.7,
    },
    entertainment: {
      keywords: ["cinema", "movie", "entertainment", "games", "sports"],
      suffixes: ["cinema", "movies", "entertainment"],
      confidence: 0.8,
    },
    healthcare: {
      keywords: ["hospital", "clinic", "medical", "pharmacy", "health"],
      suffixes: ["hospital", "clinic", "medical", "pharmacy"],
      confidence: 0.9,
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
    return createMLConfidence(0.85, "hybrid");
  }

  async extractMerchant(
    description: string,
    amount?: number
  ): Promise<{
    merchant: string;
    normalizedMerchant: string;
    confidence: number;
    extractionMethod: "pattern" | "ml" | "fallback";
  }> {
    try {
      if (!this.isReady()) {
        throw new MLServiceError(
          "Merchant extractor not ready",
          this.name,
          "extractMerchant"
        );
      }

      // Try enhanced pattern-based extraction first
      const patternResult = this.extractWithPatterns(description);
      if (patternResult.confidence > 0.7) {
        return patternResult;
      }

      // Try ML-enhanced extraction
      const mlResult = await this.extractWithML(description, amount);
      if (mlResult.confidence > 0.6) {
        return mlResult;
      }

      // Fallback to rule-based extraction
      const fallbackResult = this.extractWithFallback(description);
      return fallbackResult;
    } catch (error) {
      throw new MLServiceError(
        `Failed to extract merchant: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        this.name,
        "extractMerchant"
      );
    }
  }

  private extractWithPatterns(description: string): {
    merchant: string;
    normalizedMerchant: string;
    confidence: number;
    extractionMethod: "pattern" | "ml" | "fallback";
  } {
    const cleanDesc = description.trim();

    // Try enhanced patterns
    for (const pattern of this.enhancedPatterns) {
      const match = cleanDesc.match(pattern.regex);
      if (match && match[pattern.extractGroup]) {
        let merchant = match[pattern.extractGroup]?.trim() || "";

        // Apply pattern-specific cleanup
        if (pattern.cleanup && merchant) {
          merchant = pattern.cleanup(merchant);
        }

        if (merchant && merchant.length > 1) {
          const normalizedMerchant = normalizeMerchantName(
            merchant,
            MERCHANT_NORMALIZATIONS
          );
          const confidence = this.calculatePatternConfidence(
            merchant,
            description
          );

          return {
            merchant,
            normalizedMerchant,
            confidence,
            extractionMethod: "pattern",
          };
        }
      }
    }

    // Try original rule-based patterns as fallback
    const rulesMerchant = extractMerchantRules(description);
    if (rulesMerchant && rulesMerchant !== "Unknown") {
      return {
        merchant: rulesMerchant,
        normalizedMerchant: normalizeMerchantName(
          rulesMerchant,
          MERCHANT_NORMALIZATIONS
        ),
        confidence: 0.6,
        extractionMethod: "pattern",
      };
    }

    return {
      merchant: "Unknown",
      normalizedMerchant: "Unknown",
      confidence: 0.1,
      extractionMethod: "fallback",
    };
  }

  private async extractWithML(
    description: string,
    _amount?: number
  ): Promise<{
    merchant: string;
    normalizedMerchant: string;
    confidence: number;
    extractionMethod: "pattern" | "ml" | "fallback";
  }> {
    // Use NLP for better merchant extraction
    const nlp = compromise(description);

    // Extract potential merchant names using NLP
    const places = nlp.places().out("array");
    const organizations = nlp.organizations().out("array");
    const people = nlp.people().out("array");

    const candidates: Array<{ name: string; score: number; type: string }> = [];

    // Score place names (likely to be businesses)
    for (const place of places) {
      const score = this.scoreMerchantCandidate(place, description, "place");
      if (score > 0.3) {
        candidates.push({ name: place, score, type: "place" });
      }
    }

    // Score organizations
    for (const org of organizations) {
      const score = this.scoreMerchantCandidate(
        org,
        description,
        "organization"
      );
      if (score > 0.3) {
        candidates.push({ name: org, score, type: "organization" });
      }
    }

    // Score people names (for personal transfers)
    for (const person of people) {
      const score = this.scoreMerchantCandidate(person, description, "person");
      if (score > 0.3) {
        candidates.push({ name: person, score, type: "person" });
      }
    }

    // Extract capitalized words as potential merchants
    const capitalizedWords = description.match(/\b[A-Z][A-Z\s]{2,}\b/g) || [];
    for (const word of capitalizedWords) {
      const cleanWord = word.trim();
      if (cleanWord.length > 2) {
        const score = this.scoreMerchantCandidate(
          cleanWord,
          description,
          "capitalized"
        );
        if (score > 0.4) {
          candidates.push({ name: cleanWord, score, type: "capitalized" });
        }
      }
    }

    // Select best candidate
    if (candidates.length > 0) {
      const bestCandidate = candidates.sort((a, b) => b.score - a.score)[0]!;
      const normalizedMerchant = normalizeMerchantName(
        bestCandidate.name,
        MERCHANT_NORMALIZATIONS
      );

      return {
        merchant: bestCandidate.name,
        normalizedMerchant,
        confidence: bestCandidate.score,
        extractionMethod: "ml",
      };
    }

    return {
      merchant: "Unknown",
      normalizedMerchant: "Unknown",
      confidence: 0.2,
      extractionMethod: "ml",
    };
  }

  private extractWithFallback(_description: string): {
    merchant: string;
    normalizedMerchant: string;
    confidence: number;
    extractionMethod: "pattern" | "ml" | "fallback";
  } {
    // No fallback extraction - return Unknown
    return {
      merchant: "Unknown",
      normalizedMerchant: "Unknown",
      confidence: 0.1,
      extractionMethod: "fallback",
    };
  }

  private calculatePatternConfidence(
    merchant: string,
    _description: string
  ): number {
    let confidence = 0.7; // Base confidence for pattern match

    // Boost confidence based on merchant characteristics
    if (merchant.length > 5) confidence += 0.1;
    if (/^[A-Z][a-z]/.test(merchant)) confidence += 0.05; // Proper case
    if (merchant.split(" ").length > 1) confidence += 0.1; // Multi-word

    // Check if merchant type is recognizable
    const merchantType = this.identifyMerchantType(merchant.toLowerCase());
    if (merchantType) {
      confidence += merchantType.confidence * 0.2;
    }

    // Check normalization match
    const normalized = normalizeMerchantName(merchant, MERCHANT_NORMALIZATIONS);
    if (normalized !== merchant) {
      confidence += 0.15; // Boost for recognized merchants
    }

    return Math.min(1, confidence);
  }

  private scoreMerchantCandidate(
    candidate: string,
    _description: string,
    type: "place" | "organization" | "person" | "capitalized"
  ): number {
    let score = 0.4; // Base score

    // Type-based scoring
    switch (type) {
      case "organization":
        score += 0.3;
        break;
      case "place":
        score += 0.25;
        break;
      case "capitalized":
        score += 0.2;
        break;
      case "person":
        score += 0.15;
        break;
    }

    // Length-based scoring
    if (candidate.length > 8) score += 0.1;
    if (candidate.length < 3) score -= 0.3;

    // Check for business indicators
    const businessIndicators = [
      "pvt",
      "ltd",
      "co",
      "inc",
      "corp",
      "services",
      "solutions",
    ];
    const hasBusinessIndicator = businessIndicators.some((indicator) =>
      candidate.toLowerCase().includes(indicator)
    );
    if (hasBusinessIndicator) score += 0.2;

    // Check merchant type
    const merchantType = this.identifyMerchantType(candidate.toLowerCase());
    if (merchantType) {
      score += merchantType.confidence * 0.15;
    }

    // Penalize if looks like transaction ID or system text
    if (/^[A-Z]{3}\d+/.test(candidate) || /\d{6,}/.test(candidate)) {
      score -= 0.4;
    }

    return Math.max(0, Math.min(1, score));
  }

  private identifyMerchantType(
    merchant: string
  ): { type: string; confidence: number } | null {
    for (const [type, pattern] of Object.entries(this.merchantTypePatterns)) {
      // Check keywords
      const keywordMatch = pattern.keywords.some((keyword) =>
        merchant.includes(keyword)
      );
      if (keywordMatch) {
        return { type, confidence: pattern.confidence };
      }

      // Check suffixes
      const suffixMatch = pattern.suffixes.some((suffix) =>
        merchant.endsWith(suffix)
      );
      if (suffixMatch) {
        return { type, confidence: pattern.confidence * 0.8 };
      }
    }

    return null;
  }
}

// Factory function for easy instantiation
export function createEnhancedMerchantExtractor(): EnhancedMerchantExtractor {
  return new EnhancedMerchantExtractor();
}

import compromise from 'compromise';
import type { MLTextPreprocessor, MLPreprocessedTransaction } from '@/types';
import { createMLConfidence, MLServiceError } from './base';

/**
 * Advanced text preprocessor for transaction descriptions
 * Uses NLP to extract meaningful features and clean text
 */
export class TransactionTextPreprocessor implements MLTextPreprocessor {
  readonly name = 'TransactionTextPreprocessor';
  readonly version = '1.0.0';

  private readonly stopWords = new Set([
    'upi', 'bank', 'icici', 'hdfc', 'axis', 'yes', 'sbi', 'state',
    'to', 'from', 'transfer', 'payment', 'monthly', 'au', 'generating',
    'bil', 'imps', 'neft', 'rtgs', 'dr', 'cr', 'the', 'and', 'or', 'in', 'on', 'at'
  ]);

  private readonly importantPrefixes = [
    'upi/', 'bil/', 'imps/', 'neft/', 'rtgs/', 'bhqr/', 'gpay-', 'paytm-'
  ];

  private readonly merchantIndicators = [
    'pvt', 'ltd', 'co', 'inc', 'corp', 'restaurant', 'cafe', 'supermarket',
    'store', 'mall', 'shop', 'services', 'solutions', 'hotel', 'booking'
  ];

  isReady(): boolean {
    return true; // Simple preprocessor is always ready
  }

  getConfidence() {
    return createMLConfidence(0.95, 'rules'); // High confidence for preprocessing
  }

  preprocess(
    description: string,
    amount: number,
    type: "debit" | "credit"
  ): MLPreprocessedTransaction {
    try {
      const cleanedDescription = this.cleanDescription(description);
      const tokens = this.tokenize(cleanedDescription);
      const features = this.extractFeatures(tokens, amount);

      return {
        originalDescription: description,
        cleanedDescription,
        tokens,
        features,
        amount,
        type,
      };
    } catch (error) {
      throw new MLServiceError(
        `Failed to preprocess transaction: ${error instanceof Error ? error.message : 'Unknown error'}`,
        this.name,
        'preprocess'
      );
    }
  }

  private cleanDescription(description: string): string {
    return description
      // Remove system-generated text
      .replace(/This is a system-generated statement\.?\s*/gi, '')
      .replace(/Hence,?\s*it does not require any signature\.?\s*/gi, '')
      .replace(/\s*Page \d+\s*/gi, '')
      .replace(/signature\.\s*Page\s*\d+/gi, '')
      // Normalize case and whitespace
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  private tokenize(text: string): string[] {
    // Use compromise for smarter tokenization
    const nlp = compromise(text);
    
    // Extract different types of tokens
    const tokens: string[] = [];
    
    // Get basic words, excluding stop words
    const terms = nlp.terms().out('array');
    const words = terms
      .map((word: string) => word.replace(/[^\w\-]/g, ''))
      .filter((word: string) => word.length > 2 && !this.stopWords.has(word.toLowerCase()));
    
    tokens.push(...words);

    // Extract special patterns
    const specialPatterns = text.match(/\b[A-Z]{2,}[A-Z0-9]*\b/g) || [];
    tokens.push(...specialPatterns);

    // Extract payment method indicators
    for (const prefix of this.importantPrefixes) {
      if (text.includes(prefix)) {
        tokens.push(prefix.replace('/', ''));
      }
    }

    // Extract amounts and numbers
    const numbers = text.match(/\d+/g) || [];
    tokens.push(...numbers.filter(num => num.length >= 3));

    return Array.from(new Set(tokens)).filter(token => token.length > 0);
  }

  extractFeatures(tokens: string[], amount: number): Record<string, number> {
    const features: Record<string, number> = {};

    // Basic features
    features.token_count = tokens.length;
    features.amount = amount;
    features.amount_log = Math.log10(amount + 1);

    // Amount-based features
    features.is_small_amount = amount < 100 ? 1 : 0;
    features.is_medium_amount = amount >= 100 && amount <= 5000 ? 1 : 0;
    features.is_large_amount = amount > 5000 ? 1 : 0;
    features.is_round_amount = amount % 100 === 0 ? 1 : 0;

    // Payment method features
    features.has_upi = tokens.some(token => token.toLowerCase().includes('upi')) ? 1 : 0;
    features.has_card = tokens.some(token => token.toLowerCase().includes('card')) ? 1 : 0;
    features.has_neft = tokens.some(token => token.toLowerCase().includes('neft')) ? 1 : 0;
    features.has_imps = tokens.some(token => token.toLowerCase().includes('imps')) ? 1 : 0;
    features.has_rtgs = tokens.some(token => token.toLowerCase().includes('rtgs')) ? 1 : 0;

    // Merchant type features
    features.has_restaurant_keywords = this.hasKeywords(tokens, ['restaurant', 'cafe', 'hotel', 'dining']) ? 1 : 0;
    features.has_shopping_keywords = this.hasKeywords(tokens, ['store', 'mall', 'shopping', 'amazon', 'flipkart']) ? 1 : 0;
    features.has_service_keywords = this.hasKeywords(tokens, ['services', 'solutions', 'booking']) ? 1 : 0;
    features.has_entertainment_keywords = this.hasKeywords(tokens, ['netflix', 'movie', 'cinema', 'pvr']) ? 1 : 0;

    // Pattern-based features
    features.has_merchant_indicators = this.hasKeywords(tokens, this.merchantIndicators) ? 1 : 0;
    features.has_person_name_pattern = this.looksLikePersonName(tokens) ? 1 : 0;
    
    // Text length and complexity
    const combinedText = tokens.join(' ');
    features.text_length = combinedText.length;
    features.avg_token_length = tokens.length > 0 ? combinedText.length / tokens.length : 0;
    features.has_numbers = /\d/.test(combinedText) ? 1 : 0;
    features.has_special_chars = /[\/\-_]/.test(combinedText) ? 1 : 0;

    return features;
  }

  private hasKeywords(tokens: string[], keywords: string[]): boolean {
    const tokenText = tokens.join(' ').toLowerCase();
    return keywords.some(keyword => tokenText.includes(keyword));
  }

  private looksLikePersonName(tokens: string[]): boolean {
    // Simple heuristic: 1-3 capitalized words, no business indicators
    if (tokens.length === 0 || tokens.length > 3) return false;
    
    const hasBusinessKeywords = this.hasKeywords(tokens, this.merchantIndicators);
    const hasLongNumbers = tokens.some(token => /\d{4,}/.test(token));
    
    return !hasBusinessKeywords && !hasLongNumbers;
  }
}
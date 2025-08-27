export interface Transaction {
  id: string;
  date: Date;
  amount: number;
  description: string;
  type: "debit" | "credit";
  category: string;
  subcategory?: string;
  merchant?: string;
  account: string;
  paymentMethod: string;
  isRecurring: boolean;
  tags: string[];
  notes?: string;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type SupportedBank = "ICICI" | "UNKNOWN";

export interface PdfParseResult {
  bank: SupportedBank;
  transactions: Transaction[];
  warnings: string[];
}

export interface WorkerProgress {
  kind: "progress";
  progressPercent: number; // 0..100
  message?: string;
}

export interface WorkerComplete {
  kind: "complete";
  result: PdfParseResult;
}

export interface WorkerError {
  kind: "error";
  message: string;
}

export type PdfWorkerOutboundMessage =
  | WorkerProgress
  | WorkerComplete
  | WorkerError;

export type PdfWorkerInboundMessage =
  | { kind: "parse"; fileName: string; fileBuffer: ArrayBuffer }
  | { kind: "cancel" };

export type PdfParserResult = {
  bank: SupportedBank;
  canParse: (bytes: Uint8Array, fileName: string) => Promise<boolean> | boolean;
  parse: (
    bytes: Uint8Array,
    emitProgress: (progressPercent: number, message?: string) => void
  ) => Promise<PdfParseResult>;
};

// ML-related types
export interface MLConfidence {
  score: number; // 0-1, higher is more confident
  source: "ml" | "rules" | "hybrid";
}

export interface MLCategoryPrediction {
  category: string;
  subcategory?: string;
  confidence: MLConfidence;
  alternativeCategories?: Array<{
    category: string;
    subcategory?: string;
    confidence: number;
  }>;
}

export interface MLMerchantPrediction {
  merchant: string;
  normalizedMerchant: string;
  confidence: MLConfidence;
  extractionMethod: "pattern" | "ml" | "fallback";
}

export interface MLTransactionEnrichment {
  category: MLCategoryPrediction;
  merchant: MLMerchantPrediction;
  paymentMethod: string;
  isRecurring: boolean;
  tags: string[];
  notes?: string;
  confidence: MLConfidence;
}

export interface MLPreprocessedTransaction {
  originalDescription: string;
  cleanedDescription: string;
  tokens: string[];
  features: Record<string, number>;
  amount: number;
  type: "debit" | "credit";
}

export interface MLServiceConfig {
  useML: boolean;
  confidenceThreshold: number; // Minimum confidence to use ML results
  fallbackToRules: boolean;
  modelPath?: string;
}

// Base interface for ML services  
export interface MLService {
  readonly name: string;
  readonly version: string;
  isReady(): boolean;
  getConfidence(): MLConfidence;
}

export interface MLCategoryClassifier extends MLService {
  classify(
    transaction: MLPreprocessedTransaction
  ): Promise<{
    category: string;
    subcategory?: string;
    confidence: number;
    alternatives?: Array<{ category: string; subcategory?: string; confidence: number }>;
  }>;
}

export interface MLMerchantExtractor extends MLService {
  extractMerchant(
    description: string,
    amount?: number
  ): Promise<{
    merchant: string;
    normalizedMerchant: string;
    confidence: number;
    extractionMethod: "pattern" | "ml" | "fallback";
  }>;
}

export interface MLTextPreprocessor extends MLService {
  preprocess(
    description: string,
    amount: number,
    type: "debit" | "credit"
  ): MLPreprocessedTransaction;
  
  extractFeatures(tokens: string[], amount: number): Record<string, number>;
}

// Category rule interface
export interface CategoryRule {
  keywords: string[];
  merchantKeywords?: string[];
  category: string;
  subcategory?: string;
  isRecurring?: boolean;
  amountThreshold?: { min?: number; max?: number };
}

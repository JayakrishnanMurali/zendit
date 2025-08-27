import type { Transaction } from "@/types";

// ============================================================================
// ENHANCED MERCHANT EXTRACTION HELPERS
// ============================================================================

export interface MerchantPattern {
  regex: RegExp;
  extractGroup: number;
  cleanup?: (name: string) => string;
}

// Conservative merchant patterns - no assumptive cleanup
export const UPI_MERCHANT_PATTERNS: MerchantPattern[] = [
  {
    // Basic UPI pattern - extract as-is
    regex: /UPI\/([^\/]+)(?:\/.*)?$/i,
    extractGroup: 1,
  },
  {
    regex: /IMPS\/([^\/]+)\/([^\/]+)/i,
    extractGroup: 2,
  },
  {
    regex: /NEFT\/([^\/]+)\/([^\/]+)/i,
    extractGroup: 2,
  },
  {
    regex: /RTGS\/([^\/]+)\/([^\/]+)/i,
    extractGroup: 2,
  },
  {
    // Bill payments - extract as-is
    regex: /BIL\/([^\/]+)(?:\/.*)?$/i,
    extractGroup: 1,
  },
];

// Strict merchant normalizations - only definitive, well-known brands
export const MERCHANT_NORMALIZATIONS: Record<string, string> = {
  // Food Delivery - Major platforms only
  SWIGGY: "Swiggy",
  SWIGGYINST: "Swiggy Instamart",
  SWIGGYINSTAMAR: "Swiggy Instamart", 
  ZOMATO: "Zomato",
  
  // Streaming Services - Major platforms only
  NETFLIX: "Netflix",
  "NETFLIX CO": "Netflix",
  
  // E-commerce - Major platforms only
  AMAZON: "Amazon",
  FLIPKART: "Flipkart",
  MYNTRA: "Myntra",
  AJIO: "Ajio",
  
  // Payment Apps - Major platforms only
  PAYTM: "Paytm",
  PHONEPE: "PhonePe", 
  GPAY: "Google Pay",
  
  // Tech Companies - Major platforms only
  "GOOGLE IND": "Google",
  "GOOGLE INDIA": "Google",
  
  // Transportation - Major platforms only
  UBER: "Uber",
  OLA: "Ola",
  
  // Entertainment - Major chains only
  "PVR INOX": "PVR Inox",
  "PVR INOX L": "PVR Inox",
};

export function extractMerchant(
  description: string,
  patterns: MerchantPattern[] = UPI_MERCHANT_PATTERNS
): string {
  const cleanDesc = description.trim();

  // Try each pattern - extract as-is without assumptions
  for (const pattern of patterns) {
    const match = cleanDesc.match(pattern.regex);
    if (match && match[pattern.extractGroup]) {
      let merchant = match[pattern.extractGroup]?.trim();

      if (merchant && merchant.length > 2) {
        // Only normalize if we have an exact match in our strict list
        const normalized = normalizeMerchantName(merchant, MERCHANT_NORMALIZATIONS);
        return normalized;
      }
    }
  }

  // No fallback - return Unknown if no definitive match
  return "Unknown";
}

// Removed assumptive merchant name cleanup

export function normalizeMerchantName(
  name: string,
  normalizations: Record<string, string> = MERCHANT_NORMALIZATIONS
): string {
  const upperName = name.toUpperCase();

  // Only return normalized name for exact matches
  if (normalizations[upperName]) {
    return normalizations[upperName];
  }

  // No partial matching - return original name if not exactly known
  return name.trim();
}

// Removed assumptive fallback merchant extraction

// ============================================================================
// ENHANCED CATEGORIZATION HELPERS
// ============================================================================

export interface CategoryRule {
  keywords: string[];
  merchantKeywords?: string[];
  category: string;
  subcategory?: string;
  isRecurring?: boolean;
  amountThreshold?: { min?: number; max?: number };
}

// Ultra-strict category rules - only definitive merchant matches
export const DEFAULT_CATEGORY_RULES: CategoryRule[] = [
  // Food Delivery - Only major platforms with exact merchant matches
  {
    keywords: [],
    merchantKeywords: ["swiggy", "swiggy instamart", "zomato"],
    category: "Food & Dining",
    subcategory: "Food Delivery", 
    isRecurring: false,
  },
  
  // Entertainment - Streaming - Only exact matches
  {
    keywords: [],
    merchantKeywords: ["netflix"],
    category: "Entertainment",
    subcategory: "Streaming Services",
    isRecurring: true,
  },
  
  // Entertainment - Movies - Only exact chain matches
  {
    keywords: [],
    merchantKeywords: ["pvr inox"],
    category: "Entertainment",
    subcategory: "Movies",
    isRecurring: false,
  },
  
  // E-commerce - Only major platforms with exact matches
  {
    keywords: [],
    merchantKeywords: ["amazon", "flipkart", "myntra", "ajio"],
    category: "Shopping",
    subcategory: "Online Shopping",
    isRecurring: false,
  },
  
  // Transportation - Only major platforms with exact matches
  {
    keywords: [],
    merchantKeywords: ["uber", "ola"],
    category: "Transportation",
    isRecurring: false,
  },
  
  // Payment platforms - Only exact matches 
  {
    keywords: [],
    merchantKeywords: ["paytm", "phonepe", "google pay"],
    category: "Transfer",
    subcategory: "Digital Wallet",
    isRecurring: false,
  },
  
  // ATM - Only when explicitly mentioned
  {
    keywords: ["atm withdrawal", "cash withdrawal"],
    merchantKeywords: [],
    category: "Cash & ATM",
    isRecurring: false,
  },
  
  // EMI/Loans - Only when explicitly mentioned
  {
    keywords: ["emi", "loan emi", "personal loan"],
    merchantKeywords: [],
    category: "Finance", 
    subcategory: "Loans & EMI",
    isRecurring: true,
  },
];

export function categorizeTransaction(
  description: string,
  merchant: string,
  amount: number,
  rules: CategoryRule[] = DEFAULT_CATEGORY_RULES
): {
  category: string;
  subcategory?: string;
  paymentMethod: string;
  isRecurring: boolean;
} {
  const desc = description.toLowerCase();
  const merch = merchant.toLowerCase();

  // Ultra-strict rule matching - only exact merchant matches
  for (const rule of rules) {
    // Only check merchantKeywords for exact matches (no description keyword matching)
    const matchesMerchantKeywords = rule.merchantKeywords
      ? rule.merchantKeywords.some((keyword) =>
          merch === keyword.toLowerCase() || merch.includes(keyword.toLowerCase())
        )
      : false;

    // Check description keywords only for very specific terms
    const matchesKeywords = rule.keywords.some((keyword) =>
      desc.includes(keyword.toLowerCase())
    );

    const matchesAmount =
      !rule.amountThreshold ||
      ((!rule.amountThreshold.min || amount >= rule.amountThreshold.min) &&
        (!rule.amountThreshold.max || amount <= rule.amountThreshold.max));

    // Require merchant match OR very specific keyword match
    if ((matchesMerchantKeywords || matchesKeywords) && matchesAmount) {
      return {
        category: rule.category,
        subcategory: rule.subcategory,
        paymentMethod: determinePaymentMethod(description),
        isRecurring: rule.isRecurring ?? false,
      };
    }
  }

  // No personal transfer detection - too assumptive

  // Default category
  return {
    category: "Others",
    paymentMethod: determinePaymentMethod(description),
    isRecurring: false,
  };
}

export function determinePaymentMethod(description: string): string {
  const desc = description.toLowerCase();

  // More specific payment method detection
  if (desc.includes("bhqr") || desc.includes("qr")) return "QR Code";
  if (desc.includes("gpay")) return "Google Pay";
  if (desc.includes("paytm")) return "Paytm";
  if (desc.includes("phonepe")) return "PhonePe";
  if (desc.includes("upi")) return "UPI";
  if (desc.includes("card")) return "Card";
  if (desc.includes("neft") || desc.includes("rtgs")) return "Bank Transfer";
  if (desc.includes("bil/")) return "Bill Payment";
  if (desc.includes("imps")) return "IMPS";

  return "UPI"; // Default for most transactions
}

// Removed assumptive personal transfer detection

// ============================================================================
// ENHANCED UTILITY HELPERS
// ============================================================================

export function extractNotes(description: string): string | undefined {
  // Extract ICICI transaction ID
  const iciMatch = description.match(/(ICI[a-f0-9]+)/i);
  if (iciMatch) {
    return `Transaction ID: ${iciMatch[1]}`;
  }

  // Extract reference numbers
  const refMatch = description.match(/(\b[A-Z0-9]{10,}\b)/);
  if (refMatch) {
    return `Reference: ${refMatch[1]}`;
  }

  return undefined;
}

export function parseDate(dateStr: string): Date {
  try {
    // Handle both DD-MM-YYYY and DD/MM/YYYY formats
    const parts = dateStr.split(/[-\/]/).map(Number);
    if (parts.length !== 3) {
      throw new Error(`Date must have 3 parts: ${dateStr}`);
    }

    const [day, month, year] = parts;

    // Validate date components
    if (
      !day ||
      !month ||
      !year ||
      day < 1 ||
      day > 31 ||
      month < 1 ||
      month > 12 ||
      year < 1900
    ) {
      throw new Error(
        `Invalid date values: day=${day}, month=${month}, year=${year}`
      );
    }

    // Create date at noon UTC to avoid timezone issues
    const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));

    // Validate the date was created correctly
    if (
      date.getUTCDate() !== day ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCFullYear() !== year
    ) {
      throw new Error(`Date validation failed: ${dateStr}`);
    }

    return date;
  } catch (error) {
    console.error(`Failed to parse date "${dateStr}":`, error);
    throw new Error(`Invalid date format: ${dateStr}`);
  }
}

export function cleanDescription(description: string): string {
  return (
    description
      // Remove system statement text (improved patterns)
      .replace(/This is a system-generated statement\.?\s*/gi, "")
      .replace(/Hence,?\s*it does not require any signature\.?\s*/gi, "")
      .replace(/\s*Page \d+\s*/gi, "")
      .replace(/signature\.\s*Page\s*\d+/gi, "")
      // Remove extra forward slashes at the end
      .replace(/\/+$/, "")
      // Normalize whitespace (key improvement)
      .replace(/\s+/g, " ")
      .trim()
  );
}

export function isSystemText(text: string): boolean {
  const systemPatterns = [
    /^This is a system-generated/i,
    /Hence, it does not require/i,
    /any signature/i,
    /Page \d+$/i,
    /signature\.\s*Page/i,
    /Account Number/i,
    /Transaction date/i,
    /Date\s*Description\s*Amount\s*Type/i,
    /From \d{2}\/\d{2}\/\d{4} To \d{2}\/\d{2}\/\d{4}/i,
  ];

  return systemPatterns.some((pattern) => pattern.test(text));
}

// ============================================================================
// ENHANCED TAGGING HELPERS
// ============================================================================

export function generateTags(
  description: string,
  _merchant: string,
  category: string,
  amount?: number
): string[] {
  const tags = new Set<string>();
  const desc = description.toLowerCase();

  // Add category as base tag (factual)
  tags.add(category.toLowerCase().replace(/[\s&]/g, "-"));

  // Payment method tags - only from transaction description (factual)
  if (desc.includes("upi")) tags.add("upi");
  if (desc.includes("neft")) tags.add("neft"); 
  if (desc.includes("imps")) tags.add("imps");
  if (desc.includes("rtgs")) tags.add("rtgs");
  if (desc.includes("atm")) tags.add("atm");

  // Bank tags - only when explicitly mentioned (factual)
  if (desc.includes("hdfc")) tags.add("hdfc-bank");
  if (desc.includes("icici")) tags.add("icici-bank");
  if (desc.includes("axis")) tags.add("axis-bank");
  if (desc.includes("sbi")) tags.add("sbi-bank");

  // Transaction type tags - only when explicitly mentioned (factual)
  if (desc.includes("withdrawal")) tags.add("withdrawal");
  if (desc.includes("transfer")) tags.add("transfer");
  if (desc.includes("payment")) tags.add("payment");

  // Amount-based tags (factual)
  if (amount) {
    if (amount >= 10000) tags.add("high-amount");
    if (amount < 100) tags.add("small-amount");
    if (amount % 100 === 0 && amount >= 1000) tags.add("round-amount");
  }

  return Array.from(tags).filter((tag) => tag.length > 0);
}

// ============================================================================
// TRANSACTION CONVERSION HELPERS
// ============================================================================

export interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  type: "DR" | "CR";
}

export function convertToTransactionInterface(
  parsedTransactions: ParsedTransaction[],
  accountNumber: string,
  bankName: string = "ICICI"
): Transaction[] {
  return parsedTransactions.map((tx, index) => {
    const merchant = extractMerchant(tx.description);
    const categorization = categorizeTransaction(
      tx.description,
      merchant,
      tx.amount
    );
    const now = new Date();

    // Generate unique ID with proper date formatting
    const dateKey = tx.date.replace(/[-\/]/g, "");
    const id = `${bankName.toLowerCase()}_${accountNumber}_${dateKey}_${index}`;

    return {
      id,
      date: parseDate(tx.date),
      amount: tx.amount,
      description: tx.description,
      type: (tx.type === "DR" ? "debit" : "credit") as "debit" | "credit",
      category: categorization.category,
      subcategory: categorization.subcategory,
      merchant,
      account: accountNumber,
      paymentMethod: categorization.paymentMethod,
      isRecurring: categorization.isRecurring,
      tags: generateTags(
        tx.description,
        merchant,
        categorization.category,
        tx.amount
      ),
      notes: extractNotes(tx.description),
      isVerified: false,
      createdAt: now,
      updatedAt: now,
    };
  });
}

/**
 * ML-enhanced version of convertToTransactionInterface
 * Uses ML pipeline for better categorization and merchant extraction
 */
export async function convertToTransactionInterfaceML(
  parsedTransactions: ParsedTransaction[],
  accountNumber: string,
  bankName: string = "ICICI"
): Promise<Transaction[]> {
  // Lazy import ML pipeline to avoid loading it unless needed
  const { createMLPipeline } = await import('../ml/pipeline');
  const mlPipeline = createMLPipeline({
    useML: true,
    confidenceThreshold: 0.7,
    fallbackToRules: true,
  });

  const results = await Promise.all(
    parsedTransactions.map(async (tx, index) => {
      const now = new Date();
      const dateKey = tx.date.replace(/[-\/]/g, "");
      const id = `${bankName.toLowerCase()}_${accountNumber}_${dateKey}_${index}`;
      const type = (tx.type === "DR" ? "debit" : "credit") as "debit" | "credit";

      try {
        // Use ML pipeline for enrichment
        const mlEnrichment = await mlPipeline.enrichTransaction(
          tx.description,
          tx.amount,
          type
        );

        return {
          id,
          date: parseDate(tx.date),
          amount: tx.amount,
          description: tx.description,
          type,
          category: mlEnrichment.category.category,
          subcategory: mlEnrichment.category.subcategory,
          merchant: mlEnrichment.merchant.normalizedMerchant,
          account: accountNumber,
          paymentMethod: mlEnrichment.paymentMethod,
          isRecurring: mlEnrichment.isRecurring,
          tags: mlEnrichment.tags,
          notes: mlEnrichment.notes,
          isVerified: false,
          createdAt: now,
          updatedAt: now,
        };
      } catch (error) {
        console.warn(`ML processing failed for transaction ${index}, falling back to rules:`, error);
        
        // Fallback to original rule-based processing
        const merchant = extractMerchant(tx.description);
        const categorization = categorizeTransaction(
          tx.description,
          merchant,
          tx.amount
        );

        return {
          id,
          date: parseDate(tx.date),
          amount: tx.amount,
          description: tx.description,
          type,
          category: categorization.category,
          subcategory: categorization.subcategory,
          merchant,
          account: accountNumber,
          paymentMethod: categorization.paymentMethod,
          isRecurring: categorization.isRecurring,
          tags: [...generateTags(
            tx.description,
            merchant,
            categorization.category,
            tx.amount
          ), 'fallback-processing'],
          notes: extractNotes(tx.description),
          isVerified: false,
          createdAt: now,
          updatedAt: now,
        };
      }
    })
  );

  return results;
}

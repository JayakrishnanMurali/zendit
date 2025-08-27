import type { Transaction } from "@/types";

// ============================================================================
// ENHANCED MERCHANT EXTRACTION HELPERS
// ============================================================================

export interface MerchantPattern {
  regex: RegExp;
  extractGroup: number;
  cleanup?: (name: string) => string;
}

export const UPI_MERCHANT_PATTERNS: MerchantPattern[] = [
  {
    // Primary UPI pattern with improved cleanup
    regex: /UPI\/([^\/]+)(?:\/.*)?$/i,
    extractGroup: 1,
    cleanup: (name) =>
      name.replace(/\s*(REST|H|CO|PVT|LTD|SOLUTIONS?|SOL)$/i, "").trim(),
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
    regex: /BIL\/(.+?)(?:\/.*)?$/i,
    extractGroup: 1,
    cleanup: (name) => name.replace(/\s*(CREDIT CA|EMI|LOAN).*$/i, "").trim(),
  },
];

// Enhanced merchant normalizations with more entries
export const MERCHANT_NORMALIZATIONS: Record<string, string> = {
  SWIGGY: "Swiggy",
  SWIGGYINST: "Swiggy Instamart",
  SWIGGYINSTAMAR: "Swiggy Instamart",
  ZOMATO: "Zomato",
  NETFLIX: "Netflix",
  "NETFLIX CO": "Netflix",
  AMAZON: "Amazon",
  FLIPKART: "Flipkart",
  PAYTM: "Paytm",
  PHONEPE: "PhonePe",
  GPAY: "Google Pay",
  "GOOGLE IND": "Google",
  "GOOGLE INDIA": "Google",
  UBER: "Uber",
  OLA: "Ola",
  MYNTRA: "Myntra",
  AJIO: "Ajio",
  "MY LOOKS": "My Looks",
  "MY LOOKS H": "My Looks",
  "LORDS REST": "Lords Restaurant",
  LORDS: "Lords Restaurant",
  "THE HAVEN": "The Haven Supermarket",
  "PVR INOX": "PVR Inox",
  "PVR INOX L": "PVR Inox",
  "LULU INTER": "Lulu Hypermarket",
  LULU: "Lulu Hypermarket",
  "D CAFE AND": "D Cafe",
  "ANBARASI A": "Anbarasi Restaurant",
  "SKYNET SOL": "Skynet Solutions",
  "BROADWAY A": "Broadway",
  BROADWAY: "Broadway",
  GOODCAREPE: "Good Care Pest Control",
  MALABARCOM: "Malabar Restaurant",
  PARKINGBOO: "Parking Booking",
  ABHIRAMIPR: "Abhirami",
  "ABHIRAMI V": "Abhirami",
  "LAKSHMY FU": "Lakshmy",
  "J S FRUITS": "J S Fruits",
  "AKB FRUITS": "AKB Fruits",
  "BAAWRCHI T": "Baawrchi",
  "MEJO JACOB": "Mejo Jacob",
  "PRAVEEN KU": "Praveen Kumar",
  "MINIMOL R": "Minimol",
  "NANDANA M": "Nandana",
  "MURALI R": "Murali",
  JAYAKRISHN: "Jayakrishnan",
  "SHAMLA J": "Shamla",
  "GVR AND CO": "GVR & Co",
  "RAMESAN C": "Ramesan",
  "MOHAMMAD A": "Mohammad",
  "BHARAT KUM": "Bharat Kumar",
  "AMBIKA NIT": "Ambika",
  SHABABAIK: "Shabab",
  "PARAGON LU": "Paragon",
};

export function extractMerchant(
  description: string,
  patterns: MerchantPattern[] = UPI_MERCHANT_PATTERNS
): string {
  const cleanDesc = description.trim();

  // Try each pattern
  for (const pattern of patterns) {
    const match = cleanDesc.match(pattern.regex);
    if (match && match[pattern.extractGroup]) {
      let merchant = match[pattern.extractGroup]?.trim();

      // Apply pattern-specific cleanup
      if (pattern.cleanup && merchant) {
        merchant = pattern.cleanup(merchant);
      }

      // Apply general cleanup
      merchant = cleanMerchantName(merchant ?? "");

      if (merchant && merchant.length > 1) {
        return normalizeMerchantName(merchant);
      }
    }
  }

  // Fallback: extract meaningful words
  return extractFallbackMerchant(cleanDesc);
}

export function cleanMerchantName(name: string): string {
  return (
    name
      // Remove common business suffixes (improved regex)
      .replace(
        /\s*(REST|RESTAURANT|PVT\s*LTD|LTD|PVT|PRIVATE|LIMITED|COMPANY|CO|INC|CORP|LLC|SOL|SOLUTIONS?|H)\s*$/i,
        ""
      )
      // Remove single trailing letters (like 'H' in 'MY LOOKS H')
      .replace(/\s+[A-Z]$/, "")
      // Remove common prefixes
      .replace(/^(MR|MS|DR|PROF)\s+/i, "")
      // Remove transaction codes and IDs
      .replace(/\b[A-Z]{3}\d{6,}\b/g, "")
      .replace(/\b\d{6,}\b/g, "")
      // Remove special characters but keep spaces and hyphens
      .replace(/[^A-Za-z0-9\s\-&]/g, " ")
      // Clean up multiple spaces
      .replace(/\s+/g, " ")
      .trim()
  );
}

export function normalizeMerchantName(
  name: string,
  normalizations: Record<string, string> = MERCHANT_NORMALIZATIONS
): string {
  const upperName = name.toUpperCase();

  // Check for exact matches first
  if (normalizations[upperName]) {
    return normalizations[upperName];
  }

  // Check for partial matches (more specific first)
  const sortedKeys = Object.keys(normalizations).sort(
    (a, b) => b.length - a.length
  );
  for (const key of sortedKeys) {
    if (upperName.includes(key)) {
      return normalizations[key] ?? name;
    }
  }

  // Return title case version
  return name
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function extractFallbackMerchant(description: string): string {
  const stopWords = new Set([
    "UPI",
    "BANK",
    "ICI",
    "ICICI",
    "HDFC",
    "AXIS",
    "YES",
    "SBI",
    "STATE",
    "TO",
    "FROM",
    "TRANSFER",
    "PAYMENT",
    "MONTHLY",
    "AU",
    "GENERATING",
  ]);

  const words = description
    .split(/[\s\/\-\_\|]+/)
    .filter((word) => {
      const clean = word.replace(/[^A-Za-z]/g, "").toUpperCase();
      return clean.length >= 3 && !stopWords.has(clean) && !/^\d+$/.test(clean);
    })
    .slice(0, 2); // Take first 2 meaningful words

  const result = words.join(" ").trim();
  return result || "Unknown";
}

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

export const DEFAULT_CATEGORY_RULES: CategoryRule[] = [
  // Entertainment - Movies (HIGH PRIORITY FIX)
  {
    keywords: ["pvr", "inox", "cinema", "movie", "theatre", "theater"],
    merchantKeywords: ["pvr inox", "pvr", "inox"],
    category: "Entertainment",
    subcategory: "Movies",
    isRecurring: false,
  },
  // Entertainment - Streaming
  {
    keywords: [
      "netflix",
      "prime",
      "spotify",
      "youtube",
      "hotstar",
      "zee5",
      "voot",
    ],
    merchantKeywords: ["netflix"],
    category: "Entertainment",
    subcategory: "Streaming Services",
    isRecurring: true,
  },
  // Food & Dining - Delivery
  {
    keywords: ["swiggy", "zomato", "uber eats", "food delivery", "instamart"],
    merchantKeywords: ["swiggy", "swiggy instamart", "zomato"],
    category: "Food & Dining",
    subcategory: "Food Delivery",
    isRecurring: false,
  },
  // Food & Dining - Restaurant (HIGH PRIORITY FIX)
  {
    keywords: [
      "restaurant",
      "cafe",
      "dining",
      "hotel",
      "bar",
      "rest",
      "anbarasi",
      "lords",
      "malabar",
      "baawrchi",
    ],
    merchantKeywords: [
      "lords restaurant",
      "anbarasi restaurant",
      "d cafe",
      "malabar restaurant",
      "baawrchi",
    ],
    category: "Food & Dining",
    subcategory: "Restaurant",
    isRecurring: false,
  },
  // Shopping - Groceries
  {
    keywords: ["supermarket", "grocery", "haven", "lulu", "hypermarket"],
    merchantKeywords: ["the haven supermarket", "lulu hypermarket"],
    category: "Shopping",
    subcategory: "Groceries",
    isRecurring: false,
  },
  // Shopping - Online
  {
    keywords: [
      "amazon",
      "flipkart",
      "myntra",
      "ajio",
      "shopping",
      "mall",
      "store",
      "looks",
    ],
    merchantKeywords: ["my looks"],
    category: "Shopping",
    subcategory: "Online Shopping",
    isRecurring: false,
  },
  // Transportation
  {
    keywords: [
      "uber",
      "ola",
      "rapido",
      "taxi",
      "auto",
      "metro",
      "bus",
      "train",
      "ixigo",
    ],
    merchantKeywords: ["ixigo"],
    category: "Transportation",
    subcategory: "Travel Booking",
    isRecurring: false,
  },
  // Home & Services (NEW CATEGORY)
  {
    keywords: ["pest control", "goodcare", "skynet"],
    merchantKeywords: ["good care pest control", "skynet solutions"],
    category: "Home & Services",
    subcategory: "Pest Control",
    isRecurring: false,
  },
  // Utilities
  {
    keywords: [
      "electricity",
      "water",
      "gas",
      "internet",
      "mobile",
      "phone",
      "broadband",
    ],
    category: "Utilities",
    subcategory: "Bills",
    isRecurring: true,
  },
  // Healthcare
  {
    keywords: ["medical", "hospital", "pharmacy", "doctor", "clinic", "health"],
    category: "Healthcare",
    isRecurring: false,
  },
  // Transportation - Fuel
  {
    keywords: [
      "petrol",
      "diesel",
      "fuel",
      "hp",
      "bharat petroleum",
      "indian oil",
    ],
    category: "Transportation",
    subcategory: "Fuel",
    isRecurring: false,
  },
  // Transportation - Parking
  {
    keywords: ["parking", "parkingboo"],
    merchantKeywords: ["parking booking"],
    category: "Transportation",
    subcategory: "Parking",
    isRecurring: false,
  },
  // Cash & ATM
  {
    keywords: ["atm", "cash", "withdrawal"],
    category: "Cash & ATM",
    isRecurring: false,
  },
  // Finance - Loans
  {
    keywords: ["loan", "emi", "credit card", "personal loan"],
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
  const combinedText = `${desc} ${merch}`;

  // Check each rule with better matching
  for (const rule of rules) {
    const matchesKeywords = rule.keywords.some((keyword) =>
      combinedText.includes(keyword.toLowerCase())
    );

    const matchesMerchantKeywords = rule.merchantKeywords
      ? rule.merchantKeywords.some(
          (keyword) =>
            merch.includes(keyword.toLowerCase()) ||
            desc.includes(keyword.toLowerCase())
        )
      : false;

    const matchesAmount =
      !rule.amountThreshold ||
      ((!rule.amountThreshold.min || amount >= rule.amountThreshold.min) &&
        (!rule.amountThreshold.max || amount <= rule.amountThreshold.max));

    if ((matchesKeywords || matchesMerchantKeywords) && matchesAmount) {
      return {
        category: rule.category,
        subcategory: rule.subcategory,
        paymentMethod: determinePaymentMethod(description),
        isRecurring: rule.isRecurring ?? false,
      };
    }
  }

  // Personal transfer detection (improved)
  if (isPersonalTransfer(description, merchant)) {
    return {
      category: "Transfer",
      subcategory: "Personal",
      paymentMethod: determinePaymentMethod(description),
      isRecurring: false,
    };
  }

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

export function isPersonalTransfer(
  description: string,
  merchant: string
): boolean {
  const desc = description.toLowerCase();
  const merch = merchant.toLowerCase();

  // Check for payment apps (enhanced)
  if (
    desc.includes("paytm-") ||
    desc.includes("gpay-") ||
    desc.includes("phonepe")
  ) {
    return true;
  }

  // Check if merchant looks like a person name
  const businessKeywords = [
    "pvt",
    "ltd",
    "co",
    "inc",
    "corp",
    "bank",
    "services",
    "solutions",
    "restaurant",
    "supermarket",
    "store",
    "cafe",
    "mall",
    "shop",
  ];

  const hasBusinessKeyword = businessKeywords.some((keyword) =>
    merch.includes(keyword)
  );

  // Personal names are usually short, don't contain business keywords, and may have initials
  const isPersonName =
    !hasBusinessKeyword &&
    merch.length < 25 &&
    !merch.includes("@") &&
    !merch.includes("www") &&
    !/\d{4,}/.test(merch); // No long numbers

  return isPersonName;
}

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
  merchant: string,
  category: string,
  amount?: number
): string[] {
  const tags = new Set<string>();
  const desc = description.toLowerCase();
  const merch = merchant.toLowerCase();

  // Add category as base tag
  tags.add(category.toLowerCase().replace(/[\s&]/g, "-"));

  // Payment method tags (enhanced)
  if (desc.includes("bhqr")) tags.add("qr-payment");
  if (desc.includes("upi")) tags.add("upi");
  if (desc.includes("gpay")) tags.add("google-pay");
  if (desc.includes("paytm")) tags.add("paytm");
  if (desc.includes("neft")) tags.add("neft");
  if (desc.includes("imps")) tags.add("imps");
  if (desc.includes("rtgs")) tags.add("rtgs");

  // Bank tags
  if (desc.includes("hdfc")) tags.add("hdfc-bank");
  if (desc.includes("icici")) tags.add("icici-bank");
  if (desc.includes("axis")) tags.add("axis-bank");
  if (desc.includes("sbi") || desc.includes("state bank")) tags.add("sbi-bank");
  if (desc.includes("yes bank")) tags.add("yes-bank");

  // Service-specific tags
  if (/swiggy/i.test(merch)) {
    tags.add("food-delivery");
    if (/instamart/i.test(merch)) tags.add("grocery-delivery");
  }
  if (/netflix|prime|spotify/i.test(merch)) {
    tags.add("subscription");
    tags.add("monthly-bill");
  }
  if (/emi|loan/i.test(desc)) {
    tags.add("recurring");
    tags.add("loan-payment");
  }

  // Amount-based tags
  if (amount) {
    if (amount > 10000) tags.add("high-amount");
    if (amount < 100) tags.add("small-amount");
  }

  // Add merchant name as tag if meaningful
  if (merchant !== "Unknown" && merchant.length > 2) {
    const merchantTag = merchant
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    if (merchantTag.length > 1) {
      tags.add(`merchant-${merchantTag}`);
    }
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

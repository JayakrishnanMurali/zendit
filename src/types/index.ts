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

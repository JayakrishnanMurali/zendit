import type { PdfParseResult, PdfParserResult, Transaction } from "@/types";

export function createIciciPdfParser(): PdfParserResult {
  return {
    bank: "ICICI",
    canParse(bytes: Uint8Array, fileName: string): boolean {
      // Heuristics: filename contains icici or first bytes contain certain markers
      const name = fileName.toLowerCase();
      if (name.includes("icici")) return true;
      // Simple magic byte check placeholder
      return false;
    },
    async parse(
      bytes: Uint8Array,
      emitProgress: (p: number, m?: string) => void
    ): Promise<PdfParseResult> {
      emitProgress(0.1, "Initializing ICICI parser");
      // TODO: Integrate pdfjs-dist parsing and implement real extraction
      // For now, return an empty result to validate the pipeline
      const transactions: Transaction[] = [];
      const result: PdfParseResult = {
        bank: "ICICI",
        transactions,
        warnings: ["ICICI parser not implemented yet"],
      };
      return result;
    },
  };
}

import type { PdfParseResult, PdfParserResult } from "@/types";
import * as pdfjsLib from "pdfjs-dist";
import {
  convertToTransactionInterface,
  cleanDescription,
  isSystemText,
} from "./helpers";
import type { ParsedTransaction } from "./helpers";

// Set up PDF.js worker - use local worker file
pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

export function createIciciPdfParser(): PdfParserResult {
  return {
    bank: "ICICI",
    async canParse(bytes: Uint8Array, fileName: string): Promise<boolean> {
      try {
        // First check if filename suggests ICICI
        if (fileName.toLowerCase().includes("icici")) {
          return true;
        }

        // Try to load PDF and check first page content
        const clonedBytes = new Uint8Array(bytes);
        const loadingTask = pdfjsLib.getDocument({ data: clonedBytes });
        const pdf = await loadingTask.promise;

        if (pdf.numPages === 0) {
          return false;
        }

        // Check first page for ICICI identifiers
        const page = await pdf.getPage(1);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(" ")
          .toLowerCase();

        // Look for ICICI bank identifiers
        return (
          pageText.includes("icici bank") ||
          pageText.includes("icici") ||
          pageText.includes("industrial credit and investment corporation")
        );
      } catch (error) {
        console.warn("Failed to parse PDF for bank detection:", error);
        return false;
      }
    },

    async parse(
      bytes: Uint8Array,
      emitProgress: (p: number, m?: string) => void
    ): Promise<PdfParseResult> {
      emitProgress(0.1, "Loading PDF document");

      try {
        const clonedBytes = new Uint8Array(bytes);
        const loadingTask = pdfjsLib.getDocument({ data: clonedBytes });
        const pdf = await loadingTask.promise;
        emitProgress(0.2, `Loaded PDF with ${pdf.numPages} pages`);

        const transactions: any[] = [];
        const warnings: string[] = [];
        let accountNumber = "";

        // Process each page
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          emitProgress(
            0.2 + (pageNum / pdf.numPages) * 0.7,
            `Processing page ${pageNum}`
          );

          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(" ");

          // Extract account number from first page
          if (pageNum === 1) {
            const accountMatch = pageText.match(/Account Number:\s*(\d+)/i);
            if (accountMatch) {
              accountNumber = accountMatch[1] || "";
            }
          }

          // Extract transactions from this page
          const pageTransactions = extractTransactionsFromPage(textContent);

          // Convert ParsedTransaction to Transaction format
          const convertedTransactions = convertToTransactionInterface(
            pageTransactions,
            accountNumber,
            "ICICI"
          );
          transactions.push(...convertedTransactions);
        }

        emitProgress(1.0, "Parsing complete");

        return {
          bank: "ICICI",
          transactions,
          warnings: warnings.length > 0 ? warnings : [],
        };
      } catch (error) {
        throw new Error(
          `Failed to parse ICICI PDF: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    },
  };
}

function extractTransactionsFromPage(textContent: any): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];
  const items = textContent.items as any[];

  // Sort items by position (top to bottom, left to right)
  const sortedItems = items.sort((a: any, b: any) => {
    const yDiff = Math.abs(a.transform[5] - b.transform[5]);
    if (yDiff > 3) {
      // Different rows - sort by Y position (descending for PDF coordinates)
      return b.transform[5] - a.transform[5];
    }
    // Same row - sort by X position (ascending)
    return a.transform[4] - b.transform[4];
  });

  // Group items by rows with improved tolerance
  const rows: any[][] = [];
  let currentRow: any[] = [];
  let lastY = -1;
  const Y_TOLERANCE = 5;

  for (const item of sortedItems) {
    const y = Math.round(item.transform[5]);
    if (lastY === -1 || Math.abs(y - lastY) <= Y_TOLERANCE) {
      currentRow.push(item);
    } else {
      if (currentRow.length > 0) {
        rows.push([...currentRow]);
      }
      currentRow = [item];
    }
    lastY = y;
  }
  if (currentRow.length > 0) {
    rows.push(currentRow);
  }

  // Improved patterns with better validation
  const datePattern = /^(\d{2}[-\/]\d{2}[-\/]\d{4})$/;
  const amountPattern = /^(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)$|^(\d+\.?\d*)$/;
  const typePattern = /^(DR|CR)$/;

  let currentTransaction: {
    date?: string;
    descriptionParts: string[];
    amount?: number;
    type?: "DR" | "CR";
  } | null = null;

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    const rowText =
      row
        ?.map((item) => item.str.trim())
        ?.filter((str) => str.length > 0 && !isSystemText(str)) ?? [];

    if (rowText.length === 0) continue;

    // Check for new transaction (contains date)
    const dateIndex = rowText.findIndex((text) => datePattern.test(text));

    if (dateIndex !== -1) {
      // Save previous transaction if complete
      if (currentTransaction?.date && currentTransaction?.amount) {
        const description = cleanDescription(
          currentTransaction.descriptionParts
            .join(" ")
            .replace(/\s+/g, " ")
            .trim()
        );

        if (description.length > 0) {
          transactions.push({
            date: currentTransaction.date,
            description,
            amount: currentTransaction.amount,
            type: currentTransaction.type || "DR",
          });
        }
      }

      // Start new transaction
      const date = rowText[dateIndex];
      const descriptionParts: string[] = [];
      let amount: number | undefined;
      let type: "DR" | "CR" | undefined;

      // Parse this row for amount, type, and initial description
      for (let i = 0; i < rowText.length; i++) {
        const text = rowText[i];

        if (i === dateIndex) continue; // Skip date

        if (typePattern.test(text)) {
          type = text as "DR" | "CR";
        } else if (amountPattern.test(text) && !amount) {
          amount = parseFloat(text.replace(/,/g, ""));
        } else if (text && text.length > 1) {
          descriptionParts.push(text);
        }
      }

      currentTransaction = {
        date,
        descriptionParts,
        amount,
        type,
      };
    } else if (currentTransaction) {
      // Continuation row - look for missing amount/type and add description
      for (const text of rowText) {
        if (typePattern.test(text) && !currentTransaction.type) {
          currentTransaction.type = text as "DR" | "CR";
        } else if (amountPattern.test(text) && !currentTransaction.amount) {
          currentTransaction.amount = parseFloat(text.replace(/,/g, ""));
        } else if (
          text &&
          text.length > 1 &&
          !typePattern.test(text) &&
          !amountPattern.test(text)
        ) {
          currentTransaction.descriptionParts.push(text);
        }
      }
    }
  }

  // Don't forget the last transaction
  if (currentTransaction?.date && currentTransaction?.amount) {
    const description = cleanDescription(
      currentTransaction.descriptionParts.join(" ").replace(/\s+/g, " ").trim()
    );

    if (description.length > 0) {
      transactions.push({
        date: currentTransaction.date,
        description,
        amount: currentTransaction.amount,
        type: currentTransaction.type || "DR",
      });
    }
  }

  return transactions;
}

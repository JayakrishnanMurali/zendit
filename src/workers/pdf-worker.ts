/* eslint-disable no-restricted-globals */
import type {
  PdfParseResult,
  PdfWorkerInboundMessage,
  PdfWorkerOutboundMessage,
  SupportedBank,
  Transaction,
} from "@/types";

// Minimal parser contracts so we can add more banks later
interface BankPdfParser {
  bank: SupportedBank;
  canParse: (bytes: Uint8Array, fileName: string) => Promise<boolean> | boolean;
  parse: (
    bytes: Uint8Array,
    emitProgress: (p: number, m?: string) => void
  ) => Promise<PdfParseResult>;
}

// Lazy import registry to keep worker light initially
async function getParsers(): Promise<BankPdfParser[]> {
  const { createIciciPdfParser } = await import("@/lib/parsers/icici");
  return [createIciciPdfParser()];
}

function postMessageFromWorker(message: PdfWorkerOutboundMessage) {
  postMessage(message);
}

async function handleParse(fileName: string, fileBuffer: ArrayBuffer) {
  const emitProgress = (progressPercent: number, message?: string) => {
    postMessageFromWorker({ kind: "progress", progressPercent, message });
  };

  try {
    emitProgress(2, "Loading parsers");
    const parsers = await getParsers();

    emitProgress(5, "Selecting parser");
    const bytes = new Uint8Array(fileBuffer);
    let selected: BankPdfParser | undefined;
    for (const parser of parsers) {
      if (await parser.canParse(bytes, fileName)) {
        selected = parser;
        break;
      }
    }

    if (!selected) {
      emitProgress(100);
      postMessageFromWorker({
        kind: "error",
        message: "No suitable parser found for this PDF.",
      });
      return;
    }

    emitProgress(10, `Parsing with ${selected.bank}`);
    const result = await selected.parse(bytes, (p, m) =>
      emitProgress(Math.min(10 + Math.floor(p * 0.9), 99), m)
    );

    console.log("result", result);
    emitProgress(100, "Done");
    postMessageFromWorker({ kind: "complete", result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    postMessageFromWorker({ kind: "error", message });
  }
}

let cancelled = false;

self.onmessage = (event: MessageEvent<PdfWorkerInboundMessage>) => {
  const data = event.data;
  if (data.kind === "parse") {
    cancelled = false;
    void handleParse(data.fileName, data.fileBuffer);
    return;
  }
  if (data.kind === "cancel") {
    cancelled = true;
    return;
  }
};

export {};

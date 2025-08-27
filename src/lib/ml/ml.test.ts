import { describe, it, expect } from "vitest";
import { createMLPipeline } from "@/lib/ml";

describe("MLTransactionPipeline", () => {
  it("enriches a sample UPI transaction", async () => {
    const ml = createMLPipeline({ confidenceThreshold: 0.7, useML: true });

    const enrichment = await ml.enrichTransaction(
      "UPI/GVR AND CO/paytm.d1618803/UPI/YES BANK P/522932491107/ICI6dc2e3745fa9 4b7aa33b371a547db7fa",
      5000,
      "debit"
    );

    console.log(JSON.stringify(enrichment, null, 2));

    expect(enrichment).toBeTruthy();
  });
});

// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { resolveNextDirection, type TradeCategory } from "@/hooks/useAutoTrader";

describe("resolveNextDirection consecutive loss protection", () => {
  const strategyPool: TradeCategory[] = ["under4", "over4", "under5", "over5"];

  it("does not change direction if nextStep is less than 5", () => {
    const res = resolveNextDirection(
      "under4",
      4, // 5th trade (step 4)
      ["U4", "O4", "U5", "O5"],
      "strategy_a",
      ["U4", "O4", "U5", "O5", "U4", "O4", "U5", "O5", "U4", "O4", "U5", "O5"],
      4,
      strategyPool
    );
    expect(res.trade).toBe("under4");
    expect(res.currentArrangement).toBeUndefined();
  });

  it("does not change direction if the planned trade is not in the loss sequence", () => {
    const res = resolveNextDirection(
      "under5",
      5, // 6th trade (step 5)
      ["U4", "O4", "O5", "EV", "OD"], // loss sequence has no U5 ("under5")
      "strategy_c",
      ["U4", "O4", "O5", "EV", "OD", "U5", "U4", "O4", "O5", "EV", "OD", "U5"],
      5,
      ["under4", "over4", "under5", "over5", "even", "odd"]
    );
    expect(res.trade).toBe("under5");
    expect(res.currentArrangement).toBeUndefined();
  });

  it("swaps with a future element in the arrangement if planned trade is in loss sequence", () => {
    const arrangement = ["U4", "O4", "O5", "EV", "OD", "EV", "U5", "O4", "U4", "OD", "O5", "U5"];
    const lossSeq = ["OD", "U4", "O5", "FALL", "EV"]; // EV was the 5th loss, so it's in the loss sequence
    // The planned trade at sequenceStep = 5 is "EV" ("even"), which is in lossSeq.
    // Future elements are:
    // index 6: "U5" ("under5") -> not in lossSeq -> valid candidate!
    // So it should swap index 5 ("EV") with index 6 ("U5"), returning "under5".
    
    const res = resolveNextDirection(
      "even",
      5,
      lossSeq,
      "strategy_c",
      arrangement,
      5,
      ["under4", "over4", "under5", "over5", "even", "odd"]
    );
    
    expect(res.trade).toBe("under5");
    expect(res.currentArrangement).toBeDefined();
    expect(res.currentArrangement![5]).toBe("U5");
    expect(res.currentArrangement![6]).toBe("EV");
  });

  it("falls back to random pool selection excluding loss sequence if no arrangement swap is possible or not arrangement-based", () => {
    const pool: TradeCategory[] = ["under4", "over4", "under5", "over5", "even", "odd"];
    const lossSeq = ["under4", "over4", "under5", "even", "odd"]; // Only "over5" is not in lossSeq
    // Non-arrangement strategy (like strategy_i)
    const res = resolveNextDirection(
      "under4",
      5,
      lossSeq.map(d => d === "under4" ? "U4" : d === "over4" ? "O4" : d === "under5" ? "U5" : d === "even" ? "EV" : "OD"),
      "strategy_i",
      undefined,
      5,
      pool
    );
    expect(res.trade).toBe("over5");
  });

  it("avoids only the immediately preceding direction if all allowed pool directions are in the loss sequence", () => {
    const pool: TradeCategory[] = ["under4", "over4", "under5", "over5"];
    const lossSeq = ["U4", "O4", "U5", "O5"]; // All 4 are lost
    // The last loss is O5 ("over5")
    const res = resolveNextDirection(
      "over5",
      5,
      lossSeq,
      "strategy_a",
      undefined,
      5,
      pool
    );
    expect(res.trade).not.toBe("over5");
    expect(pool).toContain(res.trade);
  });
});

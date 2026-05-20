import { describe, expect, it } from "vitest";
import { resolveSettledMartingaleState } from "@/lib/martingale-state";

describe("resolveSettledMartingaleState", () => {
  const pendingState = {
    currentStake: 9.21,
    martingaleStep: 4,
    sequenceStep: 4,
    initialChoice: "DIGITOVER" as const,
    currentSymbol: "1HZ100V",
    currentContract: "DIGITOVER" as const,
    currentBarrier: 5,
    status: "PENDING" as const,
    nextAction: "TRD_LIV",
    symbolLossStreak: 3,
  };

  it("resets to the base stake and step zero immediately after a settled win", () => {
    const next = resolveSettledMartingaleState(
      pendingState,
      { stake: 9.21, martingaleStep: 4, sequenceStep: 4 },
      true,
      0.35,
      "P_CD_1T"
    );

    expect(next.status).toBe("WIN");
    expect(next.currentStake).toBe(0.35);
    expect(next.martingaleStep).toBe(0);
    expect(next.sequenceStep).toBe(0);
    expect(next.symbolLossStreak).toBe(0);
  });

  it("keeps the settled losing stake and step for the next martingale calculation", () => {
    const next = resolveSettledMartingaleState(
      pendingState,
      { stake: 9.21, martingaleStep: 4, sequenceStep: 4 },
      false,
      0.35,
      "L_CD_1T"
    );

    expect(next.status).toBe("LOSS");
    expect(next.currentStake).toBe(9.21);
    expect(next.martingaleStep).toBe(4);
    expect(next.sequenceStep).toBe(4);
    expect(next.symbolLossStreak).toBe(4);
  });
});

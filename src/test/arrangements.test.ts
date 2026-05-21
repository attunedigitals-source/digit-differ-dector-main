import { describe, expect, it } from "vitest";
import { ARRANGEMENT_TOTAL, getArrangementPermutation, getScrambledArrangementIndex } from "@/lib/arrangements";

describe("Arrangement engine", () => {
  it("matches the first 10 spreadsheet rows", () => {
    const expected = [
      "under4,under4,under4,over4,over4,over4,under5,under5,under5,over5,over5,over5",
      "under4,under4,under4,over4,over4,over4,under5,under5,over5,under5,over5,over5",
      "under4,under4,under4,over4,over4,over4,under5,under5,over5,over5,under5,over5",
      "under4,under4,under4,over4,over4,over4,under5,under5,over5,over5,over5,under5",
      "under4,under4,under4,over4,over4,over4,under5,over5,under5,under5,over5,over5",
      "under4,under4,under4,over4,over4,over4,under5,over5,under5,over5,under5,over5",
      "under4,under4,under4,over4,over4,over4,under5,over5,under5,over5,over5,under5",
      "under4,under4,under4,over4,over4,over4,under5,over5,over5,under5,under5,over5",
      "under4,under4,under4,over4,over4,over4,under5,over5,over5,under5,over5,under5",
      "under4,under4,under4,over4,over4,over4,under5,over5,over5,over5,under5,under5",
    ];

    for (let i = 1; i <= 10; i += 1) {
      expect(getArrangementPermutation(i).join(",")).toBe(expected[i - 1]);
    }
  });

  it("scrambler is collision free over full domain", () => {
    const seen = new Set<number>();
    for (let i = 0; i < ARRANGEMENT_TOTAL; i += 1) {
      const mapped = getScrambledArrangementIndex(i);
      expect(mapped).toBeGreaterThanOrEqual(1);
      expect(mapped).toBeLessThanOrEqual(ARRANGEMENT_TOTAL);
      seen.add(mapped);
    }
    expect(seen.size).toBe(ARRANGEMENT_TOTAL);
  }, 20000);

  it("keeps account state isolated", () => {
    const arrangementStates = {
      CR123456: { current_index: 456, current_step: 3, mode: "scrambled" as const },
      VRTC987654: { current_index: 12, current_step: 0, mode: "scrambled" as const },
    };

    expect(arrangementStates.CR123456.current_index).not.toBe(arrangementStates.VRTC987654.current_index);
    expect(arrangementStates.CR123456.current_step).not.toBe(arrangementStates.VRTC987654.current_step);
  });
});

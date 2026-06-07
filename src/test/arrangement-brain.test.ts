import { describe, it, expect } from "vitest";
import {
  factorial,
  getNthPermutation,
  lcgPermute,
  getNextArrangement,
  directionToDetails,
  getPermutationIndex,
  getRandomSequenceWithPrefix
} from "../lib/arrangement-brain";

describe("Strategy A Arrangement Brain Math", () => {
  const ELEMENTS = ["U4", "O4", "U5", "O5"];
  const COUNTS = [3, 3, 3, 3];

  describe("factorial", () => {
    it("should calculate factorials correctly", () => {
      expect(factorial(0)).toBe(1);
      expect(factorial(1)).toBe(1);
      expect(factorial(3)).toBe(6);
      expect(factorial(5)).toBe(120);
      expect(factorial(12)).toBe(479001600);
    });
  });

  describe("getNthPermutation (lexicographical match with Excel Arrangements sheet)", () => {
    it("should match Row 1 (Index 1)", () => {
      const arr = getNthPermutation(ELEMENTS, COUNTS, 1);
      expect(arr.join(", ")).toBe("U4, U4, U4, O4, O4, O4, U5, U5, U5, O5, O5, O5");
    });

    it("should match Row 2 (Index 2)", () => {
      const arr = getNthPermutation(ELEMENTS, COUNTS, 2);
      expect(arr.join(", ")).toBe("U4, U4, U4, O4, O4, O4, U5, U5, O5, U5, O5, O5");
    });

    it("should match Row 11 (Index 11)", () => {
      const arr = getNthPermutation(ELEMENTS, COUNTS, 11);
      expect(arr.join(", ")).toBe("U4, U4, U4, O4, O4, O4, O5, U5, U5, U5, O5, O5");
    });

    it("should match Row 20 (Index 20)", () => {
      const arr = getNthPermutation(ELEMENTS, COUNTS, 20);
      expect(arr.join(", ")).toBe("U4, U4, U4, O4, O4, O4, O5, O5, O5, U5, U5, U5");
    });
  });

  describe("lcgPermute (Bijection Uniqueness)", () => {
    it("should map every index uniquely for small sizes", () => {
      const size = 1000;
      const seen = new Set<number>();
      for (let i = 0; i < size; i++) {
        const val = lcgPermute(i, size, 42);
        expect(val).toBeLessThan(size);
        expect(val).toBeGreaterThanOrEqual(0);
        seen.add(val);
      }
      expect(seen.size).toBe(size);
    });

    it("should create unique maps with different seeds", () => {
      const val1 = lcgPermute(0, 369600, 42);
      const val2 = lcgPermute(0, 369600, 999);
      expect(val1).not.toBe(val2);
    });
  });

  describe("getNextArrangement", () => {
    it("should load valid arrangement with index", () => {
      const { index, arrangement } = getNextArrangement(0, 42);
      expect(index).toBeGreaterThanOrEqual(1);
      expect(index).toBeLessThanOrEqual(369600);
      expect(arrangement.length).toBe(12);
      
      // Every direction category must appear exactly 3 times
      const counts: Record<string, number> = {};
      arrangement.forEach(dir => {
        counts[dir] = (counts[dir] || 0) + 1;
      });
      expect(counts["U4"]).toBe(3);
      expect(counts["O4"]).toBe(3);
      expect(counts["U5"]).toBe(3);
      expect(counts["O5"]).toBe(3);
    });
  });

  describe("directionToDetails", () => {
    it("should map codes to contract details", () => {
      expect(directionToDetails("U4")).toEqual({ type: "DIGITUNDER", barrier: 4 });
      expect(directionToDetails("O4")).toEqual({ type: "DIGITOVER", barrier: 4 });
      expect(directionToDetails("U5")).toEqual({ type: "DIGITUNDER", barrier: 5 });
      expect(directionToDetails("O5")).toEqual({ type: "DIGITOVER", barrier: 5 });
      expect(directionToDetails("EV")).toEqual({ type: "DIGITEVEN", barrier: undefined });
      expect(directionToDetails("OD")).toEqual({ type: "DIGITODD", barrier: undefined });
    });
  });

  describe("getPermutationIndex (Lexicographical Ranking - Inverse Bijection)", () => {
    it("should correctly rank boundary permutations", () => {
      const idx1 = getPermutationIndex(ELEMENTS, COUNTS, getNthPermutation(ELEMENTS, COUNTS, 1));
      expect(idx1).toBe(1);

      const idx2 = getPermutationIndex(ELEMENTS, COUNTS, getNthPermutation(ELEMENTS, COUNTS, 2));
      expect(idx2).toBe(2);

      const idx11 = getPermutationIndex(ELEMENTS, COUNTS, getNthPermutation(ELEMENTS, COUNTS, 11));
      expect(idx11).toBe(11);

      const idx20 = getPermutationIndex(ELEMENTS, COUNTS, getNthPermutation(ELEMENTS, COUNTS, 20));
      expect(idx20).toBe(20);

      const idxLast = getPermutationIndex(ELEMENTS, COUNTS, getNthPermutation(ELEMENTS, COUNTS, 369600));
      expect(idxLast).toBe(369600);
    });

    it("should compute unique ranks for random indices", () => {
      const indices = [15, 100, 5000, 25000, 150000, 300000];
      for (const rank of indices) {
        const arr = getNthPermutation(ELEMENTS, COUNTS, rank);
        const computed = getPermutationIndex(ELEMENTS, COUNTS, arr);
        expect(computed).toBe(rank);
      }
    });
  });

  describe("getRandomSequenceWithPrefix (Uniform Random Pool Selection)", () => {
    it("should preserve the requested prefix", () => {
      const prefix = ["U4", "O5", "O4"];
      const sequence = getRandomSequenceWithPrefix(prefix);
      
      expect(sequence.slice(0, prefix.length)).toEqual(prefix);
      expect(sequence.length).toBe(12);

      // Verify balanced counts (exactly 3 of each element)
      const counts: Record<string, number> = {};
      sequence.forEach(dir => {
        counts[dir] = (counts[dir] || 0) + 1;
      });
      expect(counts["U4"]).toBe(3);
      expect(counts["O4"]).toBe(3);
      expect(counts["U5"]).toBe(3);
      expect(counts["O5"]).toBe(3);
    });

    it("should draw from pool for an empty prefix", () => {
      const sequence = getRandomSequenceWithPrefix([]);
      expect(sequence.length).toBe(12);

      const counts: Record<string, number> = {};
      sequence.forEach(dir => {
        counts[dir] = (counts[dir] || 0) + 1;
      });
      expect(counts["U4"]).toBe(3);
      expect(counts["O4"]).toBe(3);
      expect(counts["U5"]).toBe(3);
      expect(counts["O5"]).toBe(3);
    });

    it("should work correctly with a maximum length prefix", () => {
      const fullPerm = getNthPermutation(ELEMENTS, COUNTS, 12345);
      const sequence = getRandomSequenceWithPrefix(fullPerm);
      expect(sequence).toEqual(fullPerm);
    });
  });

  describe("Strategy C Expanded Deck Math (Even and Odd)", () => {
    const STRAT_C_ELEMENTS = ["U4", "O4", "U5", "O5", "EV", "OD"];
    const STRAT_C_COUNTS = [2, 2, 2, 2, 2, 2];
    const STRAT_C_SIZE = 7484400;

    it("should map every index uniquely for Strategy C deck using LCG walking", () => {
      const size = 1000;
      const seen = new Set<number>();
      for (let i = 0; i < size; i++) {
        const val = lcgPermute(i, STRAT_C_SIZE, 42);
        expect(val).toBeLessThan(STRAT_C_SIZE);
        expect(val).toBeGreaterThanOrEqual(0);
        seen.add(val);
      }
      expect(seen.size).toBe(size);
    });

    it("should generate a valid Strategy C arrangement with exactly 2 occurrences of each element", () => {
      const arr = getNthPermutation(STRAT_C_ELEMENTS, STRAT_C_COUNTS, 1);
      expect(arr.length).toBe(12);

      const counts: Record<string, number> = {};
      arr.forEach(dir => {
        counts[dir] = (counts[dir] || 0) + 1;
      });
      expect(counts["U4"]).toBe(2);
      expect(counts["O4"]).toBe(2);
      expect(counts["U5"]).toBe(2);
      expect(counts["O5"]).toBe(2);
      expect(counts["EV"]).toBe(2);
      expect(counts["OD"]).toBe(2);
    });

    it("should rank Strategy C permutations bijectively", () => {
      const rank = 123456;
      const arr = getNthPermutation(STRAT_C_ELEMENTS, STRAT_C_COUNTS, rank);
      const computed = getPermutationIndex(STRAT_C_ELEMENTS, STRAT_C_COUNTS, arr);
      expect(computed).toBe(rank);
    });
  });

  describe("Strategy J Generalized Fibonacci mod 8 mapping rules", () => {
    const getGeneralizedFibonacci = (a: number, b: number, n: number, prime: bigint = 1000000007n): bigint => {
      if (n <= 0) return BigInt(a) % prime;
      if (n === 1) return BigInt(b) % prime;
      let prev2 = BigInt(a) % prime;
      let prev1 = BigInt(b) % prime;
      for (let i = 2; i <= n; i++) {
        const temp = (prev2 + prev1) % prime;
        prev2 = prev1;
        prev1 = temp;
      }
      return prev1;
    };

    const mapModToTrade = (val: bigint): string => {
      const mod = Number(val % 8n);
      if (mod === 1) return "under4";
      if (mod === 2) return "over5";
      if (mod === 3) return "even";
      if (mod === 4) return "rise";
      if (mod === 5) return "under5";
      if (mod === 6) return "over4";
      if (mod === 7) return "fall";
      return "odd"; // mod === 0
    };

    it("should compute correct terms for G(n)", () => {
      // G(0)=3, G(1)=5
      expect(getGeneralizedFibonacci(3, 5, 0)).toBe(3n);
      expect(getGeneralizedFibonacci(3, 5, 1)).toBe(5n);
      expect(getGeneralizedFibonacci(3, 5, 2)).toBe(8n);
      expect(getGeneralizedFibonacci(3, 5, 3)).toBe(13n);
      expect(getGeneralizedFibonacci(3, 5, 4)).toBe(21n);
      expect(getGeneralizedFibonacci(3, 5, 5)).toBe(34n);
    });

    it("should map G(n) modulo 8 to correct trade types", () => {
      expect(mapModToTrade(1n)).toBe("under4");
      expect(mapModToTrade(2n)).toBe("over5");
      expect(mapModToTrade(3n)).toBe("even");
      expect(mapModToTrade(4n)).toBe("rise");
      expect(mapModToTrade(5n)).toBe("under5");
      expect(mapModToTrade(6n)).toBe("over4");
      expect(mapModToTrade(7n)).toBe("fall");
      expect(mapModToTrade(0n)).toBe("odd");
      expect(mapModToTrade(8n)).toBe("odd");
      expect(mapModToTrade(9n)).toBe("under4");
    });

    it("should skip under4 and over5 trade directions after 3rd consecutive loss and advance step", () => {
      const runSkipLogic = (startA: number, startB: number, initialStep: number, consecutiveLosses: number): { finalStep: number; direction: string } => {
        let step = initialStep;
        let fibValue = getGeneralizedFibonacci(startA, startB, step);
        let tradeDir = mapModToTrade(fibValue);

        if (consecutiveLosses >= 3) {
          const shouldSkip = (dir: string) => {
            if (consecutiveLosses >= 5) {
              return dir === "under4" || dir === "over5" || dir === "under5" || dir === "over4";
            }
            return dir === "under4" || dir === "over5";
          };

          while (shouldSkip(tradeDir)) {
            step += 1;
            fibValue = getGeneralizedFibonacci(startA, startB, step);
            tradeDir = mapModToTrade(fibValue);
          }
        }
        return { finalStep: step, direction: tradeDir };
      };

      // Less than 3 consecutive losses: should NOT skip and remain at step 0 ("under4")
      expect(runSkipLogic(1, 2, 0, 2)).toEqual({ finalStep: 0, direction: "under4" });

      // 3 consecutive losses, starting at step 0 (which maps to "under4"):
      // Step 0 ("under4") -> skipped.
      // Step 1 ("over5") -> skipped.
      // Step 2 ("even") -> allowed!
      // Final step should be 2, direction should be "even".
      expect(runSkipLogic(1, 2, 0, 3)).toEqual({ finalStep: 2, direction: "even" });

      // 3 consecutive losses, starting at step 1 (which maps to "over5"):
      // Step 1 ("over5") -> skipped.
      // Step 2 ("even") -> allowed!
      // Final step should be 2, direction should be "even".
      expect(runSkipLogic(1, 2, 1, 3)).toEqual({ finalStep: 2, direction: "even" });

      // 5 consecutive losses, starting at step 0 (which maps to "under5" with seeds 5, 6):
      // Step 0 ("under5") -> skipped.
      // Step 1 ("over4") -> skipped.
      // Step 2 ("even") -> allowed!
      // Final step should be 2, direction should be "even".
      expect(runSkipLogic(5, 6, 0, 5)).toEqual({ finalStep: 2, direction: "even" });
    });
  });
});


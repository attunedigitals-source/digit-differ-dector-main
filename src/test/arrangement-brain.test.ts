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
});

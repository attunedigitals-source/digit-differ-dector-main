import { describe, it, expect } from "vitest";
import {
  evaluateStrategySStep2Candidate,
  evaluateStrategySStep3Candidate,
} from "../lib/signal-engine";

describe("Strategy S Danger Zone Depletion Evaluator", () => {
  describe("evaluateStrategySStep2Candidate (OVER 2 vs UNDER 7)", () => {
    it("returns null when digits count is less than 15", () => {
      const result = evaluateStrategySStep2Candidate("1HZ10V", [1, 2, 3, 4]);
      expect(result).toBeNull();
    });

    it("favors OVER 2 when danger zone [0, 1, 2] is depleted", () => {
      // 40 ticks with NO 0, 1, 2 digits (all digits 3-6)
      const digits = Array(40).fill(5);
      const result = evaluateStrategySStep2Candidate("1HZ10V", digits);
      expect(result).not.toBeNull();
      expect(result?.targetContract).toBe("over2");
      expect(result?.dangerZone).toBe("0,1,2");
      expect(result?.dangerFreq).toBe(0);
      expect(result?.baselineFreq).toBe(30.0);
      expect(result?.safetyCushion).toBe(30.0);
      expect(result?.isValidated).toBe(true);
    });

    it("favors UNDER 7 when danger zone [7, 8, 9] is depleted", () => {
      // 40 ticks with heavy [0, 1, 2] but NO [7, 8, 9]
      const digits = [...Array(20).fill(0), ...Array(20).fill(5)];
      const result = evaluateStrategySStep2Candidate("1HZ10V", digits);
      expect(result).not.toBeNull();
      expect(result?.targetContract).toBe("under7");
      expect(result?.dangerZone).toBe("7,8,9");
      expect(result?.dangerFreq).toBe(0);
      expect(result?.safetyCushion).toBe(30.0);
    });
  });

  describe("evaluateStrategySStep3Candidate (OVER 3 vs UNDER 6)", () => {
    it("returns null when digits count is less than 15", () => {
      const result = evaluateStrategySStep3Candidate("1HZ25V", [0, 1, 2, 3]);
      expect(result).toBeNull();
    });

    it("favors OVER 3 when low danger zone [0, 1, 2, 3] is heavily suppressed", () => {
      // 40 ticks: only digits 4 and 5 (no 0-3 and no 6-9)
      // Zone L count = 0 (0%), Zone H count = 0 (0%)
      // Both safety = 40% - 0% = +40.0% cushion; tie defaults to over3
      const digits = Array(40).fill(4);
      const result = evaluateStrategySStep3Candidate("1HZ25V", digits);
      expect(result).not.toBeNull();
      expect(result?.targetContract).toBe("over3");
      expect(result?.dangerZone).toBe("0,1,2,3");
      expect(result?.dangerFreq).toBe(0);
      expect(result?.baselineFreq).toBe(40.0);
      expect(result?.safetyCushion).toBe(40.0);
      expect(result?.isValidated).toBe(true);
    });

    it("favors UNDER 6 when high danger zone [6, 7, 8, 9] is depleted while low danger zone is active", () => {
      // 40 ticks: 16 digits of [0, 1, 2, 3] (40%), 0 digits of [6, 7, 8, 9] (0%), and 24 digits of [4, 5]
      // Zone L freq = 40.0% -> Safety L = 40.0 - 40.0 = 0.0%
      // Zone H freq = 0.0%  -> Safety H = 40.0 - 0.0 = +40.0%
      const digits = [...Array(16).fill(1), ...Array(24).fill(4)];
      const result = evaluateStrategySStep3Candidate("1HZ50V", digits);
      expect(result).not.toBeNull();
      expect(result?.targetContract).toBe("under6");
      expect(result?.dangerZone).toBe("6,7,8,9");
      expect(result?.dangerFreq).toBe(0);
      expect(result?.safetyCushion).toBe(40.0);
      expect(result?.isValidated).toBe(true);
    });

    it("favors OVER 3 when low danger zone [0, 1, 2, 3] is depleted while high danger zone is active", () => {
      // 40 ticks: 0 digits of [0, 1, 2, 3], 20 digits of [6, 7, 8, 9] (50%), 20 digits of [4, 5]
      // Zone L freq = 0.0% -> Safety L = +40.0%
      // Zone H freq = 50.0% -> Safety H = -10.0%
      const digits = [...Array(20).fill(8), ...Array(20).fill(5)];
      const result = evaluateStrategySStep3Candidate("R_100", digits);
      expect(result).not.toBeNull();
      expect(result?.targetContract).toBe("over3");
      expect(result?.dangerZone).toBe("0,1,2,3");
      expect(result?.dangerFreq).toBe(0);
      expect(result?.safetyCushion).toBe(40.0);
      expect(result?.isValidated).toBe(true);
    });

    it("correctly handles realistic 40-tick sample distributions", () => {
      // Sample: 10 low digits (25%), 12 high digits (30%), 18 mid digits (45%)
      // Zone L freq = 25.0% -> Safety L = 40.0 - 25.0 = +15.0%
      // Zone H freq = 30.0% -> Safety H = 40.0 - 30.0 = +10.0%
      // Safety L > Safety H -> selects OVER 3
      const sample = [
        ...Array(10).fill(2),
        ...Array(12).fill(7),
        ...Array(18).fill(5),
      ];
      const result = evaluateStrategySStep3Candidate("1HZ75V", sample);
      expect(result).not.toBeNull();
      expect(result?.targetContract).toBe("over3");
      expect(result?.dangerFreq).toBe(25.0);
      expect(result?.safetyCushion).toBe(15.0);
    });
  });
});

import { describe, expect, it } from "vitest";
import { decideDominantCategoryTrade } from "@/lib/dominant-category-trade";

describe("decideDominantCategoryTrade", () => {
  it("counts all overlapping categories across exactly the last 16 digits", () => {
    const decision = decideDominantCategoryTrade([
      9,
      9,
      0,
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      0,
      1,
      2,
      3,
      4,
      5,
    ]);

    expect(decision.counts).toEqual({
      under4: 8,
      over4: 6,
      under5: 10,
      over5: 4,
    });
    expect(decision.topCategories).toEqual(["under5"]);
    expect(decision.selectedTrade).toBe("under5");
  });

  it("uniformly selects from tied top categories using the supplied random source", () => {
    const digits = [0, 1, 2, 3, 6, 7, 8, 9, 0, 1, 2, 3, 6, 7, 8, 9];

    const first = decideDominantCategoryTrade(digits, () => 0);
    const second = decideDominantCategoryTrade(digits, () => 0.74);

    expect(first.counts).toEqual({
      under4: 8,
      over4: 8,
      under5: 8,
      over5: 8,
    });
    expect(first.topCategories).toEqual(["under4", "over4", "under5", "over5"]);
    expect(first.selectedTrade).toBe("under4");
    expect(second.selectedTrade).toBe("under5");
  });
});

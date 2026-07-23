export const STRATEGY_WINDOW_SIZE = 16;

export type DominantCategory = "under4" | "over4" | "under5" | "over5";

export type DominantCategoryDecision = {
  counts: Record<DominantCategory, number>;
  topCategories: DominantCategory[];
  selectedTrade: DominantCategory;
};

export const decideDominantCategoryTrade = (
  digits: number[],
  random: () => number = Math.random
): DominantCategoryDecision => {
  const last16 = digits.slice(-STRATEGY_WINDOW_SIZE);
  const counts: Record<DominantCategory, number> = {
    under4: 0,
    over4: 0,
    under5: 0,
    over5: 0,
  };

  for (const digit of last16) {
    if (digit < 4) counts.under4++;
    if (digit > 4) counts.over4++;
    if (digit < 5) counts.under5++;
    if (digit > 5) counts.over5++;
  }

  const maxCount = Math.max(counts.under4, counts.over4, counts.under5, counts.over5);
  const topCategories = (Object.keys(counts) as DominantCategory[]).filter(
    category => counts[category] === maxCount
  );
  const selectedTrade = topCategories[Math.floor(random() * topCategories.length)];

  return {
    counts,
    topCategories,
    selectedTrade,
  };
};


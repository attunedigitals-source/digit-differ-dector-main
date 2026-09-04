/**
 * Strategy A — "Pre-Planned Cycles" Arrangement Brain
 * 
 * Provides O(1) memory programmatic generation of the 369,600 unique
 * balanced permutations of U4, O4, U5, and O5 (each appearing exactly 3 times).
 * Uses a cycle-walking LCG bijection to shuffle the arrangements with zero duplicates
 * until the entire deck of 369,600 is exhausted.
 */

const ELEMENTS = ["U4", "O4", "U5", "O5"];
const COUNTS = [3, 3, 3, 3];
const TOTAL_ARRANGEMENTS = 369600;

/**
 * Calculates the factorial of a number
 */
export function factorial(num: number): number {
  if (num <= 1) return 1;
  let res = 1;
  for (let i = 2; i <= num; i++) {
    res *= i;
  }
  return res;
}

/**
 * Programmatically computes the N-th lexicographical permutation of the given elements
 * with their respective counts. This matches the Excel Arrangements sheet exactly!
 * 
 * @param elements The sorted unique elements, e.g., ["U4", "O4", "U5", "O5"]
 * @param counts The occurrences of each element, e.g., [3, 3, 3, 3]
 * @param n The 1-indexed permutation number (from 1 to 369,600)
 */
export function getNthPermutation(
  elements: string[],
  counts: number[],
  n: number
): string[] {
  let tempN = n - 1; // Convert to 0-indexed
  const result: string[] = [];
  const totalElements = counts.reduce((a, b) => a + b, 0);
  const currentCounts = [...counts];

  for (let position = 0; position < totalElements; position++) {
    for (let i = 0; i < elements.length; i++) {
      if (currentCounts[i] > 0) {
        currentCounts[i] -= 1;
        
        let denom = 1;
        for (const c of currentCounts) {
          denom *= factorial(c);
        }
        const numPerms = Math.floor(factorial(totalElements - 1 - position) / denom);

        if (tempN < numPerms) {
          result.push(elements[i]);
          break;
        } else {
          tempN -= numPerms;
          currentCounts[i] += 1;
        }
      }
    }
  }
  return result;
}

/**
 * A Linear Congruential Generator (LCG) cycle-walking bijection.
 * Maps every index in [0, size - 1] to a unique pseudo-random shuffled index in the same range.
 * This guarantees zero duplicates and complete coverage of all 369,600 arrangements
 * without needing to load or keep track of huge arrays.
 * 
 * @param index The counter of arrangements used (0 to size - 1)
 * @param size The total size of the deck (369,600)
 * @param seed A session or user-level seed to randomize the traversal order
 */
export function lcgPermute(index: number, size: number, seed: number): number {
  // P is the smallest prime number larger than the deck size
  // For size 369,600, P = 369623
  // For size 7,484,400 (Strategy C with Even and Odd), P = 7484401
  // For size 29,937,600 (Strategy D with Even, Odd, Rise, Fall), P = 29937601
  const P = size === 29937600 ? 29937601 : (size === 7484400 ? 7484401 : (size === 40320 ? 40343 : 369623));
  
  // High quality prime-based LCG multipliers
  const a = 15485863;
  const c = 2038074743 + seed;
  
  let val = (index * a + c) % P;
  while (val >= size) {
    val = (val * a + c) % P;
  }
  return val;
}

/**
 * Fetches the arrangement at the given progress index under a shuffling seed
 * 
 * @param progressIndex The deck progress (0 to 369,599)
 * @param seed The shuffling seed
 */
export function getNextArrangement(progressIndex: number, seed: number): { index: number; arrangement: string[] } {
  // Safely bound the progress index
  const safeProgress = progressIndex % TOTAL_ARRANGEMENTS;
  const arrangementIndex = lcgPermute(safeProgress, TOTAL_ARRANGEMENTS, seed);
  
  // Permutations in our function are 1-indexed (1 to 369,600)
  const n = arrangementIndex + 1;
  const arrangement = getNthPermutation(ELEMENTS, COUNTS, n);
  
  return {
    index: n,
    arrangement,
  };
}

/**
 * Converts a direction code (e.g., "U4") to its Deriv contract parameters
 */
export function directionToDetails(direction: string): {
  type: "DIGITOVER" | "DIGITUNDER" | "DIGITEVEN" | "DIGITODD" | "CALLE" | "PUTE";
  barrier?: number;
} {
  switch (direction) {
    case "U4":
      return { type: "DIGITUNDER", barrier: 4 };
    case "O4":
      return { type: "DIGITOVER", barrier: 4 };
    case "U5":
      return { type: "DIGITUNDER", barrier: 5 };
    case "O5":
      return { type: "DIGITOVER", barrier: 5 };
    case "O1":
      return { type: "DIGITOVER", barrier: 1 };
    case "U8":
      return { type: "DIGITUNDER", barrier: 8 };
    case "O2":
      return { type: "DIGITOVER", barrier: 2 };
    case "U7":
      return { type: "DIGITUNDER", barrier: 7 };
    case "O3":
      return { type: "DIGITOVER", barrier: 3 };
    case "U6":
      return { type: "DIGITUNDER", barrier: 6 };
    case "EV":
      return { type: "DIGITEVEN", barrier: undefined };
    case "Odd":
    case "OD":
    case "O":
      return { type: "DIGITODD", barrier: undefined };
    case "RISE":
    case "Rise":
      return { type: "PUTE", barrier: undefined };
    case "FALL":
    case "Fall":
      return { type: "CALLE", barrier: undefined };
    default:
      console.warn(`[ArrangementBrain] Unknown direction code: ${direction}. Falling back to default O5.`);
      return { type: "DIGITOVER", barrier: 5 };
  }
}

/**
 * Computes the 1-indexed lexicographical permutation number (1 to 369,600)
 * of the given arrangement of 12 elements with counts [3, 3, 3, 3].
 */
export function getPermutationIndex(
  elements: string[] = ELEMENTS,
  counts: number[] = COUNTS,
  arrangement: string[]
): number {
  const totalElements = counts.reduce((a, b) => a + b, 0);
  const currentCounts = [...counts];
  let rank = 0;

  for (let position = 0; position < totalElements; position++) {
    const elem = arrangement[position];
    for (let i = 0; i < elements.length; i++) {
      if (elements[i] === elem) {
        break;
      }
      if (currentCounts[i] > 0) {
        currentCounts[i] -= 1;
        let denom = 1;
        for (const c of currentCounts) {
          denom *= factorial(c);
        }
        const numPerms = Math.floor(factorial(totalElements - 1 - position) / denom);
        rank += numPerms;
        currentCounts[i] += 1; // Backtrack
      }
    }
    const idx = elements.indexOf(elem);
    if (idx !== -1 && currentCounts[idx] > 0) {
      currentCounts[idx] -= 1;
    }
  }
  return rank + 1; // Convert 0-indexed rank to 1-indexed position
}

/**
 * Shuffles an array in place using standard Fisher-Yates shuffle
 */
function shuffle<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = temp;
  }
  return shuffled;
}

/**
 * Creates a pool of all valid arrangements having the specified prefix of loss directions,
 * selects one at random from this pool, and returns it.
 * 
 * @param prefix The prefix of consecutive loss directions (e.g. ["U4", "O5"])
 * @param elements The sorted unique elements (default ["U4", "O4", "U5", "O5"])
 * @param counts The occurrences of each element (default [3, 3, 3, 3])
 */
export function getRandomSequenceWithPrefix(
  prefix: string[],
  elements: string[] = ELEMENTS,
  counts: number[] = COUNTS
): string[] {
  // Determine remaining counts
  const remainingCounts = [...counts];
  for (const item of prefix) {
    const idx = elements.indexOf(item);
    if (idx !== -1 && remainingCounts[idx] > 0) {
      remainingCounts[idx] -= 1;
    }
  }

  // Construct remaining elements list
  const remainingElements: string[] = [];
  for (let i = 0; i < elements.length; i++) {
    for (let c = 0; c < remainingCounts[i]; c++) {
      remainingElements.push(elements[i]);
    }
  }

  // Shuffle remaining elements and combine
  const shuffledRemaining = shuffle(remainingElements);
  return [...prefix, ...shuffledRemaining];
}

/**
 * Checks if a candidate arrangement starts with any blacklisted prefix (of any length)
 */
export function isPrefixBlacklisted(
  arr: string[],
  blacklistedPrefixes: string[]
): boolean {
  if (!blacklistedPrefixes || blacklistedPrefixes.length === 0) return false;
  return blacklistedPrefixes.some(blacklisted => {
    const prefixElems = blacklisted.split(",");
    if (prefixElems.length > arr.length) return false;
    for (let i = 0; i < prefixElems.length; i++) {
      if (arr[i] !== prefixElems[i]) return false;
    }
    return true;
  });
}

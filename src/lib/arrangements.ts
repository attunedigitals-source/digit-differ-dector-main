export const ARRANGEMENT_TOTAL = 369600;
const MODULUS_PRIME = 369623;
const SCRAMBLE_A = 1103515245;
const SCRAMBLE_B = 12345;

type ArrangementToken = "under4" | "over4" | "under5" | "over5";

const TOKENS: ArrangementToken[] = ["under4", "over4", "under5", "over5"];
const TOKEN_COUNTS: Record<ArrangementToken, number> = {
  under4: 3,
  over4: 3,
  under5: 3,
  over5: 3,
};

const factorial = (n: number): number => {
  let out = 1;
  for (let i = 2; i <= n; i += 1) out *= i;
  return out;
};

const countPermutations = (remaining: number, counts: Record<ArrangementToken, number>): number => {
  let denom = 1;
  for (const token of TOKENS) denom *= factorial(counts[token]);
  return factorial(remaining) / denom;
};

export const getArrangementPermutation = (oneBasedIndex: number): ArrangementToken[] => {
  if (!Number.isInteger(oneBasedIndex) || oneBasedIndex < 1 || oneBasedIndex > ARRANGEMENT_TOTAL) {
    throw new Error(`Arrangement index must be an integer in [1, ${ARRANGEMENT_TOTAL}]`);
  }

  const counts = { ...TOKEN_COUNTS };
  const output: ArrangementToken[] = [];
  let rank = oneBasedIndex - 1;

  for (let pos = 0; pos < 12; pos += 1) {
    const remaining = 12 - pos - 1;
    for (const token of TOKENS) {
      if (counts[token] === 0) continue;
      counts[token] -= 1;
      const bucketSize = countPermutations(remaining, counts);
      if (rank < bucketSize) {
        output.push(token);
        break;
      }
      rank -= bucketSize;
      counts[token] += 1;
    }
  }

  return output;
};

export const getScrambledArrangementIndex = (zeroBasedSequence: number): number => {
  if (!Number.isInteger(zeroBasedSequence) || zeroBasedSequence < 0 || zeroBasedSequence >= ARRANGEMENT_TOTAL) {
    throw new Error(`Sequence index must be an integer in [0, ${ARRANGEMENT_TOTAL - 1}]`);
  }

  let x = zeroBasedSequence;
  while (true) {
    x = ((SCRAMBLE_A * x + SCRAMBLE_B) % MODULUS_PRIME + MODULUS_PRIME) % MODULUS_PRIME;
    if (x < ARRANGEMENT_TOTAL) {
      return x + 1;
    }
  }
};

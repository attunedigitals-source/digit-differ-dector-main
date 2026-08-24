export interface SymbolState {
  symbol: string;
  digits: number[];
  tickCount: number;
  lastSignalTick: number;
  updatedAt?: number;
}

export interface Signal {
  symbol: string;
  dangerDigit: number;
  confidence: number;
  validUntilTick: number;
  tickCount: number;
  timestamp: Date;
}

const MAX_HISTORY = 1000;

export function createSymbolState(symbol: string): SymbolState {
  return { symbol, digits: [], tickCount: 0, lastSignalTick: -10, updatedAt: Date.now() };
}

export function getSymbolDefaultPipSize(symbol: string): number {
  if (symbol.startsWith("1HZ")) return 2; // 1HZ10V, 1HZ25V, 1HZ50V, 1HZ75V, 1HZ100V
  if (symbol === "R_10" || symbol === "R_25") return 3;
  if (symbol === "R_50" || symbol === "R_75") return 4;
  if (symbol === "R_100") return 2;
  return 2;
}

export function extractLastDigit(quote: number | string, pipSize?: number): number {
  let str: string;
  if (typeof quote === "number") {
    if (pipSize !== undefined && pipSize >= 0) {
      str = quote.toFixed(pipSize);
    } else {
      str = String(quote);
    }
  } else {
    str = String(quote).trim();
  }

  if (pipSize !== undefined && pipSize >= 0 && !isNaN(Number(quote))) {
    const num = Number(quote);
    if (!isNaN(num)) {
      str = num.toFixed(pipSize);
    }
  }

  const lastChar = str[str.length - 1];
  const parsed = parseInt(lastChar, 10);
  return isNaN(parsed) ? 0 : parsed;
}

export function addTick(state: SymbolState, digit: number): SymbolState {
  const digits = [...state.digits, digit];
  if (digits.length > MAX_HISTORY) digits.shift();
  return { ...state, digits, tickCount: state.tickCount + 1, updatedAt: Date.now() };
}

export function getLeastFrequentDigits(digits: number[], count: number = 4): number[] {
  if (digits.length === 0) return [];

  // Count occurrences of each digit 0-9
  const frequencies = new Array(10).fill(0).map((_, i) => ({ digit: i, count: 0 }));
  digits.forEach(d => {
    if (d >= 0 && d <= 9) frequencies[d].count++;
  });

  // Sort by count (ascending)
  frequencies.sort((a, b) => a.count - b.count);

  // Return the digits of the first 'count' items
  return frequencies.slice(0, count).map(f => f.digit);
}

function computeScores(digits: number[]): number[] {
  const scores = new Array(10).fill(0);
  const len = digits.length;
  if (len < 30) return scores;

  // For the Danger Score (Live Signals), we use a smaller window of 200 for 'local' momentum
  const analysisWindow = digits.slice(-200);
  const recent20 = analysisWindow.slice(-20);
  const recent10 = analysisWindow.slice(-10);

  const overallFreq = new Array(10).fill(0);
  for (const d of analysisWindow) overallFreq[d]++;

  for (let d = 0; d <= 9; d++) {
    let lastSeen = -1;
    for (let i = analysisWindow.length - 1; i >= 0; i--) {
      if (analysisWindow[i] === d) { lastSeen = i; break; }
    }
    const gap = lastSeen === -1 ? analysisWindow.length : analysisWindow.length - 1 - lastSeen;
    const normalizedGap = Math.min(gap / 30, 1);
    const recentFreq = recent20.filter((x) => x === d).length / recent20.length;
    const patternScore = recent10.includes(d) ? 0 : 1;
    const overallWeight = overallFreq[d] / analysisWindow.length;

    scores[d] = 0.4 * normalizedGap + 0.3 * (1 - recentFreq) + 0.15 * patternScore + 0.15 * (1 - overallWeight);
  }

  return scores;
}

export function generateSignal(state: SymbolState): Signal | null {
  if (state.digits.length < 30) return null;
  if (state.tickCount - state.lastSignalTick < 10) return null;

  const scores = computeScores(state.digits);
  const maxScore = Math.max(...scores);
  const dangerDigit = scores.indexOf(maxScore);

  if (maxScore < 0.65) return null;

  return {
    symbol: state.symbol,
    dangerDigit,
    confidence: Math.min(maxScore, 0.99),
    validUntilTick: state.tickCount + 3,
    tickCount: state.tickCount,
    timestamp: new Date(),
  };
}

export interface StrategyREvenOddEvaluation {
  symbol: string;
  pattern: "EVEN_EVEN" | "ODD_ODD";
  targetContract: "even" | "odd";
  d1: number;
  p1: number;
  d2: number;
  p2: number;
  d3: number;
  p3: number;
  triggerDigit: number; // D10
  p10: number;
  triggerAppeared: boolean;
  triggerTickIndex?: number;
  nextTickDigit?: number;
  isValidated: boolean; // Criterion E fulfilled
  isInvalidated: boolean; // Criterion E failed
}

export function evaluateStrategyREvenOddCandidate(
  symbol: string,
  digits: number[]
): StrategyREvenOddEvaluation | null {
  if (!digits || digits.length < 100) {
    return null;
  }

  // Use up to last 1000 digits
  const sample = digits.slice(-1000);
  const total = sample.length;
  if (total === 0) return null;

  // Compute counts for digits 0-9
  const counts: Record<number, number> = { 0:0, 1:0, 2:0, 3:0, 4:0, 5:0, 6:0, 7:0, 8:0, 9:0 };
  for (const d of sample) {
    if (d >= 0 && d <= 9) {
      counts[d] = (counts[d] || 0) + 1;
    }
  }

  // Map to array & sort by percentage descending
  const stats = Object.keys(counts).map(k => {
    const digit = parseInt(k, 10);
    const count = counts[digit];
    const percentage = Number(((count / total) * 100).toFixed(2));
    return { digit, percentage };
  }).sort((a, b) => b.percentage - a.percentage || b.digit - a.digit);

  const d1Info = stats[0];
  const d2Info = stats[1];
  const d3Info = stats[2];
  const d10Info = stats[9]; // Least highest digit (lowest percentage)

  const isD1Even = d1Info.digit % 2 === 0;
  const isD2Even = d2Info.digit % 2 === 0;

  // Criterion A & Criterion F (Tie-Breaker):
  // If D1 and D2 have matching parity (both EVEN or both ODD), use that parity.
  // Criterion F: If D1 and D2 have different parity (one EVEN, one ODD tie), randomly select target contract parity.
  let pattern: "EVEN_EVEN" | "ODD_ODD";
  let targetContract: "even" | "odd";

  if (isD1Even === isD2Even) {
    pattern = isD1Even ? "EVEN_EVEN" : "ODD_ODD";
    targetContract = isD1Even ? "even" : "odd";
  } else {
    // Criterion F: Tie of EVEN and ODD -> randomly select target contract
    const chooseEven = Math.random() < 0.5;
    pattern = chooseEven ? "EVEN_EVEN" : "ODD_ODD";
    targetContract = chooseEven ? "even" : "odd";
  }

  // Criterion B: P1 >= 11.0% AND P2 >= 11.0%
  if (d1Info.percentage < 11.0 || d2Info.percentage < 11.0) {
    return null;
  }

  // Criterion C: P3 <= 9.5%
  if (d3Info.percentage > 9.5) {
    return null;
  }

  // Criterion D: D10 (trigger digit) must have OPPOSITE parity
  // For EVEN_EVEN -> D10 must be ODD (d10 % 2 !== 0)
  // For ODD_ODD -> D10 must be EVEN (d10 % 2 === 0)
  const isD10Even = d10Info.digit % 2 === 0;
  if (pattern === "EVEN_EVEN" && isD10Even) {
    return null; // D10 must be ODD
  }
  if (pattern === "ODD_ODD" && !isD10Even) {
    return null; // D10 must be EVEN
  }

  const triggerDigit = d10Info.digit;

  // Criterion E: Check live tick pattern sequence
  // Find the last occurrence of triggerDigit in digits
  let triggerTickIndex = -1;
  for (let i = digits.length - 1; i >= 0; i--) {
    if (digits[i] === triggerDigit) {
      triggerTickIndex = i;
      break;
    }
  }

  let triggerAppeared = false;
  let nextTickDigit: number | undefined = undefined;
  let isValidated = false;
  let isInvalidated = false;

  if (triggerTickIndex >= 0) {
    triggerAppeared = true;
    // Check if there is a tick immediately following the trigger digit
    if (triggerTickIndex < digits.length - 1) {
      nextTickDigit = digits[triggerTickIndex + 1];
      const isNextEven = nextTickDigit % 2 === 0;

      if (pattern === "EVEN_EVEN") {
        // Trigger is ODD. If next digit is EVEN -> VALIDATED!
        if (isNextEven) {
          isValidated = true;
        } else {
          isInvalidated = true;
        }
      } else {
        // Pattern is ODD_ODD. Trigger is EVEN. If next digit is ODD -> VALIDATED!
        if (!isNextEven) {
          isValidated = true;
        } else {
          isInvalidated = true;
        }
      }
    }
  }

  return {
    symbol,
    pattern,
    targetContract,
    d1: d1Info.digit,
    p1: d1Info.percentage,
    d2: d2Info.digit,
    p2: d2Info.percentage,
    d3: d3Info.digit,
    p3: d3Info.percentage,
    triggerDigit,
    p10: d10Info.percentage,
    triggerAppeared,
    triggerTickIndex,
    nextTickDigit,
    isValidated,
    isInvalidated,
  };
}

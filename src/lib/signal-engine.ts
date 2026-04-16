export interface SymbolState {
  symbol: string;
  digits: number[];
  tickCount: number;
  lastSignalTick: number;
}

export interface Signal {
  symbol: string;
  dangerDigit: number;
  confidence: number;
  validUntilTick: number;
  tickCount: number;
  timestamp: Date;
}

const MAX_HISTORY = 200;

export function createSymbolState(symbol: string): SymbolState {
  return { symbol, digits: [], tickCount: 0, lastSignalTick: -10 };
}

export function extractLastDigit(quote: number): number {
  // Use string representation to handle decimal precision correctly
  const str = String(quote);
  const dotIndex = str.indexOf('.');
  if (dotIndex === -1) return 0;
  return parseInt(str[str.length - 1], 10);
}

export function addTick(state: SymbolState, digit: number): SymbolState {
  const digits = [...state.digits, digit];
  if (digits.length > MAX_HISTORY) digits.shift();
  return { ...state, digits, tickCount: state.tickCount + 1 };
}

function computeScores(digits: number[]): number[] {
  const scores = new Array(10).fill(0);
  const len = digits.length;
  if (len < 30) return scores;

  const recent20 = digits.slice(-20);
  const recent10 = digits.slice(-10);

  // Overall frequency for baseline
  const overallFreq = new Array(10).fill(0);
  for (const d of digits) overallFreq[d]++;

  for (let d = 0; d <= 9; d++) {
    // Normalized gap: how long since digit last appeared
    let lastSeen = -1;
    for (let i = len - 1; i >= 0; i--) {
      if (digits[i] === d) { lastSeen = i; break; }
    }
    const gap = lastSeen === -1 ? len : len - 1 - lastSeen;
    const normalizedGap = Math.min(gap / 30, 1);

    // Recent frequency in last 20 ticks
    const recentFreq = recent20.filter((x) => x === d).length / recent20.length;

    // Pattern score
    const patternScore = recent10.includes(d) ? 0 : 1;

    // Overall frequency weight - digits appearing less overall get lower danger score
    const overallWeight = overallFreq[d] / len;

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

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

const MAX_HISTORY = 1000;

export function createSymbolState(symbol: string): SymbolState {
  return { symbol, digits: [], tickCount: 0, lastSignalTick: -10 };
}

export function extractLastDigit(quote: number | string): number {
  const str = String(quote);
  const lastChar = str[str.length - 1];
  return parseInt(lastChar, 10) || 0;
}

export function addTick(state: SymbolState, digit: number): SymbolState {
  const digits = [...state.digits, digit];
  if (digits.length > MAX_HISTORY) digits.shift();
  return { ...state, digits, tickCount: state.tickCount + 1 };
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

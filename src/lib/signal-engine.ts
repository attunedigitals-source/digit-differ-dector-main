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

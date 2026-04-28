import { getSymbolName } from "./deriv-symbols";

export interface AdaptiveResult {
  symbol: string;
  avoid_digits: number[];
  confidence: number;
  strategy: string;
  weights: Record<string, number>;
  market_state: string;
  status: string;
  // Metadata for weight updates
  model_predictions: Record<string, number[]>;
}

// -------------------------------------------------------------
// Core Utilities
// -------------------------------------------------------------

function normalizeScore(arr: number[]): number[] {
  const min = Math.min(...arr);
  const max = Math.max(...arr);
  if (max === min) return arr.map(() => 0.5);
  return arr.map(v => (v - min) / (max - min));
}

function computeFrequency(digits: number[]): number[] {
  const freqs = new Array(10).fill(0);
  if (digits.length === 0) return freqs;
  for (const d of digits) {
    if (d >= 0 && d <= 9) freqs[d]++;
  }
  return freqs.map(f => f / digits.length);
}

function getBaseEntropy(digits: number[]): number {
  const freq = computeFrequency(digits);
  return freq.reduce((acc, p) => (p > 0 ? acc - p * Math.log2(p) : acc), 0);
}

// -------------------------------------------------------------
// The 4 Base Mathematical Models (Inverted for Safe Barrier)
// High Score = Unlikely to appear = Good to avoid (Barrier)
// -------------------------------------------------------------

export function compute_entropy_scores(digits: number[]): number[] {
  if (digits.length === 0) return new Array(10).fill(0.5);
  const baseEntropy = getBaseEntropy(digits);
  
  const gains = new Array(10).fill(0);
  for (let d = 0; d < 10; d++) {
    const withoutD = digits.filter(x => x !== d);
    const hWithout = withoutD.length > 0 ? getBaseEntropy(withoutD) : 0;
    // Positive gain = d was dominant. Negative gain = d was rare.
    gains[d] = hWithout - baseEntropy;
  }
  
  // We want safe barriers -> low frequency -> negative gain -> invert gain to make it positive.
  const invertedGains = gains.map(g => -g);
  return normalizeScore(invertedGains);
}

export function compute_transition_scores(digits: number[]): number[] {
  if (digits.length < 2) return new Array(10).fill(0.5);
  
  const matrix: number[][] = Array(10).fill(0).map(() => Array(10).fill(0));
  for (let i = 0; i < digits.length - 1; i++) {
    const current = digits[i];
    const next = digits[i + 1];
    if (current >= 0 && current <= 9 && next >= 0 && next <= 9) {
      matrix[current][next]++;
    }
  }
  
  const lastObserved = digits[digits.length - 1];
  const row = matrix[lastObserved];
  const totalTransitions = row.reduce((sum, count) => sum + count, 0);
  
  const probs = row.map(count => totalTransitions > 0 ? count / totalTransitions : 0.1);
  
  // We want low probability of appearance -> High score
  const invertedProbs = probs.map(p => 1 - p);
  return normalizeScore(invertedProbs);
}

export function compute_compression_scores(digits: number[]): number[] {
  if (digits.length < 4) return new Array(10).fill(0.5);
  
  const freqs = computeFrequency(digits);
  const meanFreq = 0.1;
  const variance = freqs.reduce((acc, f) => acc + Math.pow(f - meanFreq, 2), 0) / 10;
  
  const low_threshold = 0.005; 
  let rawScores = new Array(10).fill(0);
  
  if (variance < low_threshold) {
    // Compression regime: user wants normalized freq. High freq -> High rawScore
    rawScores = normalizeScore(freqs);
  } else {
    // Expansion regime: user wants momentum. 
    const quarter = Math.floor(digits.length * 0.25);
    if (quarter > 0) {
      const pastWindow = digits.slice(0, digits.length - quarter);
      const recentWindow = digits.slice(digits.length - quarter);
      const pastFreq = computeFrequency(pastWindow);
      const recentFreq = computeFrequency(recentWindow);
      const momentum = recentFreq.map((rf, i) => rf - pastFreq[i]);
      rawScores = normalizeScore(momentum);
    } else {
      rawScores = normalizeScore(freqs);
    }
  }
  
  // Invert for Safe Barrier Selection
  const safeScores = rawScores.map(s => 1 - s);
  return normalizeScore(safeScores);
}

export function compute_zscore_scores(short_digits: number[], long_digits: number[]): number[] {
  if (short_digits.length === 0 || long_digits.length === 0) return new Array(10).fill(0.5);
  
  const longFreqs = computeFrequency(long_digits);
  const shortCounts = new Array(10).fill(0);
  for (const d of short_digits) {
    if (d >= 0 && d <= 9) shortCounts[d]++;
  }
  
  const zScores = new Array(10).fill(0);
  const short_len = short_digits.length;
  
  for (let d = 0; d < 10; d++) {
    const p = longFreqs[d] || 0.1; 
    const expected = short_len * p;
    // Prevent div by 0 and extremely small stddev variance
    const stdDev = Math.max(1, Math.sqrt(short_len * p * (1 - p)));
    zScores[d] = (shortCounts[d] - expected) / stdDev;
  }
  
  const rawZ = zScores.map(z => Math.max(0, z)); // High positive Z = exceptionally frequent
  const normalizedZ = normalizeScore(rawZ);
  
  // Invert for Safe Barrier Selection
  const safeScores = normalizedZ.map(s => 1 - s);
  return normalizeScore(safeScores);
}

// -------------------------------------------------------------
// Voting & Ensemble System Map
// -------------------------------------------------------------

function run_base_models(short_digits: number[], mid_digits: number[], long_digits: number[]) {
  return {
    entropy: compute_entropy_scores(short_digits),
    transition: compute_transition_scores(short_digits),
    compression: compute_compression_scores(short_digits),
    zscore: compute_zscore_scores(short_digits, long_digits)
  };
}

// Global Weight State
const defaultWeights = {
  entropy: 0.25,
  transition: 0.20,
  compression: 0.15,
  zscore: 0.20,
  voting: 0.20,
};

type ModelWeights = typeof defaultWeights;

export const symbolWeightsState = new Map<string, ModelWeights>();

export function get_symbol_weights(symbol: string): ModelWeights {
  if (!symbolWeightsState.has(symbol)) {
    symbolWeightsState.set(symbol, { ...defaultWeights });
  }
  return symbolWeightsState.get(symbol)!;
}

export function reset_symbol_weights(symbol: string) {
  symbolWeightsState.set(symbol, { ...defaultWeights });
}

// Self-Learning Adjustment Engine
export function update_model_weights(symbol: string, isWin: boolean, chosenDigits: number[], modelPredictions: Record<string, number[]>) {
  const w = get_symbol_weights(symbol);
  const learning_rate = 0.05;
  const models = ["entropy", "transition", "compression", "zscore", "voting"] as const;
  
  for (const m of models) {
    if (!modelPredictions[m]) continue;
    // 1. Track contribution
    let sumScore = 0;
    for (const d of chosenDigits) {
      sumScore += modelPredictions[m][d];
    }
    const contribution = chosenDigits.length > 0 ? sumScore / chosenDigits.length : 0;
    
    // 2. Adjust using grad descent style update
    if (isWin) {
      w[m] += learning_rate * contribution;
    } else {
      w[m] -= learning_rate * contribution;
    }
    
    // Clamp clamping defaults [0.05, 0.50]
    w[m] = Math.max(w[m] as number, 0.05);
    w[m] = Math.min(w[m] as number, 0.50);
  }
  
  // Normalize Weights to sum to 1
  const sumWeights = Object.values(w).reduce((sum, val) => sum + val, 0);
  if (sumWeights > 0) {
    for (const m of models) {
      w[m] = w[m] / sumWeights;
    }
  } else {
    reset_symbol_weights(symbol); // Fallback
  }
}

// -------------------------------------------------------------
// Engine Entrance
// -------------------------------------------------------------

export function select_avoid_digits(symbol: string, all_historical_digits: number[]): AdaptiveResult | null {
  const longWindow = 1000;
  const midWindow = 300;
  const shortWindow = 100;

  // Need at least minimal short window to attempt modeling
  if (all_historical_digits.length < shortWindow) {
    return null;
  }

  const long_digits = all_historical_digits.slice(-longWindow);
  
  // 5. Time-sliced Voting Model (uses 50, 100, 300)
  const sizes = [50, 100, 300];
  const votes = new Array(10).fill(0);
  
  for (const size of sizes) {
    if (long_digits.length < size) continue;
    const slice = long_digits.slice(-size);
    const m = run_base_models(slice, long_digits.slice(-midWindow), long_digits);
    
    // Quick equal-weight ensemble for this slice
    const sliceScores = new Array(10).fill(0);
    for (let d = 0; d < 10; d++) {
      sliceScores[d] = m.entropy[d] + m.transition[d] + m.compression[d] + m.zscore[d];
    }
    const rankedSlice = sliceScores.map((score, digit) => ({ score, digit })).sort((a, b) => b.score - a.score);
    // Give a vote to the Top 4 digits (highest safe scores)
    for (let i = 0; i < 4; i++) {
        votes[rankedSlice[i].digit]++;
    }
  }
  
  const votingScores = normalizeScore(votes);

  // Main evaluation on Short Window (100) vs Long Window logic
  const short_digits = long_digits.slice(-shortWindow);
  const mid_digits = long_digits.slice(-midWindow);
  const m_final = run_base_models(short_digits, mid_digits, long_digits);
  
  const modelPredictions = {
    entropy: m_final.entropy,
    transition: m_final.transition,
    compression: m_final.compression,
    zscore: m_final.zscore,
    voting: votingScores
  };

  const weights = get_symbol_weights(symbol);
  
  const final_score = new Array(10).fill(0);
  for (let d = 0; d < 10; d++) {
    final_score[d] = 
      weights.entropy * m_final.entropy[d] +
      weights.transition * m_final.transition[d] +
      weights.compression * m_final.compression[d] +
      weights.zscore * m_final.zscore[d] +
      weights.voting * votingScores[d];
  }
  
  // Conflict Filter: standard dev across model scores per digit
  const conflict_threshold = 0.35; // reasonable stdev for normalized 0-1 scale limits
  const filtered_score = [...final_score];
  for (let d = 0; d < 10; d++) {
     const scoresOfD = [
       m_final.entropy[d], m_final.transition[d], m_final.compression[d], m_final.zscore[d], votingScores[d]
     ];
     const avg = scoresOfD.reduce((s, x) => s + x, 0) / 5;
     const variance = scoresOfD.reduce((s, x) => s + Math.pow(x - avg, 2), 0) / 5;
     const stdev = Math.sqrt(variance);
     
     if (stdev > conflict_threshold) {
         filtered_score[d] = -Infinity; // Exclude
     }
  }

  // Confidence Calculation
  const validScores = filtered_score.filter(s => s !== -Infinity);
  if (validScores.length === 0) return null;
  
  const maxScore = Math.max(...validScores);
  
  // Find median
  const sortedValid = [...validScores].sort((a,b) => a - b);
  const midIndex = Math.floor(sortedValid.length / 2);
  const medianScore = sortedValid.length % 2 !== 0 
      ? sortedValid[midIndex] 
      : (sortedValid[midIndex - 1] + sortedValid[midIndex]) / 2;

  const confidence = maxScore - medianScore;
  const confidence_threshold = 0.12;
  
  if (confidence <= confidence_threshold) {
      return null; // Don't trade if edge isn't clear
  }
  
  // Final Selection
  const rankedDigs = filtered_score.map((score, digit) => ({ score, digit }))
                      .filter(x => x.score !== -Infinity)
                      .sort((a, b) => b.score - a.score);
                      
  if (rankedDigs.length < 4) return null; // Not enough safe pool
  
  const avoid_digits = rankedDigs.slice(0, 4).map(r => r.digit);
  
  const state = variance(computeFrequency(short_digits)) < 0.005 ? "compression" : "expansion";

  return {
    symbol,
    avoid_digits,
    confidence,
    strategy: "Multivariate Ensemble",
    weights: { ...weights },
    market_state: state,
    status: "TRADE",
    model_predictions: modelPredictions
  };
}

// Utility for variance to flag text market state
function variance(freqs: number[]): number {
    const mean = 0.1;
    return freqs.reduce((acc, f) => acc + Math.pow(f - mean, 2), 0) / 10;
}

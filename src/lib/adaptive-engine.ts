import { getSymbolName } from "./deriv-symbols";

export interface AdaptiveResult {
  symbol: string;
  avoid_digits: number[];
  confidence: number;
  strategy: string;
}

export function compute_frequency(digits: number[]): number[] {
  const frequencies = new Array(10).fill(0);
  const total = digits.length;
  if (total === 0) return frequencies;

  for (const d of digits) {
    if (d >= 0 && d <= 9) frequencies[d]++;
  }

  // Normalize to probability
  return frequencies.map(f => f / total);
}

export function compute_momentum(digits: number[]): number[] {
  const total = digits.length;
  if (total < 4) return new Array(10).fill(0);

  const quarter = Math.floor(total * 0.25);
  const past_window = digits.slice(0, total - quarter);
  const recent_window = digits.slice(total - quarter);

  const past_freq = compute_frequency(past_window);
  const recent_freq = compute_frequency(recent_window);

  return recent_freq.map((rf, i) => rf - past_freq[i]);
}

export function compute_streak(digits: number[]): number[] {
  const streak_score = new Array(10).fill(0);
  if (digits.length === 0) return streak_score;

  // We are interested in streaks at the end of the window (current streak) 
  // or generally across the window. "length of current streak" implies looking from the end.
  const last_digit = digits[digits.length - 1];
  let streak = 0;
  
  for (let i = digits.length - 1; i >= 0; i--) {
    if (digits[i] === last_digit) {
      streak++;
    } else {
      break;
    }
  }

  // Only the last digit has a positive current streak.
  // Normalize it arbitrarily (e.g. out of 5 max typical streak to keep it 0-1 range)
  streak_score[last_digit] = Math.min(streak / 5, 1);

  return streak_score;
}

export function select_avoid_digits(symbol: string, all_historical_digits: number[]): AdaptiveResult | null {
  const name = getSymbolName(symbol);

  let window_size = 300;
  let momentum_weight = 0;
  let streak_weight = 0;
  let frequency_weight = 0;
  let threshold = 0.10;

  if (name.includes("(1s)")) {
    window_size = 120;
    momentum_weight = 0.5;
    streak_weight = 0.3;
    frequency_weight = 0.2;
    threshold = 0.15;
  } else if (["Volatility 25", "Volatility 50", "Volatility 75"].includes(name)) {
    window_size = 300;
    momentum_weight = 0.35;
    streak_weight = 0.25;
    frequency_weight = 0.4;
    threshold = 0.10;
  } else if (["Volatility 10", "Volatility 100"].includes(name)) {
    window_size = 500;
    momentum_weight = 0.2;
    streak_weight = 0.1;
    frequency_weight = 0.7;
    threshold = 0.10;
  }

  // Truncate to window
  const digits = all_historical_digits.slice(-window_size);
  if (digits.length < window_size * 0.5) {
    // Insufficient data to make a confident prediction
    return null;
  }

  const freq = compute_frequency(digits);
  const momentum = compute_momentum(digits);
  const streak = compute_streak(digits);

  const max_freq = Math.max(...freq);
  const inverse_freq = freq.map(f => max_freq - f);

  const scores = new Array(10).fill(0);
  for (let d = 0; d <= 9; d++) {
    scores[d] = 
      (momentum_weight * momentum[d]) +
      (streak_weight * streak[d]) +
      (frequency_weight * inverse_freq[d]);
  }

  // Find confidence
  const max_score = Math.max(...scores);
  const min_score = Math.min(...scores);
  const confidence = max_score - min_score;

  if (confidence < threshold) {
    return null; // DO NOT TRADE condition
  }

  // Rank digits by score descending
  const ranked = Array.from({ length: 10 }, (_, i) => ({ digit: i, score: scores[i] }))
    .sort((a, b) => b.score - a.score);

  let avoid_digits = ranked.slice(0, 4).map(r => r.digit);

  // Anti-Overfitting Rules
  // 1. Ensure not all even or all odd
  const all_even = avoid_digits.every(d => d % 2 === 0);
  const all_odd = avoid_digits.every(d => d % 2 !== 0);

  if (all_even || all_odd) {
    // Find the highest ranked digit of the opposite parity
    const targetParity = all_even ? 1 : 0; // if all even, seek odd
    const replacement = ranked.slice(4).find(r => r.digit % 2 === targetParity);
    if (replacement) {
      avoid_digits[3] = replacement.digit;
    }
  }

  return {
    symbol,
    avoid_digits,
    confidence,
    strategy: "momentum-streak hybrid"
  };
}

export const DERIV_SYMBOLS = [
  { symbol: "1HZ10V", name: "Volatility 10 (1s)" },
  { symbol: "R_10", name: "Volatility 10" },
  { symbol: "1HZ15V", name: "Volatility 15 (1s)" },
  { symbol: "1HZ25V", name: "Volatility 25 (1s)" },
  { symbol: "R_25", name: "Volatility 25" },
  { symbol: "1HZ30V", name: "Volatility 30 (1s)" },
  { symbol: "1HZ50V", name: "Volatility 50 (1s)" },
  { symbol: "R_50", name: "Volatility 50" },
  { symbol: "1HZ75V", name: "Volatility 75 (1s)" },
  { symbol: "R_75", name: "Volatility 75" },
  { symbol: "1HZ90V", name: "Volatility 90 (1s)" },
  { symbol: "1HZ100V", name: "Volatility 100 (1s)" },
  { symbol: "R_100", name: "Volatility 100" },
] as const;

export type DerivSymbol = (typeof DERIV_SYMBOLS)[number]["symbol"];

export const getSymbolName = (symbol: string): string => {
  return DERIV_SYMBOLS.find((s) => s.symbol === symbol)?.name ?? symbol;
};

export interface TradeRecord {
  id: string;
  symbol: string;
  sequence_name?: string;
  contract: string;
  barrier: number;
  stake: number;
  profit: number;
  martingale_step: number;
  status: "WIN" | "LOSS" | "PENDING";
  next_action: string;
  timestamp: Date;
}

export type TradingStrategy = "alternating" | "strategy_a" | "strategy_b";

export interface AutoTraderConfig {
  enabled: boolean;
  baseStake: number;
  maxMartingaleSteps: number;
  cooldownIntervalMinutes: 30 | 40 | 50 | 60;
  strategy: TradingStrategy;
}

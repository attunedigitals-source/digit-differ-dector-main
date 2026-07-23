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

export type TradingStrategy = "alternating" | "strategy_a" | "strategy_b" | "strategy_c" | "strategy_d" | "strategy_e" | "strategy_f" | "strategy_g" | "strategy_h" | "strategy_i" | "strategy_j" | "strategy_k" | "strategy_l" | "strategy_m" | "strategy_n" | "strategy_o" | "strategy_p" | "strategy_q" | "strategy_r";

export interface AutoTraderConfig {
  enabled: boolean;
  baseStake: number;
  maxMartingaleSteps: number;
  cooldownIntervalMinutes: 30 | 40 | 50 | 60;
  strategy: TradingStrategy;
  strategyLBaseStake?: number;
  strategyMBaseStake?: number;
  strategyOBaseStake?: number;
  strategyPBaseStake?: number;
  strategyRBaseStake?: number;
  strategyRStickyEnabled?: boolean;
  initialBalance?: number;
  allowableLoss?: number;
  targetProfit?: number;
}


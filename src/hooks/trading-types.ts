export interface TradeRecord {
  id: string;
  symbol: string;
  contract: string;
  barrier: number;
  stake: number;
  profit: number;
  martingale_step: number;
  status: "WIN" | "LOSS" | "PENDING";
  next_action: string;
  timestamp: Date;
}

export interface AutoTraderConfig {
  enabled: boolean;
  baseStake: number;
  maxMartingaleSteps: number;
  continuousTradeCooldownMinutes: 30 | 40 | 50 | 60;
}

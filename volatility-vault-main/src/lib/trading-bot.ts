// Trading bot engine: Over/Under digit contracts on Volatility indices.
// Strategy: martingale on loss, reset on win. Take-profit / stop-loss in PnL.

import { DerivWS } from "./deriv";

export type BotConfig = {
  token: string;
  symbol: string; // e.g. R_100
  contractType: "DIGITOVER" | "DIGITUNDER";
  barrier: number; // 0..9
  stake: number; // USD
  duration: number; // ticks
  martingale: number; // multiplier on loss, 1 = none
  takeProfit: number; // stop bot when pnl >= TP
  stopLoss: number; // stop bot when pnl <= -SL
  maxTrades: number; // 0 = unlimited
};

export type TradeEvent = {
  id: string;
  time: number;
  contract_id?: number;
  type: string;
  symbol: string;
  stake: number;
  payout?: number;
  profit?: number;
  status: "open" | "won" | "lost" | "error";
  message?: string;
};

export type BotStats = {
  pnl: number;
  wins: number;
  losses: number;
  totalTrades: number;
  running: boolean;
};

type Listener = (state: { stats: BotStats; trades: TradeEvent[]; log: string[] }) => void;

export class TradingBot {
  private ws = new DerivWS();
  private cfg!: BotConfig;
  private listener: Listener | null = null;
  private stats: BotStats = { pnl: 0, wins: 0, losses: 0, totalTrades: 0, running: false };
  private trades: TradeEvent[] = [];
  private log: string[] = [];
  private currentStake = 0;
  private stopRequested = false;

  onChange(l: Listener) {
    this.listener = l;
  }

  private emit() {
    this.listener?.({ stats: { ...this.stats }, trades: [...this.trades], log: [...this.log] });
  }

  private addLog(msg: string) {
    const ts = new Date().toLocaleTimeString();
    this.log.unshift(`[${ts}] ${msg}`);
    if (this.log.length > 200) this.log.pop();
  }

  async start(cfg: BotConfig) {
    this.cfg = cfg;
    this.currentStake = cfg.stake;
    this.stopRequested = false;
    this.stats = { pnl: 0, wins: 0, losses: 0, totalTrades: 0, running: true };
    this.trades = [];
    this.log = [];
    this.addLog(`Starting bot: ${cfg.contractType} ${cfg.barrier} on ${cfg.symbol}`);
    this.emit();

    await this.ws.connect();
    await this.ws.authorize(cfg.token);
    this.addLog("Authorized with Deriv account");
    this.emit();

    while (!this.stopRequested) {
      if (this.cfg.maxTrades > 0 && this.stats.totalTrades >= this.cfg.maxTrades) {
        this.addLog(`Reached max trades (${this.cfg.maxTrades}). Stopping.`);
        break;
      }
      if (this.stats.pnl >= this.cfg.takeProfit) {
        this.addLog(`Take profit hit (${this.stats.pnl.toFixed(2)}). Stopping.`);
        break;
      }
      if (this.stats.pnl <= -this.cfg.stopLoss) {
        this.addLog(`Stop loss hit (${this.stats.pnl.toFixed(2)}). Stopping.`);
        break;
      }
      try {
        await this.runTrade();
      } catch (e: any) {
        this.addLog(`Trade error: ${e.message}`);
        this.emit();
        await new Promise((r) => setTimeout(r, 1500));
      }
    }

    this.stats.running = false;
    this.addLog("Bot stopped.");
    this.emit();
    this.ws.close();
  }

  stop() {
    this.stopRequested = true;
    this.addLog("Stop requested...");
    this.emit();
  }

  private async runTrade(): Promise<void> {
    const cfg = this.cfg;
    const stake = Math.round(this.currentStake * 100) / 100;

    // 1. Get proposal
    const proposal: any = await this.ws.send({
      proposal: 1,
      amount: stake,
      basis: "stake",
      contract_type: cfg.contractType,
      currency: "USD",
      duration: cfg.duration,
      duration_unit: "t",
      symbol: cfg.symbol,
      barrier: String(cfg.barrier),
    });

    const proposalId = proposal.proposal.id;

    // 2. Buy
    const buy: any = await this.ws.send({ buy: proposalId, price: stake });
    const contractId = buy.buy.contract_id;
    const trade: TradeEvent = {
      id: String(contractId),
      time: Date.now(),
      contract_id: contractId,
      type: cfg.contractType,
      symbol: cfg.symbol,
      stake,
      status: "open",
    };
    this.trades.unshift(trade);
    this.stats.totalTrades++;
    this.addLog(`Bought ${cfg.contractType} ${cfg.barrier} @ $${stake} (id ${contractId})`);
    this.emit();

    // 3. Poll contract until settled
    const result = await this.waitForSettlement(contractId);
    const profit = Number(result.profit || 0);
    trade.profit = profit;
    trade.payout = Number(result.payout || 0);

    if (profit >= 0) {
      trade.status = "won";
      this.stats.wins++;
      this.currentStake = cfg.stake; // reset
      this.addLog(`WON +$${profit.toFixed(2)}`);
    } else {
      trade.status = "lost";
      this.stats.losses++;
      this.currentStake = stake * cfg.martingale;
      this.addLog(`LOST $${profit.toFixed(2)}. Next stake: $${this.currentStake.toFixed(2)}`);
    }
    this.stats.pnl += profit;
    this.emit();
  }

  private async waitForSettlement(contractId: number): Promise<any> {
    // Poll proposal_open_contract every 1s
    while (true) {
      const r: any = await this.ws.send({
        proposal_open_contract: 1,
        contract_id: contractId,
      });
      const c = r.proposal_open_contract;
      if (c.is_sold || c.status === "won" || c.status === "lost") {
        return c;
      }
      await new Promise((res) => setTimeout(res, 1000));
    }
  }
}

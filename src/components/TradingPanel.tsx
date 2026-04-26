import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Bot, DollarSign, TrendingUp, Shuffle, Clock, Target } from "lucide-react";
import { type TradeRecord, type AutoTraderConfig } from "@/hooks/trading-types";
import { getSymbolName } from "@/lib/deriv-symbols";

const MIN_PROFIT_INTERVAL_COOLDOWN_AMOUNT = 50;

interface TradingPanelProps {
  config: AutoTraderConfig;
  onConfigChange: (config: AutoTraderConfig) => void;
  sessionState: any;
  ticksToWait: number;
  tradeLog: TradeRecord[];
  connected: boolean;
  hasToken: boolean;
  dailyPL: number;
}

export function TradingPanel({
  config,
  onConfigChange,
  sessionState,
  ticksToWait,
  tradeLog,
  connected,
  hasToken,
  dailyPL,
}: TradingPanelProps) {
  const canTrade = connected && hasToken && config.baseStake >= 0.35;

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-4 shadow-lg backdrop-blur-sm bg-opacity-80">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Bot className="w-5 h-5 text-primary animate-pulse" />
          Randomized Over/Under Bot
        </div>
        <Badge variant={connected ? "default" : "destructive"} className="text-[10px]">
          {connected ? "CONNECTED" : "DISCONNECTED"}
        </Badge>
      </div>

      {!connected && (
        <p className="text-xs text-destructive bg-destructive/10 p-2 rounded">
          Connect to Deriv first to enable trading.
        </p>
      )}

      {/* Main Configuration */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <DollarSign className="w-3 h-3" /> Base Stake
          </label>
          <Input
            type="number"
            min={0.35}
            step={0.1}
            value={config.baseStake}
            onChange={(e) => onConfigChange({ ...config, baseStake: Number(e.target.value) })}
            className="bg-muted border-border font-mono text-sm h-8"
          />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Target className="w-3 h-3" /> Max Martingale
          </label>
          <Input
            type="number"
            min={1}
            max={20}
            step={1}
            value={config.maxMartingaleSteps}
            onChange={(e) => onConfigChange({ ...config, maxMartingaleSteps: Number(e.target.value) })}
            className="bg-muted border-border font-mono text-sm h-8"
          />
        </div>
      </div>

      {/* Risk Tolerance Calculator */}
      {(() => {
        const MULTIPLIER = 1.8;
        let total = 0;
        let stake = config.baseStake;
        for (let i = 0; i < config.maxMartingaleSteps; i++) {
          total += Number(stake.toFixed(2));
          stake = stake * MULTIPLIER;
        }

        return (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-destructive/80 font-bold flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-destructive" />
                Risk Tolerance
              </span>
              <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-full border bg-destructive/10 text-destructive border-destructive/30">
                ${total.toFixed(2)}
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" /> Profit Interval Cooldown ($)
              </label>
              <Input
                type="number"
                min={MIN_PROFIT_INTERVAL_COOLDOWN_AMOUNT}
                step={1}
                value={config.profitIntervalCooldownAmount}
                onChange={(e) =>
                  onConfigChange({
                    ...config,
                    profitIntervalCooldownAmount: Math.max(
                      MIN_PROFIT_INTERVAL_COOLDOWN_AMOUNT,
                      Number(e.target.value || MIN_PROFIT_INTERVAL_COOLDOWN_AMOUNT)
                    ),
                  })
                }
                className="bg-muted border-border font-mono text-sm h-8"
              />
              <p className="text-[9px] text-muted-foreground">
                Every time net daily profit reaches this amount, trading pauses for 50-70 ticks.
              </p>
            </div>
          </div>
        );
      })()}

      {/* Stats & Current Session */}
      <div className="grid grid-cols-3 gap-2 bg-muted/30 p-3 rounded-md border border-border/50">
        <div className="text-center">
          <div className="text-[9px] text-muted-foreground uppercase">Daily P/L</div>
          <div className={`text-sm font-bold ${dailyPL >= 0 ? "text-green-500" : "text-destructive"}`}>
            ${dailyPL.toFixed(2)}
          </div>
        </div>
        <div className="text-center border-x border-border/50">
          <div className="text-[9px] text-muted-foreground uppercase">Cur Stake</div>
          <div className="text-sm font-bold text-foreground">
            ${sessionState.currentStake.toFixed(2)}
          </div>
        </div>
        <div className="text-center">
          <div className="text-[9px] text-muted-foreground uppercase">Step</div>
          <div className="text-sm font-bold text-foreground">
            {sessionState.martingaleStep}
          </div>
        </div>
      </div>

      {/* Bot Control */}
      <div className="flex items-center justify-between p-3 bg-primary/5 rounded-md border border-primary/20">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-full ${config.enabled ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
            <Shuffle className={`w-4 h-4 ${config.enabled ? "animate-spin-slow" : ""}`} />
          </div>
          <div>
            <div className="text-xs font-semibold">Auto-Trading Loop</div>
            <div className="text-[10px] text-muted-foreground">
              {config.enabled ? "Running Strategy..." : "Bot is Paused"}
            </div>
          </div>
        </div>
        <Switch
          checked={config.enabled}
          onCheckedChange={(enabled) => onConfigChange({ ...config, enabled })}
          disabled={!canTrade}
        />
      </div>

      {/* Status Bar */}
      {config.enabled && (
        <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" /> Cooldown:
            </span>
            <span className="font-mono font-bold text-primary">
              {ticksToWait > 0 ? `${ticksToWait} ticks` : "READY"}
            </span>
          </div>
          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
             <div 
              className="h-full bg-primary transition-all duration-300" 
              style={{ width: ticksToWait > 0 ? `${Math.min(100, (ticksToWait / 15) * 100)}%` : '100%' }}
            />
          </div>
          <div className="text-[10px] text-center italic text-muted-foreground">
            {sessionState.nextAction}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="space-y-2 pt-2 border-t border-border">
        <label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
          <Clock className="w-3 h-3" /> Recent Activity
        </label>
        <div className="max-h-48 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
          {tradeLog.length === 0 ? (
            <div className="text-[10px] text-center text-muted-foreground py-4">No trades yet this session</div>
          ) : (
            tradeLog.slice(0, 10).map((trade, i) => (
              <div
                key={i}
                className={`text-[10px] font-mono px-2 py-1.5 rounded flex items-center justify-between border ${
                  trade.status === "WIN"
                    ? "bg-green-500/5 border-green-500/20 text-green-400"
                    : trade.status === "LOSS"
                    ? "bg-destructive/5 border-destructive/20 text-destructive"
                    : "bg-muted/50 border-border text-muted-foreground"
                }`}
              >
                <div className="flex flex-col">
                  <span className="font-semibold">{getSymbolName(trade.symbol)}</span>
                  <span className="text-[8px] opacity-70">{trade.contract} B:{trade.barrier}</span>
                </div>
                <div className="flex items-center gap-2 text-right">
                  <div className="flex flex-col">
                    <span className="font-bold">${trade.stake.toFixed(2)}</span>
                    <span className="text-[8px] opacity-70">Step {trade.martingale_step}</span>
                  </div>
                  <Badge variant={trade.status === "WIN" ? "default" : trade.status === "LOSS" ? "destructive" : "secondary"} className="text-[8px] px-1 h-4">
                    {trade.status}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

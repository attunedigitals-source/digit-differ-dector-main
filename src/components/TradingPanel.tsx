import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Bot, DollarSign, TrendingUp, Shuffle, Clock, Target } from "lucide-react";
import { type TradeRecord, type AutoTraderConfig } from "@/hooks/trading-types";
import { getSymbolName } from "@/lib/deriv-symbols";

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
        const steps: { step: number; stake: number }[] = [];
        for (let i = 0; i < config.maxMartingaleSteps; i++) {
          const s = Number(stake.toFixed(2));
          steps.push({ step: i + 1, stake: s });
          total += s;
          stake = stake * MULTIPLIER;
        }
        const isHighRisk = total > 50;
        const isMedRisk = total > 15 && total <= 50;

        return (
          <div className="rounded-md border border-border/60 bg-muted/20 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-yellow-500" />
                Risk Tolerance
              </span>
              <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded-full border ${
                isHighRisk
                  ? "bg-destructive/10 text-destructive border-destructive/30"
                  : isMedRisk
                  ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/30"
                  : "bg-green-500/10 text-green-500 border-green-500/30"
              }`}>
                ${total.toFixed(2)}
              </span>
            </div>
            <p className="text-[9px] text-muted-foreground leading-relaxed">
              Max loss across <span className="font-bold text-foreground">{config.maxMartingaleSteps}</span> consecutive losses at ${config.baseStake.toFixed(2)} base stake.
            </p>
            {/* Step breakdown — collapsible on small screens */}
            <div className="grid grid-cols-4 gap-1 pt-1">
              {steps.map(({ step, stake: s }) => (
                <div key={step} className="flex flex-col items-center bg-background/50 rounded px-1 py-0.5 border border-border/40">
                  <span className="text-[8px] text-muted-foreground">L{step}</span>
                  <span className="text-[9px] font-mono font-bold text-foreground">${s.toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className={`text-[9px] font-semibold text-center pt-0.5 ${
              isHighRisk ? "text-destructive" : isMedRisk ? "text-yellow-400" : "text-green-500"
            }`}>
              {isHighRisk ? "⚠ High risk — consider reducing stake or steps" :
               isMedRisk ? "◈ Moderate risk" : "✓ Conservative risk profile"}
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

import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Bot, DollarSign, TrendingUp, Shuffle, Clock, Target } from "lucide-react";
import { type TradeRecord, type AutoTraderConfig } from "@/hooks/trading-types";
import { getSymbolName } from "@/lib/deriv-symbols";

const COOLDOWN_MINUTE_OPTIONS: Array<AutoTraderConfig["continuousTradeCooldownMinutes"]> = [30, 40, 50, 60];

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
@@ -67,60 +69,85 @@ export function TradingPanel({
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
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-1.5">
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
                <Clock className="w-3 h-3" /> Continuous Trade Cooldown Timer
              </label>
              <select
                value={config.continuousTradeCooldownMinutes}
                onChange={(e) =>
                  onConfigChange({
                    ...config,
                    continuousTradeCooldownMinutes: Number(e.target.value) as AutoTraderConfig["continuousTradeCooldownMinutes"],
                  })
                }
                className="flex h-8 w-full rounded-md border border-border bg-muted px-3 py-1 text-sm font-mono ring-offset-background"
              >
                {COOLDOWN_MINUTE_OPTIONS.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes} Minutes
                  </option>
                ))}
              </select>
              <p className="text-[9px] text-muted-foreground">
                After continuous trading for the selected duration, bot pauses for 50-70 ticks before continuing.
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

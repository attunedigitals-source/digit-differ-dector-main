import { useState } from "react";
import { DERIV_SYMBOLS, getSymbolName } from "@/lib/deriv-symbols";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Bot, DollarSign, TrendingUp, Shuffle } from "lucide-react";
import type { TradeRecord } from "@/hooks/useAutoTrader";

interface TradingPanelProps {
  autoTradeEnabled: boolean;
  onAutoTradeToggle: (enabled: boolean) => void;
  stake: number;
  onStakeChange: (stake: number) => void;
  selectedSymbols: string[];
  onSymbolsChange: (symbols: string[]) => void;
  minConfidence: number;
  onMinConfidenceChange: (v: number) => void;
  useRandomDigits: boolean;
  onRandomDigitsToggle: (enabled: boolean) => void;
  tradeLog: TradeRecord[];
  connected: boolean;
  hasToken: boolean;
}

export function TradingPanel({
  autoTradeEnabled,
  onAutoTradeToggle,
  stake,
  onStakeChange,
  selectedSymbols,
  onSymbolsChange,
  minConfidence,
  onMinConfidenceChange,
  useRandomDigits,
  onRandomDigitsToggle,
  tradeLog,
  connected,
  hasToken,
}: TradingPanelProps) {
  const toggleSymbol = (symbol: string) => {
    if (selectedSymbols.includes(symbol)) {
      onSymbolsChange(selectedSymbols.filter((s) => s !== symbol));
    } else {
      onSymbolsChange([...selectedSymbols, symbol]);
    }
  };

  const selectAll = () => onSymbolsChange(DERIV_SYMBOLS.map((s) => s.symbol));
  const deselectAll = () => onSymbolsChange([]);

  const canTrade = connected && hasToken && selectedSymbols.length > 0 && stake > 0;

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Bot className="w-4 h-4 text-primary" />
        Auto-Trading
      </div>

      {!connected && (
        <p className="text-xs text-destructive">Connect to Deriv first to enable trading.</p>
      )}

      {/* Stake */}
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground flex items-center gap-1">
          <DollarSign className="w-3 h-3" /> Stake per trade
        </label>
        <Input
          type="number"
          min={0.35}
          step={0.1}
          value={stake}
          onChange={(e) => onStakeChange(Number(e.target.value))}
          className="bg-muted border-border font-mono text-sm w-32"
        />
      </div>

      {/* Min confidence */}
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground flex items-center gap-1">
          <TrendingUp className="w-3 h-3" /> Min confidence to trade
        </label>
        <Input
          type="number"
          min={65}
          max={99}
          step={1}
          value={Math.round(minConfidence * 100)}
          onChange={(e) => onMinConfidenceChange(Number(e.target.value) / 100)}
          className="bg-muted border-border font-mono text-sm w-32"
        />
      </div>

      {/* Volatility selection */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs text-muted-foreground">Select volatilities to trade</label>
          <div className="flex gap-2">
            <button onClick={selectAll} className="text-[10px] text-primary hover:underline">Select all</button>
            <button onClick={deselectAll} className="text-[10px] text-muted-foreground hover:underline">Clear</button>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {DERIV_SYMBOLS.map((s) => (
            <label
              key={s.symbol}
              className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/50 rounded px-2 py-1.5 transition-colors"
            >
              <Checkbox
                checked={selectedSymbols.includes(s.symbol)}
                onCheckedChange={() => toggleSymbol(s.symbol)}
              />
              <span className="text-foreground">{getSymbolName(s.symbol)}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Auto-Trading Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Bot className="w-4 h-4 text-primary" />
          <span className="text-xs">Enable Auto-Trading</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {autoTradeEnabled ? "Active" : "Off"}
          </span>
          <Switch
            checked={autoTradeEnabled}
            onCheckedChange={onAutoTradeToggle}
            disabled={!canTrade}
          />
        </div>
      </div>

      {/* Random Digits Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Shuffle className="w-4 h-4 text-primary" />
          <span className="text-xs">Random avoid digits</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {useRandomDigits ? "On" : "Off"}
          </span>
          <Switch
            checked={useRandomDigits}
            onCheckedChange={onRandomDigitsToggle}
          />
        </div>
      </div>

      {/* Trade log */}
      {tradeLog.length > 0 && (
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Recent trades</label>
          <div className="max-h-64 overflow-y-auto space-y-1">
            {tradeLog.slice(0, 20).map((trade, i) => (
              <div
                key={i}
                className={`text-xs font-mono px-2 py-1 rounded flex items-center justify-between ${
                  trade.status === "won"
                    ? "bg-green-500/10 text-green-400"
                    : trade.status === "lost"
                    ? "bg-destructive/10 text-destructive"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <span>{getSymbolName(trade.symbol)} — avoid {trade.dangerDigit}</span>
                <div className="flex items-center gap-2">
                  <span>{trade.stake.toFixed(2)}</span>
                  <Badge variant={trade.status === "won" ? "default" : trade.status === "lost" ? "destructive" : "secondary"} className="text-[10px]">
                    {trade.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

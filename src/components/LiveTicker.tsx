import { DERIV_SYMBOLS, getSymbolName } from "@/lib/deriv-symbols";
import { Activity, ShieldCheck } from "lucide-react";
import { getLeastFrequentDigits, SymbolState } from "@/lib/signal-engine";

interface LiveTickerProps {
  tickCounts: Record<string, number>;
  lastDigits: Record<string, number>;
  selectedSymbols?: string[];
  avoidDigits?: Record<string, number>;
  allStates: Map<string, SymbolState>;
}

export function LiveTicker({ tickCounts, lastDigits, selectedSymbols, avoidDigits, allStates }: LiveTickerProps) {
  const active = DERIV_SYMBOLS.filter((s) => tickCounts[s.symbol] > 0 && (!selectedSymbols || selectedSymbols.length === 0 || selectedSymbols.includes(s.symbol)));

  if (active.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3 text-sm font-medium text-foreground">
        <Activity className="w-4 h-4 text-primary animate-ticker" />
        Live Statistics ({active.length} active)
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
        {active.map((s) => {
          const state = allStates.get(s.symbol);
          const safeDigits = state ? getLeastFrequentDigits(state.digits, 4) : [];
          const activeAvoid = avoidDigits?.[s.symbol];

          return (
            <div key={s.symbol} className="flex flex-col gap-2 bg-muted/30 border border-border/50 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-xs text-foreground">{getSymbolName(s.symbol)}</div>
                <div className="text-[10px] text-muted-foreground font-mono">#{tickCounts[s.symbol]}</div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1 text-[10px] text-emerald-500 font-medium">
                    <ShieldCheck className="w-3 h-3" />
                    SAFE: {safeDigits.length > 0 ? safeDigits.join(", ") : "..."}
                  </div>
                  {activeAvoid !== undefined && (
                    <div className="text-[10px] text-rose-500 font-bold uppercase transition-all animate-pulse">
                      Avoiding: {activeAvoid}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="font-mono text-2xl font-bold text-accent leading-none">
                    {lastDigits[s.symbol] ?? "-"}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

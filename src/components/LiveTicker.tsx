import { DERIV_SYMBOLS, getSymbolName } from "@/lib/deriv-symbols";
import { Activity } from "lucide-react";

interface LiveTickerProps {
  tickCounts: Record<string, number>;
  lastDigits: Record<string, number>;
  selectedSymbols?: string[];
  avoidDigits?: Record<string, number>;
}

export function LiveTicker({ tickCounts, lastDigits, selectedSymbols, avoidDigits }: LiveTickerProps) {
  const active = DERIV_SYMBOLS.filter((s) => tickCounts[s.symbol] > 0 && (!selectedSymbols || selectedSymbols.length === 0 || selectedSymbols.includes(s.symbol)));

  if (active.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3 text-sm font-medium text-foreground">
        <Activity className="w-4 h-4 text-primary animate-ticker" />
        Live Feeds ({active.length} active)
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
        {active.map((s) => (
          <div key={s.symbol} className="flex items-center justify-between bg-muted/50 rounded px-3 py-2">
            <div>
              <div className="font-semibold text-xs text-foreground">{getSymbolName(s.symbol)}</div>
              {avoidDigits && avoidDigits[s.symbol] !== undefined && (
                <div className="text-[10px] text-destructive font-mono">Avoid: {avoidDigits[s.symbol]}</div>
              )}
            </div>
            <div className="text-right">
              <div className="font-mono text-lg font-bold text-accent">{lastDigits[s.symbol] ?? "-"}</div>
              <div className="text-[10px] text-muted-foreground font-mono">#{tickCounts[s.symbol]}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

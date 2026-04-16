import { useMemo } from "react";
import type { SignalWithStatus } from "@/hooks/useDerivWebSocket";
import { DERIV_SYMBOLS, getSymbolName } from "@/lib/deriv-symbols";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, TrendingUp } from "lucide-react";

interface SignalsTableProps {
  signals: SignalWithStatus[];
  symbolFilter: string;
  confidenceFilter: number;
  selectedSymbols?: string[];
  avoidDigits?: Record<string, number>;
}

export function SignalsTable({ signals, symbolFilter, confidenceFilter, selectedSymbols, avoidDigits }: SignalsTableProps) {
  // Build a stable row per symbol, showing the latest signal for each
  const rows = useMemo(() => {
    const symbolOrder = DERIV_SYMBOLS.map((s) => s.symbol);
    const latestBySymbol = new Map<string, SignalWithStatus>();

    // Most recent signal per symbol
    for (const sig of signals) {
      if (sig.confidence * 100 < confidenceFilter) continue;
      if (symbolFilter && sig.symbol !== symbolFilter) continue;
      if (selectedSymbols && selectedSymbols.length > 0 && !selectedSymbols.includes(sig.symbol)) continue;
      
      const existing = latestBySymbol.get(sig.symbol);
      if (!existing || sig.timestamp > existing.timestamp) {
        latestBySymbol.set(sig.symbol, sig);
      }
    }

    // Return in fixed symbol order
    return symbolOrder
      .filter((sym) => latestBySymbol.has(sym))
      .map((sym) => latestBySymbol.get(sym)!);
  }, [signals, symbolFilter, confidenceFilter, selectedSymbols]);

  if (rows.length === 0) {
    return (
      <div className="bg-card border border-border rounded-lg p-8 text-center">
        <TrendingUp className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground text-sm">Waiting for signals...</p>
        <p className="text-muted-foreground text-xs mt-1">Signals appear when conditions are met (score &gt; 0.65)</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left p-3 font-medium text-muted-foreground">Symbol</th>
              <th className="text-center p-3 font-medium text-muted-foreground">Avoid Digit</th>
              <th className="text-center p-3 font-medium text-muted-foreground">Confidence</th>
              <th className="text-center p-3 font-medium text-muted-foreground">Status</th>
              <th className="text-right p-3 font-medium text-muted-foreground">Time</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((signal) => {
              const isActive = signal.status === "active";
              return (
                <tr key={signal.symbol} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="p-3">
                    <div className="font-semibold text-sm text-foreground">{getSymbolName(signal.symbol)}</div>
                  </td>
                  <td className="p-3 text-center">
                    <span
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full font-mono font-bold text-lg transition-colors ${
                        isActive
                          ? "bg-green-500/15 text-green-400"
                          : "bg-destructive/10 text-destructive"
                      }`}
                    >
                      {isActive ? (
                        <CheckCircle className="w-3.5 h-3.5" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5" />
                      )}
                      {avoidDigits?.[signal.symbol] ?? signal.dangerDigit}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <div className="font-mono font-semibold text-foreground">
                      {(signal.confidence * 100).toFixed(1)}%
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                      <div
                        className="h-1.5 rounded-full bg-primary transition-all"
                        style={{ width: `${signal.confidence * 100}%` }}
                      />
                    </div>
                  </td>
                  <td className="p-3 text-center">
                    <Badge
                      variant={isActive ? "default" : "secondary"}
                      className={isActive ? "animate-ticker" : ""}
                    >
                      {isActive ? "🟢 Active" : "⚪ Expired"}
                    </Badge>
                  </td>
                  <td className="p-3 text-right text-xs text-muted-foreground font-mono">
                    {signal.timestamp.toLocaleTimeString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

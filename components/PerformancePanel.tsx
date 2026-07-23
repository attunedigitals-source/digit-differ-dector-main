import type { TradeRecord } from "@/hooks/trading-types";
import type { DerivAccount } from "@/hooks/useDerivWebSocket";
import { Award, Target, TrendingDown, RotateCcw, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface PerformancePanelProps {
  tradeLog: TradeRecord[];
  onReset: () => void;
  activeAccount?: DerivAccount | null;
  dailyPL?: number;
  dailyStats?: { total_trades: number; wins: number };
}

export function PerformancePanel({ 
  tradeLog, 
  onReset, 
  activeAccount, 
  dailyPL = 0,
  dailyStats
}: PerformancePanelProps) {
  const settled = tradeLog.filter((t) => t.status === "WIN" || t.status === "LOSS");
  
  // Use persistent dailyStats if available, otherwise fallback to local session history
  const totalTrades = dailyStats ? dailyStats.total_trades : settled.length;
  const wins = dailyStats ? dailyStats.wins : settled.filter((t) => t.status === "WIN").length;
  const losses = totalTrades - wins;

  const stats = [
    {
      label: "Balance",
      value: activeAccount ? `${activeAccount.balance.toFixed(2)} ${activeAccount.currency}` : "—",
      icon: Wallet,
      color: "text-primary",
    },
    {
      label: "Today (P/L)",
      value: `${dailyPL >= 0 ? "+" : ""}${dailyPL.toFixed(2)}`,
      icon: TrendingDown,
      color: dailyPL >= 0 ? "text-success" : "text-danger",
    },
    {
      label: "Total Trades",
      value: totalTrades,
      icon: Target,
      color: "text-info",
    },

    {
      label: "Wins",
      value: wins,
      icon: Award,
      color: "text-success",
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Performance</h3>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground gap-1">
              <RotateCcw className="w-3 h-3" />
              Reset
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset Performance Stats?</AlertDialogTitle>
              <AlertDialogDescription>
                This will clear all trade history and performance metrics. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={onReset} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Reset
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 md:gap-3">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-card border border-border rounded-lg p-3 md:p-4 transition-all hover:bg-muted/30">
            <div className="flex items-center gap-2 mb-1.5 md:mb-2 text-muted-foreground">
              <stat.icon className={`w-3.5 h-3.5 md:w-4 md:h-4 ${stat.color}`} />
              <span className="text-[10px] md:text-xs font-medium uppercase tracking-tight">{stat.label}</span>
            </div>
            <div className={`text-lg md:text-2xl font-bold font-mono tracking-tighter sm:tracking-normal ${stat.color}`}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

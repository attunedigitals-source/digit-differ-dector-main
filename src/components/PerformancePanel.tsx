import type { TradeRecord } from "@/hooks/useAutoTrader";
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
}

export function PerformancePanel({ tradeLog, onReset, activeAccount }: PerformancePanelProps) {
  const settled = tradeLog.filter((t) => t.status === "won" || t.status === "lost");
  const totalTrades = settled.length;
  const wins = settled.filter((t) => t.status === "won").length;
  const losses = totalTrades - wins;
  const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;

  const stats = [
    {
      label: "Balance",
      value: activeAccount ? `${activeAccount.balance.toFixed(2)} ${activeAccount.currency}` : "—",
      icon: Wallet,
      color: "text-primary",
    },
    {
      label: "Total Trades",
      value: totalTrades,
      icon: Target,
      color: "text-info",
    },
    {
      label: "Win Rate",
      value: `${winRate.toFixed(1)}%`,
      icon: Award,
      color: winRate >= 50 ? "text-success" : "text-danger",
    },
    {
      label: "Wins",
      value: wins,
      icon: Award,
      color: "text-success",
    },
    {
      label: "Losses",
      value: losses,
      icon: TrendingDown,
      color: "text-danger",
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
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
              <span className="text-xs text-muted-foreground font-medium">{stat.label}</span>
            </div>
            <div className={`text-2xl font-bold font-mono ${stat.color}`}>{stat.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, LogOut, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getAccounts,
  getActiveAccount,
  setActiveAccount,
  logout,
  type DerivAccount,
} from "@/lib/deriv";
import { TradingBot, type BotConfig, type BotStats, type TradeEvent } from "@/lib/trading-bot";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — DerivPilot" },
      { name: "description", content: "Run your Deriv Over/Under bot." },
    ],
  }),
  component: Dashboard,
});

const SYMBOLS = [
  { v: "R_10", l: "Volatility 10" },
  { v: "R_25", l: "Volatility 25" },
  { v: "R_50", l: "Volatility 50" },
  { v: "R_75", l: "Volatility 75" },
  { v: "R_100", l: "Volatility 100" },
  { v: "1HZ10V", l: "Volatility 10 (1s)" },
  { v: "1HZ100V", l: "Volatility 100 (1s)" },
];

function Dashboard() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<DerivAccount[]>([]);
  const [active, setActive] = useState<DerivAccount | null>(null);
  const [stats, setStats] = useState<BotStats>({
    pnl: 0,
    wins: 0,
    losses: 0,
    totalTrades: 0,
    running: false,
  });
  const [trades, setTrades] = useState<TradeEvent[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const botRef = useRef<TradingBot | null>(null);

  const [cfg, setCfg] = useState({
    symbol: "R_100",
    contractType: "DIGITOVER" as "DIGITOVER" | "DIGITUNDER",
    barrier: 2,
    stake: 1,
    duration: 1,
    martingale: 2,
    takeProfit: 10,
    stopLoss: 10,
    maxTrades: 0,
  });

  useEffect(() => {
    const accs = getAccounts();
    if (accs.length === 0) {
      navigate({ to: "/" });
      return;
    }
    setAccounts(accs);
    setActive(getActiveAccount());
  }, [navigate]);

  // Set sensible defaults when contract type changes (Over 2 / Under 7)
  useEffect(() => {
    setCfg((c) => ({
      ...c,
      barrier: c.contractType === "DIGITOVER" ? 2 : 7,
    }));
  }, [cfg.contractType]);

  const winRate = useMemo(() => {
    const t = stats.wins + stats.losses;
    return t === 0 ? 0 : (stats.wins / t) * 100;
  }, [stats]);

  const handleStart = async () => {
    if (!active) return;
    const bot = new TradingBot();
    botRef.current = bot;
    bot.onChange((s) => {
      setStats(s.stats);
      setTrades(s.trades);
      setLog(s.log);
    });
    const config: BotConfig = { token: active.token, ...cfg };
    try {
      await bot.start(config);
    } catch (e: any) {
      toast.error(e.message || "Bot failed to start");
    }
  };

  const handleStop = () => botRef.current?.stop();

  const handleLogout = () => {
    botRef.current?.stop();
    logout();
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2 font-semibold">
            <Bot className="h-5 w-5 text-primary" />
            DerivPilot
          </div>
          <div className="flex items-center gap-3">
            {accounts.length > 0 && (
              <Select
                value={active?.loginid}
                onValueChange={(v) => {
                  setActiveAccount(v);
                  setActive(accounts.find((a) => a.loginid === v) || null);
                }}
              >
                <SelectTrigger className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.loginid} value={a.loginid}>
                      {a.loginid} ({a.currency})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat label="Profit / Loss" value={`$${stats.pnl.toFixed(2)}`} accent={stats.pnl >= 0 ? "pos" : "neg"} />
          <Stat label="Trades" value={String(stats.totalTrades)} />
          <Stat label="Win rate" value={`${winRate.toFixed(0)}%`} />
          <Stat label="Status" value={stats.running ? "Running" : "Idle"} accent={stats.running ? "pos" : undefined} />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Config */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Bot configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Symbol">
                <Select value={cfg.symbol} onValueChange={(v) => setCfg({ ...cfg, symbol: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SYMBOLS.map((s) => (
                      <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Contract type">
                <Select
                  value={cfg.contractType}
                  onValueChange={(v: "DIGITOVER" | "DIGITUNDER") => setCfg({ ...cfg, contractType: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DIGITOVER">Digit Over</SelectItem>
                    <SelectItem value="DIGITUNDER">Digit Under</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Barrier (0-9)">
                  <Input type="number" min={0} max={9} value={cfg.barrier}
                    onChange={(e) => setCfg({ ...cfg, barrier: Number(e.target.value) })} />
                </Field>
                <Field label="Duration (ticks)">
                  <Input type="number" min={1} max={10} value={cfg.duration}
                    onChange={(e) => setCfg({ ...cfg, duration: Number(e.target.value) })} />
                </Field>
                <Field label="Stake ($)">
                  <Input type="number" step="0.5" min={0.35} value={cfg.stake}
                    onChange={(e) => setCfg({ ...cfg, stake: Number(e.target.value) })} />
                </Field>
                <Field label="Martingale x">
                  <Input type="number" step="0.1" min={1} value={cfg.martingale}
                    onChange={(e) => setCfg({ ...cfg, martingale: Number(e.target.value) })} />
                </Field>
                <Field label="Take profit ($)">
                  <Input type="number" min={0} value={cfg.takeProfit}
                    onChange={(e) => setCfg({ ...cfg, takeProfit: Number(e.target.value) })} />
                </Field>
                <Field label="Stop loss ($)">
                  <Input type="number" min={0} value={cfg.stopLoss}
                    onChange={(e) => setCfg({ ...cfg, stopLoss: Number(e.target.value) })} />
                </Field>
                <Field label="Max trades (0=∞)">
                  <Input type="number" min={0} value={cfg.maxTrades}
                    onChange={(e) => setCfg({ ...cfg, maxTrades: Number(e.target.value) })} />
                </Field>
              </div>

              <div className="pt-2">
                {!stats.running ? (
                  <Button className="w-full" onClick={handleStart}>
                    <Play className="mr-2 h-4 w-4" /> Start bot
                  </Button>
                ) : (
                  <Button className="w-full" variant="destructive" onClick={handleStop}>
                    <Square className="mr-2 h-4 w-4" /> Stop bot
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Trades + log */}
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Recent trades</CardTitle>
              </CardHeader>
              <CardContent>
                {trades.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No trades yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-left text-muted-foreground">
                        <tr>
                          <th className="py-2">Time</th>
                          <th>Type</th>
                          <th>Symbol</th>
                          <th>Stake</th>
                          <th>Profit</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trades.slice(0, 15).map((t) => (
                          <tr key={t.id} className="border-t border-border">
                            <td className="py-2">{new Date(t.time).toLocaleTimeString()}</td>
                            <td>{t.type}</td>
                            <td>{t.symbol}</td>
                            <td>${t.stake.toFixed(2)}</td>
                            <td className={t.profit && t.profit >= 0 ? "text-[oklch(0.78_0.17_155)]" : "text-destructive"}>
                              {t.profit !== undefined ? `$${t.profit.toFixed(2)}` : "—"}
                            </td>
                            <td className="capitalize">{t.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Activity log</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-64 overflow-y-auto rounded-md bg-muted/40 p-3 font-mono text-xs">
                  {log.length === 0 ? (
                    <p className="text-muted-foreground">Waiting for activity…</p>
                  ) : (
                    log.map((line, i) => <div key={i}>{line}</div>)
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: "pos" | "neg" }) {
  const color =
    accent === "pos" ? "text-[oklch(0.78_0.17_155)]" : accent === "neg" ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${color}`}>{value}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

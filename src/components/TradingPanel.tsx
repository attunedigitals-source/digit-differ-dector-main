import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bot, DollarSign, Shuffle, Clock, Target, Flag, AlertCircle } from "lucide-react";
import { type TradeRecord, type AutoTraderConfig } from "@/hooks/trading-types";
import { type VolatilityTracking } from "@/hooks/useAutoTrader";
import { DERIV_SYMBOLS, getSymbolName } from "@/lib/deriv-symbols";
import { UserProfile } from "@/hooks/useAuth";
import { toast } from "sonner";

const getFibonacci = (k: number): bigint => {
  if (k <= 0) return 0n;
  if (k === 1) return 1n;
  let a = 0n;
  let b = 1n;
  for (let i = 2; i <= k; i++) {
    const temp = a + b;
    a = b;
    b = temp;
  }
  return b;
};

interface TradingPanelProps {
  config: AutoTraderConfig;
  onConfigChange: (config: AutoTraderConfig) => void;
  sessionState: {
    currentStake: number;
    martingaleStep: number;
    nextAction: string;
    currentArrangementIndex?: number;
    currentArrangement?: string[];
    arrangementProgressIndex?: number;
    shufflingSeed?: number;
    sequenceStep?: number;
    blacklistedPrefixes?: Record<string, string[]>;
    fibonacciIndex?: number;
    usedStartIndices?: number[];
  };
  ticksToWait: number;
  tradeLog: TradeRecord[];
  connected: boolean;
  hasToken: boolean;
  dailyPL: number;
  windDownMode: boolean;
  onActivateWindDown: () => void;
  profile?: UserProfile | null;
  volatilityTracking?: Record<string, VolatilityTracking>;
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
  windDownMode,
  onActivateWindDown,
  profile,
  volatilityTracking,
}: TradingPanelProps) {
  const [localStake, setLocalStake] = useState(config.baseStake.toString());
  const [localSteps, setLocalSteps] = useState(config.maxMartingaleSteps.toString());
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Sync local state when config changes from outside (e.g. sync from cloud)
  useEffect(() => {
    setLocalStake(config.baseStake.toString());
  }, [config.baseStake]);

  useEffect(() => {
    setLocalSteps(config.maxMartingaleSteps.toString());
  }, [config.maxMartingaleSteps]);

  const handleStakeBlur = () => {
    const val = parseFloat(localStake);
    onConfigChange({ ...config, baseStake: isNaN(val) ? 0.35 : val });
  };

  const handleStepsBlur = () => {
    const val = parseInt(localSteps);
    onConfigChange({ ...config, maxMartingaleSteps: isNaN(val) ? 12 : val });
  };
  const stakeVal = parseFloat(localStake);
  const stepsVal = parseInt(localSteps);
  const isStakeValid = !isNaN(stakeVal) && stakeVal >= 0.35;
  const isStepsValid = !isNaN(stepsVal) && stepsVal >= 1;

  const isTrialExpired = (() => {
    if (!profile || profile.subscription_status !== 'free' || !profile.trial_started_at) return false;
    const startTime = new Date(profile.trial_started_at).getTime();
    const durationMs = profile.trial_duration_days * 24 * 60 * 60 * 1000;
    return (startTime + durationMs) < new Date().getTime();
  })();

  const canTrade = connected && hasToken && isStakeValid && isStepsValid && !isTrialExpired;
  const formatCooldown = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${String(secs).padStart(2, "0")}`;
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-4 shadow-lg backdrop-blur-sm bg-opacity-80">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Bot className="w-5 h-5 text-primary animate-pulse" />
          Digits AI Engine
        </div>
        <Badge variant={connected ? "default" : "destructive"} className="text-[10px]">
          {connected ? "CONNECTED" : "DISCONNECTED"}
        </Badge>
      </div>

      {!connected && (
        <p className="text-xs text-destructive bg-destructive/10 p-2 rounded">
          Connect to Deriv first to enable automation.
        </p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <DollarSign className="w-3 h-3" /> Base Stake
          </label>
          <Input
            type="number"
            min={0.35}
            step={0.1}
            value={localStake}
            onChange={(e) => setLocalStake(e.target.value)}
            onBlur={handleStakeBlur}
            className={`bg-muted border-border font-mono text-sm h-8 ${!isStakeValid && localStake !== "" ? "border-destructive text-destructive" : ""}`}
          />
          {!isStakeValid && localStake !== "" && (
            <p className="text-[9px] text-destructive font-bold italic animate-in fade-in slide-in-from-top-1">Min $0.35</p>
          )}
        </div>
        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Target className="w-3 h-3" /> Max Step
          </label>
          <Input
            type="number"
            min={1}
            step={1}
            value={localSteps}
            onChange={(e) => setLocalSteps(e.target.value)}
            onBlur={handleStepsBlur}
            className={`bg-muted border-border font-mono text-sm h-8 ${!isStepsValid && localSteps !== "" ? "border-destructive text-destructive" : ""}`}
          />
          {!isStepsValid && localSteps !== "" && (
            <p className="text-[9px] text-destructive font-bold italic animate-in fade-in slide-in-from-top-1">Min 1 Step</p>
          )}
        </div>
      </div>

      {/* Cooldown Configuration */}
      <div className="space-y-1.5 bg-muted/20 p-3 rounded-md border border-border/50">
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
          <Clock className="w-3 h-3" /> Cooldown Interval (Minutes)
        </label>
        <Select
          value={String(config.cooldownIntervalMinutes)}
          disabled={config.enabled}
          onValueChange={(value) =>
            onConfigChange({
              ...config,
              cooldownIntervalMinutes: Number(value) as AutoTraderConfig["cooldownIntervalMinutes"],
            })
          }
        >
          <SelectTrigger className="bg-muted border-border font-mono text-sm h-8">
            <SelectValue placeholder="Select cooldown interval" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="30">30 Minutes</SelectItem>
            <SelectItem value="40">40 Minutes</SelectItem>
            <SelectItem value="50">50 Minutes</SelectItem>
            <SelectItem value="60">60 Minutes</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-[9px] text-muted-foreground">
          Tool pauses between 5–8 minutes after every interval. Setting locks while running.
        </p>
      </div>

      {/* Trading Strategy Selection */}
      <div className="space-y-1.5 bg-muted/20 p-3 rounded-md border border-border/50">
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
          <Shuffle className="w-3 h-3 text-primary animate-pulse" /> Trading Strategy
        </label>
        <Select
          value={config.strategy}
          disabled={config.enabled}
          onValueChange={(value) =>
            onConfigChange({
              ...config,
              strategy: value as AutoTraderConfig["strategy"],
            })
          }
        >
          <SelectTrigger className="bg-muted border-border font-semibold text-xs h-8">
            <SelectValue placeholder="Select strategy" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alternating">Alternating Volatility</SelectItem>
            <SelectItem value="strategy_a">Strategy A (Pre-Planned Cycles)</SelectItem>
            <SelectItem value="strategy_b">Strategy B (Sticky Loss Cycles)</SelectItem>
            <SelectItem value="strategy_c">Strategy C (Sticky Loss + Suspension)</SelectItem>
            <SelectItem value="strategy_d">Strategy D (Immediate Suspension)</SelectItem>
            <SelectItem value="strategy_e">Strategy E (God Mode - Multi-Strategy Arbitrage)</SelectItem>
            <SelectItem value="strategy_f">Strategy F (Sticky + Deferred Suspension + Prefix Elimination)</SelectItem>
            <SelectItem value="strategy_g">Strategy G (Pre-Planned + Session Prefix Elimination)</SelectItem>
            <SelectItem value="strategy_h">Strategy H (Fibonacci Trade Engine)</SelectItem>
            <SelectItem value="strategy_i">Strategy I (Random Loop Engine)</SelectItem>
            <SelectItem value="strategy_j">Strategy J (Random Volatility & Trade Loop)</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-[9px] text-muted-foreground">
          Strategy A–G run 12-trade cycles. E is God Mode. F is Strategy C with prefix blacklists. G is Strategy A but blacklists underperforming 5-loss prefixes globally. H is a Fibonacci trade sequence modulo 6 with random non-back-to-back volatility. I is a fully randomized volatility and direction pool loop with Strategy H martingale logic. J is a fully randomized volatility and direction pool loop with Strategy D martingale and stake rules.
        </p>
      </div>

      {/* Strategy A/B/C/D Visualizer Panel */}
      {(config.strategy === "strategy_a" || config.strategy === "strategy_b" || config.strategy === "strategy_c" || config.strategy === "strategy_d" || config.strategy === "strategy_e" || config.strategy === "strategy_f" || config.strategy === "strategy_g") && (
        <div className="bg-gradient-to-br from-primary/10 via-card to-background border border-primary/20 rounded-md p-3.5 space-y-3 relative overflow-hidden shadow-inner text-card-foreground">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex items-center justify-between border-b border-primary/10 pb-2">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-primary uppercase tracking-wider flex items-center gap-1">
                <Target className="w-3.5 h-3.5 text-primary animate-pulse" /> Arrangement #{sessionState.currentArrangementIndex ?? 1}
              </span>
              <span className="text-[8px] text-muted-foreground">
                Seed: {sessionState.shufflingSeed ?? 0} | Progress: {sessionState.arrangementProgressIndex ?? 0} / {(config.strategy === "strategy_c" || config.strategy === "strategy_d") ? "7,484,400" : "369,600"}
              </span>
            </div>
            <Badge variant="outline" className="text-[9px] border-primary/30 text-primary bg-primary/5 px-1.5 py-0.5">
              Step {(sessionState.sequenceStep ?? 0) + 1}/12
            </Badge>
          </div>
 
          <div className="grid grid-cols-6 gap-1.5 py-1">
            {(sessionState.currentArrangement ?? []).map((step, idx) => {
              const isActive = idx === (sessionState.sequenceStep ?? 0);
              const label = step === "U4" ? "Under 4" : step === "O4" ? "Over 4" : step === "U5" ? "Under 5" : step === "O5" ? "Over 5" : step === "EV" ? "Even" : step === "OD" ? "Odd" : step === "RISE" ? "Rise" : step === "FALL" ? "Fall" : "Unknown";
              
              let bgClass = "";
              let borderClass = "";
              let textClass = "";
 
              if (step === "U4") {
                bgClass = isActive ? "bg-gradient-to-r from-blue-500/25 to-indigo-500/25" : "bg-blue-950/20";
                borderClass = isActive ? "border-blue-400/80 shadow-[0_0_8px_rgba(59,130,246,0.5)]" : "border-blue-950/40 hover:border-blue-900/60";
                textClass = "text-blue-400";
              } else if (step === "O4") {
                bgClass = isActive ? "bg-gradient-to-r from-emerald-500/25 to-teal-500/25" : "bg-emerald-950/20";
                borderClass = isActive ? "border-emerald-400/80 shadow-[0_0_8px_rgba(52,211,153,0.5)]" : "border-emerald-950/40 hover:border-emerald-900/60";
                textClass = "text-emerald-400";
              } else if (step === "U5") {
                bgClass = isActive ? "bg-gradient-to-r from-purple-500/25 to-pink-500/25" : "bg-purple-950/20";
                borderClass = isActive ? "border-purple-400/80 shadow-[0_0_8px_rgba(168,85,247,0.5)]" : "border-purple-950/40 hover:border-purple-900/60";
                textClass = "text-purple-400";
              } else if (step === "EV") {
                bgClass = isActive ? "bg-gradient-to-r from-violet-500/25 to-fuchsia-500/25" : "bg-violet-950/20";
                borderClass = isActive ? "border-violet-400/85 shadow-[0_0_10px_rgba(139,92,246,0.6)]" : "border-violet-950/40 hover:border-violet-900/60";
                textClass = "text-violet-400";
              } else if (step === "OD") {
                bgClass = isActive ? "bg-gradient-to-r from-cyan-500/25 to-sky-500/25" : "bg-cyan-950/20";
                borderClass = isActive ? "border-cyan-400/85 shadow-[0_0_10px_rgba(6,182,212,0.6)]" : "border-cyan-950/40 hover:border-cyan-900/60";
                textClass = "text-cyan-400";
              } else if (step === "RISE") {
                bgClass = isActive ? "bg-gradient-to-r from-rose-500/25 to-pink-500/25" : "bg-rose-950/20";
                borderClass = isActive ? "border-rose-400/85 shadow-[0_0_10px_rgba(244,63,94,0.6)]" : "border-rose-950/40 hover:border-rose-900/60";
                textClass = "text-rose-400";
              } else if (step === "FALL") {
                bgClass = isActive ? "bg-gradient-to-r from-red-500/25 to-orange-500/25" : "bg-red-950/20";
                borderClass = isActive ? "border-red-400/85 shadow-[0_0_10px_rgba(239,68,68,0.6)]" : "border-red-950/40 hover:border-red-900/60";
                textClass = "text-red-400";
              } else {
                bgClass = isActive ? "bg-gradient-to-r from-amber-500/25 to-orange-500/25" : "bg-amber-950/20";
                borderClass = isActive ? "border-amber-400/80 shadow-[0_0_8px_rgba(245,158,11,0.5)]" : "border-amber-950/40 hover:border-amber-900/60";
                textClass = "text-amber-400";
              }
 
              return (
                <div
                  key={idx}
                  title={label}
                  className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded border transition-all duration-300 relative cursor-default select-none ${bgClass} ${borderClass} ${isActive ? "scale-105 border-2 border-primary" : "opacity-60"}`}
                >
                  <span className={`text-[10px] font-mono font-black ${textClass}`}>
                    {step}
                  </span>
                  <span className="text-[7px] text-muted-foreground scale-90">
                    Step {idx + 1}
                  </span>
                  {isActive && (
                    <span className="absolute -top-1 -right-1 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          
          <div className="flex items-center gap-1.5 justify-between text-[8px] bg-muted/40 px-2 py-1 rounded border border-border/40">
            <span className="text-muted-foreground flex items-center gap-1">
              <AlertCircle className="w-2.5 h-2.5 text-primary" /> Active trade target:
            </span>
            <span className="font-bold text-foreground">
              {(() => {
                const currentArr = sessionState.currentArrangement ?? [];
                const activeStep = currentArr[sessionState.sequenceStep ?? 0];
                if (!activeStep) return "None";
                if (activeStep === "U4") return "DIGITUNDER 4 (Barrier 4)";
                if (activeStep === "O4") return "DIGITOVER 4 (Barrier 4)";
                if (activeStep === "U5") return "DIGITUNDER 5 (Barrier 5)";
                if (activeStep === "O5") return "DIGITOVER 5 (Barrier 5)";
                if (activeStep === "EV") return "DIGITEVEN (No Barrier)";
                if (activeStep === "OD") return "DIGITODD (No Barrier)";
                if (activeStep === "RISE") return "RISE (Allow Equals)";
                if (activeStep === "FALL") return "FALL (Allow Equals)";
                return "Unknown";
              })()}
            </span>
          </div>

          {config.strategy === "strategy_g" && sessionState.blacklistedPrefixes?.["global"] && sessionState.blacklistedPrefixes["global"].length > 0 && (
            <div className="mt-2 space-y-1 bg-destructive/5 p-2 rounded border border-destructive/15">
              <span className="text-[8px] uppercase tracking-wider text-destructive font-bold flex items-center gap-1">
                🚫 Session Blacklisted Prefixes (Globally)
              </span>
              <div className="flex flex-wrap gap-1">
                {sessionState.blacklistedPrefixes["global"].map((prefix, idx) => (
                  <Badge 
                    key={idx} 
                    variant="outline" 
                    className="text-[7px] font-mono bg-destructive/10 text-destructive border-destructive/20 px-1 py-0.5"
                    title={prefix.split(",").join(" -> ")}
                  >
                    🚫 {prefix.split(",").join("")}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {config.strategy === "strategy_h" && (
        <div className="bg-gradient-to-br from-indigo-500/15 via-card to-purple-500/15 border border-indigo-500/20 rounded-md p-3.5 space-y-3 relative overflow-hidden shadow-inner text-card-foreground">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex items-center justify-between border-b border-indigo-500/10 pb-2">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                <Shuffle className="w-3.5 h-3.5 text-indigo-400 animate-spin-slow" /> Fibonacci Trade Engine
              </span>
              <span className="text-[8px] text-muted-foreground">
                Path: Fibonacci sequence modulo 6 | Used Starts: {sessionState.usedStartIndices?.length ?? 0} / 10001
              </span>
            </div>
            {sessionState.fibonacciIndex !== undefined && sessionState.fibonacciIndex >= 0 ? (
              <Badge variant="outline" className="text-[9px] border-indigo-500/30 text-indigo-400 bg-indigo-500/5 px-1.5 py-0.5">
                Fibonacci Index k = {sessionState.fibonacciIndex}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[9px] border-amber-500/30 text-amber-400 bg-amber-500/5 px-1.5 py-0.5 animate-pulse">
                INITIALIZING
              </Badge>
            )}
          </div>

          {sessionState.fibonacciIndex === undefined || sessionState.fibonacciIndex === -1 ? (
            <div className="flex flex-col items-center justify-center py-4 px-2 bg-indigo-950/10 border border-indigo-950/20 rounded-md text-center">
              <Shuffle className="w-8 h-8 text-indigo-400/40 mb-2 animate-bounce" />
              <span className="text-xs font-semibold text-indigo-300">Ready to Launch Sequence</span>
              <span className="text-[9px] text-muted-foreground max-w-[220px] mt-1">
                Seeds the Fibonacci trade engine at a random index k in range [0, 10000].
              </span>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-5 gap-1.5 py-1">
                {[-2, -1, 0, 1, 2].map((offset) => {
                  const currentK = (sessionState.fibonacciIndex ?? 0) + offset;
                  if (currentK < 0) {
                    return (
                      <div
                        key={offset}
                        className="flex flex-col items-center justify-center py-1.5 px-0.5 rounded border border-dashed border-muted-foreground/20 opacity-30 select-none cursor-default"
                      >
                        <span className="text-[8px] text-muted-foreground">k = {currentK}</span>
                        <span className="text-[10px] font-mono font-bold text-muted-foreground">N/A</span>
                      </div>
                    );
                  }

                  const val = getFibonacci(currentK);
                  const valStr = val.toString();
                  const mod = Number(val % 6n);
                  const isActive = offset === 0;

                  let code = "U4";
                  let label = "Under 4";
                  let bgClass = "";
                  let borderClass = "";
                  let textClass = "";

                  if (mod === 0) {
                    code = "U4"; label = "Under 4";
                    bgClass = isActive ? "bg-gradient-to-r from-blue-500/25 to-indigo-500/25" : "bg-blue-950/20";
                    borderClass = isActive ? "border-blue-400/85 shadow-[0_0_10px_rgba(59,130,246,0.6)]" : "border-blue-950/40 hover:border-blue-900/60";
                    textClass = "text-blue-400";
                  } else if (mod === 1) {
                    code = "O5"; label = "Over 5";
                    bgClass = isActive ? "bg-gradient-to-r from-amber-500/25 to-orange-500/25" : "bg-amber-950/20";
                    borderClass = isActive ? "border-amber-400/85 shadow-[0_0_10px_rgba(245,158,11,0.6)]" : "border-amber-950/40 hover:border-amber-900/60";
                    textClass = "text-amber-400";
                  } else if (mod === 2) {
                    code = "Even"; label = "Even";
                    bgClass = isActive ? "bg-gradient-to-r from-violet-500/25 to-fuchsia-500/25" : "bg-violet-950/20";
                    borderClass = isActive ? "border-violet-400/85 shadow-[0_0_10px_rgba(139,92,246,0.6)]" : "border-violet-950/40 hover:border-violet-900/60";
                    textClass = "text-violet-400";
                  } else if (mod === 3) {
                    code = "U5"; label = "Under 5";
                    bgClass = isActive ? "bg-gradient-to-r from-purple-500/25 to-pink-500/25" : "bg-purple-950/20";
                    borderClass = isActive ? "border-purple-400/85 shadow-[0_0_10px_rgba(168,85,247,0.6)]" : "border-purple-950/40 hover:border-purple-900/60";
                    textClass = "text-purple-400";
                  } else if (mod === 4) {
                    code = "O4"; label = "Over 4";
                    bgClass = isActive ? "bg-gradient-to-r from-emerald-500/25 to-teal-500/25" : "bg-emerald-950/20";
                    borderClass = isActive ? "border-emerald-400/85 shadow-[0_0_10px_rgba(52,211,153,0.6)]" : "border-emerald-950/40 hover:border-emerald-900/60";
                    textClass = "text-emerald-400";
                  } else {
                    code = "Odd"; label = "Odd";
                    bgClass = isActive ? "bg-gradient-to-r from-cyan-500/25 to-sky-500/25" : "bg-cyan-950/20";
                    borderClass = isActive ? "border-cyan-400/85 shadow-[0_0_10px_rgba(6,182,212,0.6)]" : "border-cyan-950/40 hover:border-cyan-900/60";
                    textClass = "text-cyan-400";
                  }

                  return (
                    <div
                      key={offset}
                      title={`${label} (Fibonacci ${valStr})`}
                      className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded border transition-all duration-300 relative cursor-default select-none ${bgClass} ${borderClass} ${isActive ? "scale-105 border-2 border-primary" : "opacity-60"}`}
                    >
                      <span className="text-[7px] text-muted-foreground font-mono">
                        k = {currentK}
                      </span>
                      <span className={`text-[11px] font-mono font-black ${textClass}`} title={`Value: ${valStr}`}>
                        {valStr.length > 4 ? `${valStr.substring(0, 3)}..` : valStr}
                      </span>
                      <span className={`text-[8px] font-bold ${textClass} scale-90 mt-0.5`}>
                        {code}
                      </span>
                      {isActive && (
                        <span className="absolute -top-1 -right-1 flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-500 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-1.5 justify-between text-[8px] bg-muted/40 px-2 py-1 rounded border border-border/40">
                <span className="text-muted-foreground flex items-center gap-1">
                  <AlertCircle className="w-2.5 h-2.5 text-indigo-400 animate-pulse" /> Current Fibonacci Number:
                </span>
                <span className="font-bold text-foreground">
                  F({sessionState.fibonacciIndex}) = {getFibonacci(sessionState.fibonacciIndex).toString()} (Mapped to {(() => {
                    const val = getFibonacci(sessionState.fibonacciIndex);
                    const mod = Number(val % 6n);
                    if (mod === 0) return "DIGITUNDER 4 (Barrier 4)";
                    if (mod === 1) return "DIGITOVER 5 (Barrier 5)";
                    if (mod === 2) return "DIGITEVEN (No Barrier)";
                    if (mod === 3) return "DIGITUNDER 5 (Barrier 5)";
                    if (mod === 4) return "DIGITOVER 4 (Barrier 4)";
                    return "DIGITODD (No Barrier)";
                  })()})
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {config.strategy === "strategy_i" && (
        <div className="bg-gradient-to-br from-pink-500/15 via-card to-purple-500/15 border border-pink-500/20 rounded-md p-3.5 space-y-3 relative overflow-hidden shadow-inner text-card-foreground">
          <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/5 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex items-center justify-between border-b border-pink-500/10 pb-2">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-pink-400 uppercase tracking-wider flex items-center gap-1">
                <Shuffle className="w-3.5 h-3.5 text-pink-400 animate-pulse" /> Strategy I (Random Loop)
              </span>
              <span className="text-[8px] text-muted-foreground">
                Path: Fully randomized volatility & contract direction from pool
              </span>
            </div>
            <Badge variant="outline" className="text-[9px] border-pink-500/30 text-pink-400 bg-pink-500/5 px-1.5 py-0.5 animate-pulse">
              ACTIVE LOOP
            </Badge>
          </div>

          <div className="space-y-2">
            <span className="text-[9px] text-muted-foreground uppercase tracking-wider block">Contract Candidates Pool:</span>
            <div className="grid grid-cols-6 gap-1.5 py-1">
              {["U4", "O5", "EV", "U5", "O4", "OD"].map((code) => {
                let textClass = "";
                let bgClass = "";
                let borderClass = "";
                let label = "";

                if (code === "U4") {
                  label = "Under 4"; textClass = "text-blue-400"; bgClass = "bg-blue-950/20"; borderClass = "border-blue-950/40";
                } else if (code === "O5") {
                  label = "Over 5"; textClass = "text-amber-400"; bgClass = "bg-amber-950/20"; borderClass = "border-amber-950/40";
                } else if (code === "EV") {
                  label = "Even"; textClass = "text-violet-400"; bgClass = "bg-violet-950/20"; borderClass = "border-violet-950/40";
                } else if (code === "U5") {
                  label = "Under 5"; textClass = "text-purple-400"; bgClass = "bg-purple-950/20"; borderClass = "border-purple-950/40";
                } else if (code === "O4") {
                  label = "Over 4"; textClass = "text-emerald-400"; bgClass = "bg-emerald-950/20"; borderClass = "border-emerald-950/40";
                } else {
                  label = "Odd"; textClass = "text-cyan-400"; bgClass = "bg-cyan-950/20"; borderClass = "border-cyan-950/40";
                }

                return (
                  <div
                    key={code}
                    title={label}
                    className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded border ${bgClass} ${borderClass} opacity-80`}
                  >
                    <span className={`text-[10px] font-mono font-black ${textClass}`}>
                      {code}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {config.strategy === "strategy_j" && (
        <div className="bg-gradient-to-br from-pink-500/15 via-card to-purple-500/15 border border-pink-500/20 rounded-md p-3.5 space-y-3 relative overflow-hidden shadow-inner text-card-foreground">
          <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/5 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex items-center justify-between border-b border-pink-500/10 pb-2">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-pink-400 uppercase tracking-wider flex items-center gap-1">
                <Shuffle className="w-3.5 h-3.5 text-pink-400 animate-pulse" /> Strategy J (Random Volatility & Trade Loop)
              </span>
              <span className="text-[8px] text-muted-foreground">
                Path: Fully randomized volatility & contract direction from pool
              </span>
            </div>
            <Badge variant="outline" className="text-[9px] border-pink-500/30 text-pink-400 bg-pink-500/5 px-1.5 py-0.5 animate-pulse">
              ACTIVE LOOP
            </Badge>
          </div>

          <div className="space-y-2">
            <span className="text-[9px] text-muted-foreground uppercase tracking-wider block">Contract Candidates Pool:</span>
            <div className="grid grid-cols-4 gap-1.5 py-1">
              {["U4", "O4", "U5", "O5", "EV", "OD", "RISE", "FALL"].map((code) => {
                let textClass = "";
                let bgClass = "";
                let borderClass = "";
                let label = "";

                if (code === "U4") {
                  label = "Under 4"; textClass = "text-blue-400"; bgClass = "bg-blue-950/20"; borderClass = "border-blue-950/40";
                } else if (code === "O4") {
                  label = "Over 4"; textClass = "text-emerald-400"; bgClass = "bg-emerald-950/20"; borderClass = "border-emerald-950/40";
                } else if (code === "U5") {
                  label = "Under 5"; textClass = "text-purple-400"; bgClass = "bg-purple-950/20"; borderClass = "border-purple-950/40";
                } else if (code === "O5") {
                  label = "Over 5"; textClass = "text-amber-400"; bgClass = "bg-amber-950/20"; borderClass = "border-amber-950/40";
                } else if (code === "EV") {
                  label = "Even"; textClass = "text-violet-400"; bgClass = "bg-violet-950/20"; borderClass = "border-violet-950/40";
                } else if (code === "OD") {
                  label = "Odd"; textClass = "text-cyan-400"; bgClass = "bg-cyan-950/20"; borderClass = "border-cyan-950/40";
                } else if (code === "RISE") {
                  label = "Rise (Put)"; textClass = "text-rose-400"; bgClass = "bg-rose-950/20"; borderClass = "border-rose-950/40";
                } else {
                  label = "Fall (Call)"; textClass = "text-red-400"; bgClass = "bg-red-950/20"; borderClass = "border-red-950/40";
                }

                return (
                  <div
                    key={code}
                    title={label}
                    className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded border ${bgClass} ${borderClass} opacity-80`}
                  >
                    <span className={`text-[10px] font-mono font-black ${textClass}`}>
                      {code}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {(config.strategy === "strategy_c" || config.strategy === "strategy_d" || config.strategy === "strategy_e" || config.strategy === "strategy_f") && (
        <div className="bg-muted/10 border border-border/80 rounded-md p-3 space-y-2.5 shadow-sm">
          <div className="flex items-center justify-between border-b border-border/40 pb-1.5">
            <span className="text-[10px] font-bold text-foreground uppercase tracking-wider flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-primary animate-pulse" /> Volatility Trackers & Suspensions
            </span>
            <Badge variant="outline" className="text-[8px] bg-primary/5 text-primary border-primary/20 px-1.5 py-0.5">
              {config.strategy === "strategy_c" ? "STRATEGY C" : config.strategy === "strategy_d" ? "STRATEGY D" : config.strategy === "strategy_e" ? "STRATEGY E" : "STRATEGY F"}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
            {DERIV_SYMBOLS.map((s) => {
              const tracking = volatilityTracking?.[s.symbol] || { consecutiveLosses: 0, pendingSuspension: false, suspendedUntil: null };
               const isSuspended = !!(tracking.suspendedUntil && currentTime < tracking.suspendedUntil);
               const remainingSeconds = isSuspended ? Math.max(0, Math.ceil((tracking.suspendedUntil! - currentTime) / 1000)) : 0;

               const formatTimer = (secs: number) => {
                 const m = Math.floor(secs / 60);
                 const sec = secs % 60;
                 return `${m}:${String(sec).padStart(2, "0")}`;
               };

              return (
                <div 
                  key={s.symbol}
                  className={`flex items-center justify-between p-2 rounded-md border text-[10px] transition-all duration-300 ${
                    isSuspended 
                      ? "bg-red-500/5 border-red-500/20 text-red-400/90 shadow-[inset_0_0_8px_rgba(239,68,68,0.05)]" 
                      : tracking.pendingSuspension
                      ? "bg-amber-500/5 border-amber-500/20 text-amber-400/90"
                      : "bg-muted/30 border-border/40 text-foreground"
                  }`}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold tracking-tight">{s.name}</span>
                    <div className="flex items-center gap-1.5">
                      {/* Consecutive loss dots */}
                      <div className="flex gap-0.5" title={`${tracking.consecutiveLosses} consecutive losses`}>
                        {[1, 2, 3, 4, 5].map((dot) => {
                          const active = dot <= tracking.consecutiveLosses;
                          return (
                            <span 
                              key={dot}
                              className={`h-1.5 w-1.5 rounded-full transition-colors duration-300 ${
                                active 
                                  ? tracking.pendingSuspension ? "bg-amber-500 animate-pulse" : "bg-red-500" 
                                  : "bg-muted-foreground/30"
                              }`}
                            />
                          );
                        })}
                      </div>
                      {tracking.consecutiveLosses > 0 && (
                        <span className="text-[8px] font-bold opacity-80">
                          ({tracking.consecutiveLosses})
                        </span>
                      )}
                    </div>
                    {/* Strategy F Blacklisted Prefixes */}
                    {config.strategy === "strategy_f" && sessionState.blacklistedPrefixes?.[s.symbol] && sessionState.blacklistedPrefixes[s.symbol].length > 0 && (
                      <div className="flex flex-wrap gap-0.5 mt-1 max-w-[120px]">
                        {sessionState.blacklistedPrefixes[s.symbol].map((prefix, idx) => (
                          <Badge 
                            key={idx} 
                            variant="outline" 
                            className="text-[7px] font-mono bg-destructive/5 text-destructive border-destructive/15 px-1 py-0 shadow-[inset_0_0_4px_rgba(239,68,68,0.02)]"
                            title={prefix.split(",").join(" -> ")}
                          >
                            🚫 {prefix.split(",").join("")}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    {isSuspended ? (
                      <div className="flex items-center gap-1 bg-red-500/10 border border-red-500/20 rounded px-1 py-0.5 text-[8px] font-bold tracking-tight text-red-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-ping" />
                        <span>SUSPENDED ({formatTimer(remainingSeconds)})</span>
                      </div>
                    ) : tracking.pendingSuspension ? (
                      <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 rounded px-1 py-0.5 text-[8px] font-bold tracking-tight text-amber-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                        <span>PENDING SUSPENSION</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 bg-green-500/10 border border-green-500/20 rounded px-1 py-0.5 text-[8px] font-bold tracking-tight text-green-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                        <span>ACTIVE</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}


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
      <div className={`flex items-center justify-between p-3 rounded-md border transition-all duration-300 ${
        config.enabled 
          ? windDownMode 
            ? "bg-orange-500/10 border-orange-500/30 shadow-[0_0_15px_rgba(249,115,22,0.1)]"
            : "bg-primary/5 border-primary/20" 
          : "bg-destructive/5 border-destructive/20 shadow-[0_0_15px_rgba(239,68,68,0.1)]"
      }`}>
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-full transition-colors ${
            config.enabled 
              ? windDownMode
                ? "bg-orange-500/20 text-orange-500"
                : "bg-primary/20 text-primary" 
              : "bg-destructive/20 text-destructive"
          }`}>
            <Shuffle className={`w-4 h-4 ${config.enabled ? "animate-spin-slow" : ""}`} />
          </div>
          <div>
            <div className={`text-xs font-bold uppercase tracking-tight ${
              !config.enabled ? "text-destructive" : windDownMode ? "text-orange-500" : ""
            }`}>
              {windDownMode ? "Stopping Gracefully..." : "AI-Automation Loop"}
            </div>
            <div className="text-[10px] text-muted-foreground font-medium">
              {config.enabled 
                ? windDownMode ? "Waiting for win to stop" : "Running AI..." 
                : "AI is Paused"}
            </div>
          </div>
        </div>
        <Switch
          checked={config.enabled}
          onCheckedChange={(enabled) => {
            if (enabled) {
              if (isTrialExpired) {
                toast.error("Your free trial has expired, click your Real Account to subscribe", {
                  duration: 6000,
                  icon: <AlertCircle className="text-red-500" />
                });
                return;
              }
              if (!canTrade) {
                toast.error("Requirements not met: Stake ≥ 0.35 and Steps ≥ 1");
                return;
              }
            }
            onConfigChange({ ...config, enabled });
          }}
          disabled={(!canTrade && !config.enabled) || isTrialExpired}
          className={`${!config.enabled ? "data-[state=unchecked]:bg-destructive" : windDownMode ? "data-[state=checked]:bg-orange-500" : ""}`}
        />
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={`w-full transition-all duration-300 font-bold uppercase text-[10px] tracking-widest h-9 ${
          windDownMode 
            ? "bg-orange-500 text-white hover:bg-orange-600 border-none shadow-lg animate-pulse" 
            : "bg-orange-500/10 text-orange-500 border-orange-500/30 hover:bg-orange-500/20"
        }`}
        onClick={onActivateWindDown}
        disabled={!config.enabled || windDownMode}
      >
        <Flag className={`w-4 h-4 mr-2 ${windDownMode ? "fill-current" : ""}`} />
        {windDownMode ? "Wind Down Armed (Waiting Profit)" : "Wind Down On Next Profit"}
      </Button>

      {/* Status Bar */}
      {config.enabled && (
        <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" /> Cooldown:
            </span>
            <span className="font-mono font-bold text-primary">
              {ticksToWait > 0 ? formatCooldown(ticksToWait) : "READY"}
            </span>
          </div>
          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
             <div 
              className="h-full bg-primary transition-all duration-300" 
              style={{ width: ticksToWait > 0 ? `${Math.min(100, (ticksToWait / 480) * 100)}%` : '100%' }}
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
                  {/* Sequence name removed as it is common to all trades */}
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

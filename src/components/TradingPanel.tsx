import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bot, DollarSign, Shuffle, Clock, Target, Flag, AlertCircle, Download, Wand2, Pencil, Wallet, ShieldAlert, AlertTriangle, Layers } from "lucide-react";
import { type TradeRecord, type AutoTraderConfig } from "@/hooks/trading-types";
import { type VolatilityTracking, type ConnectionQuarantine } from "@/hooks/useAutoTrader";
import { type SymbolState, evaluateStrategyREvenOddCandidate, type StrategyREvenOddEvaluation } from "@/lib/signal-engine";
import { DERIV_SYMBOLS, getSymbolName } from "@/lib/deriv-symbols";
import { UserProfile, isEmailAdmin } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
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

const getGeneralizedFibonacci = (a: number, b: number, n: number, prime: bigint = 1000000007n): bigint => {
  if (n <= 0) return BigInt(a) % prime;
  if (n === 1) return BigInt(b) % prime;
  let prev2 = BigInt(a) % prime;
  let prev1 = BigInt(b) % prime;
  for (let i = 2; i <= n; i++) {
    const temp = (prev2 + prev1) % prime;
    prev2 = prev1;
    prev1 = temp;
  }
  return prev1;
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
    strategyJ_fibStartA?: number;
    strategyJ_fibStartB?: number;
    strategyJ_fibStep?: number;
    currentCategory?: string | null;
    currentLossSequence?: string[];
    strategyLMode?: "loss_sticky" | "win_sticky" | "none_sticky";
    strategyLNoneStickyCount?: number;
    strategyRMode?: "win_sticky" | "none_sticky" | "loss_sticky";
    strategyRModeCount?: number;
    strategyNActiveSub?: "strategy_l" | "strategy_m";
    strategyNNextSwitchTime?: number;
    strategyQActiveSub?: "strategy_a" | "strategy_b" | "strategy_c" | "strategy_d";
    strategyQRemainingRuns?: number;
    strategyQLastSub?: "strategy_a" | "strategy_b" | "strategy_c" | "strategy_d";
    strategyRSequenceBaseStake?: number;
    strategyRAccumulatedLoss?: number;
    strategySMode?: "win_sticky" | "none_sticky" | "loss_sticky";
    strategySModeCount?: number;
    strategySSequenceBaseStake?: number;
    strategySAccumulatedLoss?: number;
    strategySConsecutiveLosses?: number;
  };
  ticksToWait: number;
  tradeLog: TradeRecord[];
  connected: boolean;
  hasToken: boolean;
  balance?: number;
  sessionPL: number;
  onResetSessionPL: () => void;
  windDownMode: boolean;
  onActivateWindDown: () => void;
  profile?: UserProfile | null;
  volatilityTracking?: Record<string, VolatilityTracking>;
  onClearBlacklist?: () => void;
  getSymbolState?: (symbol: string) => SymbolState | undefined;
  connectionQuarantine?: ConnectionQuarantine;
}

export function TradingPanel({
  config,
  onConfigChange,
  sessionState,
  ticksToWait,
  tradeLog,
  connected,
  hasToken,
  balance,
  sessionPL,
  onResetSessionPL,
  windDownMode,
  onActivateWindDown,
  profile,
  volatilityTracking,
  onClearBlacklist,
  getSymbolState,
  connectionQuarantine,
}: TradingPanelProps) {
  const [localStake, setLocalStake] = useState(config.baseStake.toString());
  const [localStakeL, setLocalStakeL] = useState((config.strategyLBaseStake ?? config.baseStake).toString());
  const [localStakeM, setLocalStakeM] = useState((config.strategyMBaseStake ?? config.baseStake).toString());
  const [localStakeO, setLocalStakeO] = useState((config.strategyOBaseStake ?? config.baseStake).toString());
  const [localStakeP, setLocalStakeP] = useState((config.strategyPBaseStake ?? config.baseStake).toString());
  const [localStakeR, setLocalStakeR] = useState((config.strategyRBaseStake ?? config.baseStake).toString());
  const [localStakeS, setLocalStakeS] = useState((config.strategySBaseStake ?? config.baseStake).toString());
  const [localSteps, setLocalSteps] = useState(config.maxMartingaleSteps.toString());
  const [localInitBalance, setLocalInitBalance] = useState(config.initialBalance?.toString() || "");
  const [localAllowableLoss, setLocalAllowableLoss] = useState(config.allowableLoss?.toString() || "");
  const [localTargetProfit, setLocalTargetProfit] = useState(config.targetProfit?.toString() || "");
  const [autoGenMode, setAutoGenMode] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());

  const isAdmin = profile?.role === "admin" || 
                  profile?.role === "sub-admin" || 
                  isEmailAdmin(profile?.email);
  const [showStrategyRDebug, setShowStrategyRDebug] = useState<boolean>(() => {
    try {
      return localStorage.getItem("admin_show_strategy_r_debug") === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const onStorageChange = () => {
      const isSet = localStorage.getItem("admin_show_strategy_r_debug") === "true";
      setShowStrategyRDebug(isSet);
    };
    window.addEventListener("storage", onStorageChange);

    // 1. Fetch Global Preference for all users (clients & admins)
    supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'enable_strategy_r_debug')
      .maybeSingle()
      .then(({ data }) => {
        if (data && data.value !== undefined) {
          const isEnabled = data.value === true || data.value === 'true';
          setShowStrategyRDebug(isEnabled);
          try {
            localStorage.setItem("admin_show_strategy_r_debug", String(isEnabled));
          } catch {}
        }
      });

    // 2. Real-time subscription to global Strategy R debug setting changes
    const globalChannel = supabase
      .channel('global-strategy-r-debug-sync')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'system_settings',
          filter: 'key=eq.enable_strategy_r_debug'
        },
        (payload: any) => {
          if (payload.new && payload.new.value !== undefined) {
            const isEnabled = payload.new.value === true || payload.new.value === 'true';
            setShowStrategyRDebug(isEnabled);
            try {
              localStorage.setItem("admin_show_strategy_r_debug", String(isEnabled));
            } catch {}
          }
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener("storage", onStorageChange);
      supabase.removeChannel(globalChannel);
    };
  }, []);

  const effectiveStrategy = config.strategy === "strategy_q" 
    ? (sessionState.strategyQActiveSub || "strategy_a")
    : (config.strategy === "strategy_n"
      ? (sessionState.strategyNActiveSub || "strategy_l")
      : config.strategy);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Sync local state when config changes from outside (e.g. sync from cloud)
  useEffect(() => {
    setLocalInitBalance(config.initialBalance?.toString() || "");
  }, [config.initialBalance]);

  useEffect(() => {
    setLocalStake(config.baseStake.toString());
  }, [config.baseStake]);

  useEffect(() => {
    setLocalStakeL((config.strategyLBaseStake ?? config.baseStake).toString());
  }, [config.strategyLBaseStake, config.baseStake]);

  useEffect(() => {
    setLocalStakeM((config.strategyMBaseStake ?? config.baseStake).toString());
  }, [config.strategyMBaseStake, config.baseStake]);

  useEffect(() => {
    setLocalStakeO((config.strategyOBaseStake ?? config.baseStake).toString());
  }, [config.strategyOBaseStake, config.baseStake]);

  useEffect(() => {
    setLocalStakeP((config.strategyPBaseStake ?? config.baseStake).toString());
  }, [config.strategyPBaseStake, config.baseStake]);

  useEffect(() => {
    setLocalStakeR((config.strategyRBaseStake ?? config.baseStake).toString());
  }, [config.strategyRBaseStake, config.baseStake]);

  useEffect(() => {
    setLocalStakeS((config.strategySBaseStake ?? config.baseStake).toString());
  }, [config.strategySBaseStake, config.baseStake]);

  useEffect(() => {
    setLocalSteps(config.maxMartingaleSteps.toString());
  }, [config.maxMartingaleSteps]);

  useEffect(() => {
    setLocalAllowableLoss(config.allowableLoss?.toString() || "");
  }, [config.allowableLoss]);

  useEffect(() => {
    setLocalTargetProfit(config.targetProfit?.toString() || "");
  }, [config.targetProfit]);

  const handleInitBalanceBlur = () => {
    const val = parseFloat(localInitBalance);
    onConfigChange({ ...config, initialBalance: isNaN(val) || val <= 0 ? undefined : val });
  };

  const handleAllowableLossBlur = () => {
    const val = parseFloat(localAllowableLoss);
    onConfigChange({ ...config, allowableLoss: isNaN(val) ? undefined : val });
  };

  const handleTargetProfitBlur = () => {
    const val = parseFloat(localTargetProfit);
    onConfigChange({ ...config, targetProfit: isNaN(val) ? undefined : val });
  };

  /**
   * Auto-generates BASE STAKE, ALLOWED LOSS and TARGET PROFIT from the Init Balance (or active account balance).
   * Rule 1: initBal <= 1435  => baseStake=1.0, allowLoss=200, targetProfit=120
   * Rule 2: initBal > 1435   => allowLoss=initBal/5, baseStake=allowLoss/285.714, targetProfit=allowLoss*0.6
   */
  const handleAutoGenerate = () => {
    let targetBal = parseFloat(localInitBalance);

    // If no custom Init Balance entered, default to active account balance
    if (isNaN(targetBal) || targetBal <= 0) {
      if (balance !== undefined && !isNaN(balance) && balance > 0) {
        targetBal = balance;
      }
    }

    if (isNaN(targetBal) || targetBal <= 0) {
      toast.error("Please connect an account with a balance or enter an Init Balance to auto-generate parameters.");
      return;
    }

    let newBaseStake: number;
    let newAllowLoss: number;
    let newTargetProfit: number;

    if (targetBal <= 1435) {
      // Rule 1: Capital <= 1435 uses Base stake $1.00, Allowed Loss $200.00, Target Profit $120.00
      newBaseStake = 1.0;
      newAllowLoss = 200.0;
      newTargetProfit = 120.0;
    } else {
      // Rule 2: Capital > 1435
      newAllowLoss = parseFloat((targetBal / 5).toFixed(2));
      newBaseStake = parseFloat((newAllowLoss / 285.714).toFixed(2));
      newTargetProfit = parseFloat((newAllowLoss * 0.6).toFixed(2));
    }

    setLocalInitBalance(targetBal.toString());
    setLocalStake(newBaseStake.toString());
    setLocalStakeL(newBaseStake.toString());
    setLocalStakeM(newBaseStake.toString());
    setLocalStakeO(newBaseStake.toString());
    setLocalStakeP(newBaseStake.toString());
    setLocalStakeR(newBaseStake.toString());
    setLocalStakeS(newBaseStake.toString());
    setLocalAllowableLoss(newAllowLoss.toString());
    setLocalTargetProfit(newTargetProfit.toString());

    onConfigChange({
      ...config,
      initialBalance: targetBal,
      baseStake: newBaseStake,
      strategyLBaseStake: newBaseStake,
      strategyMBaseStake: newBaseStake,
      strategyOBaseStake: newBaseStake,
      strategyPBaseStake: newBaseStake,
      strategyRBaseStake: newBaseStake,
      strategySBaseStake: newBaseStake,
      allowableLoss: newAllowLoss,
      targetProfit: newTargetProfit,
    });

    setAutoGenMode(true);
    toast.success(
      `Auto-generated ✓ (Init Balance: $${targetBal}) Base Stake: $${newBaseStake} | Allowed Loss: $${newAllowLoss} | Target Profit: $${newTargetProfit}`,
      { duration: 5000 }
    );
  };

  const handleStakeBlur = () => {
    const val = parseFloat(localStake);
    onConfigChange({ ...config, baseStake: isNaN(val) ? 0.35 : val });
  };

  const handleStakeLBlur = () => {
    const val = parseFloat(localStakeL);
    onConfigChange({ ...config, strategyLBaseStake: isNaN(val) ? 0.35 : val });
  };

  const handleStakeMBlur = () => {
    const val = parseFloat(localStakeM);
    onConfigChange({ ...config, strategyMBaseStake: isNaN(val) ? 0.35 : val });
  };

  const handleStakeOBlur = () => {
    const val = parseFloat(localStakeO);
    onConfigChange({ ...config, strategyOBaseStake: isNaN(val) ? 0.35 : val });
  };

  const handleStakePBlur = () => {
    const val = parseFloat(localStakeP);
    onConfigChange({ ...config, strategyPBaseStake: isNaN(val) ? 0.35 : val });
  };

  const handleStakeRBlur = () => {
    const val = parseFloat(localStakeR);
    onConfigChange({ ...config, strategyRBaseStake: isNaN(val) ? 0.35 : val });
  };

  const handleStakeSBlur = () => {
    const val = parseFloat(localStakeS);
    onConfigChange({ ...config, strategySBaseStake: isNaN(val) ? 0.35 : val });
  };

  const handleStepsBlur = () => {
    const val = parseInt(localSteps);
    onConfigChange({ ...config, maxMartingaleSteps: isNaN(val) ? 12 : val });
  };
  const stakeVal = parseFloat(localStake);
  const stepsVal = parseInt(localSteps);
  const isStakeValid = !isNaN(stakeVal) && stakeVal >= 0.35;
  const isStepsValid = !isNaN(stepsVal) && stepsVal >= 1;

  const stakeLVal = parseFloat(localStakeL);
  const stakeMVal = parseFloat(localStakeM);
  const stakeOVal = parseFloat(localStakeO);
  const stakePVal = parseFloat(localStakeP);
  const stakeRVal = parseFloat(localStakeR);
  const stakeSVal = parseFloat(localStakeS);
  const isStakeLValid = !isNaN(stakeLVal) && stakeLVal >= 0.35;
  const isStakeMValid = !isNaN(stakeMVal) && stakeMVal >= 0.35;
  const isStakeOValid = !isNaN(stakeOVal) && stakeOVal >= 0.35;
  const isStakePValid = !isNaN(stakePVal) && stakePVal >= 0.35;
  const isStakeRValid = !isNaN(stakeRVal) && stakeRVal >= 0.35;
  const isStakeSValid = !isNaN(stakeSVal) && stakeSVal >= 0.35;

  const isTrialExpired = (() => {
    if (!profile) return false;
    // Admins NEVER have an expiration date
    if (isAdmin) return false;
    if (profile.subscription_status !== 'free' || !profile.trial_started_at) return false;
    const startTime = new Date(profile.trial_started_at).getTime();
    const durationMs = (profile.trial_duration_days || 7) * 24 * 60 * 60 * 1000;
    return (startTime + durationMs) < new Date().getTime();
  })();

  const canTrade = connected && hasToken && isStakeValid && isStepsValid &&
                   (config.strategy !== "strategy_n" || (isStakeLValid && isStakeMValid)) &&
                   (config.strategy !== "strategy_o" || isStakeOValid) &&
                   (config.strategy !== "strategy_p" || isStakePValid) &&
                   (config.strategy !== "strategy_r" || isStakeRValid) &&
                   (config.strategy !== "strategy_s" || isStakeSValid) &&
                   !isTrialExpired;
  const formatCooldown = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${String(secs).padStart(2, "0")}`;
  };

  const hasAnyBlacklist = () => {
    const prefixes = sessionState.blacklistedPrefixes || {};
    return Object.keys(prefixes).some(key => prefixes[key] && prefixes[key].length > 0);
  };

  const exportBlacklistToCSV = () => {
    const isGlobal = config.strategy === "strategy_g" || config.strategy === "strategy_k" || config.strategy === "strategy_m";
    let csvContent = "\uFEFF"; // BOM for UTF-8 Excel compatibility

    if (isGlobal) {
      const globalBlacklist = sessionState.blacklistedPrefixes?.["global"] || [];
      if (globalBlacklist.length === 0) {
        toast.error("No blacklisted prefixes to export.");
        return;
      }
      csvContent += "Index,Prefix,Friendly Name\n";
      globalBlacklist.forEach((prefix, index) => {
        const friendlyName = prefix.split(",").map(step => {
          if (step === "U4") return "Under 4";
          if (step === "O4") return "Over 4";
          if (step === "U5") return "Under 5";
          if (step === "O5") return "Over 5";
          if (step === "EV") return "Even";
          if (step === "OD") return "Odd";
          if (step === "RISE") return "Rise";
          if (step === "FALL") return "Fall";
          return step;
        }).join(" -> ");
        csvContent += `${index + 1},"${prefix}","${friendlyName}"\n`;
      });
    } else {
      const prefixes = sessionState.blacklistedPrefixes || {};
      const symbols = Object.keys(prefixes).filter(key => key !== "global" && prefixes[key] && prefixes[key].length > 0);
      if (symbols.length === 0) {
        toast.error("No blacklisted prefixes to export.");
        return;
      }
      csvContent += "Symbol,Index,Prefix,Friendly Name\n";
      symbols.forEach(symbol => {
        prefixes[symbol].forEach((prefix, index) => {
          const friendlyName = prefix.split(",").map(step => {
            if (step === "U4") return "Under 4";
            if (step === "O4") return "Over 4";
            if (step === "U5") return "Under 5";
            if (step === "O5") return "Over 5";
            if (step === "EV") return "Even";
            if (step === "OD") return "Odd";
            if (step === "RISE") return "Rise";
            if (step === "FALL") return "Fall";
            return step;
          }).join(" -> ");
          csvContent += `${symbol},${index + 1},"${prefix}","${friendlyName}"\n`;
        });
      });
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${config.strategy}_blacklist_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Blacklist exported successfully to CSV!");
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

      {connectionQuarantine?.active && (
        <div className="bg-amber-500/15 border border-amber-500/40 rounded-lg p-3 space-y-1.5 animate-pulse text-amber-300 shadow-sm">
          <div className="flex items-center gap-1.5 text-xs font-bold">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            Connection Instability Protected (Deriv Updates)
          </div>
          <p className="text-[10px] leading-relaxed text-amber-200/90">
            {connectionQuarantine.reason}
          </p>
          <div className="flex items-center justify-between text-[9px] font-mono pt-1 text-amber-400 border-t border-amber-500/20">
            <span>Status: Quarantine Cooldown Active</span>
            <span>Verifying live tick stream...</span>
          </div>
        </div>
      )}

      {/* 1. Init Balance Field */}
      <div className="space-y-1.5 bg-muted/20 p-3 rounded-md border border-border/50">
        <div className="flex items-center justify-between">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1 font-bold">
            <Wallet className="w-3.5 h-3.5 text-emerald-400" /> Init Balance ($)
          </label>
          {balance !== undefined && balance > 0 && !config.enabled && (
            <button
              type="button"
              onClick={() => {
                const balStr = balance.toString();
                setLocalInitBalance(balStr);
                onConfigChange({ ...config, initialBalance: balance });
                toast.info(`Init Balance set to active account balance ($${balance.toFixed(2)})`);
              }}
              className="text-[9px] text-primary hover:underline font-mono font-semibold"
              title="Click to copy full account balance"
            >
              Auto-Fill Full Balance (${balance.toFixed(2)})
            </button>
          )}
        </div>
        <Input
          type="number"
          min={0}
          step={10}
          disabled={config.enabled || autoGenMode}
          value={localInitBalance}
          onChange={(e) => {
            setLocalInitBalance(e.target.value);
            setAutoGenMode(false);
          }}
          onBlur={handleInitBalanceBlur}
          className={`bg-muted border-border font-mono text-sm h-8 ${
            autoGenMode ? "opacity-70 cursor-not-allowed" : ""
          }`}
          placeholder={balance ? `e.g. ${balance} (or enter custom portion)` : "e.g. 1000"}
        />
        <p className="text-[9px] text-muted-foreground italic">
          Target trading capital. Auto-calculate parameters below from this Init Balance or enter custom portion.
        </p>
      </div>

      {/* 2. Risk & Profit Auto Generate Header Section */}
      <div className="space-y-2 border-b border-border/20 pb-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Wand2 className="w-3.5 h-3.5 text-primary" /> Risk & Profit Parameters
            </span>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Auto-generate parameters from Init Balance above or set manually.
            </p>
          </div>
          {!config.enabled && (
            <Button
              type="button"
              size="sm"
              onClick={autoGenMode ? () => setAutoGenMode(false) : handleAutoGenerate}
              className={`h-8 text-[10px] font-bold px-3 gap-1.5 shrink-0 transition-all ${
                autoGenMode
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30"
                  : "bg-primary/20 text-primary border border-primary/40 hover:bg-primary/30"
              }`}
              variant="ghost"
            >
              {autoGenMode ? (
                <><Pencil className="w-3 h-3" /> Manual</>
              ) : (
                <><Wand2 className="w-3 h-3" /> Auto Generate</>
              )}
            </Button>
          )}
        </div>

        {/* Auto-gen hint */}
        {!autoGenMode && !config.enabled && (
          <p className="text-[9px] text-muted-foreground italic">
            Click <span className="text-primary font-semibold">Auto Generate</span> to calculate from Init Balance above — or set parameters manually.
          </p>
        )}
        {autoGenMode && (
          <p className="text-[9px] text-amber-400 font-semibold animate-in fade-in">
            ✓ Values auto-generated from Init Balance. Click <span className="underline font-bold">Manual</span> to edit Base Stake, Allowed Loss, & Target Profit freely.
          </p>
        )}
      </div>

      {/* 3. Base Stake Section */}
      <div className={`grid ${config.strategy === "strategy_n" ? "grid-cols-2" : "grid-cols-1"} gap-4`}>
        {config.strategy === "strategy_n" ? (
          <>
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <DollarSign className="w-3 h-3" /> Stake (L)
              </label>
              <Input
                type="number"
                min={0.35}
                step={0.1}
                disabled={config.enabled || autoGenMode}
                value={localStakeL}
                onChange={(e) => setLocalStakeL(e.target.value)}
                onBlur={handleStakeLBlur}
                className={`bg-muted border-border font-mono text-sm h-8 ${!isStakeLValid && localStakeL !== "" ? "border-destructive text-destructive" : ""} ${autoGenMode ? "opacity-70 cursor-not-allowed" : ""}`}
              />
              {!isStakeLValid && localStakeL !== "" && (
                <p className="text-[9px] text-destructive font-bold italic animate-in fade-in slide-in-from-top-1">Min $0.35</p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <DollarSign className="w-3 h-3" /> Stake (M)
              </label>
              <Input
                type="number"
                min={0.35}
                step={0.1}
                disabled={config.enabled || autoGenMode}
                value={localStakeM}
                onChange={(e) => setLocalStakeM(e.target.value)}
                onBlur={handleStakeMBlur}
                className={`bg-muted border-border font-mono text-sm h-8 ${!isStakeMValid && localStakeM !== "" ? "border-destructive text-destructive" : ""} ${autoGenMode ? "opacity-70 cursor-not-allowed" : ""}`}
              />
              {!isStakeMValid && localStakeM !== "" && (
                <p className="text-[9px] text-destructive font-bold italic animate-in fade-in slide-in-from-top-1">Min $0.35</p>
              )}
            </div>
          </>
        ) : (
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <DollarSign className="w-3 h-3" /> Base Stake
            </label>
            <Input
              type="number"
              min={0.35}
              step={0.1}
              disabled={config.enabled || autoGenMode}
              value={config.strategy === "strategy_o" ? localStakeO : (config.strategy === "strategy_p" ? localStakeP : (config.strategy === "strategy_r" ? localStakeR : (config.strategy === "strategy_s" ? localStakeS : localStake)))}
              onChange={(e) => config.strategy === "strategy_o" ? setLocalStakeO(e.target.value) : (config.strategy === "strategy_p" ? setLocalStakeP(e.target.value) : (config.strategy === "strategy_r" ? setLocalStakeR(e.target.value) : (config.strategy === "strategy_s" ? setLocalStakeS(e.target.value) : setLocalStake(e.target.value))))}
              onBlur={config.strategy === "strategy_o" ? handleStakeOBlur : (config.strategy === "strategy_p" ? handleStakePBlur : (config.strategy === "strategy_r" ? handleStakeRBlur : (config.strategy === "strategy_s" ? handleStakeSBlur : handleStakeBlur)))}
              className={`bg-muted border-border font-mono text-sm h-8 ${
                !(config.strategy === "strategy_o" ? isStakeOValid : (config.strategy === "strategy_p" ? isStakePValid : (config.strategy === "strategy_r" ? isStakeRValid : (config.strategy === "strategy_s" ? isStakeSValid : isStakeValid)))) && 
                (config.strategy === "strategy_o" ? localStakeO : (config.strategy === "strategy_p" ? localStakeP : (config.strategy === "strategy_r" ? localStakeR : (config.strategy === "strategy_s" ? localStakeS : localStake)))) !== "" 
                  ? "border-destructive text-destructive" 
                  : ""
              } ${autoGenMode ? "opacity-70 cursor-not-allowed" : ""}`}
            />
            {!(config.strategy === "strategy_o" ? isStakeOValid : (config.strategy === "strategy_p" ? isStakePValid : (config.strategy === "strategy_r" ? isStakeRValid : (config.strategy === "strategy_s" ? isStakeSValid : isStakeValid)))) && 
             (config.strategy === "strategy_o" ? localStakeO : (config.strategy === "strategy_p" ? localStakeP : (config.strategy === "strategy_r" ? localStakeR : (config.strategy === "strategy_s" ? localStakeS : localStake)))) !== "" && (
              <p className="text-[9px] text-destructive font-bold italic animate-in fade-in slide-in-from-top-1">Min $0.35</p>
            )}
          </div>
        )}
      </div>

      {/* 3. Allowed Loss & Target Profit Limits */}
      <div className="grid grid-cols-2 gap-3 border-t border-border/20 pt-3">
        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <DollarSign className="w-3 h-3 text-rose-400" /> Allowed Loss
          </label>
          <Input
            type="number"
            min={0}
            step={1}
            disabled={config.enabled || autoGenMode}
            value={localAllowableLoss}
            onChange={(e) => { setLocalAllowableLoss(e.target.value); setAutoGenMode(false); }}
            onBlur={handleAllowableLossBlur}
            className={`bg-muted border-border font-mono text-sm h-8 ${
              autoGenMode ? "opacity-70 cursor-not-allowed" : ""
            }`}
            placeholder="e.g. 200"
          />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Target className="w-3 h-3 text-sky-400" /> Target Profit
          </label>
          <Input
            type="number"
            min={0}
            step={1}
            disabled={config.enabled || autoGenMode}
            value={localTargetProfit}
            onChange={(e) => { setLocalTargetProfit(e.target.value); setAutoGenMode(false); }}
            onBlur={handleTargetProfitBlur}
            className={`bg-muted border-border font-mono text-sm h-8 ${
              autoGenMode ? "opacity-70 cursor-not-allowed" : ""
            }`}
            placeholder="e.g. 100"
          />
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
            <SelectItem value="10">10 Minutes</SelectItem>
            <SelectItem value="20">20 Minutes</SelectItem>
            <SelectItem value="30">30 Minutes</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-[9px] text-muted-foreground">
          Tool pauses between 5–8 minutes after every interval. Setting locks while running.
        </p>
      </div>

      {/* Trading Strategy Selection */}
      <div className="space-y-1.5 bg-primary/5 p-3 rounded-md border border-primary/20">
        <div className="flex items-center justify-between">
          <label className="text-[10px] uppercase tracking-wider text-primary font-bold flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-primary" /> Trading Strategy
          </label>
          <Badge variant="outline" className="text-[8px] border-primary/40 text-primary px-1.5 font-mono">
            {isAdmin ? "ADMIN / ACTIVE" : "ACTIVE"}
          </Badge>
        </div>
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
          <SelectTrigger className="bg-muted border-border font-mono text-xs h-8">
            <SelectValue placeholder="Select active strategy" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="strategy_s">Strategy S (Graduated Over/Under Ladder)</SelectItem>
            <SelectItem value="strategy_r">Strategy R (Special Markup Recovery)</SelectItem>
            <SelectItem value="strategy_p">Strategy P</SelectItem>
            <SelectItem value="strategy_o">Strategy O</SelectItem>
            <SelectItem value="strategy_n">Strategy N</SelectItem>
            <SelectItem value="strategy_m">Strategy M</SelectItem>
            <SelectItem value="strategy_l">Strategy L</SelectItem>
            <SelectItem value="strategy_k">Strategy K</SelectItem>
            <SelectItem value="strategy_j">Strategy J</SelectItem>
            <SelectItem value="strategy_i">Strategy I</SelectItem>
            <SelectItem value="strategy_h">Strategy H</SelectItem>
            <SelectItem value="strategy_a">Strategy A</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-[8px] text-muted-foreground">
          Choose trading strategy. Setting locks while AI-Automation loop is running.
        </p>
      </div>

      {/* Strategy A/B/C/D Visualizer Panel */}
      {(effectiveStrategy === "strategy_a" || effectiveStrategy === "strategy_b" || effectiveStrategy === "strategy_c" || effectiveStrategy === "strategy_d" || effectiveStrategy === "strategy_e" || effectiveStrategy === "strategy_f" || effectiveStrategy === "strategy_g" || effectiveStrategy === "strategy_k" || effectiveStrategy === "strategy_m") && (
        <div className="bg-gradient-to-br from-primary/10 via-card to-background border border-primary/20 rounded-md p-3.5 space-y-3 relative overflow-hidden shadow-inner text-card-foreground">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex items-center justify-between border-b border-primary/10 pb-2">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-primary uppercase tracking-wider flex items-center gap-1">
                <Target className="w-3.5 h-3.5 text-primary animate-pulse" /> Arrangement #{sessionState.currentArrangementIndex ?? 1}
              </span>
              <span className="text-[8px] text-muted-foreground">
                Seed: {sessionState.shufflingSeed ?? 0} | Progress: {sessionState.arrangementProgressIndex ?? 0} / {
                  effectiveStrategy === "strategy_c" ? "7,484,400" :
                  effectiveStrategy === "strategy_d" ? "29,937,600" :
                  (effectiveStrategy === "strategy_k" || effectiveStrategy === "strategy_m") ? "40,320" :
                  "369,600"
                }
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {effectiveStrategy === "strategy_m" && sessionState.strategyLMode && (
                <Badge variant="outline" className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 ${
                  sessionState.strategyLMode === 'loss_sticky' 
                    ? 'border-amber-500/30 text-amber-400 bg-amber-500/5' 
                    : sessionState.strategyLMode === 'win_sticky'
                    ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/5'
                    : 'border-blue-500/30 text-blue-400 bg-blue-500/5'
                }`}>
                  {sessionState.strategyLMode === 'loss_sticky' 
                    ? 'Loss Sticky' 
                    : sessionState.strategyLMode === 'win_sticky'
                    ? 'Win Sticky'
                    : 'None Sticky'}
                </Badge>
              )}
              <Badge variant="outline" className="text-[9px] border-primary/30 text-primary bg-primary/5 px-1.5 py-0.5">
                Step {(sessionState.sequenceStep ?? 0) + 1}/{(effectiveStrategy === "strategy_k" || effectiveStrategy === "strategy_m") ? 8 : 12}
              </Badge>
            </div>
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

          {(effectiveStrategy === "strategy_g" || effectiveStrategy === "strategy_k" || effectiveStrategy === "strategy_m") && sessionState.blacklistedPrefixes?.["global"] && sessionState.blacklistedPrefixes["global"].length > 0 && (
            <div className="mt-2 space-y-1 bg-destructive/5 p-2 rounded border border-destructive/15">
              <div className="flex items-center justify-between pb-1">
                <span className="text-[8px] uppercase tracking-wider text-destructive font-bold flex items-center gap-1">
                  🚫 Session Blacklisted Prefixes (Globally)
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-4 px-1.5 text-[8px] text-primary hover:bg-primary/10 hover:text-primary font-bold uppercase tracking-wider flex items-center gap-0.5 border border-primary/10 shadow-[0_0_8px_rgba(59,130,246,0.1)]"
                    onClick={exportBlacklistToCSV}
                  >
                    <Download className="w-2 h-2" /> Export CSV
                  </Button>
                  {onClearBlacklist && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-4 px-1.5 text-[8px] text-destructive hover:bg-destructive/10 hover:text-destructive font-bold uppercase tracking-wider"
                      onClick={onClearBlacklist}
                    >
                      Clear Blacklist
                    </Button>
                  )}
                </div>
              </div>
              <div className="max-h-[72px] overflow-y-auto pr-1 custom-scrollbar flex flex-wrap gap-1 align-content-start">
                {[...sessionState.blacklistedPrefixes["global"]].reverse().map((prefix) => (
                  <Badge 
                    key={prefix} 
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
                <Shuffle className="w-3.5 h-3.5 text-pink-400 animate-spin-slow" /> Strategy J (Generalized Fibonacci)
              </span>
              <span className="text-[8px] text-muted-foreground">
                Path: Generalized Fibonacci modulo 8 | G(0) = {sessionState.strategyJ_fibStartA ?? "?"}, G(1) = {sessionState.strategyJ_fibStartB ?? "?"}
              </span>
            </div>
            {sessionState.strategyJ_fibStep !== undefined && sessionState.strategyJ_fibStep >= 0 ? (
              <Badge variant="outline" className="text-[9px] border-pink-500/30 text-pink-400 bg-pink-500/5 px-1.5 py-0.5">
                Step n = {sessionState.strategyJ_fibStep}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[9px] border-amber-500/30 text-amber-400 bg-amber-500/5 px-1.5 py-0.5 animate-pulse">
                INITIALIZING
              </Badge>
            )}
          </div>

          {sessionState.strategyJ_fibStep === undefined || sessionState.strategyJ_fibStep === -1 || sessionState.strategyJ_fibStartA === undefined || sessionState.strategyJ_fibStartA === -1 ? (
            <div className="flex flex-col items-center justify-center py-4 px-2 bg-pink-950/10 border border-pink-950/20 rounded-md text-center">
              <Shuffle className="w-8 h-8 text-pink-400/40 mb-2 animate-bounce" />
              <span className="text-xs font-semibold text-pink-300">Ready to Launch Sequence</span>
              <span className="text-[9px] text-muted-foreground max-w-[220px] mt-1">
                Generates a random Fibonacci sequence G(n) at session start or after wins.
              </span>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-5 gap-1.5 py-1">
                {[-2, -1, 0, 1, 2].map((offset) => {
                  const currentN = (sessionState.strategyJ_fibStep ?? 0) + offset;
                  if (currentN < 0) {
                    return (
                      <div
                        key={offset}
                        className="flex flex-col items-center justify-center py-1.5 px-0.5 rounded border border-dashed border-muted-foreground/20 opacity-30 select-none cursor-default"
                      >
                        <span className="text-[8px] text-muted-foreground">n = {currentN}</span>
                        <span className="text-[10px] font-mono font-bold text-muted-foreground">N/A</span>
                      </div>
                    );
                  }

                  const val = getGeneralizedFibonacci(
                    sessionState.strategyJ_fibStartA ?? 0,
                    sessionState.strategyJ_fibStartB ?? 0,
                    currentN
                  );
                  const valStr = val.toString();
                  const mod = Number(val % 8n);
                  const isActive = offset === 0;

                  let code = "U4";
                  let label = "Under 4";
                  let bgClass = "";
                  let borderClass = "";
                  let textClass = "";

                  if (mod === 1) {
                    code = "U4"; label = "Under 4";
                    bgClass = isActive ? "bg-gradient-to-r from-blue-500/25 to-indigo-500/25" : "bg-blue-950/20";
                    borderClass = isActive ? "border-blue-400/85 shadow-[0_0_10px_rgba(59,130,246,0.6)]" : "border-blue-950/40 hover:border-blue-900/60";
                    textClass = "text-blue-400";
                  } else if (mod === 2) {
                    code = "O5"; label = "Over 5";
                    bgClass = isActive ? "bg-gradient-to-r from-amber-500/25 to-orange-500/25" : "bg-amber-950/20";
                    borderClass = isActive ? "border-amber-400/85 shadow-[0_0_10px_rgba(245,158,11,0.6)]" : "border-amber-950/40 hover:border-amber-900/60";
                    textClass = "text-amber-400";
                  } else if (mod === 3) {
                    code = "Even"; label = "Even";
                    bgClass = isActive ? "bg-gradient-to-r from-violet-500/25 to-fuchsia-500/25" : "bg-violet-950/20";
                    borderClass = isActive ? "border-violet-400/85 shadow-[0_0_10px_rgba(139,92,246,0.6)]" : "border-violet-950/40 hover:border-violet-900/60";
                    textClass = "text-violet-400";
                  } else if (mod === 4) {
                    code = "CALL"; label = "Call (Rise)";
                    bgClass = isActive ? "bg-gradient-to-r from-rose-500/25 to-pink-500/25" : "bg-rose-950/20";
                    borderClass = isActive ? "border-rose-400/85 shadow-[0_0_10px_rgba(244,63,94,0.6)]" : "border-rose-950/40 hover:border-rose-900/60";
                    textClass = "text-rose-400";
                  } else if (mod === 5) {
                    code = "U5"; label = "Under 5";
                    bgClass = isActive ? "bg-gradient-to-r from-purple-500/25 to-pink-500/25" : "bg-purple-950/20";
                    borderClass = isActive ? "border-purple-400/85 shadow-[0_0_10px_rgba(168,85,247,0.6)]" : "border-purple-950/40 hover:border-purple-900/60";
                    textClass = "text-purple-400";
                  } else if (mod === 6) {
                    code = "O4"; label = "Over 4";
                    bgClass = isActive ? "bg-gradient-to-r from-emerald-500/25 to-teal-500/25" : "bg-emerald-950/20";
                    borderClass = isActive ? "border-emerald-400/85 shadow-[0_0_10px_rgba(52,211,153,0.6)]" : "border-emerald-950/40 hover:border-emerald-900/60";
                    textClass = "text-emerald-400";
                  } else if (mod === 7) {
                    code = "PUT"; label = "Put (Fall)";
                    bgClass = isActive ? "bg-gradient-to-r from-red-500/25 to-orange-500/25" : "bg-red-950/20";
                    borderClass = isActive ? "border-red-400/85 shadow-[0_0_10px_rgba(239,68,68,0.6)]" : "border-red-950/40 hover:border-red-900/60";
                    textClass = "text-red-400";
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
                        n = {currentN}
                      </span>
                      <span className={`text-[11px] font-mono font-black ${textClass}`} title={`Value: ${valStr}`}>
                        {valStr.length > 4 ? `${valStr.substring(0, 3)}..` : valStr}
                      </span>
                      <span className={`text-[8px] font-bold ${textClass} scale-90 mt-0.5`}>
                        {code}
                      </span>
                      {isActive && (
                        <span className="absolute -top-1 -right-1 flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-500 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-pink-500"></span>
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-1.5 justify-between text-[8px] bg-muted/40 px-2 py-1 rounded border border-border/40">
                <span className="text-muted-foreground flex items-center gap-1">
                  <AlertCircle className="w-2.5 h-2.5 text-pink-400 animate-pulse" /> Current Fibonacci Number:
                </span>
                <span className="font-bold text-foreground font-mono">
                  G({sessionState.strategyJ_fibStep}) = {getGeneralizedFibonacci(
                    sessionState.strategyJ_fibStartA ?? 0,
                    sessionState.strategyJ_fibStartB ?? 0,
                    sessionState.strategyJ_fibStep ?? 0
                  ).toString()} (Mapped to {(() => {
                    const val = getGeneralizedFibonacci(
                      sessionState.strategyJ_fibStartA ?? 0,
                      sessionState.strategyJ_fibStartB ?? 0,
                      sessionState.strategyJ_fibStep ?? 0
                    );
                    const mod = Number(val % 8n);
                    if (mod === 1) return "DIGITUNDER 4 (Barrier 4)";
                    if (mod === 2) return "DIGITOVER 5 (Barrier 5)";
                    if (mod === 3) return "DIGITEVEN (No Barrier)";
                    if (mod === 4) return "RISE (Allow Equals)";
                    if (mod === 5) return "DIGITUNDER 5 (Barrier 5)";
                    if (mod === 6) return "DIGITOVER 4 (Barrier 4)";
                    if (mod === 7) return "FALL (Allow Equals)";
                    return "DIGITODD (No Barrier)";
                  })()})
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {effectiveStrategy === "strategy_l" && (
        <div className="bg-gradient-to-br from-teal-500/15 via-card to-emerald-500/15 border border-teal-500/20 rounded-md p-3.5 space-y-3 relative overflow-hidden shadow-inner text-card-foreground">
          <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/5 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex items-center justify-between border-b border-teal-500/10 pb-2">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-teal-400 uppercase tracking-wider flex items-center gap-1">
                <Shuffle className="w-3.5 h-3.5 text-teal-400 animate-pulse" /> Strategy L (Random Over 2 / Under 7)
              </span>
              <span className="text-[8px] text-muted-foreground">
                Path: Random volatility & random Over 2 or Under 7 contracts
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {sessionState.strategyLMode && (
                <Badge variant="outline" className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 ${
                  sessionState.strategyLMode === 'loss_sticky' 
                    ? 'border-amber-500/30 text-amber-400 bg-amber-500/5' 
                    : sessionState.strategyLMode === 'win_sticky'
                    ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/5'
                    : 'border-blue-500/30 text-blue-400 bg-blue-500/5'
                }`}>
                  {sessionState.strategyLMode === 'loss_sticky' 
                    ? 'Loss Sticky' 
                    : sessionState.strategyLMode === 'win_sticky'
                    ? 'Win Sticky'
                    : 'None Sticky'}
                </Badge>
              )}
              <Badge variant="outline" className="text-[9px] border-teal-500/30 text-teal-400 bg-teal-500/5 px-1.5 py-0.5 animate-pulse">
                ACTIVE LOOP
              </Badge>
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-[9px] text-muted-foreground uppercase tracking-wider block">Contract Candidates Pool:</span>
            <div className="grid grid-cols-2 gap-2 py-1">
              {[
                { code: "O2", label: "Over 2", textClass: "text-emerald-400", bgClass: "bg-emerald-950/20", borderClass: "border-emerald-950/40" },
                { code: "U7", label: "Under 7", textClass: "text-blue-400", bgClass: "bg-blue-950/20", borderClass: "border-blue-950/40" }
              ].map((item) => {
                const isActive = sessionState.currentCategory === (item.code === "O2" ? "over2" : "under7");
                return (
                  <div
                    key={item.code}
                    title={item.label}
                    className={`flex flex-col items-center justify-center py-2 px-1 rounded border transition-all duration-300 relative cursor-default select-none ${item.bgClass} ${item.borderClass} ${isActive ? "scale-105 border-2 border-primary" : "opacity-60"}`}
                  >
                    <span className={`text-xs font-mono font-black ${item.textClass}`}>
                      {item.code}
                    </span>
                    <span className="text-[7px] text-muted-foreground mt-0.5">{item.label}</span>
                    {isActive && (
                      <span className="absolute -top-1 -right-1 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-500 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            
            <div className="flex items-center gap-1.5 justify-between text-[8px] bg-muted/40 px-2 py-1 rounded border border-border/40 mt-1">
              <span className="text-muted-foreground flex items-center gap-1">
                <AlertCircle className="w-2.5 h-2.5 text-teal-400 animate-pulse" /> Active trade target:
              </span>
              <span className="font-bold text-foreground">
                {(() => {
                  const cat = sessionState.currentCategory;
                  if (!cat) return "None (Waiting...)";
                  if (cat === "over2") return "DIGITOVER 2 (Barrier 2)";
                  if (cat === "under7") return "DIGITUNDER 7 (Barrier 7)";
                  return cat;
                })()}
              </span>
            </div>
          </div>
        </div>
      )}

      {config.strategy === "strategy_o" && (
        <div className="bg-gradient-to-br from-indigo-500/15 via-card to-purple-500/15 border border-indigo-500/20 rounded-md p-3.5 space-y-3 relative overflow-hidden shadow-inner text-card-foreground">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex items-center justify-between border-b border-indigo-500/10 pb-2">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                <Shuffle className="w-3.5 h-3.5 text-indigo-400 animate-pulse" /> Strategy O (Dynamic Staking & Progression)
              </span>
              <span className="text-[8px] text-muted-foreground">
                {"Path: Over 2/Under 7 -> Over 1/Under 8 -> Reset to Step 0"}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {sessionState.strategyLMode && (
                <Badge variant="outline" className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 ${
                  sessionState.strategyLMode === 'loss_sticky' 
                    ? 'border-amber-500/30 text-amber-400 bg-amber-500/5' 
                    : sessionState.strategyLMode === 'win_sticky'
                    ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/5'
                    : 'border-blue-500/30 text-blue-400 bg-blue-500/5'
                }`}>
                  {sessionState.strategyLMode === 'loss_sticky' 
                    ? 'Loss Sticky' 
                    : sessionState.strategyLMode === 'win_sticky'
                    ? 'Win Sticky'
                    : 'None Sticky'}
                </Badge>
              )}
              <Badge variant="outline" className="text-[9px] border-indigo-500/30 text-indigo-400 bg-indigo-500/5 px-1.5 py-0.5 animate-pulse">
                ACTIVE LOOP
              </Badge>
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-[9px] text-muted-foreground uppercase tracking-wider block">Contract Candidates Pool (Current Step):</span>
            <div className="grid grid-cols-3 gap-2 py-1">
              {[
                { code: "O2/U7", label: "Over 2/Under 7 (Step 0)", textClass: "text-emerald-400", bgClass: "bg-emerald-950/20", borderClass: "border-emerald-950/40", active: sessionState.martingaleStep === 0 || sessionState.status === "WIN" || sessionState.status === "IDLE" },
                { code: "O1/U8", label: "Over 1/Under 8 (Step 1)", textClass: "text-blue-400", bgClass: "bg-blue-950/20", borderClass: "border-blue-950/40", active: sessionState.martingaleStep === 1 && sessionState.status === "LOSS" },
                { code: "O1/U8", label: "Over 1/Under 8 (Step 2)", textClass: "text-purple-400", bgClass: "bg-purple-950/20", borderClass: "border-purple-950/40", active: sessionState.martingaleStep >= 2 && sessionState.status === "LOSS" }
              ].map((item) => {
                return (
                  <div
                    key={item.label}
                    title={item.label}
                    className={`flex flex-col items-center justify-center py-2 px-1 rounded border transition-all duration-300 relative cursor-default select-none ${item.bgClass} ${item.borderClass} ${item.active ? "scale-105 border-2 border-primary opacity-100 font-bold" : "opacity-40"}`}
                  >
                    <span className={`text-xs font-mono font-black ${item.textClass}`}>
                      {item.code}
                    </span>
                    <span className="text-[7px] text-muted-foreground mt-0.5 text-center leading-tight">{item.label}</span>
                    {item.active && (
                      <span className="absolute -top-1 -right-1 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-500 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            
            <div className="flex items-center gap-1.5 justify-between text-[8px] bg-muted/40 px-2 py-1 rounded border border-border/40 mt-1">
              <span className="text-muted-foreground flex items-center gap-1">
                <AlertCircle className="w-2.5 h-2.5 text-indigo-400 animate-pulse" /> Active trade target:
              </span>
              <span className="font-bold text-foreground">
                {(() => {
                  const cat = sessionState.currentCategory;
                  if (!cat) return "None (Waiting...)";
                  if (cat === "even") return "DIGITEVEN (Even)";
                  if (cat === "odd") return "DIGITODD (Odd)";
                  if (cat === "over2") return "DIGITOVER 2 (Barrier 2)";
                  if (cat === "under7") return "DIGITUNDER 7 (Barrier 7)";
                  if (cat === "over1") return "DIGITOVER 1 (Barrier 1)";
                  if (cat === "under8") return "DIGITUNDER 8 (Barrier 8)";
                  return cat;
                })()}
              </span>
            </div>
          </div>
        </div>
      )}

      {config.strategy === "strategy_p" && (
        <div className="bg-gradient-to-br from-indigo-500/15 via-card to-purple-500/15 border border-indigo-500/20 rounded-md p-3.5 space-y-3 relative overflow-hidden shadow-inner text-card-foreground">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex items-center justify-between border-b border-indigo-500/10 pb-2">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                <Shuffle className="w-3.5 h-3.5 text-indigo-400 animate-pulse" /> Strategy P (Dynamic Staking & Progression)
              </span>
              <span className="text-[8px] text-muted-foreground">
                {"Path: Over 1/Under 8 -> Over 5/Under 4 -> Unlimited Recovery"}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {sessionState.strategyLMode && (
                <Badge variant="outline" className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 ${
                  sessionState.strategyLMode === 'loss_sticky' 
                    ? 'border-amber-500/30 text-amber-400 bg-amber-500/5' 
                    : sessionState.strategyLMode === 'win_sticky'
                    ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/5'
                    : 'border-blue-500/30 text-blue-400 bg-blue-500/5'
                }`}>
                  {sessionState.strategyLMode === 'loss_sticky' 
                    ? 'Loss Sticky' 
                    : sessionState.strategyLMode === 'win_sticky'
                    ? 'Win Sticky'
                    : 'None Sticky'}
                </Badge>
              )}
              <Badge variant="outline" className="text-[9px] border-indigo-500/30 text-indigo-400 bg-indigo-500/5 px-1.5 py-0.5 animate-pulse">
                ACTIVE LOOP
              </Badge>
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-[9px] text-muted-foreground uppercase tracking-wider block">Contract Candidates Pool (Current Step):</span>
            <div className="grid grid-cols-3 gap-2 py-1">
              {[
                { code: "O1/U8", label: "Over 1/Under 8 (Step 0)", textClass: "text-emerald-400", bgClass: "bg-emerald-950/20", borderClass: "border-emerald-950/40", active: sessionState.martingaleStep === 0 || sessionState.status === "WIN" || sessionState.status === "IDLE" },
                { code: "O5/U4", label: "Over 5/Under 4 (Step 1)", textClass: "text-blue-400", bgClass: "bg-blue-950/20", borderClass: "border-blue-950/40", active: sessionState.martingaleStep === 1 && sessionState.status === "LOSS" },
                { code: "O5/U4", label: "Over 5/Under 4 (Step 2+)", textClass: "text-purple-400", bgClass: "bg-purple-950/20", borderClass: "border-purple-950/40", active: sessionState.martingaleStep >= 2 && sessionState.status === "LOSS" }
              ].map((item) => {
                return (
                  <div
                    key={item.label}
                    title={item.label}
                    className={`flex flex-col items-center justify-center py-2 px-1 rounded border transition-all duration-300 relative cursor-default select-none ${item.bgClass} ${item.borderClass} ${item.active ? "scale-105 border-2 border-primary opacity-100 font-bold" : "opacity-40"}`}
                  >
                    <span className={`text-xs font-mono font-black ${item.textClass}`}>
                      {item.code}
                    </span>
                    <span className="text-[7px] text-muted-foreground mt-0.5 text-center leading-tight">{item.label}</span>
                    {item.active && (
                      <span className="absolute -top-1 -right-1 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-500 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-[10px] mt-1">
              <div className="bg-muted/50 rounded p-1.5 border border-border/50">
                <span className="text-muted-foreground block text-[8px] uppercase">Sequence Base Stake</span>
                <span className="font-mono font-bold text-indigo-400">
                  ${sessionState.strategyPSequenceBaseStake !== undefined ? sessionState.strategyPSequenceBaseStake.toFixed(2) : (config.strategyPBaseStake ?? config.baseStake).toFixed(2)}
                </span>
              </div>
              <div className="bg-muted/50 rounded p-1.5 border border-border/50">
                <span className="text-muted-foreground block text-[8px] uppercase">Active Recovery Loss</span>
                <span className="font-mono font-bold text-rose-400">
                  ${sessionState.strategyPAccumulatedLoss !== undefined ? sessionState.strategyPAccumulatedLoss.toFixed(2) : "0.00"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 justify-between text-[8px] bg-muted/40 px-2 py-1 rounded border border-border/40 mt-1">
              <span className="text-muted-foreground flex items-center gap-1">
                <AlertCircle className="w-2.5 h-2.5 text-indigo-400 animate-pulse" /> Active trade target:
              </span>
              <span className="font-bold text-foreground">
                {(() => {
                  const cat = sessionState.currentCategory;
                  if (!cat) return "None (Waiting...)";
                  if (cat === "over1") return "DIGITOVER 1 (Barrier 1)";
                  if (cat === "under8") return "DIGITUNDER 8 (Barrier 8)";
                  if (cat === "over5") return "DIGITOVER 5 (Barrier 5)";
                  if (cat === "under4") return "DIGITUNDER 4 (Barrier 4)";
                  return cat;
                })()}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Admin Debug Toggle for Strategy R & Strategy S (IP Protection) */}
      {isAdmin && (config.strategy === "strategy_r" || config.strategy === "strategy_s") && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-md p-2.5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
            <div className="flex flex-col">
              <span className="font-bold text-amber-300 text-[11px]">
                Admin Control: {config.strategy === "strategy_s" ? "Strategy S" : "Strategy R"} Scanner Interface
              </span>
              <span className="text-muted-foreground text-[9px]">Toggle internal scanner & candidates UI for troubleshooting/updates</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${
              showStrategyRDebug 
                ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10" 
                : "border-amber-500/40 text-amber-400 bg-amber-500/10"
            }`}>
              {showStrategyRDebug ? "VISIBLE" : "HIDDEN (DEFAULT)"}
            </span>
            <Switch
              checked={showStrategyRDebug}
              onCheckedChange={(checked) => {
                setShowStrategyRDebug(checked);
                try {
                  localStorage.setItem("admin_show_strategy_r_debug", String(checked));
                  window.dispatchEvent(new Event('storage'));
                } catch {}
                supabase
                  .from('system_settings')
                  .upsert({ key: 'enable_strategy_r_debug', value: checked }, { onConflict: 'key' })
                  .then();
              }}
            />
          </div>
        </div>
      )}

      {/* Strategy R / Strategy S monitoring panel — hidden globally by default, revealed when Admin turns master switch ON */}
      {(config.strategy === "strategy_r" || config.strategy === "strategy_s") && showStrategyRDebug && (
        <div className="bg-gradient-to-br from-violet-500/15 via-card to-fuchsia-500/15 border border-violet-500/20 rounded-md p-3.5 space-y-3 relative overflow-hidden shadow-inner text-card-foreground">
          <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/5 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex items-center justify-between border-b border-violet-500/10 pb-2">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-violet-400 uppercase tracking-wider flex items-center gap-1">
                <Shuffle className="w-3.5 h-3.5 text-violet-400 animate-pulse" /> {config.strategy === "strategy_s" ? "Strategy S (Graduated Over/Under Ladder)" : "Strategy R (Special Markup Recovery)"}
              </span>
              <span className="text-[8px] text-muted-foreground">
                {config.strategy === "strategy_s"
                  ? "Path: Base (O1/U8) → Rec 1 (O1/U8) → Rec 2 (O2/U7) → Rec 3 (O3/U6) → Rec 4 (O4/U5) → Rec 5+ (SP)"
                  : "Path: Over 1/Under 8 → Over 5/Under 4/Special Contracts"}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {((config.strategy === "strategy_s" && config.strategySStickyEnabled && sessionState.strategySMode) ||
                (config.strategy === "strategy_r" && config.strategyRStickyEnabled && sessionState.strategyRMode)) && (
                <Badge variant="outline" className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 ${
                  (config.strategy === "strategy_s" ? sessionState.strategySMode : sessionState.strategyRMode) === 'loss_sticky'
                    ? 'border-amber-500/30 text-amber-400 bg-amber-500/5'
                    : (config.strategy === "strategy_s" ? sessionState.strategySMode : sessionState.strategyRMode) === 'win_sticky'
                    ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/5'
                    : 'border-blue-500/30 text-blue-400 bg-blue-500/5'
                }`}>
                  {(config.strategy === "strategy_s" ? sessionState.strategySMode : sessionState.strategyRMode) === 'loss_sticky'
                    ? `Loss Sticky (R: ${(config.strategy === "strategy_s" ? sessionState.strategySModeCount : sessionState.strategyRModeCount) ?? 0})`
                    : (config.strategy === "strategy_s" ? sessionState.strategySMode : sessionState.strategyRMode) === 'win_sticky'
                    ? `Win Sticky (R: ${(config.strategy === "strategy_s" ? sessionState.strategySModeCount : sessionState.strategyRModeCount) ?? 0})`
                    : `None Sticky (R: ${(config.strategy === "strategy_s" ? sessionState.strategySModeCount : sessionState.strategyRModeCount) ?? 0})`}
                </Badge>
              )}
              <Badge variant="outline" className="text-[9px] border-violet-500/30 text-violet-400 bg-violet-500/5 px-1.5 py-0.5 animate-pulse">
                ACTIVE LOOP
              </Badge>
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-[9px] text-muted-foreground uppercase tracking-wider block">Contract Candidates Pool (Current Step):</span>
            <div className={`grid ${config.strategy === "strategy_s" ? "grid-cols-3 sm:grid-cols-6" : "grid-cols-3"} gap-2 py-1`}>
              {(config.strategy === "strategy_s" ? [
                { code: "O1/U8", label: "Base (0.20)", textClass: "text-emerald-400", bgClass: "bg-emerald-950/20", borderClass: "border-emerald-950/40", active: sessionState.martingaleStep === 0 || sessionState.status === "WIN" || sessionState.status === "IDLE" },
                { code: "O1/U8", label: "Rec 1 (0.20)", textClass: "text-blue-400", bgClass: "bg-blue-950/20", borderClass: "border-blue-950/40", active: sessionState.martingaleStep === 1 && sessionState.status === "LOSS" },
                { code: "O2/U7", label: "Rec 2 (0.36)", textClass: "text-cyan-400", bgClass: "bg-cyan-950/20", borderClass: "border-cyan-950/40", active: sessionState.martingaleStep === 2 && sessionState.status === "LOSS" },
                { code: "O3/U6", label: "Rec 3 (0.55)", textClass: "text-amber-400", bgClass: "bg-amber-950/20", borderClass: "border-amber-950/40", active: sessionState.martingaleStep === 3 && sessionState.status === "LOSS" },
                { code: "O4/U5", label: "Rec 4 (0.85)", textClass: "text-orange-400", bgClass: "bg-orange-950/20", borderClass: "border-orange-950/40", active: sessionState.martingaleStep === 4 && sessionState.status === "LOSS" },
                { code: "E/O / P/C", label: "Rec 5+ (0.85)", textClass: "text-purple-400", bgClass: "bg-purple-950/20", borderClass: "border-purple-950/40", active: sessionState.martingaleStep >= 5 && sessionState.status === "LOSS" },
              ] : [
                { code: "O1/U8", label: "Over 1/Under 8 (Step 0)", textClass: "text-emerald-400", bgClass: "bg-emerald-950/20", borderClass: "border-emerald-950/40", active: sessionState.martingaleStep === 0 || sessionState.status === "WIN" || sessionState.status === "IDLE" },
                { code: "O5/U4/SP", label: "Special Markup (Step 1)", textClass: "text-blue-400", bgClass: "bg-blue-950/20", borderClass: "border-blue-950/40", active: sessionState.martingaleStep === 1 && sessionState.status === "LOSS" },
                { code: "O5/U4/SP", label: "Special Markup (Step 2+)", textClass: "text-purple-400", bgClass: "bg-purple-950/20", borderClass: "border-purple-950/40", active: sessionState.martingaleStep >= 2 && sessionState.status === "LOSS" }
              ]).map((item) => {
                return (
                  <div
                    key={item.label}
                    title={item.label}
                    className={`flex flex-col items-center justify-center py-2 px-1 rounded border transition-all duration-300 relative cursor-default select-none ${item.bgClass} ${item.borderClass} ${item.active ? "scale-105 border-2 border-primary opacity-100 font-bold" : "opacity-40"}`}
                  >
                    <span className={`text-xs font-mono font-black ${item.textClass}`}>
                      {item.code}
                    </span>
                    <span className="text-[7px] text-muted-foreground mt-0.5 text-center leading-tight">{item.label}</span>
                    {item.active && (
                      <span className="absolute -top-1 -right-1 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-500 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Strategy R / S 0 or 1 Last-Digit Live Scanner Monitor */}
            {(() => {
              const allVolatilitySymbols = [
                "1HZ10V", "1HZ25V", "1HZ50V", "1HZ75V", "1HZ100V",
                "R_10", "R_25", "R_50", "R_75", "R_100"
              ];
              const symbolDetails = allVolatilitySymbols.map(sym => {
                const state = getSymbolState?.(sym);
                const digits = state?.digits || [];
                const lastDigit = digits.length > 0 ? digits[digits.length - 1] : undefined;
                const isMatch = lastDigit === 0 || lastDigit === 1;
                return { symbol: sym, lastDigit, isMatch };
              });
              const matchedList = symbolDetails.filter(s => s.isMatch);
              const selectedSymbol = sessionState.currentSymbol;

              return (
                <div className="bg-muted/40 p-2.5 rounded-md border border-violet-500/30 space-y-2 relative">
                  <div className="flex items-center justify-between border-b border-border/40 pb-1.5">
                    <span className="text-[10px] font-bold text-violet-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5 text-violet-400 animate-pulse" /> WIN / Idle 0 or 1 Volatility Scanner
                    </span>
                    <Badge variant="outline" className="text-[8px] font-mono font-bold px-1.5 py-0.5 border-violet-500/30 text-violet-300 bg-violet-500/10">
                      LIVE TICKS
                    </Badge>
                  </div>

                  {/* Candidate Status Banner */}
                  {matchedList.length === 0 ? (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded p-2 text-[9px] text-amber-300 space-y-1">
                      <div className="flex items-center justify-between font-bold">
                        <span className="flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5 text-amber-400 animate-pulse" /> 0 Volatilities Matched</span>
                        <Badge variant="outline" className="text-amber-400 border-amber-500/40 bg-amber-500/10 text-[8px]">WAITING FOR 0 OR 1 TICK</Badge>
                      </div>
                      <p className="text-[8px] text-amber-300/80">No volatility currently shows a last digit of 0 or 1. AutoTrader is paused & scanning live ticks to auto-resume once found.</p>
                    </div>
                  ) : matchedList.length === 1 ? (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded p-2 text-[9px] text-emerald-300 space-y-1">
                      <div className="flex items-center justify-between font-bold">
                        <span className="flex items-center gap-1"><Target className="w-3.5 h-3.5 text-emerald-400" /> 1 Volatility Matched</span>
                        <Badge variant="outline" className="text-emerald-400 border-emerald-500/40 bg-emerald-500/10 text-[8px]">SINGLE MATCH</Badge>
                      </div>
                      <p className="text-[8px] text-emerald-200/90 font-mono">
                        Matched: <span className="font-bold text-emerald-400">{matchedList[0].symbol}</span> (Last Digit: <span className="font-bold">{matchedList[0].lastDigit}</span>) → Directly Selected for Trade
                      </p>
                    </div>
                  ) : (
                    <div className="bg-violet-500/10 border border-violet-500/30 rounded p-2 text-[9px] text-violet-300 space-y-1">
                      <div className="flex items-center justify-between font-bold">
                        <span className="flex items-center gap-1"><Shuffle className="w-3.5 h-3.5 text-violet-400" /> {matchedList.length} Volatilities Matched</span>
                        <Badge variant="outline" className="text-violet-400 border-violet-500/40 bg-violet-500/10 text-[8px]">MULTIPLE MATCHES</Badge>
                      </div>
                      <div className="text-[8px] text-violet-200 font-mono space-y-0.5">
                        <div>Matched Candidates: <span className="font-bold text-violet-300">{matchedList.map(c => `${c.symbol} [Digit: ${c.lastDigit}]`).join(", ")}</span></div>
                        <div>Randomly Selected Target: <span className="font-bold text-emerald-400">{selectedSymbol || matchedList[0].symbol}</span></div>
                      </div>
                    </div>
                  )}

                  {/* 10 Volatilities Real-Time Last-Digit Grid */}
                  <div>
                    <span className="text-[8px] text-muted-foreground font-bold uppercase tracking-wider block mb-1">Live Volatility Ticks Monitor (All 10 Symbols):</span>
                    <div className="grid grid-cols-5 gap-1.5 text-[8px]">
                      {symbolDetails.map(item => {
                        const isSelected = selectedSymbol === item.symbol;
                        return (
                          <div
                            key={item.symbol}
                            className={`p-1.5 rounded border flex flex-col items-center justify-center transition-all ${
                              item.isMatch
                                ? "bg-emerald-950/40 border-emerald-500/60 shadow-[0_0_8px_rgba(16,185,129,0.2)]"
                                : "bg-muted/30 border-border/40 opacity-70"
                            } ${isSelected ? "ring-1 ring-emerald-400" : ""}`}
                          >
                            <span className="font-bold text-[8px] text-foreground">{item.symbol}</span>
                            <span className={`font-mono text-[9px] font-black mt-0.5 ${
                              item.isMatch ? "text-emerald-400" : "text-muted-foreground"
                            }`}>
                              {item.lastDigit !== undefined ? `Digit: ${item.lastDigit}` : "-"}
                            </span>
                            {item.isMatch && (
                              <span className="text-[7px] text-emerald-300 font-bold mt-0.5">🎯 MATCH</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Strategy R / S Recovery Statistical & Tick Trigger Monitor */}
            {(() => {
              const allRVolatilitySymbols = [
                "1HZ10V", "1HZ25V", "1HZ50V", "1HZ75V", "1HZ100V",
                "R_10", "R_25", "R_50", "R_75", "R_100",
              ];

              const evaluatedList: StrategyREvenOddEvaluation[] = [];
              for (const sym of allRVolatilitySymbols) {
                const st = getSymbolState ? getSymbolState(sym) : undefined;
                if (st && st.digits && st.digits.length >= 100) {
                  const evalRes = evaluateStrategyREvenOddCandidate(sym, st.digits);
                  if (evalRes) {
                    evaluatedList.push(evalRes);
                  }
                }
              }

              const validatedList = evaluatedList.filter(e => e.isValidated);

              return (
                <div className="bg-muted/40 p-2.5 rounded-md border border-cyan-500/30 space-y-2">
                  <div className="flex items-center justify-between text-[9px]">
                    <span className="font-bold text-cyan-300 flex items-center gap-1.5">
                      <Wand2 className="w-3.5 h-3.5 text-cyan-400" /> {config.strategy === "strategy_s" ? "Step 5+ Special Candidate Scanner" : "EVEN/ODD 100-Digit Recovery Scanner"}
                    </span>
                    <Badge variant="outline" className={`text-[8px] font-mono font-bold px-1.5 py-0.5 ${
                      validatedList.length > 0
                        ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10 animate-pulse"
                        : evaluatedList.length > 0
                        ? "border-cyan-500/40 text-cyan-400 bg-cyan-500/10"
                        : "border-muted text-muted-foreground"
                    }`}>
                      {validatedList.length > 0
                        ? `${validatedList.length} QUALIFIED (READY)`
                        : evaluatedList.length > 0
                        ? `${evaluatedList.length} CANDIDATE(S) WATCHING`
                        : "NO CANDIDATES (A-D)"}
                    </Badge>
                  </div>

                  {evaluatedList.length > 0 ? (
                    <div className="space-y-1.5">
                      {evaluatedList.map(cand => (
                        <div
                          key={cand.symbol}
                          className={`p-2 rounded border text-[8.5px] font-mono space-y-1 ${
                            cand.isValidated
                              ? "bg-emerald-950/30 border-emerald-500/50 text-emerald-200"
                              : cand.isInvalidated
                              ? "bg-rose-950/20 border-rose-500/30 text-rose-300 opacity-60"
                              : "bg-cyan-950/30 border-cyan-500/40 text-cyan-200"
                          }`}
                        >
                          <div className="flex items-center justify-between font-bold">
                            <span>{cand.symbol} ({cand.pattern} → {cand.targetContract.toUpperCase()})</span>
                            <Badge variant="outline" className={`text-[7.5px] px-1 py-0 ${
                              cand.isValidated
                                ? "border-emerald-500 text-emerald-400 bg-emerald-500/20"
                                : cand.isInvalidated
                                ? "border-rose-500 text-rose-400 bg-rose-500/20"
                                : "border-cyan-500 text-cyan-300 bg-cyan-500/20"
                            }`}>
                              {cand.isValidated
                                ? "🎯 TRIGGER CONFIRMED"
                                : cand.isInvalidated
                                ? "❌ INVALIDATED"
                                : cand.triggerAppeared
                                ? "👀 TRIGGER FIRED - WATCHING NEXT"
                                : "⏳ WATCHING TRIGGER DIGIT"}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-4 gap-1 text-[7.5px]">
                            <div>D1: <span className="font-bold text-foreground">{cand.d1} ({cand.p1}%)</span></div>
                            <div>D2: <span className="font-bold text-foreground">{cand.d2} ({cand.p2}%)</span></div>
                            <div>D3: <span className="font-bold text-foreground">{cand.d3} ({cand.p3}%)</span></div>
                            <div>Trigger D10: <span className="font-bold text-amber-300">{cand.triggerDigit} ({cand.p10}%)</span></div>
                          </div>
                        </div>
                      ))}
                      {validatedList.length > 1 && (
                        <p className="text-[7.5px] text-violet-300 italic">
                          Multiple candidates passed all criteria A-E. One will be randomly selected for the recovery trade.
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-[8px] text-muted-foreground leading-tight">
                      Evaluating last 1000 digits across all 10 volatilities (Criteria A: Top 2 parity match, B: ≥11%, C: 3rd ≤9.5%, D: D10 opposite parity trigger).
                    </p>
                  )}
                </div>
              );
            })()}
            
            <div className="grid grid-cols-2 gap-2 text-[10px] mt-1">
              <div className="bg-muted/50 rounded p-1.5 border border-border/50">
                <span className="text-muted-foreground block text-[8px] uppercase">Sequence Base Stake</span>
                <span className="font-mono font-bold text-violet-400">
                  ${(config.strategy === "strategy_s" ? sessionState.strategySSequenceBaseStake : sessionState.strategyRSequenceBaseStake) !== undefined 
                    ? (config.strategy === "strategy_s" ? sessionState.strategySSequenceBaseStake! : sessionState.strategyRSequenceBaseStake!).toFixed(2) 
                    : (config.strategy === "strategy_s" ? (config.strategySBaseStake ?? config.baseStake) : (config.strategyRBaseStake ?? config.baseStake)).toFixed(2)}
                </span>
              </div>
              <div className="bg-muted/50 rounded p-1.5 border border-border/50">
                <span className="text-muted-foreground block text-[8px] uppercase">Active Recovery Loss</span>
                <span className="font-mono font-bold text-rose-400">
                  ${(config.strategy === "strategy_s" ? sessionState.strategySAccumulatedLoss : sessionState.strategyRAccumulatedLoss) !== undefined 
                    ? (config.strategy === "strategy_s" ? sessionState.strategySAccumulatedLoss! : sessionState.strategyRAccumulatedLoss!).toFixed(2) 
                    : "0.00"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 justify-between text-[8px] bg-muted/40 px-2 py-1 rounded border border-border/40 mt-1">
              <span className="text-muted-foreground flex items-center gap-1">
                <AlertCircle className="w-2.5 h-2.5 text-violet-400 animate-pulse" /> Active trade target:
              </span>
              <span className="font-bold text-foreground">
                {(() => {
                  const cat = sessionState.currentCategory;
                  if (!cat) return "None (Waiting...)";
                  if (cat === "over1") return "DIGITOVER 1 (Barrier 1)";
                  if (cat === "under8") return "DIGITUNDER 8 (Barrier 8)";
                  if (cat === "over2") return "DIGITOVER 2 (Barrier 2)";
                  if (cat === "under7") return "DIGITUNDER 7 (Barrier 7)";
                  if (cat === "over3") return "DIGITOVER 3 (Barrier 3)";
                  if (cat === "under6") return "DIGITUNDER 6 (Barrier 6)";
                  if (cat === "over4") return "DIGITOVER 4 (Barrier 4)";
                  if (cat === "under5") return "DIGITUNDER 5 (Barrier 5)";
                  if (cat === "over5") return "DIGITOVER 5 (Barrier 5)";
                  if (cat === "under4") return "DIGITUNDER 4 (Barrier 4)";
                  if (cat === "even") return "DIGITEVEN (Even)";
                  if (cat === "odd") return "DIGITODD (Odd)";
                  if (cat === "rise") return "RISE (Allow Equals)";
                  if (cat === "fall") return "FALL (Allow Equals)";
                  return cat;
                })()}
              </span>
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
            <div className="flex items-center gap-2">
              {config.strategy === "strategy_f" && (
                <>
                  {hasAnyBlacklist() && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-5 px-2 text-[8px] text-primary hover:bg-primary/10 hover:text-primary font-bold uppercase tracking-wider border border-primary/20 flex items-center gap-1 shadow-[0_0_8px_rgba(59,130,246,0.1)]"
                      onClick={exportBlacklistToCSV}
                    >
                      <Download className="w-2.5 h-2.5" /> Export CSV
                    </Button>
                  )}
                  {onClearBlacklist && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-5 px-2 text-[8px] text-destructive hover:bg-destructive/10 hover:text-destructive font-bold uppercase tracking-wider border border-destructive/20"
                      onClick={onClearBlacklist}
                    >
                      Clear Blacklists
                    </Button>
                  )}
                </>
              )}
              <Badge variant="outline" className="text-[8px] bg-primary/5 text-primary border-primary/20 px-1.5 py-0.5">
                {config.strategy === "strategy_c" ? "STRATEGY C" : config.strategy === "strategy_d" ? "STRATEGY D" : config.strategy === "strategy_e" ? "STRATEGY E" : "STRATEGY F"}
              </Badge>
            </div>
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
        <div className="text-center flex flex-col justify-between items-center">
          <div className="text-[9px] text-muted-foreground uppercase flex items-center gap-1">
            Session P/L
            <button
              onClick={onResetSessionPL}
              title="Reset Session P/L"
              className="text-muted-foreground hover:text-primary transition-colors text-[8px] border border-muted-foreground/30 px-1 rounded hover:border-primary/50"
            >
              Reset
            </button>
          </div>
          <div className={`text-sm font-bold ${sessionPL >= 0 ? "text-green-500" : "text-destructive"}`}>
            ${sessionPL.toFixed(2)}
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
              const requiredStake = sessionState.currentStake > 0 ? sessionState.currentStake : config.baseStake;
              if (balance !== undefined && balance !== null && balance < requiredStake) {
                toast.error(`Insufficient balance. Available: $${balance.toFixed(2)}, Required stake: $${requiredStake.toFixed(2)}. AI-automation stopped.`);
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
          {config.strategy === "strategy_n" && sessionState.strategyNNextSwitchTime !== undefined && (
            <div className="flex items-center justify-between text-[11px] border-b border-border/20 pb-1.5 mb-1.5">
              <span className="text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3 text-orange-400" /> Switch:
              </span>
              <span className="font-mono font-bold text-orange-400">
                {(() => {
                  const ms = sessionState.strategyNNextSwitchTime - currentTime;
                  if (ms <= 0) return "SWITCH PENDING (NEXT WIN)";
                  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
                  return formatCooldown(totalSeconds);
                })()}
              </span>
            </div>
          )}
          {config.strategy === "strategy_q" && sessionState.strategyQActiveSub !== undefined && (
            <div className="flex items-center justify-between text-[11px] border-b border-border/20 pb-1.5 mb-1.5">
              <span className="text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3 text-emerald-400" /> Active Sub:
              </span>
              <span className="font-mono font-bold text-emerald-400">
                {sessionState.strategyQActiveSub.replace("strategy_", "").toUpperCase()} ({sessionState.strategyQRemainingRuns} runs left)
              </span>
            </div>
          )}
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
                    <span className={`font-bold ${
                      trade.status === "WIN" 
                        ? "text-emerald-400" 
                        : trade.status === "LOSS" 
                        ? "text-rose-400" 
                        : ""
                    }`}>
                      {trade.status === "WIN"
                        ? `+$${(trade.profit !== undefined && trade.profit !== null && trade.profit > 0 ? trade.profit : trade.stake).toFixed(2)}`
                        : trade.status === "LOSS"
                        ? `-$${trade.stake.toFixed(2)}`
                        : `$${trade.stake.toFixed(2)}`}
                    </span>
                    <span className="text-[8px] opacity-70">
                      Stake: ${trade.stake.toFixed(2)} • Step {trade.martingale_step}
                    </span>
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

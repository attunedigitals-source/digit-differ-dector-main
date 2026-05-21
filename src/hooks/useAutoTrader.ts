import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { DerivAccount } from "@/hooks/useDerivWebSocket";
import { toast } from "sonner";
import { useAuth } from "./useAuth";
import type { SymbolState } from "@/lib/signal-engine";
import { ARRANGEMENT_TOTAL, getArrangementPermutation, getScrambledArrangementIndex } from "@/lib/arrangements";

import { type TradeRecord, type AutoTraderConfig } from "./trading-types";

const MARTINGALE_MULTIPLIER = 1.8;
const RECOVERY_MARTINGALE_MULTIPLIER = 11.43;
const MAX_TICK_AGE_MS = 10000;
const DEFAULT_COOLDOWN_INTERVAL_MINUTES: AutoTraderConfig["cooldownIntervalMinutes"] = 30;
const COOLDOWN_INTERVAL_OPTIONS: ReadonlyArray<AutoTraderConfig["cooldownIntervalMinutes"]> = [30, 40, 50, 60];
const COOLDOWN_WAIT_MIN_SECONDS = 300;
const COOLDOWN_WAIT_MAX_SECONDS = 480;
const WIN_TRADE_COOLDOWN_MIN_TICKS = 1;
const WIN_TRADE_COOLDOWN_MAX_TICKS = 3;
const LOSS_TRADE_COOLDOWN_MIN_TICKS = 1;
const LOSS_TRADE_COOLDOWN_MAX_TICKS = 3;
type TradeCategory = "under4" | "over4" | "under5" | "over5" | "over0" | "under9";
interface SymbolStatus {
  lastGroup: "NORMAL" | "SPECIAL" | null;
}

const getCategoryGroup = (cat: TradeCategory): "NORMAL" | "SPECIAL" => {
  if (cat === "under4" || cat === "over5") return "NORMAL";
  return "SPECIAL";
};


const sanitizeConfig = (incoming: Partial<AutoTraderConfig> | null | undefined): AutoTraderConfig => {
  const baseStake = Math.max(0.35, Number(incoming?.baseStake ?? 0.35));
  const maxMartingaleSteps = Math.max(1, Number(incoming?.maxMartingaleSteps ?? 12));
  const rawCooldownMinutes = Number(incoming?.cooldownIntervalMinutes ?? DEFAULT_COOLDOWN_INTERVAL_MINUTES);
  const cooldownIntervalMinutes = COOLDOWN_INTERVAL_OPTIONS.includes(rawCooldownMinutes as AutoTraderConfig["cooldownIntervalMinutes"])
    ? (rawCooldownMinutes as AutoTraderConfig["cooldownIntervalMinutes"])
    : DEFAULT_COOLDOWN_INTERVAL_MINUTES;

  return {
    enabled: Boolean(incoming?.enabled),
    baseStake,
    maxMartingaleSteps,
    cooldownIntervalMinutes,
    strategy: incoming?.strategy || "alternating",
    arrangement_states: incoming?.arrangement_states ?? {},
  };
};

export function useAutoTrader(
  wsRef: React.RefObject<WebSocket | null>,
  accountInfo: DerivAccount | null,
  connected: boolean,
  getSymbolState: (symbol: string) => SymbolState | undefined
) {
  const { user } = useAuth();
  const [tradeLog, setTradeLog] = useState<TradeRecord[]>(() => {
    const saved = localStorage.getItem('tradeLog');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Safety check for missing IDs or dates
        return parsed.map((t: any) => ({
          ...t,
          id: t.id || Math.random().toString(36).substring(2, 11),
          timestamp: new Date(t.timestamp || Date.now())
        }));
      } catch (e) {
        console.error("Error loading tradeLog from localStorage", e);
      }
    }
    return [];
  });
  const [dailyPL, setDailyPL] = useState<number>(0);
  const [dailyStats, setDailyStats] = useState({ total_trades: 0, wins: 0 });
  const [ticksToWait, setTicksToWait] = useState(0);
  const [config, setConfig] = useState<AutoTraderConfig>(() => {
    const saved = localStorage.getItem('autoTraderConfig');
    if (saved) {
      try {
        return sanitizeConfig(JSON.parse(saved));
      } catch (e) {
        console.error("Error loading config from localStorage", e);
      }
    }
    return sanitizeConfig({
      enabled: false,
      baseStake: 0.35,
      maxMartingaleSteps: 12,
      cooldownIntervalMinutes: DEFAULT_COOLDOWN_INTERVAL_MINUTES,
      strategy: "alternating",
    });
  });

  const [sessionState, setSessionState] = useState({
    currentStake: 0.35,
    martingaleStep: 0,
    sequenceStep: 0,
    initialChoice: "DIGITOVER" as "DIGITOVER" | "DIGITUNDER" | "DIGITEVEN" | "DIGITODD",
    currentSymbol: "",
    currentContract: "DIGITOVER" as "DIGITOVER" | "DIGITUNDER" | "DIGITEVEN" | "DIGITODD",
    currentBarrier: 5,
    status: "IDLE" as "IDLE" | "WIN" | "LOSS" | "SKIP" | "PENDING",
    nextAction: "IDLE_RDY",
    currentCategory: null as TradeCategory | null,
    symbolLossStreak: 0,
    usedCategories: [] as TradeCategory[],
  });

  const [martingaleCycles, setMartingaleCycles] = useState(0);
  const [windDownMode, setWindDownMode] = useState(false);
  const [activeSequenceSnapshot, setActiveSequenceSnapshot] = useState({
    name: "LAST16_HYBRID",
    arrangementIndex: 1,
    arrangementStep: 0,
    arrangementMode: "scrambled" as "scrambled" | "sequential",
    arrangementSequence: "",
  });
  const [continuousTradeStartAt, setContinuousTradeStartAt] = useState<number | null>(null);
  const continuousTradeStartAtRef = useRef<number | null>(null);

  const executionStartedAtRef = useRef<number>(0);
  const enabledRef = useRef<boolean>(config.enabled);
  const lastManualActionRef = useRef<number>(0);

  // Keep enabledRef in sync with config.enabled
  useEffect(() => {
    enabledRef.current = config.enabled;
  }, [config.enabled]);


  const requestContractStatus = useCallback((contractId: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    console.log(`[AutoTrader] Polling status for contract ${contractId}`);
    ws.send(JSON.stringify({ proposal_open_contract: 1, contract_id: contractId }));
    return true;
  }, [wsRef]);

  // Watchdog: monitor and resolve stuck execution
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();

      // Poll open contracts that haven't settled within 30s
      openContracts.current.forEach((contract, id) => {
        if (now - contract.timestamp > 30000) {
          console.log(`[AutoTrader] Stale open contract ${id} detection - requesting refresh`);
          requestContractStatus(id);
        }
      });

      // Safety check for stuck execution lock (no pending/open contracts but lock is on)
      if (isExecutingRef.current && 
          pendingProposals.current.size === 0 && 
          pendingBuys.current.size === 0 && 
          openContracts.current.size === 0 && 
          now - executionStartedAtRef.current > 45000) {
        console.warn("[AutoTrader] Watchdog triggered: Resetting empty stuck execution lock");
        isExecutingRef.current = false;
        setTradeLog(prev => prev.filter(t => !t.id.startsWith("pending-")));
        setSessionState(prev => ({
          ...prev,
          status: "LOSS",
          nextAction: "WDT_RST"
        }));
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [requestContractStatus]);

  const sessionStateRef = useRef(sessionState);
  useEffect(() => {
    sessionStateRef.current = sessionState;
  }, [sessionState]);
  useEffect(() => {
    continuousTradeStartAtRef.current = continuousTradeStartAt;
  }, [continuousTradeStartAt]);

  const lastSyncedRef = useRef({ pl: 0, trades: 0 });
  const statsRef = useRef({ pl: dailyPL, stats: dailyStats });

  // Keep statsRef updated for the sync loop
  useEffect(() => {
    statsRef.current = { pl: dailyPL, stats: dailyStats };
  }, [dailyPL, dailyStats]);

  useEffect(() => {
    if (!user?.id || !accountInfo?.loginid) return;

    const syncToSupabase = async () => {
      try {
        const { pl, stats } = statsRef.current;
        
        // Skip if nothing changed since last successful sync
        if (pl === lastSyncedRef.current.pl && stats.total_trades === lastSyncedRef.current.trades) return;

        // Current UTC date for grouping
        const utcDate = new Date().toISOString().split('T')[0];
        
        const { error } = await supabase
          .from('daily_reports')
          .upsert({
            user_id: user.id,
            deriv_loginid: accountInfo.loginid,
            trade_date: utcDate,
            reported_profit: pl,
            reported_trades: stats.total_trades,
            reported_wins: stats.wins,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id,deriv_loginid,trade_date' });

        if (!error) {
          lastSyncedRef.current = { pl, trades: stats.total_trades };
        }
      } catch (err) {
        // Silent fail for background sync
      }
    };

    // Initial sync
    syncToSupabase();

    const interval = setInterval(syncToSupabase, 60000);
    return () => clearInterval(interval);
  }, [user?.id, accountInfo?.loginid]);

  const pendingProposals = useRef<Map<string, { symbol: string; dangerDigit: number; stake: number; timestamp: number; supabaseId?: string }>>(new Map());
  const openContracts = useRef<Map<string, { symbol: string; stake: number; timestamp: number; supabaseId?: string }>>(new Map());
  const settledContracts = useRef<Set<string>>(new Set());
  const pendingBuys = useRef<Map<string, { symbol: string; supabaseId: string }>>(new Map());

  const isExecutingRef = useRef(false);
  // Stores per-proposal timeout handles so they can be cancelled when a response arrives
  const proposalTimeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const activeSequenceNameRef = useRef<string>("LAST16_HYBRID");
  const stepIndexRef = useRef<number>(0);
  const symbolTrackerRef = useRef<Map<string, SymbolStatus>>(new Map());
  const useReducedWindowSize = useRef(false);
  const freshnessWarningShownRef = useRef(false);

  const select_random_active_symbol = useCallback((excludeSymbol?: string) => {
    const symbols = [
      "1HZ10V", "1HZ25V", "1HZ50V", "1HZ75V", "1HZ100V",
      "R_10", "R_25", "R_50", "R_75", "R_100",
    ];

    const candidates = symbols
      .map((symbol) => {
        if (excludeSymbol && symbol === excludeSymbol) {
          return null;
        }
        const symbolState = getSymbolState(symbol);
        
        // Check freshness only - no need for 16 ticks
        if (symbolState?.updatedAt) {
          const tickAgeMs = Date.now() - symbolState.updatedAt;
          if (tickAgeMs > MAX_TICK_AGE_MS) {
            return null;
          }
        } else {
          // If no update timestamp, skip to be safe
          return null;
        }

        return { symbol };
      })
      .filter((c): c is { symbol: string } => c !== null);

    if (candidates.length === 0) {
      if (excludeSymbol) {
        const fallbackState = getSymbolState(excludeSymbol);
        if (fallbackState?.updatedAt) {
          const tickAgeMs = Date.now() - fallbackState.updatedAt;
          if (tickAgeMs <= MAX_TICK_AGE_MS) {
            return { symbol: excludeSymbol };
          }
        }
      }
      return null;
    }

    return candidates[Math.floor(Math.random() * candidates.length)];
  }, [getSymbolState]);

  const randomCooldownSeconds = useCallback(() => {
    return Math.floor(Math.random() * (COOLDOWN_WAIT_MAX_SECONDS - COOLDOWN_WAIT_MIN_SECONDS + 1)) + COOLDOWN_WAIT_MIN_SECONDS;
  }, []);

  const randomTradeCooldownTicks = useCallback((isWin: boolean) => {
    const minTicks = isWin ? WIN_TRADE_COOLDOWN_MIN_TICKS : LOSS_TRADE_COOLDOWN_MIN_TICKS;
    const maxTicks = isWin ? WIN_TRADE_COOLDOWN_MAX_TICKS : LOSS_TRADE_COOLDOWN_MAX_TICKS;
    return Math.floor(Math.random() * (maxTicks - minTicks + 1)) + minTicks;
  }, []);

  const execute_trade = useCallback(async () => {
    if (!enabledRef.current) {
      console.log("%c[AutoTrader] execute_trade aborted: bot is disabled (Ref Check)", "color: orange; font-weight: bold;");
      return;
    }

    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn("[AutoTrader] Trade skipped: WebSocket not open");
      return;
    }

    if (isExecutingRef.current || sessionStateRef.current.status === "PENDING" || openContracts.current.size > 0) {
      console.log("[AutoTrader] Trade skip: already executing or pending or contract open");
      return;
    }

    isExecutingRef.current = true;
    executionStartedAtRef.current = Date.now();
    if (!continuousTradeStartAtRef.current) {
      setContinuousTradeStartAt(Date.now());
    }
    try {
      const state = sessionStateRef.current;
      let nextStake = state.currentStake;
      let nextStep = state.martingaleStep;
      let seqStep = state.sequenceStep;

      let symbol: string;
      const mustChangeSymbol = state.status === "WIN" || state.status === "IDLE" || (state.status === "LOSS" && (state.symbolLossStreak ?? 0) >= 4);

      if (!mustChangeSymbol && state.currentSymbol) {
        symbol = state.currentSymbol;
      } else {
        const selectedSymbol = select_random_active_symbol(state.currentSymbol);
        if (!selectedSymbol) {
          console.warn("[AutoTrader] Trade skipped: no fresh symbol available");

          setSessionState(prev => ({
            ...prev,
            status: "SKIP",
            nextAction: "SKP_STALE",
          }));

          setTicksToWait(3);
          isExecutingRef.current = false;
          return;
        }
        symbol = selectedSymbol.symbol;
      }

      let trade: TradeCategory;
      let chosenGroup: "NORMAL" | "SPECIAL";
      let nextUsedCategories: TradeCategory[];
      const allCategories: TradeCategory[] = ["under4", "over4", "under5", "over5"];

      if (config.strategy === "arrangement_a" && accountInfo?.loginid) {
        const loginId = accountInfo.loginid;
        const prevArrangement = config.arrangement_states?.[loginId] ?? { current_index: 1, current_step: 0, mode: "scrambled" as const };
        const sequenceZeroBased = Math.max(0, Math.min(ARRANGEMENT_TOTAL - 1, prevArrangement.current_index - 1));
        const arrangementIndex = prevArrangement.mode === "scrambled"
          ? getScrambledArrangementIndex(sequenceZeroBased)
          : sequenceZeroBased + 1;
        const arrangement = getArrangementPermutation(arrangementIndex);
        const step = Math.max(0, Math.min(11, prevArrangement.current_step));
        const tokenLabelMap: Record<TradeCategory, string> = {
          under4: "U4",
          over4: "O4",
          under5: "U5",
          over5: "O5",
          over0: "O0",
          under9: "U9",
        };
        trade = arrangement[step];
        setActiveSequenceSnapshot({
          name: activeSequenceNameRef.current,
          arrangementIndex,
          arrangementStep: step,
          arrangementMode: prevArrangement.mode,
          arrangementSequence: arrangement.map((token) => tokenLabelMap[token]).join(", "),
        });
        nextUsedCategories = mustChangeSymbol ? [trade] : [...(state.usedCategories || []), trade];
      } else {
        const previousUsed = mustChangeSymbol ? [] : (state.usedCategories || []);
        const remainingCategories = allCategories.filter(cat => !previousUsed.includes(cat));
        if (remainingCategories.length > 0) {
          trade = remainingCategories[Math.floor(Math.random() * remainingCategories.length)];
        } else {
          trade = allCategories[Math.floor(Math.random() * allCategories.length)];
        }
        nextUsedCategories = [...previousUsed, trade];
      }
      chosenGroup = getCategoryGroup(trade as any);

      const categoryLabels: Record<TradeCategory, string> = {
        under4: "Under 4",
        over4: "Over 4",
        under5: "Under 5",
        over5: "Over 5",
        over0: "Over 0",
        under9: "Under 9"
      };

      console.log("[AutoTrader] Volatility and Strategy Selection", {
        strategy: config.strategy,
        symbol,
        selectedTrade: categoryLabels[trade],
        usedSoFar: nextUsedCategories,
      });

      if (state.status === "WIN" || state.status === "IDLE") {
        nextStep = 0;
        seqStep = 0;
      } else if (state.status === "LOSS") {
        nextStep = state.martingaleStep + 1;
        seqStep = state.sequenceStep + 1;
        stepIndexRef.current += 1;
      }

      if (nextStep > config.maxMartingaleSteps) {
        toast.error(`Max Martingale Steps (${config.maxMartingaleSteps}) reached. Stopping automation.`);
        setConfig(prev => ({ ...prev, enabled: false }));
        isExecutingRef.current = false;
        return;
      }

      let type: "DIGITOVER" | "DIGITUNDER";
      let barrier: number;
      if (trade === "under4") { type = "DIGITUNDER"; barrier = 4; }
      else if (trade === "over4") { type = "DIGITOVER"; barrier = 4; }
      else if (trade === "under5") { type = "DIGITUNDER"; barrier = 5; }
      else if (trade === "over5") { type = "DIGITOVER"; barrier = 5; }
      else if (trade === "over0") { type = "DIGITOVER"; barrier = 0; }
      else { type = "DIGITUNDER"; barrier = 9; }

      const isFirstTrade = state.status === "IDLE";
      const isSpecialStakeTrade = trade === "under5" || trade === "over4";
      const isWin = state.status === "WIN";

      if (isFirstTrade || isWin) {
        nextStake = config.baseStake;
      } else if (state.status === "LOSS") {
        nextStake = isSpecialStakeTrade
          ? Number((state.currentStake * MARTINGALE_MULTIPLIER * 1.26).toFixed(2))
          : Number((state.currentStake * MARTINGALE_MULTIPLIER).toFixed(2));
      } else {
        nextStake = config.baseStake;
      }

      console.log("[AutoTrader] Trade selection finalized", { symbol, trade: categoryLabels[trade], stake: nextStake });

      setSessionState(prev => ({
        ...prev,
        currentStake: nextStake,
        martingaleStep: nextStep,
        sequenceStep: seqStep,
        initialChoice: type,
        currentSymbol: symbol,
        currentContract: type,
        currentBarrier: barrier,
        currentCategory: trade,
        status: "PENDING",
        nextAction: "TRD_LIV",
        symbolLossStreak: mustChangeSymbol ? 0 : prev.symbolLossStreak,
        usedCategories: nextUsedCategories,
      }));

      const reqId = Date.now() + Math.floor(Math.random() * 10000);

      // Add pending trade to log for real-time visibility
      const pendingRecord: TradeRecord = {
        id: `pending-${reqId}`,
        symbol,
        sequence_name: activeSequenceNameRef.current,
        contract: type,
        barrier,
        stake: nextStake,
        profit: 0,
        martingale_step: nextStep,
        status: "PENDING",
        next_action: "WAITING_FOR_RESULT",
        timestamp: new Date(),
      };
      setTradeLog(prev => [pendingRecord, ...prev].slice(0, 2000));

      const isV4 = ws.url.includes("api.derivws.com");
      
      const proposalReq: any = {
        proposal: 1,
        amount: nextStake,
        basis: "stake",
        contract_type: type,
        currency: "USD",
        duration: 1,
        duration_unit: "t",
        req_id: reqId,
      };

      proposalReq.barrier = String(barrier);

      if (isV4) {
        proposalReq.underlying_symbol = symbol;
      } else {
        proposalReq.symbol = symbol;
      }

      // Register the pending proposal before sending (supabaseId filled in background)
      pendingProposals.current.set(String(reqId), {
        symbol,
        dangerDigit: barrier,
        stake: nextStake,
        timestamp: Date.now(),
        supabaseId: undefined,
      });
      // Fix 1: Send WS proposal immediately — do NOT block on Supabase
      ws.send(JSON.stringify(proposalReq));
      toast.info(`Initiating trade: ${type} on ${symbol}`);

      // Log for TradeMonitor integration
      console.log(JSON.stringify({
        event: "trade_initiated",
        symbol,
        contract: type,
        barrier,
        stake: Number(nextStake.toFixed(2)),
        martingale_step: nextStep,
        timestamp: new Date().toISOString()
      }, null, 2));

      // Fix 2: Per-proposal 15s timeout — if Deriv never responds, self-heal
      const proposalTimeout = setTimeout(() => {
        if (pendingProposals.current.has(String(reqId))) {
          console.warn(`[AutoTrader] Proposal ${reqId} timed out — clearing execution lock`);
          pendingProposals.current.delete(String(reqId));
          proposalTimeouts.current.delete(String(reqId));
          isExecutingRef.current = false;
          setTradeLog(prev => prev.filter(t => !t.id.startsWith("pending-")));
          setSessionState(prev => ({ ...prev, status: "LOSS", nextAction: "PRP_TMO" }));
          setTicksToWait(30);
        }
      }, 15000);
      proposalTimeouts.current.set(String(reqId), proposalTimeout);

      // Fix 1 (cont): Background Supabase write — failure does NOT affect trading
      (async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data, error } = await supabase.from("trades").insert({
              user_id: user.id,
              deriv_loginid: accountInfo?.loginid || "unknown",
              symbol: symbol,
              stake: nextStake,
              barrier: barrier,
              result: "pending",
              timestamp: new Date().toISOString()
            }).select("id").single();
            if (!error && data) {
              const entry = pendingProposals.current.get(String(reqId));
              if (entry) entry.supabaseId = data.id;
            }
          }
        } catch (err) {
          console.warn("[AutoTrader] Background Supabase insert failed:", err);
        }
      })();
    } finally {
      // We DO NOT reset isExecutingRef here.
      // It is reset in handle_result (normal flow) or the proposal timeout / watchdog (failure flow).
    }
  }, [config, wsRef, accountInfo, select_random_active_symbol]);

  const handle_result = useCallback((isWin: boolean, symbol: string, profit: number, supabaseId?: string) => {
    const state = sessionStateRef.current;
    
    // Update per-symbol tracker
    symbolTrackerRef.current.set(symbol, {
      lastGroup: state.currentCategory && (state.currentCategory !== "over0" && state.currentCategory !== "under9") 
        ? getCategoryGroup(state.currentCategory as any) 
        : null,
    });

    const newStatus = isWin ? "WIN" : "LOSS";
    let ticksToWaitNext = randomTradeCooldownTicks(isWin);
    let nextAction = isWin
      ? `P_CD_${ticksToWaitNext}T`
      : `L_CD_${ticksToWaitNext}T`;

    const newRecord: TradeRecord = {
      id: Math.random().toString(36).substring(2, 11),
      symbol,
      sequence_name: activeSequenceNameRef.current,
      contract: state.currentContract || "UNKNOWN",
      barrier: state.currentBarrier || 0,
      stake: state.currentStake,
      profit,
      martingale_step: state.martingaleStep,
      status: newStatus,
      next_action: nextAction,
      timestamp: new Date(),
    };
    setTradeLog(prev => {
      // Remove all pending entries safely
      const filtered = prev.filter(t => t && t.id && !t.id.startsWith("pending-"));
      return [newRecord, ...filtered].slice(0, 2000);
    });

    // Update Daily Stats locally
    setDailyStats(prev => ({
      total_trades: prev.total_trades + 1,
      wins: prev.wins + (isWin ? 1 : 0)
    }));

    // Update Daily P/L locally regardless of Supabase success
    setDailyPL(prev => {
      return prev + profit;
    });

    const now = Date.now();
    const effectiveStartAt = continuousTradeStartAtRef.current ?? now;
    const cooldownDurationMs = config.cooldownIntervalMinutes * 60 * 1000;
    if (now - effectiveStartAt >= cooldownDurationMs) {
      const intervalPauseSeconds = randomCooldownSeconds();
      ticksToWaitNext = Math.max(ticksToWaitNext, intervalPauseSeconds);
      nextAction = `${nextAction}_B_CD_${config.cooldownIntervalMinutes}M`;
      setContinuousTradeStartAt(now);
      setMartingaleCycles(0);
    }

    if (supabaseId) {
      supabase.from("trades").update({ result: isWin ? "won" : "lost", profit_loss: profit }).eq("id", supabaseId).then(({ error }) => {
        if (error) console.error("Error updating trade result in Supabase:", error);
      });
    }

    if (windDownMode && isWin) {
      nextAction = "WD_CMP";
      ticksToWaitNext = 0;
      setConfig(prev => ({ ...prev, enabled: false }));
      setWindDownMode(false);
      toast.success("Wind down complete: last confirmed trade closed in profit. Auto-automation stopped.");
    }

    const nextSessionState = {
      ...state,
      status: newStatus,
      nextAction,
      currentStake: isWin ? config.baseStake : state.currentStake,
      martingaleStep: isWin ? 0 : state.martingaleStep,
      sequenceStep: isWin ? 0 : state.sequenceStep,
      symbolLossStreak: isWin ? 0 : (state.symbolLossStreak ?? 0) + 1,
      usedCategories: isWin ? [] : (state.usedCategories || []),
    };
    sessionStateRef.current = nextSessionState;
    setSessionState(nextSessionState);
    setTicksToWait(ticksToWaitNext);

    if (config.strategy === "arrangement_a" && accountInfo?.loginid) {
      const loginId = accountInfo.loginid;
      setConfig(prev => {
        const existing = prev.arrangement_states?.[loginId] ?? { current_index: 1, current_step: 0, mode: "scrambled" as const };
        const nextStep = existing.current_step + 1;
        const wrappedIndex = existing.current_index >= ARRANGEMENT_TOTAL ? 1 : existing.current_index + 1;
        const nextArrangement = nextStep >= 12
          ? { ...existing, current_step: 0, current_index: wrappedIndex }
          : { ...existing, current_step: nextStep };
        return {
          ...prev,
          arrangement_states: {
            ...(prev.arrangement_states ?? {}),
            [loginId]: nextArrangement,
          },
        };
      });
    }
    
    // Crucial: Reset the execution lock only AFTER the result is processed
    isExecutingRef.current = false;
    console.log(JSON.stringify({
      event: "trade_settled",
      sequence: activeSequenceNameRef.current,
      step: stepIndexRef.current,
      trade: state.currentContract,
      result: newStatus,
      symbol,
      status: newStatus,
      profit: Number(profit.toFixed(2)),
      next_action: nextAction,
      ticks_to_wait: ticksToWaitNext,
      timestamp: new Date().toISOString()
    }, null, 2));
    
    if (ticksToWaitNext === 0 && !(windDownMode && isWin)) {
      if (enabledRef.current) {
        console.log("[AutoTrader] Scheduling next trade immediately...");
        setTimeout(() => execute_trade(), 0);
      } else {
        console.log("%c[AutoTrader] Bot disabled, stopping loop after trade settlement.", "color: red; font-weight: bold;");
      }
    }
  }, [execute_trade, config.cooldownIntervalMinutes, windDownMode, randomCooldownSeconds, randomTradeCooldownTicks]);

  const handleTradeMessage = useCallback((data: any) => {
    if (data.msg_type !== "tick") {
      console.log(`[AutoTrader] Received message type: ${data.msg_type}`, data);
    }

    if (data.msg_type === "profit_table" && data.profit_table) {
      const transactions = data.profit_table.transactions || [];
      const isFirstPage = (data.echo_req.offset || 0) === 0;
      
      // Use a temporary calculation to avoid intermediate state flickers
      let pageProfit = 0;
      let pageWins = 0;
      
      transactions.forEach((t: any) => {
        const profit = (Number(t.sell_price) || 0) - (Number(t.buy_price) || 0);
        pageProfit += profit;
        if (profit > 0) pageWins++;
      });

      // Update our accumulation refs (using functional updates or refs to keep track across pages)
      // For simplicity, we'll use the echo_req to know if we should reset
      if (isFirstPage) {
        (window as any)._dailyPLBuffer = { profit: pageProfit, trades: transactions.length, wins: pageWins };
      } else {
        const buffer = (window as any)._dailyPLBuffer || { profit: 0, trades: 0, wins: 0 };
        buffer.profit += pageProfit;
        buffer.trades += transactions.length;
        buffer.wins += pageWins;
      }

      const buffer = (window as any)._dailyPLBuffer;

      // If we got a full page and haven't hit a safety limit (e.g. 1,000,000 trades), fetch next
      if (transactions.length === 500 && buffer.trades < 1000000) {
        console.log(`[AutoTrader] Received 500 trades (Total: ${buffer.trades}), fetching next page...`);
        fetchDailyPL(buffer.trades);
      } else {
        console.log(`[AutoTrader] Daily P/L Reconciled: $${buffer.profit.toFixed(2)} (Wins: ${buffer.wins}, Total: ${buffer.trades})`);
        setDailyPL(buffer.profit);
        setDailyStats({
          total_trades: buffer.trades,
          wins: buffer.wins
        });
      }
      return;
    }

    if (!config.enabled) return;

    const state = sessionStateRef.current;
    
    if (data.msg_type === "proposal" && data.proposal) {
      const reqId = String(data.req_id);
      const pending = pendingProposals.current.get(reqId);
      if (!pending) return;
      pendingProposals.current.delete(reqId);
      // Fix 2: Proposal arrived in time — cancel the self-heal timeout
      const timeout = proposalTimeouts.current.get(reqId);
      if (timeout) {
        clearTimeout(timeout);
        proposalTimeouts.current.delete(reqId);
      }
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      const buyReqId = Date.now() + Math.floor(Math.random() * 10000);
      pendingBuys.current.set(String(buyReqId), { symbol: pending.symbol, supabaseId: pending.supabaseId || "" });
      ws.send(JSON.stringify({ buy: data.proposal.id, price: pending.stake + 10, req_id: buyReqId }));
    }

    if (data.msg_type === "buy" && data.buy) {
      const contractId = String(data.buy.contract_id);
      const buyReqId = String(data.req_id);
      const buyData = pendingBuys.current.get(buyReqId);
      pendingBuys.current.delete(buyReqId);
      const symbol = buyData?.symbol || "";
      const buyPrice = data.buy.buy_price ?? state.currentStake;
      if (buyData?.supabaseId) supabase.from("trades").update({ contract_id: contractId }).eq("id", buyData.supabaseId).then();
      openContracts.current.set(contractId, { symbol, stake: buyPrice, timestamp: Date.now(), supabaseId: buyData?.supabaseId });
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ proposal_open_contract: 1, contract_id: contractId, subscribe: 1 }));
    }

    if (data.msg_type === "proposal_open_contract" && data.proposal_open_contract) {
      const poc = data.proposal_open_contract;
      const contractId = String(poc.contract_id);
      const status = poc.status;
      const isFinished = poc.is_sold || poc.is_expired || ["won", "lost", "sold", "expired"].includes(status);

      console.log(`[AutoTrader] Contract ${contractId} update: status=${status}, is_sold=${poc.is_sold}, profit=${poc.profit}`);

      if (isFinished) {
        if (!settledContracts.current.has(contractId)) {
          console.log(`[AutoTrader] Settling contract ${contractId} (${status})`);
          settledContracts.current.add(contractId);
          const isWin = (poc.profit ?? 0) > 0 || status === "won";
          const profit = Number(poc.profit) || 0;
          const openC = openContracts.current.get(contractId);
          handle_result(isWin, poc.underlying || poc.symbol || "", profit, openC?.supabaseId);
        }
        
        // Always remove from openContracts if finished to stop watchdog polling
        if (openContracts.current.has(contractId)) {
          console.log(`[AutoTrader] Removing ${contractId} from active monitoring`);
          openContracts.current.delete(contractId);
        }
      }
    }

    if (data.msg_type === "profit_table" && data.profit_table) {
      // Handled above the enabled check
      return;
    }

    if (data.error) {
      const reqId = String(data.req_id);
      console.error(`[AutoTrader] API Error (req_id: ${reqId}):`, data.error);

      // Reset execution lock if this error belongs to a pending trade attempt
      if (pendingProposals.current.has(reqId) || Array.from(pendingBuys.current.keys()).includes(reqId)) {
        toast.error(`Trade error: ${data.error.message}`);
        setSessionState(prev => ({ ...prev, status: "LOSS", nextAction: "ERR_RTY" }));
        setTicksToWait(30);
        isExecutingRef.current = false;
        
        pendingProposals.current.delete(reqId);
        // Clear buy if match
        const buyReq = Array.from(pendingBuys.current.keys()).find(k => k === reqId);
        if (buyReq) pendingBuys.current.delete(buyReq);
      }

      // If it's a contract status error and we have it in openContracts, clear it
      if (data.msg_type === "proposal_open_contract" && data.error.code === "ContractNotFound") {
        // We don't have the contract ID directly in the error top-level usually, 
        // but we can check our open contracts if the watchdog just polled.
        console.warn("[AutoTrader] Contract not found on Deriv. Clearing stale references.");
        openContracts.current.clear(); // Nuclear option if we hit this, or we could be more specific
        isExecutingRef.current = false;
      }
    }
  }, [config.enabled, wsRef, handle_result, execute_trade]);

  useEffect(() => {
    if (!config.enabled || ticksToWait <= 0) return;
    const timer = setInterval(() => {
      setTicksToWait(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [config.enabled, ticksToWait]);


  const fetchDailyPL = useCallback(async (offset = 0) => {
    try {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        console.warn("[AutoTrader] fetchDailyPL: WebSocket not ready");
        return;
      }

      const now = new Date();
      // Get start of today in UTC (00:00:00 UTC)
      const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
      const epoch = Math.floor(startOfToday.getTime() / 1000);

      if (offset === 0) {
        console.log(`[AutoTrader] Requesting profit_table from Deriv since ${startOfToday.toISOString()} (UTC)`);
      }

      ws.send(JSON.stringify({
        profit_table: 1,
        date_from: epoch,
        limit: 500,
        offset: offset,
        sort: "ASC"
      }));
    } catch (err) {
      console.error("Unexpected error in fetchDailyPL:", err);
    }
  }, [wsRef]);

  useEffect(() => {
    if (!user?.id || !connected || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    const recoverPendingTrades = async () => {
      try {
        console.log("[AutoTrader] Recovery: Checking for pending trades in database...");
        const { data: pendingTrades, error } = await supabase
          .from("trades")
          .select("*")
          .eq("user_id", user.id)
          .eq("result", "pending")
          .not("contract_id", "is", null);

        if (error) throw error;
        if (!pendingTrades || pendingTrades.length === 0) return;

        console.log(`[AutoTrader] Recovery: Found ${pendingTrades.length} pending trades. Resolving...`);
        
        pendingTrades.forEach(trade => {
          if (trade.contract_id) {
            // Populate openContracts so handle_result can find it
            openContracts.current.set(trade.contract_id, {
              symbol: trade.symbol || "",
              stake: Number(trade.stake) || 0,
              timestamp: new Date(trade.timestamp).getTime(),
              supabaseId: trade.id
            });
            requestContractStatus(trade.contract_id);
          }
        });
      } catch (err) {
        console.error("[AutoTrader] Recovery failed:", err);
      }
    };

    // Delay recovery slightly to ensure socket is ready for multiple requests
    const timer = setTimeout(recoverPendingTrades, 2000);
    return () => clearTimeout(timer);
  }, [user?.id, connected, requestContractStatus, wsRef]);

  useEffect(() => {
    if (connected && accountInfo?.loginid) {
      fetchDailyPL();
    }
    const interval = setInterval(() => {
      if (connected && accountInfo?.loginid) {
        fetchDailyPL();
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchDailyPL, user?.id, connected, accountInfo?.loginid]);

  useEffect(() => {
    localStorage.setItem('autoTraderConfig', JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    localStorage.setItem('tradeLog', JSON.stringify(tradeLog.slice(0, 50)));
  }, [tradeLog]);

  useEffect(() => {
    if (!user?.id) return;
    const syncConfig = async () => {
      // Don't sync from cloud if the user recently performed a manual action (prevent overwriting new state with old DB state)
      if (Date.now() - lastManualActionRef.current < 10000) {
        console.log("[AutoTrader] Sync from cloud blocked: recent manual activity detected.");
        return;
      }

      const { data } = await supabase.from('user_configs').select('config').eq('user_id', user.id).maybeSingle();
      if (data?.config) {
        const merged = { ...config, ...data.config };
        const sanitized = sanitizeConfig(merged);
        
        // If we sanitized it (changed something), save it back to ensure DB is clean
        if (sanitized.baseStake !== merged.baseStake || sanitized.maxMartingaleSteps !== merged.maxMartingaleSteps) {
          console.log("[AutoTrader] Sanitized legacy config:", sanitized);
          // Don't wait for this
          supabase.from('user_configs').upsert({ user_id: user.id, config: sanitized });
        }

        // Only merge if meaningful changes exist and avoid flipping 'enabled' back to true if it was locally disabled
        const isDifferent = JSON.stringify(sanitized) !== JSON.stringify(config);
        
        if (isDifferent) {
          console.group("[AutoTrader] Syncing config from Supabase");
          console.log("Local Config:", config);
          console.log("Cloud Config:", sanitized);
          
          setConfig(prev => {
            const finalEnabled = prev.enabled === false ? false : sanitized.enabled;
            if (finalEnabled !== sanitized.enabled && sanitized.enabled === true) {
              console.warn("[AutoTrader] Cloud tried to enable bot, but local is disabled. Overriding cloud.");
            }
            return { ...prev, ...sanitized, enabled: finalEnabled };
          });
          console.groupEnd();
        }
      }
    };
    syncConfig();
  }, [user?.id]);

  // Cross-tab sync for localStorage
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'autoTraderConfig' && e.newValue) {
        try {
          const newConfig = sanitizeConfig(JSON.parse(e.newValue));
          if (JSON.stringify(newConfig) !== JSON.stringify(config)) {
            console.log("[AutoTrader] Syncing config from other tab...");
            setConfig(newConfig);
          }
        } catch (err) {
          console.error("[AutoTrader] Cross-tab sync failed:", err);
        }
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [config]);

  useEffect(() => {
    if (!user?.id) return;
    const timer = setTimeout(async () => {
      await supabase.from('user_configs').upsert({ user_id: user.id, config, updated_at: new Date().toISOString() });
    }, 2000);
    return () => clearTimeout(timer);
  }, [config, user?.id]);

  // Main Auto-Trading Loop
  useEffect(() => {
    if (!config.enabled) return;

    // Check if we should trigger a trade
    const shouldTrade = 
      (sessionState.status === "IDLE") || 
      (ticksToWait === 0 && (sessionState.status === "WIN" || sessionState.status === "LOSS"));

    if (shouldTrade && !isExecutingRef.current && sessionState.status !== "PENDING" && openContracts.current.size === 0) {
      console.log("[AutoTrader] Loop trigger: executing trade");
      execute_trade();
    }
  }, [config.enabled, sessionState.status, ticksToWait, execute_trade]);

  useEffect(() => {
    if (!config.enabled && windDownMode) {
      setWindDownMode(false);
    }
  }, [config.enabled, windDownMode]);

  useEffect(() => {
    if (!config.enabled) {
      symbolTrackerRef.current.clear();
      console.log("[AutoTrader] Symbol state trackers reset (auto-trading disabled)");
    }
  }, [config.enabled]);

  useEffect(() => {
    if (!config.enabled) {
      setContinuousTradeStartAt(null);
    } else if (!continuousTradeStartAt) {
      setContinuousTradeStartAt(Date.now());
    }
  }, [config.enabled, continuousTradeStartAt]);

  const activateWindDown = useCallback(() => {
    if (!config.enabled) {
      toast.error("Enable auto-automation before activating wind down.");
      return;
    }
    setWindDownMode(true);
    toast.info("Wind down armed: bot will stop only after the next profitable settled trade.");
  }, [config.enabled]);

  const resetTradeLog = useCallback(() => {
    setTradeLog([]);
    setSessionState({
      currentStake: config.baseStake,
      martingaleStep: 0,
      sequenceStep: 0,
      initialChoice: "DIGITOVER",
      currentSymbol: "",
      currentContract: "DIGITOVER",
      currentBarrier: 5,
      status: "IDLE",
      nextAction: "W8_TCK",
      symbolLossStreak: 0,
      usedCategories: [],
    });
    setTicksToWait(0);
    setMartingaleCycles(0);
    setContinuousTradeStartAt(config.enabled ? Date.now() : null);
  }, [config.baseStake, config.enabled]);

  const sanitizeConfigWithToasts = useCallback((cfg: AutoTraderConfig): AutoTraderConfig => {
    let corrected = { ...cfg };
    
    if (cfg.baseStake < 0.35) {
      corrected.baseStake = 0.35;
      toast.warning("Minimum Base Stake is $0.35", { id: 'min-stake-toast' });
    }
    
    if (cfg.maxMartingaleSteps < 12) {
      corrected.maxMartingaleSteps = 12;
      toast.warning("Minimum Max Step is 12", { id: 'min-step-toast' });
    }
    
    return corrected;
  }, []);

  const stableSetConfig = useCallback(async (val: AutoTraderConfig | ((prev: AutoTraderConfig) => AutoTraderConfig)) => {
    let nextConfig: AutoTraderConfig;
    
    if (typeof val === 'function') {
      setConfig(prev => {
        nextConfig = sanitizeConfigWithToasts(val(prev));
        
        // Track manual toggle activity
        if (nextConfig.enabled !== prev.enabled) {
          console.log(`%c[AutoTrader] Manual Toggle Detected: enabled=${prev.enabled} -> ${nextConfig.enabled}`, "color: blue; font-weight: bold;");
          lastManualActionRef.current = Date.now();
          enabledRef.current = nextConfig.enabled;
          
          // Immediate persistence for enabled state change
          if (user?.id) {
            supabase.from('user_configs').upsert({ 
              user_id: user.id, 
              config: nextConfig, 
              updated_at: new Date().toISOString() 
            }).then(({ error }) => {
              if (error) console.error("[AutoTrader] Immediate save failed:", error);
              else console.log("[AutoTrader] Immediate save successful.");
            });
          }
        }
        
        return nextConfig;
      });
    } else {
      nextConfig = sanitizeConfigWithToasts(val);
      const prevEnabled = enabledRef.current;
      
      if (nextConfig.enabled !== prevEnabled) {
        console.log(`%c[AutoTrader] Manual Toggle Detected: enabled=${prevEnabled} -> ${nextConfig.enabled}`, "color: blue; font-weight: bold;");
        lastManualActionRef.current = Date.now();
        enabledRef.current = nextConfig.enabled;

        // Immediate persistence for enabled state change
        if (user?.id) {
          supabase.from('user_configs').upsert({ 
            user_id: user.id, 
            config: nextConfig, 
            updated_at: new Date().toISOString() 
          }).then(({ error }) => {
            if (error) console.error("[AutoTrader] Immediate save failed:", error);
            else console.log("[AutoTrader] Immediate save successful.");
          });
        }
      }

      setConfig(nextConfig);
    }
  }, [user?.id, windDownMode, sanitizeConfigWithToasts]);

  return {
    config,
    setConfig: stableSetConfig,
    tradeLog,
    setTradeLog,
    dailyPL,
    dailyStats,
    resetTradeLog,
    sessionState,
    ticksToWait,
    handleTradeMessage,
    execute_trade,
    windDownMode,
    activateWindDown,
    activeSequenceSnapshot,
  };
}

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { DerivAccount } from "@/hooks/useDerivWebSocket";
import { toast } from "sonner";
import { useAuth } from "./useAuth";

import { type TradeRecord, type AutoTraderConfig } from "./trading-types";

const MARTINGALE_MULTIPLIER = 1.8;
const CONTINUOUS_COOLDOWN_MINUTES = [30, 40, 50, 60] as const;
const DEFAULT_CONTINUOUS_COOLDOWN_MINUTES: AutoTraderConfig["continuousTradeCooldownMinutes"] = 30;

const sanitizeConfig = (incoming: Partial<AutoTraderConfig> | null | undefined): AutoTraderConfig => {
  const baseStake = Number(incoming?.baseStake ?? 0.35);
  const maxMartingaleSteps = Number(incoming?.maxMartingaleSteps ?? 10);
  const rawCooldownMinutes = Number(incoming?.continuousTradeCooldownMinutes ?? DEFAULT_CONTINUOUS_COOLDOWN_MINUTES);
  const continuousTradeCooldownMinutes = CONTINUOUS_COOLDOWN_MINUTES.includes(rawCooldownMinutes as AutoTraderConfig["continuousTradeCooldownMinutes"])
    ? (rawCooldownMinutes as AutoTraderConfig["continuousTradeCooldownMinutes"])
    : DEFAULT_CONTINUOUS_COOLDOWN_MINUTES;

  return {
    enabled: Boolean(incoming?.enabled),
    baseStake,
    maxMartingaleSteps,
    continuousTradeCooldownMinutes,
  };
};

export function useAutoTrader(
  wsRef: React.RefObject<WebSocket | null>,
  accountInfo: DerivAccount | null
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
  const [config, setConfig] = useState<AutoTraderConfig>(() => {
    const saved = localStorage.getItem('autoTraderConfig');
    if (saved) {
      try {
        return JSON.parse(saved);
        return sanitizeConfig(JSON.parse(saved));
      } catch (e) {
        console.error("Error loading config from localStorage", e);
      }
    }
    return {
    return sanitizeConfig({
      enabled: false,
      baseStake: 0.35,
      maxMartingaleSteps: 10,
    };
      continuousTradeCooldownMinutes: DEFAULT_CONTINUOUS_COOLDOWN_MINUTES,
    });
  });

  const [sessionState, setSessionState] = useState({
    currentStake: 0.35,
    martingaleStep: 0,
    sequenceStep: 0,
    initialChoice: "DIGITOVER" as "DIGITOVER" | "DIGITUNDER",
    currentSymbol: "",
    currentContract: "DIGITOVER" as "DIGITOVER" | "DIGITUNDER",
    currentBarrier: 5,
    status: "IDLE" as "IDLE" | "WIN" | "LOSS" | "PENDING",
    nextAction: "WAITING_TO_START",
  });

  const [ticksToWait, setTicksToWait] = useState(0);
  const [martingaleCycles, setMartingaleCycles] = useState(0);
  const continuousTradeStartedAtRef = useRef<number | null>(null);

  const executionStartedAtRef = useRef<number>(0);

  // Watchdog: reset stuck execution
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();

      // Fix 3: Evict open contracts that have been open for >45s (subscription likely dropped)
      openContracts.current.forEach((contract, id) => {
        if (now - contract.timestamp > 45000) {
          console.warn(`[AutoTrader] Stale open contract ${id} evicted by watchdog`);
          openContracts.current.delete(id);
        }
      });

      if (isExecutingRef.current && now - executionStartedAtRef.current > 30000) {
        console.warn("[AutoTrader] Watchdog triggered: Resetting stuck execution state");
        isExecutingRef.current = false;

        // Clear stale pending entries from the log when resetting
        setTradeLog(prev => prev.filter(t => !t.id.startsWith("pending-")));

        setSessionState(prev => ({
          ...prev,
@@ -118,50 +138,54 @@ export function useAutoTrader(
  }, []);

  const select_random_symbol = useCallback(() => {
    const symbols = [
      "1HZ10V", "1HZ15V", "1HZ25V", "1HZ30V", "1HZ50V", "1HZ75V", "1HZ90V", "1HZ100V",
      "R_10", "R_25", "R_50", "R_75", "R_100"
    ];
    return symbols[Math.floor(Math.random() * symbols.length)];
  }, []);

  const execute_trade = useCallback(async () => {
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
    try {
      if (!continuousTradeStartedAtRef.current) {
        continuousTradeStartedAtRef.current = Date.now();
      }

      const state = sessionStateRef.current;
      let nextStake = state.currentStake;
      let nextStep = state.martingaleStep;
      let seqStep = state.sequenceStep;
      let initChoice = state.initialChoice;

      if (state.status === "WIN" || state.status === "IDLE") {
        nextStake = config.baseStake;
        nextStep = 0;
        seqStep = 0; // Reset sequence on win
      } else if (state.status === "LOSS") {
        nextStake = Number((state.currentStake * MARTINGALE_MULTIPLIER).toFixed(2));
        nextStep = state.martingaleStep + 1;
        seqStep = state.sequenceStep + 1; // Continue sequence on loss
      }

      if (nextStep >= config.maxMartingaleSteps) {
        toast.error("Max Martingale Steps reached. Stopping trading.");
        setConfig(prev => ({ ...prev, enabled: false }));
        return;
      }

      let type: "DIGITOVER" | "DIGITUNDER";
      let barrier: number;

@@ -344,51 +368,78 @@ export function useAutoTrader(

    setSessionState(prev => ({ ...prev, status: newStatus, nextAction }));
    setTicksToWait(ticksToWaitNext);
    
    // Crucial: Reset the execution lock only AFTER the result is processed
    isExecutingRef.current = false;
    console.log(JSON.stringify({
      event: "trade_settled",
      symbol,
      status: newStatus,
      profit: Number(profit.toFixed(2)),
      next_action: nextAction,
      ticks_to_wait: ticksToWaitNext,
      timestamp: new Date().toISOString()
    }, null, 2));
    
    if (ticksToWaitNext === 0) {
      execute_trade();
    }
  }, [martingaleCycles, execute_trade]);

  const handleTradeMessage = useCallback((data: any) => {
    if (!config.enabled) return;

    if (data.msg_type === "tick") {
      setTicksToWait(prev => prev > 0 ? prev - 1 : 0);
      setTicksToWait(prev => {
        const next = prev > 0 ? prev - 1 : 0;
        if (next === 0 && prev > 0) {
          continuousTradeStartedAtRef.current = null;
        }
        return next;
      });

      const activeTradeDurationMs =
        Number(config.continuousTradeCooldownMinutes) * 60 * 1000;
      const now = Date.now();
      const startedAt = continuousTradeStartedAtRef.current;
      const canTriggerDurationCooldown =
        startedAt !== null &&
        ticksToWait === 0 &&
        sessionStateRef.current.status !== "PENDING" &&
        openContracts.current.size === 0 &&
        now - startedAt >= activeTradeDurationMs;

      if (canTriggerDurationCooldown) {
        const cooldownTicks = Math.floor(Math.random() * 21) + 50; // 50-70 ticks
        setTicksToWait(cooldownTicks);
        setSessionState(prev => ({
          ...prev,
          nextAction: `TIME_COOLDOWN_${config.continuousTradeCooldownMinutes}M_PAUSING_${cooldownTicks}_TICKS`,
        }));
        continuousTradeStartedAtRef.current = null;
      }
      return;
    }

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
@@ -402,122 +453,129 @@ export function useAutoTrader(
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ proposal_open_contract: 1, contract_id: contractId, subscribe: 1 }));
    }

    if (data.msg_type === "proposal_open_contract" && data.proposal_open_contract) {
      const poc = data.proposal_open_contract;
      const contractId = String(poc.contract_id);
      if ((poc.is_sold || poc.is_expired) && !settledContracts.current.has(contractId)) {
        settledContracts.current.add(contractId);
        const isWin = (poc.profit ?? 0) > 0;
        const profit = Number(poc.profit) || 0;
        const openC = openContracts.current.get(contractId);
        handle_result(isWin, poc.underlying || "", profit, openC?.supabaseId);
        openContracts.current.delete(contractId);
      }
    }

    if (data.error) {
      const reqId = String(data.req_id);
      if (pendingProposals.current.has(reqId) || Array.from(pendingBuys.current.keys()).includes(reqId)) {
        toast.error(`Trade error: ${data.error.message}`);
        setSessionState(prev => ({ ...prev, status: "LOSS", nextAction: "ERROR_RETRY" }));
        setTicksToWait(2);
      }
    }
  }, [config.enabled, wsRef, handle_result, execute_trade]);
  }, [config.enabled, config.continuousTradeCooldownMinutes, wsRef, handle_result, ticksToWait]);


  const fetchDailyPL = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profileData } = await supabase.from('profiles').select('timezone').eq('id', user.id).single();
      const tz = profileData?.timezone || "UTC";
      const { data, error } = await supabase.rpc('get_user_daily_pl', { p_user_id: user.id, p_timezone: tz });
      if (!error && data !== null) setDailyPL(Number(data));
    } catch (err) {
      console.error("Unexpected error in fetchDailyPL:", err);
    }
  }, []);

  useEffect(() => {
    fetchDailyPL();
    const interval = setInterval(fetchDailyPL, 60000);
    return () => clearInterval(interval);
  }, [fetchDailyPL, user?.id]);

  useEffect(() => {
    localStorage.setItem('autoTraderConfig', JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    localStorage.setItem('tradeLog', JSON.stringify(tradeLog.slice(-100)));
  }, [tradeLog]);

  useEffect(() => {
    if (!user?.id) return;
    const syncConfig = async () => {
      const { data } = await supabase.from('user_configs').select('config').eq('user_id', user.id).maybeSingle();
      if (data?.config) {
        const cloudConfig = data.config as AutoTraderConfig;
        const cloudConfig = sanitizeConfig(data.config as AutoTraderConfig);
        if (JSON.stringify(cloudConfig) !== JSON.stringify(config)) {
          setConfig(prev => ({ ...prev, ...cloudConfig, enabled: prev.enabled }));
        }
      }
    };
    syncConfig();
  }, [user?.id]);

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
    if (!config.enabled) {
      continuousTradeStartedAtRef.current = null;
    }
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
      nextAction: "WAITING_FOR_TICK",
    });
    setTicksToWait(0);
    setMartingaleCycles(0);
    continuousTradeStartedAtRef.current = null;
  }, [config.baseStake]);

  return {
    config,
    setConfig,
    tradeLog,
    setTradeLog,
    dailyPL,
    resetTradeLog,
    sessionState,
    ticksToWait,
    handleTradeMessage,
    execute_trade,
  };
}

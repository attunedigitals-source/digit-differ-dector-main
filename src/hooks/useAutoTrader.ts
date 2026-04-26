import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { DerivAccount } from "@/hooks/useDerivWebSocket";
import { toast } from "sonner";
import { useAuth } from "./useAuth";

import { type TradeRecord, type AutoTraderConfig } from "./trading-types";

const MARTINGALE_MULTIPLIER = 1.8;
const DEFAULT_COOLDOWN_INTERVAL_MINUTES: AutoTraderConfig["cooldownIntervalMinutes"] = 30;
const COOLDOWN_INTERVAL_OPTIONS: ReadonlyArray<AutoTraderConfig["cooldownIntervalMinutes"]> = [2, 30, 40, 50, 60];
const COOLDOWN_WAIT_MIN_SECONDS = 300;
const COOLDOWN_WAIT_MAX_SECONDS = 480;
const WIN_TRADE_COOLDOWN_MIN_TICKS = 1;
const WIN_TRADE_COOLDOWN_MAX_TICKS = 3;
const LOSS_TRADE_COOLDOWN_MIN_TICKS = 1;
const LOSS_TRADE_COOLDOWN_MAX_TICKS = 3;

const sanitizeConfig = (incoming: Partial<AutoTraderConfig> | null | undefined): AutoTraderConfig => {
  const baseStake = Number(incoming?.baseStake ?? 0.35);
  const maxMartingaleSteps = Number(incoming?.maxMartingaleSteps ?? 10);
  const rawCooldownMinutes = Number(incoming?.cooldownIntervalMinutes ?? DEFAULT_COOLDOWN_INTERVAL_MINUTES);
  const cooldownIntervalMinutes = COOLDOWN_INTERVAL_OPTIONS.includes(rawCooldownMinutes as AutoTraderConfig["cooldownIntervalMinutes"])
    ? (rawCooldownMinutes as AutoTraderConfig["cooldownIntervalMinutes"])
    : DEFAULT_COOLDOWN_INTERVAL_MINUTES;

  return {
    enabled: Boolean(incoming?.enabled),
    baseStake,
    maxMartingaleSteps,
    cooldownIntervalMinutes,
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
        return sanitizeConfig(JSON.parse(saved));
      } catch (e) {
        console.error("Error loading config from localStorage", e);
      }
    }
    return sanitizeConfig({
      enabled: false,
      baseStake: 0.35,
      maxMartingaleSteps: 10,
      cooldownIntervalMinutes: DEFAULT_COOLDOWN_INTERVAL_MINUTES,
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
  const [windDownMode, setWindDownMode] = useState(false);
  const [continuousTradeStartAt, setContinuousTradeStartAt] = useState<number | null>(null);
  const continuousTradeStartAtRef = useRef<number | null>(null);

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
          status: "LOSS",
          nextAction: "WATCHDOG_TIMEOUT_RECOVERY"
        }));
        setTicksToWait(30); // Wait 30 seconds after a timeout
      }
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const sessionStateRef = useRef(sessionState);
  useEffect(() => {
    sessionStateRef.current = sessionState;
  }, [sessionState]);
  useEffect(() => {
    continuousTradeStartAtRef.current = continuousTradeStartAt;
  }, [continuousTradeStartAt]);

  const pendingProposals = useRef<Map<string, { symbol: string; dangerDigit: number; stake: number; timestamp: number; supabaseId?: string }>>(new Map());
  const openContracts = useRef<Map<string, { symbol: string; stake: number; timestamp: number; supabaseId?: string }>>(new Map());
  const settledContracts = useRef<Set<string>>(new Set());
  const pendingBuys = useRef<Map<string, { symbol: string; supabaseId: string }>>(new Map());

  const isExecutingRef = useRef(false);
  // Stores per-proposal timeout handles so they can be cancelled when a response arrives
  const proposalTimeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const select_random_contract = useCallback(() => {
    const isOver = Math.random() > 0.5;
    return {
      type: isOver ? "DIGITOVER" : "DIGITUNDER" as "DIGITOVER" | "DIGITUNDER",
      barrier: isOver ? 5 : 4
    };
  }, []);

  const select_random_symbol = useCallback(() => {
    const symbols = [
      "1HZ10V", "1HZ15V", "1HZ25V", "1HZ30V", "1HZ50V", "1HZ75V", "1HZ90V", "1HZ100V",
      "R_10", "R_25", "R_50", "R_75", "R_100"
    ];
    return symbols[Math.floor(Math.random() * symbols.length)];
  }, []);

  const randomCooldownSeconds = useCallback(() => {
    return Math.floor(Math.random() * (COOLDOWN_WAIT_MAX_SECONDS - COOLDOWN_WAIT_MIN_SECONDS + 1)) + COOLDOWN_WAIT_MIN_SECONDS;
  }, []);

  const randomTradeCooldownTicks = useCallback((isWin: boolean) => {
    const minTicks = isWin ? WIN_TRADE_COOLDOWN_MIN_TICKS : LOSS_TRADE_COOLDOWN_MIN_TICKS;
    const maxTicks = isWin ? WIN_TRADE_COOLDOWN_MAX_TICKS : LOSS_TRADE_COOLDOWN_MAX_TICKS;
    return Math.floor(Math.random() * (maxTicks - minTicks + 1)) + minTicks;
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
    if (!continuousTradeStartAtRef.current) {
      setContinuousTradeStartAt(Date.now());
    }
    try {
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

      if (seqStep === 0) {
        // First trade is random
        const randomRes = select_random_contract();
        type = randomRes.type;
        barrier = randomRes.barrier;
        initChoice = type;
      } else {
        // Updated Ping-Pong: flip pattern every 2 steps
// Logic: same as initial if (step % 2) === (floor((step-1)/2) % 2)
        const isSame = (seqStep % 2) === (Math.floor((seqStep - 1) / 2) % 2);
        type = isSame ? initChoice : (initChoice === "DIGITOVER" ? "DIGITUNDER" : "DIGITOVER");
        barrier = type === "DIGITOVER" ? 5 : 4;
      }

      const symbol = select_random_symbol();

      setSessionState(prev => ({
        ...prev,
        currentStake: nextStake,
        martingaleStep: nextStep,
        sequenceStep: seqStep,
        initialChoice: initChoice,
        currentSymbol: symbol,
        currentContract: type,
        currentBarrier: barrier,
        status: "PENDING",
        nextAction: "WAITING_FOR_RESULT"
      }));

      const reqId = Date.now() + Math.floor(Math.random() * 10000);

      // Add pending trade to log for real-time visibility
      const pendingRecord: TradeRecord = {
        id: `pending-${reqId}`,
        symbol,
        contract: type,
        barrier,
        stake: nextStake,
        profit: 0,
        martingale_step: nextStep,
        status: "PENDING",
        next_action: "WAITING_FOR_RESULT",
        timestamp: new Date(),
      };
      setTradeLog(prev => [pendingRecord, ...prev].slice(0, 100));

      const proposalReq = {
        proposal: 1,
        amount: nextStake,
        basis: "stake",
        contract_type: type,
        currency: "USD",
        duration: 1,
        duration_unit: "t",
        symbol: symbol,
        barrier: String(barrier),
        req_id: reqId,
      };

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
          setSessionState(prev => ({ ...prev, status: "LOSS", nextAction: "PROPOSAL_TIMEOUT_RETRY" }));
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
  }, [config, wsRef, accountInfo, select_random_contract, select_random_symbol]);

  const handle_result = useCallback((isWin: boolean, symbol: string, profit: number, supabaseId?: string) => {
    const state = sessionStateRef.current;
    const newStatus = isWin ? "WIN" : "LOSS";
    let ticksToWaitNext = randomTradeCooldownTicks(isWin);
    let nextAction = isWin
      ? `WIN_COOLDOWN_${ticksToWaitNext}T_CONTINUE_TRADING`
      : `LOSS_COOLDOWN_${ticksToWaitNext}T_CONTINUE_MARTINGALE`;

    const newRecord: TradeRecord = {
      id: Math.random().toString(36).substring(2, 11),
      symbol,
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
      const updated = [newRecord, ...filtered].slice(0, 100);
      localStorage.setItem('tradeLog', JSON.stringify(updated));
      return updated;
    });

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
      nextAction = `${nextAction}_AND_TIME_INTERVAL_${config.cooldownIntervalMinutes}M_PAUSING_${Math.ceil(intervalPauseSeconds / 60)}M`;
      setContinuousTradeStartAt(now);
      setMartingaleCycles(0);
    }

    if (supabaseId) {
      supabase.from("trades").update({ result: isWin ? "won" : "lost", profit_loss: profit }).eq("id", supabaseId).then(({ error }) => {
        if (error) console.error("Error updating trade result in Supabase:", error);
      });
    }

    if (windDownMode && isWin) {
      nextAction = "WIND_DOWN_COMPLETED_LAST_TRADE_PROFIT";
      ticksToWaitNext = 0;
      setConfig(prev => ({ ...prev, enabled: false }));
      setWindDownMode(false);
      toast.success("Wind down complete: last confirmed trade closed in profit. Auto-trading stopped.");
    }

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
    
    if (ticksToWaitNext === 0 && !(windDownMode && isWin)) {
      execute_trade();
    }
  }, [execute_trade, config.cooldownIntervalMinutes, windDownMode, randomCooldownSeconds, randomTradeCooldownTicks]);

  const handleTradeMessage = useCallback((data: any) => {
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
        setTicksToWait(30);
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
    if (!config.enabled && windDownMode) {
      setWindDownMode(false);
    }
  }, [config.enabled, windDownMode]);

  useEffect(() => {
    if (!config.enabled) {
      setContinuousTradeStartAt(null);
    } else if (!continuousTradeStartAt) {
      setContinuousTradeStartAt(Date.now());
    }
  }, [config.enabled, continuousTradeStartAt]);

  const activateWindDown = useCallback(() => {
    if (!config.enabled) {
      toast.error("Enable auto-trading before activating wind down.");
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
      nextAction: "WAITING_FOR_TICK",
    });
    setTicksToWait(0);
    setMartingaleCycles(0);
    setContinuousTradeStartAt(config.enabled ? Date.now() : null);
  }, [config.baseStake, config.enabled]);

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
    windDownMode,
    activateWindDown,
  };
}

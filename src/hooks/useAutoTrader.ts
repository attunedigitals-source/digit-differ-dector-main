import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { DerivAccount } from "@/hooks/useDerivWebSocket";
import { toast } from "sonner";
import { useAuth } from "./useAuth";
import type { SymbolState } from "@/lib/signal-engine";
import { type TradeRecord, type AutoTraderConfig } from "./trading-types";

const MARTINGALE_MULTIPLIER = 1.8;

type TradeCategory = "under4" | "over4" | "under5" | "over5";

const selectTradeFromLast16Digits = (digits: number[]) => {
  const counts = { under4: 0, over4: 0, under5: 0, over5: 0 };

  for (const digit of digits) {
    if (digit < 4) counts.under4++;
    if (digit > 4) counts.over4++;
    if (digit < 5) counts.under5++;
    if (digit > 5) counts.over5++;
  }

  const max = Math.max(...Object.values(counts));

  const top = (Object.entries(counts) as [TradeCategory, number][])
    .filter(([, v]) => v === max)
    .map(([k]) => k);

  const selectedTrade = top[Math.floor(Math.random() * top.length)];

  return { counts, selectedTrade };
};

export function useAutoTrader(
  wsRef: React.RefObject<WebSocket | null>,
  accountInfo: DerivAccount | null,
  connected: boolean,
  getSymbolState: (symbol: string) => SymbolState | undefined
) {
  const { user } = useAuth();

  const [config, setConfig] = useState<AutoTraderConfig>({
    enabled: false,
    baseStake: 0.35,
    maxMartingaleSteps: 10,
    cooldownIntervalMinutes: 30,
  });

  const [sessionState, setSessionState] = useState({
    currentStake: 0.35,
    martingaleStep: 0,
    sequenceStep: 0,
    status: "IDLE" as "IDLE" | "WIN" | "LOSS" | "SKIP" | "PENDING",
    currentSymbol: "",
    currentContract: "DIGITOVER" as "DIGITOVER" | "DIGITUNDER",
    currentBarrier: 5,
    nextAction: "WAITING",
  });

  const sessionStateRef = useRef(sessionState);
  useEffect(() => { sessionStateRef.current = sessionState; }, [sessionState]);

  const isExecutingRef = useRef(false);
  const openContracts = useRef<Map<string, any>>(new Map());

  // ✅ CLEAN SYMBOL MEMORY
  const lastTradePerSymbolRef = useRef<Map<string, TradeCategory>>(new Map());

  const shouldSkipTrade = (symbol: string, trade: TradeCategory) => {
    return lastTradePerSymbolRef.current.get(symbol) === trade;
  };

  const select_random_symbol = () => {
    const symbols = ["R_10","R_25","R_50","R_75","R_100"];
    return symbols[Math.floor(Math.random() * symbols.length)];
  };

  const execute_trade = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    if (isExecutingRef.current || openContracts.current.size > 0) return;

    isExecutingRef.current = true;

    const state = sessionStateRef.current;

    let nextStake = state.currentStake;
    let nextStep = state.martingaleStep;
    let nextSeq = state.sequenceStep;

    // ✅ MARTINGALE CONTROL (SKIP SAFE)
    if (state.status === "WIN" || state.status === "IDLE") {
      nextStep = 0;
      nextSeq = 0;
    } else if (state.status === "LOSS") {
      nextStep += 1;
      nextSeq += 1;
    } else if (state.status === "SKIP") {
      nextStep = state.martingaleStep;
      nextSeq = state.sequenceStep;
    }

    const symbol = select_random_symbol();
    const digits = getSymbolState(symbol)?.digits?.slice(-16) || [];

    if (digits.length < 16) {
      isExecutingRef.current = false;
      return;
    }

    const { selectedTrade } = selectTradeFromLast16Digits(digits);

    // ✅ SKIP LOGIC (PURE)
    if (shouldSkipTrade(symbol, selectedTrade)) {
      setSessionState(prev => ({
        ...prev,
        status: "SKIP",
        nextAction: `SKIP_${selectedTrade}`
      }));

      isExecutingRef.current = false;
      return;
    }

    let type: "DIGITOVER" | "DIGITUNDER";
    let barrier: number;

    if (selectedTrade === "under4") { type = "DIGITUNDER"; barrier = 4; }
    else if (selectedTrade === "over4") { type = "DIGITOVER"; barrier = 4; }
    else if (selectedTrade === "under5") { type = "DIGITUNDER"; barrier = 5; }
    else { type = "DIGITOVER"; barrier = 5; }

    const isSpecial = selectedTrade === "under5" || selectedTrade === "over4";

    // ✅ STAKE LOGIC
    if (state.status === "WIN") {
      nextStake = config.baseStake;
    } else if (state.status === "LOSS") {
      nextStake = isSpecial
        ? state.currentStake * 1.8 * 1.26
        : state.currentStake * 1.8;
    } else if (state.status === "SKIP") {
      nextStake = state.currentStake;
    }

    setSessionState(prev => ({
      ...prev,
      currentStake: nextStake,
      martingaleStep: nextStep,
      sequenceStep: nextSeq,
      currentSymbol: symbol,
      currentContract: type,
      currentBarrier: barrier,
      status: "PENDING"
    }));

    const reqId = Date.now();

    ws.send(JSON.stringify({
      proposal: 1,
      amount: nextStake,
      contract_type: type,
      symbol,
      barrier: String(barrier),
      duration: 1,
      duration_unit: "t",
      basis: "stake",
      currency: "USD",
      req_id: reqId
    }));

    // ✅ RECORD ONLY AFTER VALID TRADE
    lastTradePerSymbolRef.current.set(symbol, selectedTrade);

  }, [wsRef, getSymbolState, config.baseStake]);

  const handle_result = (isWin: boolean) => {
    const state = sessionStateRef.current;

    setSessionState(prev => ({
      ...prev,
      status: isWin ? "WIN" : "LOSS",
      currentStake: isWin ? config.baseStake : state.currentStake,
      martingaleStep: isWin ? 0 : state.martingaleStep
    }));

    isExecutingRef.current = false;
  };

  useEffect(() => {
    if (!config.enabled) return;

    const shouldTrade =
      sessionState.status === "IDLE" ||
      sessionState.status === "WIN" ||
      sessionState.status === "LOSS" ||
      sessionState.status === "SKIP";

    if (shouldTrade && !isExecutingRef.current) {
      execute_trade();
    }
  }, [sessionState.status, config.enabled, execute_trade]);

  useEffect(() => {
    if (!config.enabled) {
      lastTradePerSymbolRef.current.clear();
    }
  }, [config.enabled]);

  return {
    config,
    setConfig,
    sessionState,
    execute_trade,
    handle_result
  };
}

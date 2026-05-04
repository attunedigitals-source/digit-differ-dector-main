import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { DerivAccount } from "@/hooks/useDerivWebSocket";
import { toast } from "sonner";
import { useAuth } from "./useAuth";
import type { SymbolState } from "@/lib/signal-engine";
import { type TradeRecord, type AutoTraderConfig } from "./trading-types";

const MARTINGALE_MULTIPLIER = 1.8;

type TradeCategory = "under4" | "over4" | "under5" | "over5";

/* ===================== LAST-16 HYBRID ===================== */
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

  return top[Math.floor(Math.random() * top.length)];
};

/* ===================== MAIN HOOK ===================== */
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
  useEffect(() => {
    sessionStateRef.current = sessionState;
  }, [sessionState]);

  const isExecutingRef = useRef(false);

  // ✅ FIX 1: reliable last result (removes race condition)
  const lastResultRef = useRef<"WIN" | "LOSS" | null>(null);

  // ✅ FIX 2: symbol memory for skip
  const lastTradePerSymbolRef = useRef<Map<string, TradeCategory>>(new Map());

  const shouldSkip = (symbol: string, trade: TradeCategory) => {
    return lastTradePerSymbolRef.current.get(symbol) === trade;
  };

  const symbols = ["R_10", "R_25", "R_50", "R_75", "R_100"];

  const execute_trade = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (isExecutingRef.current) return;

    isExecutingRef.current = true;

    const state = sessionStateRef.current;
    const lastResult = lastResultRef.current;

    let nextStake = state.currentStake;
    let nextStep = state.martingaleStep;

    // ✅ FIX 3: martingale uses lastResult (not state.status)
    if (lastResult === "WIN" || state.status === "IDLE") {
      nextStep = 0;
    } else if (lastResult === "LOSS") {
      nextStep = state.martingaleStep + 1;
    }

    const symbol = symbols[Math.floor(Math.random() * symbols.length)];
    const digits = getSymbolState(symbol)?.digits?.slice(-16) || [];

    if (digits.length < 16) {
      isExecutingRef.current = false;
      return;
    }

    const trade = selectTradeFromLast16Digits(digits);

    // ✅ FIX 4: skip without affecting martingale
    if (shouldSkip(symbol, trade)) {
      setSessionState(prev => ({
        ...prev,
        status: "SKIP",
        nextAction: "SKIPPED_SAME_SIGNAL"
      }));
      isExecutingRef.current = false;
      return;
    }

    let type: "DIGITOVER" | "DIGITUNDER";
    let barrier: number;

    if (trade === "under4") { type = "DIGITUNDER"; barrier = 4; }
    else if (trade === "over4") { type = "DIGITOVER"; barrier = 4; }
    else if (trade === "under5") { type = "DIGITUNDER"; barrier = 5; }
    else { type = "DIGITOVER"; barrier = 5; }

    const isSpecial = trade === "under5" || trade === "over4";

    // ✅ FIX 5: stake reset ALWAYS after win
    if (lastResult === "WIN" || state.status === "IDLE") {
      nextStake = config.baseStake;
    } else if (lastResult === "LOSS") {
      nextStake = isSpecial
        ? Number((state.currentStake * 1.8 * 1.26).toFixed(2))
        : Number((state.currentStake * 1.8).toFixed(2));
    } else if (state.status === "SKIP") {
      nextStake = state.currentStake;
    }

    setSessionState(prev => ({
      ...prev,
      currentStake: nextStake,
      martingaleStep: nextStep,
      currentSymbol: symbol,
      currentContract: type,
      currentBarrier: barrier,
      status: "PENDING"
    }));

    ws.send(JSON.stringify({
      proposal: 1,
      amount: nextStake,
      basis: "stake",
      contract_type: type,
      currency: "USD",
      duration: 1,
      duration_unit: "t",
      symbol,
      barrier: String(barrier),
    }));

    // record trade
    lastTradePerSymbolRef.current.set(symbol, trade);

  }, [wsRef, getSymbolState, config.baseStake]);

  const handle_result = (isWin: boolean) => {
    const state = sessionStateRef.current;

    // ✅ CRITICAL: update immediately (fix race condition)
    lastResultRef.current = isWin ? "WIN" : "LOSS";

    setSessionState(prev => ({
      ...prev,
      status: isWin ? "WIN" : "LOSS",
      currentStake: isWin ? config.baseStake : state.currentStake,
      martingaleStep: isWin ? 0 : state.martingaleStep,
    }));

    isExecutingRef.current = false;
  };

  useEffect(() => {
    if (!config.enabled) return;

    if (
      sessionState.status === "IDLE" ||
      sessionState.status === "WIN" ||
      sessionState.status === "LOSS" ||
      sessionState.status === "SKIP"
    ) {
      execute_trade();
    }
  }, [sessionState.status, config.enabled, execute_trade]);

  useEffect(() => {
    if (!config.enabled) {
      lastTradePerSymbolRef.current.clear();
      lastResultRef.current = null;
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

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { DerivAccount } from "@/hooks/useDerivWebSocket";
import { toast } from "sonner";
import { useAuth } from "./useAuth";
import type { SymbolState } from "@/lib/signal-engine";

import { type TradeRecord, type AutoTraderConfig } from "./trading-types";

const MARTINGALE_MULTIPLIER = 1.8;

type TradeCategory = "under4" | "over4" | "under5" | "over5";

/* ================= SAFE HELPERS ================= */
const safeNumber = (val: any, fallback: number) => {
  const n = Number(val);
  return isNaN(n) ? fallback : n;
};

const safeArray = (arr: any) => (Array.isArray(arr) ? arr : []);

/* ================= CORE LOGIC ================= */
const selectTradeFromLast16Digits = (digits: number[]) => {
  const counts = { under4: 0, over4: 0, under5: 0, over5: 0 };

  for (const digit of digits) {
    if (digit < 4) counts.under4++;
    if (digit > 4) counts.over4++;
    if (digit < 5) counts.under5++;
    if (digit > 5) counts.over5++;
  }

  const max = Math.max(...Object.values(counts));

  const top = Object.entries(counts)
    .filter(([, v]) => v === max)
    .map(([k]) => k as TradeCategory);

  const selected = top[Math.floor(Math.random() * top.length)];

  return { counts, selected };
};

/* ================= HOOK ================= */
export function useAutoTrader(
  wsRef: React.RefObject<WebSocket | null>,
  accountInfo: DerivAccount | null,
  connected: boolean,
  getSymbolState: (symbol: string) => SymbolState | undefined
) {
  const { user } = useAuth();

  const [tradeLog, setTradeLog] = useState<TradeRecord[]>([]);

  const [config, setConfig] = useState<AutoTraderConfig>({
    enabled: false,
    baseStake: 0.35,
    maxMartingaleSteps: 10,
    cooldownIntervalMinutes: 30,
  });

  const [sessionState, setSessionState] = useState({
    currentStake: 0.35,
    martingaleStep: 0,
    status: "IDLE" as "IDLE" | "WIN" | "LOSS" | "PENDING",
    currentSymbol: "",
    currentContract: "DIGITOVER" as "DIGITOVER" | "DIGITUNDER",
    currentBarrier: 5,
  });

  const sessionRef = useRef(sessionState);
  useEffect(() => {
    sessionRef.current = sessionState;
  }, [sessionState]);

  const isExecutingRef = useRef(false);

  /* ================= SYMBOL PICK ================= */
  const pickSymbol = useCallback(() => {
    const symbols = [
      "R_10","R_25","R_50","R_75","R_100",
      "1HZ10V","1HZ25V","1HZ50V","1HZ75V","1HZ100V"
    ];

    const valid = symbols
      .map(s => ({
        symbol: s,
        digits: getSymbolState(s)?.digits?.slice(-16) ?? []
      }))
      .filter(x => x.digits.length === 16);

    if (!valid.length) return null;

    return valid[Math.floor(Math.random() * valid.length)];
  }, [getSymbolState]);

  /* ================= TRADE ================= */
  const execute_trade = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    if (isExecutingRef.current) return;
    isExecutingRef.current = true;

    const state = sessionRef.current;

    const picked = pickSymbol();
    if (!picked) {
      isExecutingRef.current = false;
      return;
    }

    const decision = selectTradeFromLast16Digits(picked.digits);

    let type: "DIGITOVER" | "DIGITUNDER";
    let barrier: number;

    switch (decision.selected) {
      case "under4": type = "DIGITUNDER"; barrier = 4; break;
      case "over4": type = "DIGITOVER"; barrier = 4; break;
      case "under5": type = "DIGITUNDER"; barrier = 5; break;
      default: type = "DIGITOVER"; barrier = 5;
    }

    /* ===== SAFE STAKE LOGIC ===== */
    let stake = safeNumber(state.currentStake, config.baseStake);

    if (state.status === "WIN" || state.status === "IDLE") {
      stake = config.baseStake;
    } else if (state.status === "LOSS") {
      stake = safeNumber(stake * MARTINGALE_MULTIPLIER, config.baseStake);
    }

    stake = Number(stake.toFixed(2));

    setSessionState(prev => ({
      ...prev,
      currentStake: stake,
      martingaleStep: state.status === "LOSS" ? prev.martingaleStep + 1 : 0,
      currentSymbol: picked.symbol,
      currentContract: type,
      currentBarrier: barrier,
      status: "PENDING"
    }));

    ws.send(JSON.stringify({
      proposal: 1,
      amount: stake,
      basis: "stake",
      contract_type: type,
      currency: "USD",
      duration: 1,
      duration_unit: "t",
      symbol: picked.symbol,
      barrier: String(barrier)
    }));

  }, [wsRef, config.baseStake, pickSymbol]);

  /* ================= RESULT ================= */
  const handle_result = useCallback((isWin: boolean, profit: number) => {
    const state = sessionRef.current;

    const safeProfit = safeNumber(profit, 0);

    setTradeLog(prev => {
      const safePrev = safeArray(prev);
      return [{
        id: Math.random().toString(36),
        symbol: state.currentSymbol,
        stake: state.currentStake,
        profit: Number(safeProfit.toFixed(2)),
        status: isWin ? "WIN" : "LOSS",
        timestamp: new Date()
      }, ...safePrev].slice(0, 1000);
    });

    setSessionState(prev => ({
      ...prev,
      status: isWin ? "WIN" : "LOSS",
      currentStake: isWin
        ? config.baseStake
        : safeNumber(prev.currentStake, config.baseStake)
    }));

    isExecutingRef.current = false;

  }, [config.baseStake]);

  /* ================= LOOP ================= */
  useEffect(() => {
    if (!config.enabled) return;

    if (!isExecutingRef.current && sessionState.status !== "PENDING") {
      execute_trade();
    }
  }, [config.enabled, sessionState.status, execute_trade]);

  return {
    config,
    setConfig,
    tradeLog,
    sessionState,
    execute_trade,
    handle_result
  };
}

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { DerivAccount } from "@/hooks/useDerivWebSocket";
import { toast } from "sonner";
import { useAuth } from "./useAuth";
import type { SymbolState } from "@/lib/signal-engine";

import { type TradeRecord, type AutoTraderConfig } from "./trading-types";

const MARTINGALE_MULTIPLIER = 1.8;
const DEFAULT_COOLDOWN_INTERVAL_MINUTES: AutoTraderConfig["cooldownIntervalMinutes"] = 30;
const COOLDOWN_INTERVAL_OPTIONS: ReadonlyArray<AutoTraderConfig["cooldownIntervalMinutes"]> = [30, 40, 50, 60];

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
  const top = Object.entries(counts)
    .filter(([, v]) => v === max)
    .map(([k]) => k as TradeCategory);

  return {
    selectedTrade: top[Math.floor(Math.random() * top.length)],
  };
};

const sanitizeConfig = (incoming: Partial<AutoTraderConfig> | null | undefined): AutoTraderConfig => ({
  enabled: Boolean(incoming?.enabled),
  baseStake: Number(incoming?.baseStake ?? 0.35),
  maxMartingaleSteps: Number(incoming?.maxMartingaleSteps ?? 10),
  cooldownIntervalMinutes: DEFAULT_COOLDOWN_INTERVAL_MINUTES,
});

export function useAutoTrader(
  wsRef: React.RefObject<WebSocket | null>,
  accountInfo: DerivAccount | null,
  connected: boolean,
  getSymbolState: (symbol: string) => SymbolState | undefined
) {
  const { user } = useAuth();

  const [config, setConfig] = useState<AutoTraderConfig>(() =>
    sanitizeConfig({
      enabled: false,
      baseStake: 0.35,
      maxMartingaleSteps: 10,
      cooldownIntervalMinutes: 30,
    })
  );

  const [sessionState, setSessionState] = useState({
    currentStake: 0.35,
    martingaleStep: 0,
    sequenceStep: 0,
    currentSymbol: "",
    currentContract: "DIGITOVER" as "DIGITOVER" | "DIGITUNDER",
    currentBarrier: 5,
    status: "IDLE" as "IDLE" | "WIN" | "LOSS" | "PENDING",
    nextAction: "",
  });

  const sessionStateRef = useRef(sessionState);
  useEffect(() => {
    sessionStateRef.current = sessionState;
  }, [sessionState]);

  const isExecutingRef = useRef(false);

  // 🔥 FIX: Track last symbol
  const lastTradedSymbolRef = useRef<string | null>(null);

  const select_random_symbol_with_last16 = useCallback(() => {
    const symbols = ["R_10", "R_25", "R_50", "R_75", "R_100"];

    const valid = symbols
      .map(s => ({
        symbol: s,
        digits: getSymbolState(s)?.digits?.slice(-16) ?? [],
      }))
      .filter(s => s.digits.length === 16);

    if (!valid.length) return null;

    return valid[Math.floor(Math.random() * valid.length)];
  }, [getSymbolState]);

  const execute_trade = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    if (isExecutingRef.current || sessionStateRef.current.status === "PENDING") return;

    isExecutingRef.current = true;

    try {
      const state = sessionStateRef.current;

      let nextStake = state.currentStake;
      let nextStep = state.martingaleStep;
      let seqStep = state.sequenceStep;

      if (state.status === "WIN" || state.status === "IDLE") {
        nextStep = 0;
        seqStep = 0;
      } else if (state.status === "LOSS") {
        nextStep++;
        seqStep++;
      }

      if (nextStep >= config.maxMartingaleSteps) {
        setConfig(prev => ({ ...prev, enabled: false }));
        return;
      }

      const selected = select_random_symbol_with_last16();
      if (!selected) {
        isExecutingRef.current = false;
        return;
      }

      const { symbol, digits } = selected;

      const decision = selectTradeFromLast16Digits(digits);
      const trade = decision.selectedTrade;

      const isNewSymbol = lastTradedSymbolRef.current !== symbol;

      let type: "DIGITOVER" | "DIGITUNDER";
      let barrier: number;

      if (trade === "under4") { type = "DIGITUNDER"; barrier = 4; }
      else if (trade === "over4") { type = "DIGITOVER"; barrier = 4; }
      else if (trade === "under5") { type = "DIGITUNDER"; barrier = 5; }
      else { type = "DIGITOVER"; barrier = 5; }

      const isSpecial = trade === "under5" || trade === "over4";

      // 🔥 FIXED LOGIC
      if (isNewSymbol) {
        nextStake = config.baseStake;
        nextStep = 0;
        seqStep = 0;
      } else if (state.status === "WIN" || state.status === "IDLE") {
        nextStake = config.baseStake;
      } else if (state.status === "LOSS") {
        nextStake = isSpecial
          ? Number((state.currentStake * MARTINGALE_MULTIPLIER * 1.26).toFixed(2))
          : Number((state.currentStake * MARTINGALE_MULTIPLIER).toFixed(2));
      }

      setSessionState(prev => ({
        ...prev,
        currentStake: nextStake,
        martingaleStep: nextStep,
        sequenceStep: seqStep,
        currentSymbol: symbol,
        currentContract: type,
        currentBarrier: barrier,
        status: "PENDING",
      }));

      const req_id = Date.now();

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
        req_id,
      }));

      // 🔥 update symbol AFTER placing trade
      lastTradedSymbolRef.current = symbol;

    } catch (err) {
      console.error(err);
      isExecutingRef.current = false;
    }
  }, [config, wsRef, select_random_symbol_with_last16]);

  return {
    config,
    setConfig,
    sessionState,
    execute_trade,
  };
}

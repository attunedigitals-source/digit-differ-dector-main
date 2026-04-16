import { useCallback, useEffect, useRef, useState } from "react";
import { DERIV_SYMBOLS } from "@/lib/deriv-symbols";
import {
  type Signal,
  type SymbolState,
  addTick,
  createSymbolState,
  extractLastDigit,
  generateSignal,
} from "@/lib/signal-engine";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const WS_URL = "wss://ws.derivws.com/websockets/v3?app_id=1089";

export interface DerivAccount {
  loginid: string;
  currency: string;
  is_virtual: boolean;
  balance: number;
  token?: string; // Deriv sometimes includes target tokens in the authorize response
}

export interface SignalWithStatus extends Signal {
  id?: string;
  status: "active" | "expired";
}

export interface SignalResult {
  symbol: string;
  dangerDigit: number;
  actualDigit: number;
  win: boolean;
  createdAt: Date;
}

export function useDerivWebSocket(apiToken?: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const statesRef = useRef<Map<string, SymbolState>>(new Map());
  const [connected, setConnected] = useState(false);
  const [signals, setSignals] = useState<SignalWithStatus[]>([]);
  const [results, setResults] = useState<SignalResult[]>([]);
  const [tickCounts, setTickCounts] = useState<Record<string, number>>({});
  const [lastDigits, setLastDigits] = useState<Record<string, number>>({});
  const [accounts, setAccounts] = useState<DerivAccount[]>([]);
  const [activeLoginId, setActiveLoginId] = useState<string | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();
  const activeSignalsRef = useRef<SignalWithStatus[]>([]);
  const pingTimer = useRef<ReturnType<typeof setInterval>>();
  const balanceFallbackTimer = useRef<ReturnType<typeof setInterval>>();
  const authorizedRef = useRef(false);

  // Callback refs for external message handlers (auto-trader)
  const onSignalRef = useRef<((signal: SignalWithStatus) => void) | null>(null);
  const onMessageRef = useRef<((data: any) => void) | null>(null);

  const saveSignal = useCallback(async (signal: Signal) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("matches_signals").insert({
      user_id: user.id,
      symbol: signal.symbol,
      danger_digit: signal.dangerDigit,
      confidence: signal.confidence,
      valid_until_tick: signal.validUntilTick,
      tick_count: signal.tickCount,
    });
  }, []);

  const saveResult = useCallback(async (result: SignalResult) => {
    await supabase.from("signal_results").insert({
      symbol: result.symbol,
      danger_digit: result.dangerDigit,
      actual_digit: result.actualDigit,
      win: result.win,
    });
  }, []);

  // Helper to subscribe to balance after authorization
  const subscribeBalance = useCallback((ws: WebSocket) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ balance: 1, subscribe: 1 }));
    }
  }, []);

  // Helper to subscribe to ticks
  const subscribeTicks = useCallback((ws: WebSocket) => {
    for (const { symbol } of DERIV_SYMBOLS) {
      ws.send(JSON.stringify({ ticks: symbol, subscribe: 1 }));
    }
  }, []);

  const switchAccount = useCallback((loginid: string) => {
    if (loginid === activeLoginId) return;
    
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    const targetAccount = accounts.find(a => a.loginid === loginid);
    
    if (!targetAccount?.token && apiToken) {
      const currentAccount = accounts.find(a => a.loginid === activeLoginId);
      if (currentAccount && currentAccount.is_virtual !== targetAccount?.is_virtual) {
        toast.warning(
          `Trading on ${targetAccount?.is_virtual ? 'Demo' : 'Real'} requires its specific API Token. Please update your token in Settings.`,
          { duration: 6000 }
        );
        return;
      }
    }

    const tokenToUse = targetAccount?.token || apiToken;
    if (tokenToUse) {
      authorizedRef.current = false;
      ws.send(JSON.stringify({ authorize: tokenToUse }));
    }
  }, [accounts, activeLoginId, apiToken]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;
    authorizedRef.current = false;

    for (const { symbol } of DERIV_SYMBOLS) {
      if (!statesRef.current.has(symbol)) {
        statesRef.current.set(symbol, createSymbolState(symbol));
      }
    }

    ws.onopen = () => {
      setConnected(true);

      // 1. Keepalive: Send ping every 30 seconds
      if (pingTimer.current) clearInterval(pingTimer.current);
      pingTimer.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ ping: 1 }));
        }
      }, 30000);

      // 2. Fallback: Request balance every 10 seconds
      if (balanceFallbackTimer.current) clearInterval(balanceFallbackTimer.current);
      balanceFallbackTimer.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN && authorizedRef.current) {
          ws.send(JSON.stringify({ balance: 1 }));
        }
      }, 10000);

      // 3. Authorization: Send authorize first if token available
      if (apiToken) {
        ws.send(JSON.stringify({ authorize: apiToken }));
      } else {
        // Fallback for unauthorized viewing (ticks only)
        subscribeTicks(ws);
      }
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      onMessageRef.current?.(data);

      // Handle authorize response: SUCCESS triggers everything else
      if (data.msg_type === "authorize" && data.authorize) {
        authorizedRef.current = true;
        const auth = data.authorize;
        
        const accountList: DerivAccount[] = (auth.account_list || []).map(
          (acc: any) => ({
            loginid: acc.loginid,
            currency: acc.currency || "USD",
            is_virtual: Boolean(acc.is_virtual),
            balance: 0,
            token: acc.token,
          })
        );
        
        // Populate the authorized account balance immediately
        const currentIdx = accountList.findIndex((a) => a.loginid === auth.loginid);
        if (currentIdx >= 0) {
          accountList[currentIdx].balance = Number(auth.balance) || 0;
          accountList[currentIdx].currency = auth.currency || accountList[currentIdx].currency;
        }
        
        setAccounts(accountList);
        setActiveLoginId(auth.loginid);
        
        // NOW subscribe to continuous balance and ticks
        subscribeBalance(ws);
        subscribeTicks(ws);
      }

      // Handle balance updates: Listen for msg_type === "balance"
      if (data.msg_type === "balance" && data.balance) {
        const bal = data.balance;
        const balanceNum = Number(bal.balance);
        
        if (!isNaN(balanceNum)) {
          setAccounts((prev) =>
            prev.map((acc) =>
              acc.loginid === bal.loginid
                ? { ...acc, balance: balanceNum, currency: bal.currency || acc.currency }
                : acc
            )
          );
        }
      }

      if (data.msg_type === "tick") {
        const tick = data.tick;
        const symbol = tick.symbol as string;
        const quote = tick.quote as number;
        const digit = extractLastDigit(quote);

        let state = statesRef.current.get(symbol);
        if (!state) return;

        state = addTick(state, digit);
        statesRef.current.set(symbol, state);

        setTickCounts((prev) => ({ ...prev, [symbol]: state!.tickCount }));
        setLastDigits((prev) => ({ ...prev, [symbol]: digit }));

        // Check and expire active signals
        const active = activeSignalsRef.current;
        const expiring: SignalWithStatus[] = [];
        const stillActive: SignalWithStatus[] = [];

        for (const sig of active) {
          if (sig.symbol === symbol && state.tickCount > sig.validUntilTick) {
            sig.status = "expired";
            expiring.push(sig);
            const win = digit !== sig.dangerDigit;
            const result: SignalResult = {
              symbol: sig.symbol,
              dangerDigit: sig.dangerDigit,
              actualDigit: digit,
              win,
              createdAt: new Date(),
            };
            setResults((prev) => [result, ...prev].slice(0, 100));
            saveResult(result);
          } else {
            stillActive.push(sig);
          }
        }
        activeSignalsRef.current = stillActive;

        if (expiring.length > 0) {
          setSignals((prev) =>
            prev.map((s) => {
              const exp = expiring.find(
                (e) => e.symbol === s.symbol && e.tickCount === s.tickCount
              );
              return exp ? { ...s, status: "expired" as const } : s;
            })
          );
        }

        // Generate new signal
        const signal = generateSignal(state);
        if (signal) {
          state.lastSignalTick = state.tickCount;
          statesRef.current.set(symbol, state);

          const signalWithStatus: SignalWithStatus = {
            ...signal,
            status: "active",
          };
          activeSignalsRef.current.push(signalWithStatus);
          setSignals((prev) => [signalWithStatus, ...prev].slice(0, 50));
          saveSignal(signal);

          // Notify auto-trader of new signal
          onSignalRef.current?.(signalWithStatus);
        }
      }
    };

    ws.onclose = () => {
      setConnected(false);
      authorizedRef.current = false;
      if (pingTimer.current) clearInterval(pingTimer.current);
      if (balanceFallbackTimer.current) clearInterval(balanceFallbackTimer.current);
      reconnectTimer.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [apiToken, activeLoginId, saveSignal, saveResult, subscribeBalance, subscribeTicks]);

  const disconnect = useCallback(() => {
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    if (pingTimer.current) clearInterval(pingTimer.current);
    if (balanceFallbackTimer.current) clearInterval(balanceFallbackTimer.current);
    authorizedRef.current = false;
    wsRef.current?.close();
    wsRef.current = null;
    setConnected(false);
    setAccounts([]);
    setActiveLoginId(null);
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    connected,
    connect,
    disconnect,
    signals,
    results,
    tickCounts,
    lastDigits,
    accounts,
    activeLoginId,
    switchAccount,
    wsRef,
    onSignalRef,
    onMessageRef,
  };
}

// Digit Bot Pro - Last Sync: 2026-05-08 (V4 API - OTP Auth)
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
import {
  getAccessToken,
  getAccounts,
  getActiveAccount,
  setActiveAccount,
  DERIV_APP_ID,
  type DerivAccount,
} from "@/lib/deriv-oauth";

// The new V4 WebSocket base URL — does NOT include app_id in URL
// Authentication is done via OTP query parameter
const V4_WS_BASE = "wss://api.derivws.com/websockets/v4";
// Fallback for unauthenticated tick-only connections
const PUBLIC_WS_URL = "wss://ws.derivws.com/websockets/v3?app_id=1089";

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

export interface DerivWebSocketOptions {
  appId?: string;
  apiToken?: string;
  accountId?: string;
  userId?: string;
}

async function fetchOTP(accessToken: string, accountId: string): Promise<string> {
  const res = await fetch(
    `https://api.derivws.com/trading/v1/options/accounts/${accountId}/otp`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Deriv-App-ID": DERIV_APP_ID,
        "Content-Type": "application/json",
      },
    }
  );

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.message || `OTP request failed: ${res.status}`);
  }

  const data = await res.json();
  // The response contains either an otp field or a websocket_url
  if (data.otp) return data.otp;
  if (data.websocket_url) {
    // If they give us a full URL, extract OTP from it
    const url = new URL(data.websocket_url);
    const otp = url.searchParams.get("otp");
    if (otp) return otp;
  }
  throw new Error("OTP not found in response");
}

export function useDerivWebSocket({ appId, apiToken, accountId, userId }: DerivWebSocketOptions = {}) {
  const wsRef = useRef<WebSocket | null>(null);
  const statesRef = useRef<Map<string, SymbolState>>(new Map());
  const pendingRequestsRef = useRef<Map<string, (data: any) => void>>(new Map());
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
  const watchdogTimer = useRef<ReturnType<typeof setInterval>>();
  const lastMessageAt = useRef<number>(Date.now());
  const connectRef = useRef<() => Promise<void>>();

  const onSignalRef = useRef<((signal: SignalWithStatus) => void) | null>(null);
  const onMessageRef = useRef<((data: any) => void) | null>(null);

  const saveSignal = useCallback(async (_signal: Signal) => { return; }, []);
  const saveResult = useCallback(async (_result: SignalResult) => { return; }, []);

  const subscribeTicksV4 = useCallback((ws: WebSocket) => {
    for (const { symbol } of DERIV_SYMBOLS) {
      // V4: ticks_history uses same format as V3 (minor field changes, same JSON-RPC)
      ws.send(JSON.stringify({
        ticks_history: symbol,
        adjust_start_time: 1,
        count: 1000,
        end: "latest",
        start: 1,
        style: "ticks",
        req_id: `history_${symbol}`,
      }));
      // V4: subscribe to live tick stream
      ws.send(JSON.stringify({ ticks: symbol, subscribe: 1 }));
    }
  }, []);

  const connect = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    // Initialize symbol states
    for (const { symbol } of DERIV_SYMBOLS) {
      if (!statesRef.current.has(symbol)) {
        statesRef.current.set(symbol, createSymbolState(symbol));
      }
    }

    const accessToken = getAccessToken();
    const activeAccount = getActiveAccount();
    const loginIdToUse = activeAccount?.loginid || accountId;

    if (!accessToken || !loginIdToUse) {
      // Unauthenticated mode: ticks only via legacy public WebSocket
      console.log("[WebSocket] No session found — connecting in public (ticks-only) mode");
      const ws = new WebSocket(PUBLIC_WS_URL);
      wsRef.current = ws;
      ws.onopen = () => {
        setConnected(true);
        subscribeTicksV4(ws);
      };
      ws.onmessage = (event) => {
        lastMessageAt.current = Date.now();
        const data = JSON.parse(event.data);
        onMessageRef.current?.(data);
        if (data.msg_type === "tick") handleTickMessage(data);
        if (data.msg_type === "history") handleHistoryMessage(data);
      };
      ws.onclose = () => {
        setConnected(false);
        reconnectTimer.current = setTimeout(() => connectRef.current?.(), 3000);
      };
      return;
    }

    try {
      // Step 1: Get a one-time password for WebSocket authentication
      console.log(`[WebSocket] Requesting OTP for account ${loginIdToUse}...`);
      const otp = await fetchOTP(accessToken, loginIdToUse);
      console.log("[WebSocket] OTP received, connecting...");

      // Step 2: Connect using the OTP URL
      const wsUrl = `${V4_WS_BASE}?otp=${otp}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        console.log("[WebSocket] V4 connection established (authenticated)");

        // Immediately load accounts from session storage
        const sessionAccounts = getAccounts();
        setAccounts(sessionAccounts);
        setActiveLoginId(loginIdToUse);

        // Start ping keepalive
        if (pingTimer.current) clearInterval(pingTimer.current);
        pingTimer.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ ping: 1 }));
        }, 30000);

        // Watchdog
        lastMessageAt.current = Date.now();
        if (watchdogTimer.current) clearInterval(watchdogTimer.current);
        watchdogTimer.current = setInterval(() => {
          if (Date.now() - lastMessageAt.current > 25000) {
            console.warn("[WebSocket] Watchdog triggered: no messages for 25s, reconnecting...");
            ws.close();
          }
        }, 5000);

        // Subscribe to ticks
        subscribeTicksV4(ws);

        // Request balance for the active account via V4 WebSocket
        ws.send(JSON.stringify({ balance: 1, subscribe: 1 }));
      };

      ws.onmessage = (event) => {
        lastMessageAt.current = Date.now();
        const data = JSON.parse(event.data);
        onMessageRef.current?.(data);

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

        if (data.msg_type === "history") handleHistoryMessage(data);
        if (data.msg_type === "tick") handleTickMessage(data);

        if (data.error) {
          console.error("[WebSocket] Server error:", data.error);
        }
      };

      ws.onclose = (event) => {
        setConnected(false);
        if (pingTimer.current) clearInterval(pingTimer.current);
        if (watchdogTimer.current) clearInterval(watchdogTimer.current);
        console.log(`[WebSocket] Connection closed (code=${event.code}). Reconnecting in 3s...`);
        reconnectTimer.current = setTimeout(() => connectRef.current?.(), 3000);
      };

      ws.onerror = (err) => {
        console.error("[WebSocket] Error:", err);
        ws.close();
      };

    } catch (error: any) {
      console.error("[WebSocket] Connection failed:", error);
      toast.error(`Deriv connection failed: ${error.message}. Retrying in 5s...`);
      reconnectTimer.current = setTimeout(() => connectRef.current?.(), 5000);
    }
  }, [accountId, subscribeTicksV4]);

  // --- Message handlers (defined outside ws.onmessage to avoid stale closures) ---

  function handleHistoryMessage(data: any) {
    const reqId = data.req_id;
    const symbol = data.echo_req?.ticks_history;
    const history = data.history;

    if (reqId && pendingRequestsRef.current.has(reqId)) {
      pendingRequestsRef.current.get(reqId)!(data);
      pendingRequestsRef.current.delete(reqId);
    }

    if (history?.prices && symbol) {
      const prices = history.prices;
      let state = statesRef.current.get(symbol);
      if (state) {
        const historicalDigits = prices.map((p: any) => extractLastDigit(p));
        state.digits = historicalDigits.slice(-1000);
        state.tickCount = historicalDigits.length;
        statesRef.current.set(symbol, state);
        setTickCounts((prev) => ({ ...prev, [symbol]: state!.tickCount }));
        if (historicalDigits.length > 0) {
          setLastDigits((prev) => ({ ...prev, [symbol]: historicalDigits[historicalDigits.length - 1] }));
        }
      }
    }
  }

  function handleTickMessage(data: any) {
    const tick = data.tick;
    const symbol = tick?.symbol as string;
    const quote = tick?.quote as number;
    if (!symbol || quote === undefined) return;

    const digit = extractLastDigit(quote);
    let state = statesRef.current.get(symbol);
    if (!state) return;

    state = addTick(state, digit);
    statesRef.current.set(symbol, state);

    setTickCounts((prev) => ({ ...prev, [symbol]: state!.tickCount }));
    setLastDigits((prev) => ({ ...prev, [symbol]: digit }));

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
          const exp = expiring.find((e) => e.symbol === s.symbol && e.tickCount === s.tickCount);
          return exp ? { ...s, status: "expired" as const } : s;
        })
      );
    }

    const signal = generateSignal(state);
    if (signal) {
      state.lastSignalTick = state.tickCount;
      statesRef.current.set(symbol, state);
      const signalWithStatus: SignalWithStatus = { ...signal, status: "active" };
      activeSignalsRef.current.push(signalWithStatus);
      setSignals((prev) => [signalWithStatus, ...prev].slice(0, 50));
      saveSignal(signal);
      onSignalRef.current?.(signalWithStatus);
    }
  }

  const switchAccount = useCallback((loginid: string) => {
    if (loginid === activeLoginId) return;
    console.log(`[WebSocket] Switching to account ${loginid} — reconnecting with new OTP`);
    setActiveAccount(loginid);
    // Close and reconnect — the connect fn will fetch a new OTP for the new account
    wsRef.current?.close();
  }, [activeLoginId]);

  const disconnect = useCallback(() => {
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    if (pingTimer.current) clearInterval(pingTimer.current);
    if (watchdogTimer.current) clearInterval(watchdogTimer.current);
    wsRef.current?.close();
    wsRef.current = null;
    setConnected(false);
    setAccounts([]);
    setActiveLoginId(null);
  }, []);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    return () => { disconnect(); };
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
    getSymbolState: (symbol: string) => statesRef.current.get(symbol),
    getAllStates: () => statesRef.current,
    requestHistory: async (symbol: string, count: number = 1000) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        throw new Error("WebSocket not connected");
      }
      const reqId = `adhoc_${symbol}_${Date.now()}`;
      return new Promise<number[]>((resolve, reject) => {
        const timeout = setTimeout(() => {
          if (pendingRequestsRef.current.has(reqId)) {
            pendingRequestsRef.current.delete(reqId);
            reject(new Error("Request history timed out"));
          }
        }, 5000);

        pendingRequestsRef.current.set(reqId, (data) => {
          clearTimeout(timeout);
          if (data.error) {
            reject(new Error(data.error.message || "Unknown error fetching history"));
          } else {
            resolve(data);
          }
        });

        wsRef.current?.send(JSON.stringify({
          ticks_history: symbol,
          adjust_start_time: 1,
          count,
          end: "latest",
          start: 1,
          style: "ticks",
          req_id: reqId,
        }));
      });
    },
  };
}

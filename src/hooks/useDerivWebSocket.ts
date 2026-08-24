// Digit Bot Pro - Last Sync: 2026-05-08 (V4 API - OTP WebSocket URL Auth)
import { useCallback, useEffect, useRef, useState } from "react";
import { DERIV_SYMBOLS } from "@/lib/deriv-symbols";
import {
  type Signal,
  type SymbolState,
  addTick,
  createSymbolState,
  extractLastDigit,
  getSymbolDefaultPipSize,
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

// Authenticated Options WebSocket URLs are returned by the OTP REST endpoint.
// Fallback for unauthenticated tick-only connections.
const PUBLIC_WS_URL = "wss://api.derivws.com/trading/v1/options/ws/public";

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
  isPaid?: boolean;
  isAdmin?: boolean;
  profileLoading?: boolean;
}

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject | null {
  return value && typeof value === "object" ? (value as JsonObject) : null;
}

function getObjectValue(value: unknown, key: string): JsonObject | null {
  const obj = asObject(value);
  return obj ? asObject(obj[key]) : null;
}

function getStringValue(value: unknown, key: string): string | undefined {
  const obj = asObject(value);
  const field = obj?.[key];
  return typeof field === "string" ? field : undefined;
}

function getErrorMessageFromBody(body: unknown, fallback: string): string {
  const topLevelMessage = getStringValue(body, "message");
  const errorMessage = getStringValue(getObjectValue(body, "error"), "message");
  const errors = asObject(body)?.errors;
  const firstError = Array.isArray(errors) ? asObject(errors[0]) : null;

  return (
    topLevelMessage ||
    errorMessage ||
    getStringValue(firstError, "message") ||
    getStringValue(firstError, "code") ||
    fallback
  );
}

function extractWebSocketUrl(data: unknown): string | null {
  const nestedData = getObjectValue(data, "data");
  const wsUrl =
    getStringValue(data, "url") ||
    getStringValue(data, "websocket_url") ||
    getStringValue(data, "ws_url") ||
    getStringValue(nestedData, "url") ||
    getStringValue(nestedData, "websocket_url") ||
    getStringValue(nestedData, "ws_url");

  if (typeof wsUrl === "string" && wsUrl.startsWith("wss://")) {
    return wsUrl;
  }

  const otp = getStringValue(data, "otp") || getStringValue(nestedData, "otp");
  const accountType = getStringValue(data, "account_type") || getStringValue(nestedData, "account_type");
  if (typeof otp === "string" && otp.length > 0) {
    const endpoint = accountType === "real" ? "real" : "demo";
    return `wss://api.derivws.com/trading/v1/options/ws/${endpoint}?otp=${encodeURIComponent(otp)}`;
  }

  return null;
}

async function fetchWebSocketUrl(accessToken: string, accountId: string, appId: string): Promise<string> {
  const res = await fetch(
    `https://api.derivws.com/trading/v1/options/accounts/${accountId}/otp`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Deriv-App-ID": appId,
        "Content-Type": "application/json",
      },
    }
  );

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(getErrorMessageFromBody(body, `OTP request failed: ${res.status}`));
  }

  const data = await res.json();
  const wsUrl = extractWebSocketUrl(data);
  if (wsUrl) return wsUrl;

  throw new Error("OTP response did not include an authenticated WebSocket URL");
}

export function useDerivWebSocket({ appId, apiToken, accountId, userId, isPaid = false, isAdmin = false, profileLoading = false }: DerivWebSocketOptions = {}) {
  const wsRef = useRef<WebSocket | null>(null);
  const statesRef = useRef<Map<string, SymbolState>>(new Map());
  const pendingRequestsRef = useRef<Map<string, (data: JsonObject) => void>>(new Map());
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
  const isManualDisconnectRef = useRef(false);
  const requestIdRef = useRef(1);

  const onSignalRef = useRef<((signal: SignalWithStatus) => void) | null>(null);
  const onMessageRef = useRef<((data: JsonObject) => void) | null>(null);

  const saveSignal = useCallback(async (_signal: Signal) => { return; }, []);
  const saveResult = useCallback(async (_result: SignalResult) => { return; }, []);

  const getNextRequestId = useCallback(() => requestIdRef.current++, []);

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
        req_id: getNextRequestId(),
      }));
      // V4: subscribe to live tick stream
      ws.send(JSON.stringify({ ticks: symbol, subscribe: 1, req_id: getNextRequestId() }));
    }
  }, [getNextRequestId]);

  const connect = useCallback(async () => {
    isManualDisconnectRef.current = false;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    // Initialize symbol states
    for (const { symbol } of DERIV_SYMBOLS) {
      if (!statesRef.current.has(symbol)) {
        statesRef.current.set(symbol, createSymbolState(symbol));
      }
    }

    const accessToken = getAccessToken();
    const activeAccount = getActiveAccount();
    const sessionAccounts = getAccounts();
    let loginIdToUse = activeAccount?.loginid || accountId;

    const hasAccessToReal = isPaid || isAdmin;
    if (!profileLoading && !hasAccessToReal) {
      const demoAccount = sessionAccounts.find(a => a.is_virtual);
      if (demoAccount) {
        loginIdToUse = demoAccount.loginid;
      }
    }

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
        if (!isManualDisconnectRef.current) {
          reconnectTimer.current = setTimeout(() => connectRef.current?.(), 3000);
        }
      };
      return;
    }

    try {
      console.log(`[WebSocket] Connecting for account ${loginIdToUse}...`);
      const isLegacyToken = accessToken.startsWith("a1-") || accessToken.startsWith("v1-");
      const appIdToUse = isLegacyToken ? "117322" : (appId || DERIV_APP_ID);
      
      const { connectDerivClient } = await import("@/lib/deriv-auth");
      const { ws } = await connectDerivClient({
        appId: appIdToUse,
        token: accessToken,
        accountId: loginIdToUse,
        preferredAuthMethod: isLegacyToken ? "legacy_authorize" : "pat_otp"
      });
      
      wsRef.current = ws;

      const finishConnection = () => {
        setConnected(true);
        console.log("[WebSocket] Options WebSocket connection established (authenticated)");

        // Immediately load accounts from session storage
        const sessionAccounts = getAccounts();
        setAccounts(sessionAccounts);
        
        let loginIdToUseAfterVerification = loginIdToUse;
        const hasAccessToReal = isPaid || isAdmin;
        if (!profileLoading && !hasAccessToReal) {
          const demoAccount = sessionAccounts.find(a => a.is_virtual);
          if (demoAccount) {
            loginIdToUseAfterVerification = demoAccount.loginid;
          }
        }

        setActiveLoginId(loginIdToUseAfterVerification);
        if (activeAccount && loginIdToUseAfterVerification !== activeAccount.loginid) {
          setActiveAccount(loginIdToUseAfterVerification);
        }

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

        // Request balance for the active account
        ws.send(JSON.stringify({ balance: 1, subscribe: 1 }));
      };

      if (ws.readyState === WebSocket.OPEN) {
        finishConnection();
      } else {
        ws.onopen = finishConnection;
      }

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
        
        if (!isManualDisconnectRef.current) {
          console.log(`[WebSocket] Connection closed (code=${event.code}). Reconnecting in 3s...`);
          reconnectTimer.current = setTimeout(() => connectRef.current?.(), 3000);
        } else {
          console.log(`[WebSocket] Connection closed manually (code=${event.code}).`);
        }
      };

      ws.onerror = (err) => {
        console.error("[WebSocket] Error:", err);
        ws.close();
      };

    } catch (error: unknown) {
      console.error("[WebSocket] Connection failed:", error);
      toast.error(`Deriv connection failed: ${error instanceof Error ? error.message : String(error)}. Retrying in 5s...`);
      reconnectTimer.current = setTimeout(() => connectRef.current?.(), 5000);
    }
  }, [accountId, subscribeTicksV4]);

  // --- Message handlers (defined outside ws.onmessage to avoid stale closures) ---

  function handleHistoryMessage(data: JsonObject) {
    const reqId = data.req_id === undefined || data.req_id === null ? undefined : String(data.req_id);
    const echoReq = asObject(data.echo_req);
    const symbol = typeof echoReq?.ticks_history === "string" ? echoReq.ticks_history : undefined;
    const history = asObject(data.history);

    if (reqId && pendingRequestsRef.current.has(reqId)) {
      pendingRequestsRef.current.get(reqId)!(data);
      pendingRequestsRef.current.delete(reqId);
    }

    if (Array.isArray(history?.prices) && symbol) {
      const prices = history.prices;
      const state = statesRef.current.get(symbol);
      if (state) {
        const defaultPip = getSymbolDefaultPipSize(symbol);
        const historicalDigits = prices.map((p) => extractLastDigit(p as number | string, defaultPip));
        state.digits = historicalDigits.slice(-1000);
        state.tickCount = historicalDigits.length;
        state.updatedAt = Date.now();
        statesRef.current.set(symbol, state);
        setTickCounts((prev) => ({ ...prev, [symbol]: state!.tickCount }));
        if (historicalDigits.length > 0) {
          setLastDigits((prev) => ({ ...prev, [symbol]: historicalDigits[historicalDigits.length - 1] }));
        }
      }
    }
  }

  function handleTickMessage(data: JsonObject) {
    const tick = asObject(data.tick);
    const symbol = typeof tick?.symbol === "string" ? tick.symbol : undefined;
    const quote = typeof tick?.quote === "number" || typeof tick?.quote === "string" ? tick.quote : undefined;
    if (!symbol || quote === undefined) return;

    const pipSize = typeof tick?.pip_size === "number" ? tick.pip_size : getSymbolDefaultPipSize(symbol);
    const digit = extractLastDigit(quote, pipSize);
    let state = statesRef.current.get(symbol);
    if (!state) return;

    const numericPrice = typeof quote === "number" ? quote : parseFloat(String(quote));
    state = addTick(state, digit, isNaN(numericPrice) ? undefined : numericPrice);
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

    const targetAccount = accounts.find(a => a.loginid === loginid);
    if (targetAccount && !targetAccount.is_virtual && !isPaid && !isAdmin) {
      toast.error("Upgrade required to trade on Real account.");
      return;
    }

    console.log(`[WebSocket] Switching to account ${loginid} — reconnecting with new OTP`);
    setActiveAccount(loginid);
    setActiveLoginId(loginid);
    // Close and reconnect — the connect fn will fetch a new OTP for the new account
    wsRef.current?.close();
  }, [activeLoginId, accounts, isPaid, isAdmin]);

  const disconnect = useCallback(() => {
    isManualDisconnectRef.current = true;
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
      const reqId = getNextRequestId();
      const requestKey = String(reqId);
      return new Promise<number[]>((resolve, reject) => {
        const timeout = setTimeout(() => {
          if (pendingRequestsRef.current.has(requestKey)) {
            pendingRequestsRef.current.delete(requestKey);
            reject(new Error("Request history timed out"));
          }
        }, 5000);

        pendingRequestsRef.current.set(requestKey, (data) => {
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

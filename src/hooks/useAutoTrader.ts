import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { SignalWithStatus, DerivAccount } from "@/hooks/useDerivWebSocket";
import { toast } from "sonner";
import { useAuth } from "./useAuth";
import { getLeastFrequentDigits, extractLastDigit } from "@/lib/signal-engine";

export interface TradeRecord {
  symbol: string;
  dangerDigit: number;
  stake: number;
  contractId?: string;
  status: "pending" | "open" | "won" | "lost";
  timestamp: Date;
  payout?: number;
}

export interface AutoTraderConfig {
  enabled: boolean;
  stake: number;
  selectedSymbols: string[];
  minConfidence: number;
  useRandomDigits: boolean;
}

const MARTINGALE_FACTOR = 11;

export function useAutoTrader(
  wsRef: React.RefObject<WebSocket | null>,
  accountInfo: DerivAccount | null,
  getSymbolState: (symbol: string) => any,
  requestHistory: (symbol: string, count: number) => Promise<number[]>
) {
  const { isPaid, isAdmin, user } = useAuth();
  const [tradeLog, setTradeLog] = useState<TradeRecord[]>(() => {
    const saved = localStorage.getItem('tradeLog');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((t: any) => ({ ...t, timestamp: new Date(t.timestamp) }));
      } catch (e) {
        console.error("Error loading tradeLog from localStorage", e);
      }
    }
    return [];
  });
  const [dailyPL, setDailyPL] = useState<number>(0);
  const [avoidDigits, setAvoidDigits] = useState<Record<string, number>>({});
  const [config, setConfig] = useState<AutoTraderConfig>(() => {
    const saved = localStorage.getItem('autoTraderConfig');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error loading config from localStorage", e);
      }
    }
    return {
      enabled: false,
      stake: 0.35,
      selectedSymbols: [],
      minConfidence: 0.80,
      useRandomDigits: false,
    };
  });
  const pendingProposals = useRef<Map<string, { symbol: string; dangerDigit: number; stake: number; timestamp: number; supabaseId?: string }>>(new Map());
  const openContracts = useRef<Map<string, { symbol: string; stake: number; timestamp: number }>>(new Map());
  const activeTradeSymbols = useRef<Map<string, number>>(new Map()); // symbol -> timestamp when locked
  const settledContracts = useRef<Set<string>>(new Set());
  const lastDangerDigit = useRef<Map<string, number>>(new Map());
  const randomDigitMap = useRef<Map<string, number>>(new Map());
  const symbolStakes = useRef<Map<string, number>>(new Map());
  const symbolCooldowns = useRef<Map<string, number>>(new Map()); // symbol -> timestamp until cooldown expires
  // Track pending buy requests to map buy responses back to symbols
  const pendingBuys = useRef<Map<string, { symbol: string; supabaseId: string }>>(new Map()); // buyReqId -> {symbol, supabaseId}

  // Initialize random digits for all selected symbols that don't have one yet
  const ensureRandomDigits = useCallback(() => {
    let changed = false;
    for (const sym of config.selectedSymbols) {
      if (!randomDigitMap.current.has(sym)) {
        randomDigitMap.current.set(sym, Math.floor(Math.random() * 10));
        changed = true;
      }
    }
    if (changed) {
      setAvoidDigits((prev) => {
        const next = { ...prev };
        for (const sym of config.selectedSymbols) {
          next[sym] = randomDigitMap.current.get(sym)!;
        }
        return next;
      });
    }
  }, [config.selectedSymbols]);

  const fetchDailyPL = useCallback(async () => {
    try {
      // 1. Get current user session
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 2. Fetch the user's timezone directly from profile to avoid hook dependency
      const { data: profileData } = await supabase
        .from('profiles')
        .select('timezone')
        .eq('id', user.id)
        .single();
      
      const tz = profileData?.timezone || "UTC";

      // 3. Call the server-side aggregation RPC
      const { data, error } = await supabase.rpc('get_user_daily_pl', {
        p_user_id: user.id,
        p_timezone: tz
      });

      if (error) {
        console.error("Error fetching daily P/L:", error);
        return;
      }

      if (data !== null) {
        setDailyPL(Number(data));
      }
    } catch (err) {
      console.error("Unexpected error in fetchDailyPL:", err);
    }
  }, []);

  // 1. Initial P/L fetch and periodic sync
  useEffect(() => {
    fetchDailyPL();
    const interval = setInterval(fetchDailyPL, 60000);
    return () => clearInterval(interval);
  }, [fetchDailyPL, user?.id]);

  // 2. Local Backup: Persistence to localStorage
  useEffect(() => {
    localStorage.setItem('autoTraderConfig', JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    // Only save the last 100 trades to localStorage to keep it lightweight
    localStorage.setItem('tradeLog', JSON.stringify(tradeLog.slice(-100)));
  }, [tradeLog]);

  // 3. Cloud Sync: Backup and Retrieval from Supabase
  useEffect(() => {
    if (!user?.id) return;

    const syncConfig = async () => {
      // First, try to fetch existing config (Retrieval)
      const { data, error } = await supabase
        .from('user_configs')
        .select('config')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data?.config) {
        // Only load from cloud if it's different from current to avoid loops
        const cloudConfig = data.config as AutoTraderConfig;
        if (JSON.stringify(cloudConfig) !== JSON.stringify(config)) {
          setConfig(prev => ({ ...prev, ...cloudConfig, enabled: prev.enabled })); // Keep local enabled state
        }
      } else if (!error) {
        // If no config exists, create it (Initial Backup)
        await supabase
          .from('user_configs')
          .insert({ user_id: user.id, config });
      }
    };

    syncConfig();
  }, [user?.id]); // Only run on login to perform initial retrieval

  // 4. Background Cloud Backup: Push changes to DB
  useEffect(() => {
    if (!user?.id) return;

    const timer = setTimeout(async () => {
      await supabase
        .from('user_configs')
        .upsert({ 
          user_id: user.id, 
          config,
          updated_at: new Date().toISOString()
        });
    }, 2000); // 2 second debounce

    return () => clearTimeout(timer);
  }, [config, user?.id]);

  const placeTradeForSignal = useCallback((signal: SignalWithStatus) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (!config.enabled) return;
    if (!config.selectedSymbols.includes(signal.symbol)) return;
    if (!config.useRandomDigits && signal.confidence < config.minConfidence) return;
    if (signal.status !== "active") return;
    if (activeTradeSymbols.current.has(signal.symbol)) return;
    const now = Date.now();
    const symbolCooldown = symbolCooldowns.current.get(signal.symbol) || 0;
    if (now < symbolCooldown) return;

    // Subscription validation: Prevent real account trading for non-paid users
    if (accountInfo && !accountInfo.is_virtual) {
      if (!isPaid && !isAdmin) {
        toast.error("Real account trading requires an active subscription.", {
          description: "Please upgrade your plan to continue.",
          duration: 5000
        });
        return;
      }
    }

    let dangerDigit: number;
    let tradeStake = config.stake;

    // RULE: Fetch fresh history at point of trade to ensure zero drift
    process.env.NODE_ENV === 'development' && console.log(`[AutoTrader] Requesting fresh 1000-tick history for ${signal.symbol} before trade...`);
    const freshPrices = await requestHistory(signal.symbol, 1000);
    const freshDigits = freshPrices.map(p => extractLastDigit(p));
    
    if (freshDigits.length < 50) {
      console.warn(`[AutoTrader] Fresh history for ${signal.symbol} was insufficient (${freshDigits.length} ticks)`);
      return; 
    }

    const safeDigits = getLeastFrequentDigits(freshDigits, 4);
    if (safeDigits.length === 0) return;
    
    // Pick one randomly from the Top 4 safest digits
    dangerDigit = safeDigits[Math.floor(Math.random() * safeDigits.length)];

    // Use compounding martingale stake if symbol has a tracked stake > base
    const currentSymbolStake = symbolStakes.current.get(signal.symbol);
    if (currentSymbolStake && currentSymbolStake > config.stake) {
      tradeStake = currentSymbolStake;
    }

    lastDangerDigit.current.set(signal.symbol, dangerDigit);
    setAvoidDigits((prev) => ({ ...prev, [signal.symbol]: dangerDigit }));
    activeTradeSymbols.current.set(signal.symbol, Date.now());

    // Log the trade intent precisely as requested
    const logTrade = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data, error } = await supabase.from("trades").insert({
        user_id: user.id,
        deriv_loginid: accountInfo?.loginid || "unknown",
        symbol: signal.symbol,
        stake: tradeStake,
        barrier: dangerDigit,
        result: "pending",
        timestamp: new Date().toISOString()
      }).select("id").single();

      if (error) {
        console.error("Error logging trade to Supabase:", error);
        return null;
      }
      return data.id;
    };

    const runTradingFlow = async () => {
      const supabaseId = await logTrade();
      
      const reqId = Date.now() + Math.floor(Math.random() * 10000);
      const proposalReq = {
        proposal: 1,
        amount: tradeStake,
        basis: "stake",
        contract_type: "DIGITDIFF",
        currency: "USD",
        duration: 1,
        duration_unit: "t",
        symbol: signal.symbol,
        barrier: String(dangerDigit),
        req_id: reqId,
      };

      pendingProposals.current.set(String(reqId), {
        symbol: signal.symbol,
        dangerDigit,
        stake: tradeStake,
        timestamp: Date.now(),
        supabaseId: supabaseId || undefined
      });

      ws.send(JSON.stringify(proposalReq));
    };

    runTradingFlow();
  }, [config, wsRef, ensureRandomDigits, accountInfo, isAdmin, isPaid]);

  // Effect to keep avoidDigits in sync with selection and random mode
  useEffect(() => {
    if (config.useRandomDigits) {
      ensureRandomDigits();
    } else {
      // Clear random digits if we switch back to signal mode
      setAvoidDigits({});
      randomDigitMap.current.clear();
      lastDangerDigit.current.clear();
    }
  }, [config.useRandomDigits, config.selectedSymbols, ensureRandomDigits]);

  const handleTradeMessage = useCallback((data: any) => {
    // Handle proposal response
    if (data.msg_type === "proposal" && data.proposal) {
      const reqId = String(data.req_id);
      const pending = pendingProposals.current.get(reqId);
      if (!pending) return;
      pendingProposals.current.delete(reqId);

      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        activeTradeSymbols.current.delete(pending.symbol);
        return;
      }

      const buyReqId = Date.now() + Math.floor(Math.random() * 10000);
      pendingBuys.current.set(String(buyReqId), { 
        symbol: pending.symbol, 
        supabaseId: pending.supabaseId || "" 
      });
      ws.send(JSON.stringify({
        buy: data.proposal.id,
        price: pending.stake + 10,
        req_id: buyReqId,
      }));

      const record: TradeRecord = {
        symbol: pending.symbol,
        dangerDigit: pending.dangerDigit,
        stake: pending.stake,
        status: "pending",
        timestamp: new Date(),
      };
      setTradeLog((prev) => [record, ...prev]);
    }

    // Handle buy response
    if (data.msg_type === "buy" && data.buy) {
      const contractId = String(data.buy.contract_id);
      const buyReqId = String(data.req_id);
      const buyData = pendingBuys.current.get(buyReqId);
      pendingBuys.current.delete(buyReqId);
      
      const symbol = buyData?.symbol || data.buy.shortcode?.split?.("_")?.[1] || "";
      const buyPrice = data.buy.buy_price ?? config.stake;

      // Update Supabase trade record with contract_id
      if (buyData?.supabaseId) {
        supabase.from("trades")
          .update({ contract_id: contractId })
          .eq("id", buyData.supabaseId)
          .then(({ error }) => {
            if (error) console.error("Error linking contract_id to trade:", error);
          });
      }

      openContracts.current.set(contractId, { symbol, stake: buyPrice, timestamp: Date.now() });

      setTradeLog((prev) => {
        const updated = [...prev];
        const pendingIdx = updated.findIndex((t) => t.status === "pending" && (t.symbol === symbol || symbol === ""));
        if (pendingIdx >= 0) {
          updated[pendingIdx] = { ...updated[pendingIdx], contractId, status: "open" };
        } else {
          updated.unshift({
            symbol,
            dangerDigit: 0,
            stake: buyPrice,
            contractId,
            status: "open",
            timestamp: new Date(),
          });
        }
        return updated;
      });

      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          proposal_open_contract: 1,
          contract_id: contractId,
          subscribe: 1,
        }));
      }

      toast.info(`Trade placed on ${symbol}`, { duration: 3000 });
    }

    // Handle buy error
    if (data.msg_type === "buy" && data.error) {
      const buyReqId = String(data.req_id);
      const trackedSymbol = pendingBuys.current.get(buyReqId);
      pendingBuys.current.delete(buyReqId);
      
      if (trackedSymbol) {
        activeTradeSymbols.current.delete(trackedSymbol);
      }
      
      toast.error(`Trade failed: ${data.error.message}`);
      setTradeLog((prev) => {
        const updated = [...prev];
        const pendingIdx = updated.findIndex((t) => t.status === "pending" && (!trackedSymbol || t.symbol === trackedSymbol));
        if (pendingIdx >= 0) {
          activeTradeSymbols.current.delete(updated[pendingIdx].symbol);
          updated[pendingIdx] = { ...updated[pendingIdx], status: "lost" };
        }
        return updated;
      });
    }

    // Handle proposal error
    if (data.msg_type === "proposal" && data.error) {
      const reqId = String(data.req_id);
      const pending = pendingProposals.current.get(reqId);
      if (pending) {
        activeTradeSymbols.current.delete(pending.symbol);
        pendingProposals.current.delete(reqId);
        toast.error(`Proposal failed for ${pending.symbol}: ${data.error.message}`);
      }
    }

    // Handle contract updates (proposal_open_contract)
    if (data.msg_type === "proposal_open_contract" && data.proposal_open_contract) {
      const poc = data.proposal_open_contract;
      const contractId = String(poc.contract_id);

      if (poc.is_sold || poc.is_expired) {
        // Prevent double-processing the same contract
        if (settledContracts.current.has(contractId)) return;
        settledContracts.current.add(contractId);

        const isWin = (poc.profit ?? 0) > 0;
        const symbol = poc.underlying || "";
        const profit = Number(poc.profit) || 0;

        activeTradeSymbols.current.delete(symbol);

        // Update Supabase with final result
        supabase.from("trades")
          .update({
            result: isWin ? "won" : "lost",
            profit_loss: profit
          })
          .eq("contract_id", contractId)
          .then(({ error }) => {
            if (error) {
              console.error("Error settling trade in Supabase:", error);
            } else {
              // Update local daily P/L state
              setDailyPL(prev => prev + profit);
            }
          });

        setTradeLog((prev) =>
          prev.map((t) =>
            t.contractId === contractId
              ? { ...t, status: isWin ? "won" : "lost", payout: poc.payout }
              : t
          )
        );
        openContracts.current.delete(contractId);

        if (isWin) {
          // On win, reset stake for this symbol back to base
          symbolStakes.current.delete(symbol);
          toast.success(`Won on ${symbol}! Payout: ${poc.payout}`, { duration: 4000 });
        } else {
          // On loss: compound martingale (last stake * factor)
          const lastStake = symbolStakes.current.get(symbol) || config.stake;
          const nextStake = lastStake * MARTINGALE_FACTOR;
          symbolStakes.current.set(symbol, nextStake);
          toast.error(`Lost on ${symbol}`, { duration: 4000 });

          // Cooldown on every loss: random 2-8 seconds
          const pauseMs = Math.floor(Math.random() * 6001) + 2000;
          symbolCooldowns.current.set(symbol, Date.now() + pauseMs);
          toast.warning(`${symbol} loss detected — pausing this index for ${(pauseMs / 1000).toFixed(1)}s`, { duration: 4000 });
        }

        // In random mode: ALWAYS regenerate digit for symbol after any trade (win or loss)
        if (config.useRandomDigits) {
          const newDigit = Math.floor(Math.random() * 10);
          randomDigitMap.current.set(symbol, newDigit);
          setAvoidDigits((prev) => ({ ...prev, [symbol]: newDigit }));
          if (isWin) {
            toast.info(`Rotated avoid digit for ${symbol}: ${newDigit}`, { duration: 2000 });
          } else {
            const nextStake = symbolStakes.current.get(symbol) || config.stake;
            toast.warning(`Regenerated avoid digit for ${symbol}: ${newDigit}, next stake: $${nextStake.toFixed(2)}`, { duration: 5000 });
          }
        }
      }
    }
  }, [config.stake, config.useRandomDigits, wsRef]);
  // Periodically attempt to settle pending/open trades
  useEffect(() => {
    if (!config.enabled) return;

    const interval = setInterval(() => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      const now = Date.now();

      // Timeout stale pending proposals (older than 15s)
      for (const [reqId, pending] of pendingProposals.current.entries()) {
        if (now - pending.timestamp > 15000) {
          pendingProposals.current.delete(reqId);
          activeTradeSymbols.current.delete(pending.symbol);
          setTradeLog((prev) =>
            prev.map((t) =>
              t.status === "pending" && t.symbol === pending.symbol
                ? { ...t, status: "lost" }
                : t
            )
          );
        }
      }

      // Re-request status for open contracts that haven't settled (older than 10s)
      for (const [contractId, contract] of openContracts.current.entries()) {
        if (settledContracts.current.has(contractId)) continue;
        if (now - contract.timestamp > 10000) {
          ws.send(JSON.stringify({
            proposal_open_contract: 1,
            contract_id: contractId,
            subscribe: 1,
          }));
          contract.timestamp = now;
        }
        // Force-release contracts stuck for over 60s
        if (now - contract.timestamp > 60000) {
          activeTradeSymbols.current.delete(contract.symbol);
          openContracts.current.delete(contractId);
        }
      }

      // Safety valve: release any symbol locked for more than 30s with no matching open contract
      for (const [symbol, lockedAt] of activeTradeSymbols.current.entries()) {
        if (now - lockedAt > 30000) {
          const hasOpenContract = Array.from(openContracts.current.values()).some((c) => c.symbol === symbol);
          if (!hasOpenContract) {
            activeTradeSymbols.current.delete(symbol);
          }
        }
      }

      // Prevent settledContracts memory leak — prune entries older than 5 minutes
      if (settledContracts.current.size > 500) {
        settledContracts.current.clear();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [config.enabled, wsRef]);

  const resetTradeLog = useCallback(() => {
    setTradeLog([]);
  }, []);

  return {
    config,
    setConfig,
    tradeLog,
    setTradeLog,
    dailyPL,
    resetTradeLog,
    avoidDigits,
    placeTradeForSignal,
    handleTradeMessage,
  };
}

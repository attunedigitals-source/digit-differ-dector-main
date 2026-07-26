import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { DerivAccount } from "@/hooks/useDerivWebSocket";
import { toast } from "sonner";
import { useAuth } from "./useAuth";
import { type SymbolState, generateSignal } from "@/lib/signal-engine";
import { getNextArrangement, lcgPermute, getNthPermutation, directionToDetails, getPermutationIndex, getRandomSequenceWithPrefix, isPrefixBlacklisted } from "../lib/arrangement-brain";

import { type TradeRecord, type AutoTraderConfig } from "./trading-types";

const MARTINGALE_MULTIPLIER = 1.8;
const RECOVERY_MARTINGALE_MULTIPLIER = 11.43;
const MAX_TICK_AGE_MS = 10000;
const MAX_BLACKLIST_SIZE = 50;
const DEFAULT_COOLDOWN_INTERVAL_MINUTES: AutoTraderConfig["cooldownIntervalMinutes"] = 30;
const COOLDOWN_INTERVAL_OPTIONS: ReadonlyArray<AutoTraderConfig["cooldownIntervalMinutes"]> = [30, 40, 50, 60];
const COOLDOWN_WAIT_MIN_SECONDS = 300;
const COOLDOWN_WAIT_MAX_SECONDS = 480;
const WIN_TRADE_COOLDOWN_MIN_TICKS = 1;
const WIN_TRADE_COOLDOWN_MAX_TICKS = 3;
const LOSS_TRADE_COOLDOWN_MIN_TICKS = 1;
const LOSS_TRADE_COOLDOWN_MAX_TICKS = 3;
export type TradeCategory = "under4" | "over4" | "under5" | "over5" | "over0" | "under9" | "even" | "odd" | "rise" | "fall" | "over2" | "under7" | "over1" | "under8";

export const STRATEGY_DIRECTIONS: Record<string, TradeCategory[]> = {
  strategy_a: ["under4", "over4", "under5", "over5"],
  strategy_b: ["under4", "over4", "under5", "over5"],
  strategy_c: ["under4", "over4", "under5", "over5", "even", "odd"],
  strategy_d: ["under4", "over4", "under5", "over5", "even", "odd", "rise", "fall"],
  strategy_e: ["under4", "over4", "under5", "over5"],
  strategy_f: ["under4", "over4", "under5", "over5"],
  strategy_g: ["under4", "over4", "under5", "over5"],
  strategy_h: ["under4", "over5", "even", "under5", "over4", "odd"],
  strategy_i: ["under4", "over4", "under5", "over5", "even", "odd"],
  strategy_j: ["under4", "over5", "even", "rise", "under5", "over4", "fall", "odd"],
  strategy_k: ["under4", "over4", "under5", "over5", "even", "odd", "rise", "fall"],
  strategy_l: ["over2", "under7"],
  strategy_m: ["under4", "over4", "under5", "over5", "even", "odd", "rise", "fall"],
  strategy_o: ["over2", "under7", "over1", "under8"],
  strategy_p: ["over1", "under8", "over5", "under4"],
  strategy_q: ["under4", "over4", "under5", "over5", "even", "odd", "rise", "fall"],
  strategy_r: ["over1", "under8", "even", "odd", "rise", "fall"],
  alternating: ["under4", "over4", "under5", "over5"]
};

const STRATEGY_O_STAKES = [1.40, 6.65, 37.15, 207.57, 1159.72, 6479.77, 36203.71];

export const categoryToCode = (cat: TradeCategory): string => {
  if (cat === "under4") return "U4";
  if (cat === "over4") return "O4";
  if (cat === "under5") return "U5";
  if (cat === "over5") return "O5";
  if (cat === "even") return "EV";
  if (cat === "odd") return "OD";
  if (cat === "rise") return "RISE";
  if (cat === "fall") return "FALL";
  if (cat === "over0") return "O0";
  if (cat === "under9") return "U9";
  if (cat === "over2") return "O2";
  if (cat === "under7") return "U7";
  if (cat === "over1") return "O1";
  if (cat === "under8") return "U8";
  return cat;
};

export const codeToCategory = (code: string): TradeCategory => {
  if (code === "U4") return "under4";
  if (code === "O4") return "over4";
  if (code === "U5") return "under5";
  if (code === "O5") return "over5";
  if (code === "EV") return "even";
  if (code === "OD") return "odd";
  if (code === "RISE") return "rise";
  if (code === "FALL") return "fall";
  if (code === "O0") return "over0";
  if (code === "U9") return "under9";
  if (code === "O2") return "over2";
  if (code === "U7") return "under7";
  if (code === "O1") return "over1";
  if (code === "U8") return "under8";
  return code as TradeCategory;
};

export function resolveNextDirection(
  trade: TradeCategory,
  nextStep: number,
  currentLossSequence: string[] | undefined,
  strategy: string,
  currentArrangement: string[] | undefined,
  sequenceStep: number,
  strategyPool: TradeCategory[],
  blacklistedPrefixes?: Record<string, string[]>
): { trade: TradeCategory; currentArrangement?: string[] } {
  if (strategy === "strategy_o" || strategy === "strategy_p" || strategy === "strategy_r") {
    return { trade };
  }

  if (strategy === "strategy_k" || strategy === "strategy_m") {
    if (nextStep < 5 || !currentLossSequence || currentLossSequence.length < 5) {
      return { trade };
    }

    const globalBlacklist = blacklistedPrefixes?.["global"] || [];
    const currentFirst5 = currentLossSequence.slice(0, 5);

    const matches = globalBlacklist.filter(entry => {
      const parts = entry.split(",");
      if (parts.length < 5) return false;
      for (let i = 0; i < 5; i++) {
        if (parts[i] !== currentFirst5[i]) return false;
      }
      return true;
    });

    if (matches.length === 0) {
      return { trade };
    }

    const appearedCodes = new Set<string>();
    matches.forEach(entry => {
      const parts = entry.split(",");
      if (parts.length > nextStep) {
        appearedCodes.add(parts[nextStep]);
      }
    });

    const pool: TradeCategory[] = ["under4", "over4", "under5", "over5", "even", "odd", "rise", "fall"];
    let selectedTrade: TradeCategory;

    if (appearedCodes.size === 0) {
      selectedTrade = pool[Math.floor(Math.random() * pool.length)];
    } else {
      const availablePool = pool.filter(cat => !appearedCodes.has(categoryToCode(cat)));
      if (availablePool.length > 0) {
        selectedTrade = availablePool[Math.floor(Math.random() * availablePool.length)];
      } else {
        selectedTrade = pool[Math.floor(Math.random() * pool.length)];
      }
    }

    const currentArr = currentArrangement ? [...currentArrangement] : [];
    if (currentArr.length > sequenceStep) {
      currentArr[sequenceStep] = categoryToCode(selectedTrade);
    }

    return {
      trade: selectedTrade,
      currentArrangement: currentArr
    };
  }

  if (nextStep < 5 || !currentLossSequence || currentLossSequence.length === 0) {
    return { trade };
  }

  const lossSeq = currentLossSequence.map(codeToCategory);
  if (!lossSeq.includes(trade)) {
    return { trade };
  }

  // If we are using an arrangement-based strategy, try to swap with a future element in the arrangement
  if (["strategy_a", "strategy_b", "strategy_c", "strategy_d", "strategy_e", "strategy_f", "strategy_g"].includes(strategy)) {
    const currentArr = currentArrangement ? [...currentArrangement] : [];
    
    for (let j = sequenceStep + 1; j < currentArr.length; j++) {
      const nextCode = currentArr[j];
      const candidateTrade = codeToCategory(nextCode);
      
      if (!lossSeq.includes(candidateTrade)) {
        // Swap elements
        const temp = currentArr[sequenceStep];
        currentArr[sequenceStep] = currentArr[j];
        currentArr[j] = temp;
        
        return {
          trade: candidateTrade,
          currentArrangement: currentArr
        };
      }
    }
  }

  // Fallback / non-arrangement strategies: filter pool
  const availableDirections = strategyPool.filter(d => !lossSeq.includes(d));
  if (availableDirections.length > 0) {
    return {
      trade: availableDirections[Math.floor(Math.random() * availableDirections.length)]
    };
  }

  // If all allowed directions are in the loss sequence, at least avoid the immediately preceding one
  const lastLoss = lossSeq[lossSeq.length - 1];
  const backupDirections = strategyPool.filter(d => d !== lastLoss);
  if (backupDirections.length > 0) {
    return {
      trade: backupDirections[Math.floor(Math.random() * backupDirections.length)]
    };
  }

  return {
    trade: strategyPool[Math.floor(Math.random() * strategyPool.length)]
  };
}

interface SymbolStatus {
  lastGroup: "NORMAL" | "SPECIAL" | null;
}

export interface VolatilityTracking {
  consecutiveLosses: number;
  pendingSuspension: boolean;
  suspendedUntil: number | null;
  pureConsecutiveLosses?: number;
}


const getCategoryGroup = (cat: TradeCategory): "NORMAL" | "SPECIAL" => {
  if (cat === "under4" || cat === "over5") return "NORMAL";
  return "SPECIAL";
};

const getLocalDayString = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getFibonacci = (k: number): bigint => {
  if (k <= 0) return 0n;
  if (k === 1) return 1n;
  let a = 0n;
  let b = 1n;
  for (let i = 2; i <= k; i++) {
    const temp = a + b;
    a = b;
    b = temp;
  }
  return b;
};

const getGeneralizedFibonacci = (a: number, b: number, n: number, prime: bigint = 1000000007n): bigint => {
  if (n <= 0) return BigInt(a) % prime;
  if (n === 1) return BigInt(b) % prime;
  let prev2 = BigInt(a) % prime;
  let prev1 = BigInt(b) % prime;
  for (let i = 2; i <= n; i++) {
    const temp = (prev2 + prev1) % prime;
    prev2 = prev1;
    prev1 = temp;
  }
  return prev1;
};


const selectUnusedFibonacciIndex = (used: number[]): number => {
  const usedSet = new Set(used || []);
  const candidates: number[] = [];
  for (let i = 0; i <= 10000; i++) {
    if (!usedSet.has(i)) {
      candidates.push(i);
    }
  }
  if (candidates.length === 0) {
    console.log("[Strategy H] All 10001 starting indices exhausted! Resetting used list.");
    return Math.floor(Math.random() * 10001);
  }
  return candidates[Math.floor(Math.random() * candidates.length)];
};


const sanitizeConfig = (incoming: Partial<AutoTraderConfig> | null | undefined): AutoTraderConfig => {
  const baseStake = Math.max(0.35, Number(incoming?.baseStake ?? 0.35));
  const maxMartingaleSteps = Math.max(1, Number(incoming?.maxMartingaleSteps ?? 12));
  const rawCooldownMinutes = Number(incoming?.cooldownIntervalMinutes ?? DEFAULT_COOLDOWN_INTERVAL_MINUTES);
  const cooldownIntervalMinutes = COOLDOWN_INTERVAL_OPTIONS.includes(rawCooldownMinutes as AutoTraderConfig["cooldownIntervalMinutes"])
    ? (rawCooldownMinutes as AutoTraderConfig["cooldownIntervalMinutes"])
    : DEFAULT_COOLDOWN_INTERVAL_MINUTES;

  const strategyLBaseStake = incoming?.strategyLBaseStake !== undefined ? Math.max(0.35, Number(incoming.strategyLBaseStake)) : undefined;
  const strategyMBaseStake = incoming?.strategyMBaseStake !== undefined ? Math.max(0.35, Number(incoming.strategyMBaseStake)) : undefined;
  const strategyOBaseStake = incoming?.strategyOBaseStake !== undefined ? Math.max(0.35, Number(incoming.strategyOBaseStake)) : undefined;
  const strategyPBaseStake = incoming?.strategyPBaseStake !== undefined ? Math.max(0.35, Number(incoming.strategyPBaseStake)) : undefined;
  const strategyRBaseStake = incoming?.strategyRBaseStake !== undefined ? Math.max(0.35, Number(incoming.strategyRBaseStake)) : undefined;
  const strategyRStickyEnabled = incoming?.strategyRStickyEnabled !== undefined ? Boolean(incoming.strategyRStickyEnabled) : undefined;
  const initialBalance = incoming?.initialBalance !== undefined ? Math.max(0, Number(incoming.initialBalance)) : undefined;
  const allowableLoss = incoming?.allowableLoss !== undefined ? Math.max(0, Number(incoming.allowableLoss)) : undefined;
  const targetProfit = incoming?.targetProfit !== undefined ? Math.max(0, Number(incoming.targetProfit)) : undefined;

  return {
    enabled: Boolean(incoming?.enabled),
    baseStake,
    maxMartingaleSteps,
    cooldownIntervalMinutes,
    strategy: (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') ? (incoming?.strategy || "strategy_r") : "strategy_r",
    strategyLBaseStake,
    strategyMBaseStake,
    strategyOBaseStake,
    strategyPBaseStake,
    strategyRBaseStake,
    strategyRStickyEnabled,
    initialBalance,
    allowableLoss,
    targetProfit,
  };
};

export function useAutoTrader(
  wsRef: React.RefObject<WebSocket | null>,
  accountInfo: DerivAccount | null,
  connected: boolean,
  getSymbolState: (symbol: string) => SymbolState | undefined
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
  const [sessionPL, setSessionPL] = useState<number>(() => {
    const saved = localStorage.getItem('sessionPL');
    return saved ? parseFloat(saved) : 0;
  });

  useEffect(() => {
    localStorage.setItem('sessionPL', String(sessionPL));
  }, [sessionPL]);

  const resetSessionPL = useCallback(() => {
    setSessionPL(0);
  }, []);
  const [dailyStats, setDailyStats] = useState({ total_trades: 0, wins: 0 });
  const [ticksToWait, setTicksToWait] = useState(0);
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
      maxMartingaleSteps: 12,
      cooldownIntervalMinutes: DEFAULT_COOLDOWN_INTERVAL_MINUTES,
      strategy: "strategy_r",
    });
  });

  const [sessionState, setSessionState] = useState(() => {
    const savedProgress = localStorage.getItem('arrangementProgressIndex');
    const savedSeed = localStorage.getItem('shufflingSeed');
    const savedArrIndex = localStorage.getItem('currentArrangementIndex');
    const savedArr = localStorage.getItem('currentArrangement');
    const savedSeqStep = localStorage.getItem('sequenceStep');
    const savedMartStep = localStorage.getItem('martingaleStep');
    const savedStake = localStorage.getItem('currentStake');
    const savedStatus = localStorage.getItem('sessionStatus');
    const savedSymbol = localStorage.getItem('currentSymbol');
    const savedCategory = localStorage.getItem('currentCategory') as TradeCategory | null;
    const savedSymbolLosses = localStorage.getItem('currentSymbolLosses');
    const savedForceSwap = localStorage.getItem('forceSwapSymbol');
    const savedBlacklist = localStorage.getItem('blacklistedPrefixes');
    const savedFibIndex = localStorage.getItem('fibonacciIndex');
    const savedUsedIndices = localStorage.getItem('usedStartIndices');
    const savedJStartA = localStorage.getItem('strategyJ_fibStartA');
    const savedJStartB = localStorage.getItem('strategyJ_fibStartB');
    const savedJStep = localStorage.getItem('strategyJ_fibStep');
    const savedLossSeq = localStorage.getItem('currentLossSequence');
    const savedLMode = localStorage.getItem('strategyLMode') as "loss_sticky" | "win_sticky" | "none_sticky" | null;
    const savedLNoneStickyCount = localStorage.getItem('strategyLNoneStickyCount');
    let lNoneStickyCount: number | undefined = undefined;
    if (savedLNoneStickyCount) {
      const parsed = parseInt(savedLNoneStickyCount, 10);
      if (!isNaN(parsed)) {
        lNoneStickyCount = parsed;
      }
    }
    const savedNActiveSub = localStorage.getItem('strategyNActiveSub') as "strategy_l" | "strategy_m" | null;
    const savedNNextSwitchTime = localStorage.getItem('strategyNNextSwitchTime');
    const savedOSeqBase = localStorage.getItem('strategyOSequenceBaseStake');
    const savedPSeqBase = localStorage.getItem('strategyPSequenceBaseStake');
    const savedPAccumLoss = localStorage.getItem('strategyPAccumulatedLoss');
    const savedRSeqBase = localStorage.getItem('strategyRSequenceBaseStake');
    const savedRAccumLoss = localStorage.getItem('strategyRAccumulatedLoss');
    const savedRMode = localStorage.getItem('strategyRMode') as "win_sticky" | "none_sticky" | "loss_sticky" | null;
    const savedRModeCount = localStorage.getItem('strategyRModeCount');
    let rModeCount: number | undefined = undefined;
    if (savedRModeCount) {
      const parsed = parseInt(savedRModeCount, 10);
      if (!isNaN(parsed)) {
        rModeCount = parsed;
      }
    }
    const savedQActiveSub = localStorage.getItem('strategyQActiveSub') as "strategy_a" | "strategy_b" | "strategy_c" | "strategy_d" | null;
    const savedQRemainingRuns = localStorage.getItem('strategyQRemainingRuns');
    let qRemainingRuns: number | undefined = undefined;
    if (savedQRemainingRuns) {
      const parsed = parseInt(savedQRemainingRuns, 10);
      if (!isNaN(parsed)) {
        qRemainingRuns = parsed;
      }
    }
    const savedQLastSub = localStorage.getItem('strategyQLastSub') as "strategy_a" | "strategy_b" | "strategy_c" | "strategy_d" | null;
    let lossSeq: string[] = [];
    if (savedLossSeq) {
      try {
        lossSeq = JSON.parse(savedLossSeq);
      } catch (e) {}
    }
    let usedIndices: number[] = [];
    if (savedUsedIndices) {
      try {
        const parsed = JSON.parse(savedUsedIndices);
        if (Array.isArray(parsed)) {
          usedIndices = parsed.map(Number).filter(n => !isNaN(n));
        }
      } catch (e) {}
    }

    const symbols = [
      "1HZ10V", "1HZ25V", "1HZ50V", "1HZ75V", "1HZ100V",
      "R_10", "R_25", "R_50", "R_75", "R_100",
    ];
    let blacklist: Record<string, string[]> = {};
    symbols.forEach(s => blacklist[s] = []);
    blacklist["global"] = [];

    if (savedBlacklist) {
      try {
        const parsed = JSON.parse(savedBlacklist);
        if (parsed && typeof parsed === 'object') {
          if (Array.isArray(parsed)) {
            symbols.forEach(s => blacklist[s] = [...parsed]);
          } else {
            symbols.forEach(s => {
              if (Array.isArray(parsed[s])) {
                blacklist[s] = parsed[s];
              }
            });
            if (Array.isArray(parsed["global"])) {
              blacklist["global"] = parsed["global"];
            }
          }
        }
      } catch (e) {}
    }

    let progress = savedProgress ? parseInt(savedProgress) : 0;
    const seed = savedSeed ? parseInt(savedSeed) : Math.floor(Math.random() * 100000) + 1;
    
    let arrIndex = savedArrIndex ? parseInt(savedArrIndex) : 0;
    let arr: string[] = [];
    if (savedArr) {
      try {
        arr = JSON.parse(savedArr);
      } catch (e) {}
    }
    
    if (arr.length === 0 || arrIndex === 0) {
      let elements = ['U4', 'O4', 'U5', 'O5'];
      let counts = [3, 3, 3, 3];
      let totalArrangements = 369600;
      
      const savedConfig = localStorage.getItem('autoTraderConfig');
      let isStrategyC = false;
      let isStrategyD = false;
      let isStrategyF = false;
      let isStrategyG = false;
      let isStrategyK = false;
      let isStrategyM = false;
      if (savedConfig) {
        try {
          const parsed = JSON.parse(savedConfig);
          isStrategyC = parsed.strategy === "strategy_c";
          isStrategyD = parsed.strategy === "strategy_d";
          isStrategyF = parsed.strategy === "strategy_f";
          isStrategyG = parsed.strategy === "strategy_g";
          isStrategyK = parsed.strategy === "strategy_k";
          isStrategyM = parsed.strategy === "strategy_m";
        } catch (e) {}
      }

      if (isStrategyC) {
        elements = ['U4', 'O4', 'U5', 'O5', 'EV', 'OD'];
        counts = [2, 2, 2, 2, 2, 2];
        totalArrangements = 7484400;
      } else if (isStrategyD) {
        elements = ['U4', 'O4', 'U5', 'O5', 'EV', 'OD', 'RISE', 'FALL'];
        counts = [2, 2, 2, 2, 1, 1, 1, 1];
        totalArrangements = 29937600;
      } else if (isStrategyK || isStrategyM) {
        elements = ['U4', 'O4', 'U5', 'O5', 'EV', 'OD', 'RISE', 'FALL'];
        counts = [1, 1, 1, 1, 1, 1, 1, 1];
        totalArrangements = 40320;
      }

      if (isStrategyF || isStrategyG || isStrategyK || isStrategyM) {
        let tempProgress = progress;
        while (true) {
          const permIndex = lcgPermute(tempProgress, totalArrangements, seed);
          const tempArrIndex = permIndex + 1;
          const tempArr = getNthPermutation(elements, counts, tempArrIndex);
          
          const isBlacklistedGlobally = isPrefixBlacklisted(tempArr, blacklist["global"] || []);
          
          const hasValidSymbol = isBlacklistedGlobally ? false : (
            (isStrategyG || isStrategyK || isStrategyM) ? true : symbols.some(s => {
              const symbolBlacklist = blacklist[s] || [];
              return !isPrefixBlacklisted(tempArr, symbolBlacklist);
            })
          );

          if (hasValidSymbol) {
            arrIndex = tempArrIndex;
            arr = tempArr;
            progress = tempProgress;
            break;
          }
          tempProgress = (tempProgress + 1) % totalArrangements;
        }
      } else {
        const permIndex = lcgPermute(progress, totalArrangements, seed);
        arrIndex = permIndex + 1;
        arr = getNthPermutation(elements, counts, arrIndex);
      }
      
      localStorage.setItem('arrangementProgressIndex', String(progress));
      localStorage.setItem('shufflingSeed', String(seed));
      localStorage.setItem('currentArrangementIndex', String(arrIndex));
      localStorage.setItem('currentArrangement', JSON.stringify(arr));
    }

    return {
      currentStake: savedStake ? parseFloat(savedStake) : 0.35,
      martingaleStep: savedMartStep ? parseInt(savedMartStep) : 0,
      sequenceStep: savedSeqStep ? parseInt(savedSeqStep) : 0,
      initialChoice: "DIGITOVER" as "DIGITOVER" | "DIGITUNDER" | "DIGITEVEN" | "DIGITODD" | "CALLE" | "PUTE",
      currentSymbol: savedSymbol || "",
      currentContract: "DIGITOVER" as "DIGITOVER" | "DIGITUNDER" | "DIGITEVEN" | "DIGITODD" | "CALLE" | "PUTE",
      currentBarrier: 5,
      status: (savedStatus as any) || "IDLE" as "IDLE" | "WIN" | "LOSS" | "SKIP" | "PENDING",
      nextAction: "IDLE_RDY",
      currentCategory: savedCategory,
      
      currentArrangementIndex: arrIndex,
      currentArrangement: arr,
      arrangementProgressIndex: progress,
      shufflingSeed: seed,
      currentSymbolLosses: savedSymbolLosses ? parseInt(savedSymbolLosses) : 0,
      forceSwapSymbol: savedForceSwap ? savedForceSwap === 'true' : false,
      blacklistedPrefixes: blacklist,
      fibonacciIndex: savedFibIndex ? parseInt(savedFibIndex) : -1,
      usedStartIndices: usedIndices,
      strategyJ_fibStartA: savedJStartA ? parseInt(savedJStartA) : -1,
      strategyJ_fibStartB: savedJStartB ? parseInt(savedJStartB) : -1,
      strategyJ_fibStep: savedJStep ? parseInt(savedJStep) : -1,
      currentLossSequence: lossSeq,
      strategyLMode: savedLMode || undefined,
      strategyLNoneStickyCount: lNoneStickyCount,
      strategyNActiveSub: savedNActiveSub || undefined,
      strategyNNextSwitchTime: savedNNextSwitchTime ? parseInt(savedNNextSwitchTime) : undefined,
      strategyOSequenceBaseStake: savedOSeqBase ? parseFloat(savedOSeqBase) : undefined,
      strategyPSequenceBaseStake: savedPSeqBase ? parseFloat(savedPSeqBase) : undefined,
      strategyPAccumulatedLoss: savedPAccumLoss ? parseFloat(savedPAccumLoss) : undefined,
      strategyRSequenceBaseStake: savedRSeqBase ? parseFloat(savedRSeqBase) : undefined,
      strategyRAccumulatedLoss: savedRAccumLoss ? parseFloat(savedRAccumLoss) : undefined,
      strategyRMode: savedRMode || undefined,
      strategyRModeCount: rModeCount,
      strategyQActiveSub: savedQActiveSub || undefined,
      strategyQRemainingRuns: qRemainingRuns,
      strategyQLastSub: savedQLastSub || undefined,
    };
  });

  const [volatilityTracking, setVolatilityTracking] = useState<Record<string, VolatilityTracking>>(() => {
    const saved = localStorage.getItem('volatilityTracking');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error loading volatilityTracking from localStorage", e);
      }
    }
    const initial: Record<string, VolatilityTracking> = {};
    const symbols = [
      "1HZ10V", "1HZ25V", "1HZ50V", "1HZ75V", "1HZ100V",
      "R_10", "R_25", "R_50", "R_75", "R_100",
    ];
    symbols.forEach(s => {
      initial[s] = { consecutiveLosses: 0, pendingSuspension: false, suspendedUntil: null, pureConsecutiveLosses: 0 };
    });
    return initial;
  });

  useEffect(() => {
    localStorage.setItem('volatilityTracking', JSON.stringify(volatilityTracking));
  }, [volatilityTracking]);

  const [martingaleCycles, setMartingaleCycles] = useState(0);
  const [windDownMode, setWindDownMode] = useState(false);
  const [continuousTradeStartAt, setContinuousTradeStartAt] = useState<number | null>(null);
  const continuousTradeStartAtRef = useRef<number | null>(null);

  const executionStartedAtRef = useRef<number>(0);
  const enabledRef = useRef<boolean>(config.enabled);
  const lastManualActionRef = useRef<number>(0);

  // Keep enabledRef in sync with config.enabled
  useEffect(() => {
    enabledRef.current = config.enabled;
  }, [config.enabled]);

  const sessionPLRef = useRef(sessionPL);
  useEffect(() => {
    sessionPLRef.current = sessionPL;
  }, [sessionPL]);


  const requestContractStatus = useCallback((contractId: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    console.log(`[AutoTrader] Polling status for contract ${contractId}`);
    ws.send(JSON.stringify({ proposal_open_contract: 1, contract_id: contractId }));
    return true;
  }, [wsRef]);

  // Watchdog: monitor and resolve stuck execution
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();

      // Poll open contracts that haven't settled within 30s
      openContracts.current.forEach((contract, id) => {
        if (now - contract.timestamp > 30000) {
          console.log(`[AutoTrader] Stale open contract ${id} detection - requesting refresh`);
          requestContractStatus(id);
        }
      });

      // Safety check for stuck execution lock (no pending/open contracts but lock is on)
      if (isExecutingRef.current && 
          pendingProposals.current.size === 0 && 
          pendingBuys.current.size === 0 && 
          openContracts.current.size === 0 && 
          now - executionStartedAtRef.current > 45000) {
        console.warn("[AutoTrader] Watchdog triggered: Resetting empty stuck execution lock");
        isExecutingRef.current = false;
        setTradeLog(prev => prev.filter(t => !t.id.startsWith("pending-")));
        setSessionState(prev => ({
          ...prev,
          status: "LOSS",
          nextAction: "WDT_RST"
        }));
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [requestContractStatus]);

  const sessionStateRef = useRef(sessionState);
  useEffect(() => {
    sessionStateRef.current = sessionState;
  }, [sessionState]);
  useEffect(() => {
    continuousTradeStartAtRef.current = continuousTradeStartAt;
  }, [continuousTradeStartAt]);

  const lastSyncedRef = useRef({ pl: 0, trades: 0 });
  const statsRef = useRef({ pl: dailyPL, stats: dailyStats });

  // Keep statsRef updated for the sync loop
  useEffect(() => {
    statsRef.current = { pl: dailyPL, stats: dailyStats };
  }, [dailyPL, dailyStats]);

  useEffect(() => {
    if (!user?.id || !accountInfo?.loginid) return;

    const syncToSupabase = async () => {
      try {
        const { pl, stats } = statsRef.current;
        
        // Skip if nothing changed since last successful sync
        if (pl === lastSyncedRef.current.pl && stats.total_trades === lastSyncedRef.current.trades) return;

        // Current UTC date for grouping
        const utcDate = new Date().toISOString().split('T')[0];
        
        const { error } = await supabase
          .from('daily_reports')
          .upsert({
            user_id: user.id,
            deriv_loginid: accountInfo.loginid,
            trade_date: utcDate,
            reported_profit: pl,
            reported_trades: stats.total_trades,
            reported_wins: stats.wins,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id,deriv_loginid,trade_date' });

        if (!error) {
          lastSyncedRef.current = { pl, trades: stats.total_trades };
        }
      } catch (err) {
        // Silent fail for background sync
      }
    };

    // Initial sync
    syncToSupabase();

    const interval = setInterval(syncToSupabase, 60000);
    return () => clearInterval(interval);
  }, [user?.id, accountInfo?.loginid]);

  const pendingProposals = useRef<Map<string, { symbol: string; dangerDigit: number; stake: number; timestamp: number; supabaseId?: string }>>(new Map());
  const openContracts = useRef<Map<string, { symbol: string; stake: number; timestamp: number; supabaseId?: string }>>(new Map());
  const settledContracts = useRef<Set<string>>(new Set());
  const pendingBuys = useRef<Map<string, { symbol: string; supabaseId: string }>>(new Map());

  const isExecutingRef = useRef(false);
  // Stores per-proposal timeout handles so they can be cancelled when a response arrives
  const proposalTimeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const activeSequenceNameRef = useRef<string>("LAST16_HYBRID");
  const stepIndexRef = useRef<number>(0);
  const symbolTrackerRef = useRef<Map<string, SymbolStatus>>(new Map());
  const useReducedWindowSize = useRef(false);
  const freshnessWarningShownRef = useRef(false);

  const calculate_reversion_score = useCallback((symbol: string): number => {
    const symbolState = getSymbolState(symbol);
    if (!symbolState || !symbolState.digits || symbolState.digits.length < 30) {
      return 10.0; // Baseline standard deviation (high standard deviation / average score)
    }

    const digits = symbolState.digits.slice(-50);
    const frequencies = new Array(10).fill(0);
    digits.forEach(d => {
      if (d >= 0 && d <= 9) frequencies[d]++;
    });

    const mean = digits.length / 10;
    const variance = frequencies.reduce((acc, count) => acc + Math.pow(count - mean, 2), 0) / 10;
    const stdDev = Math.sqrt(variance);
    return stdDev;
  }, [getSymbolState]);

  const select_smart_volatility_symbol = useCallback(() => {
    const symbols = [
      "1HZ10V", "1HZ25V", "1HZ50V", "1HZ75V", "1HZ100V",
      "R_10", "R_25", "R_50", "R_75", "R_100",
    ];

    const candidates = symbols
      .map((symbol) => {
        const tracking = volatilityTracking[symbol];
        if (tracking && tracking.suspendedUntil && Date.now() < tracking.suspendedUntil) {
          return null;
        }

        const symbolState = getSymbolState(symbol);
        if (symbolState?.updatedAt) {
          const tickAgeMs = Date.now() - symbolState.updatedAt;
          if (tickAgeMs > MAX_TICK_AGE_MS) {
            return null;
          }
        } else {
          return null;
        }

        const stdDev = calculate_reversion_score(symbol);
        const score = 100 - (stdDev * 10);
        return { symbol, score };
      })
      .filter((c): c is { symbol: string; score: number } => c !== null);

    if (candidates.length === 0) {
      return null;
    }

    candidates.sort((a, b) => b.score - a.score);
    return candidates[0];
  }, [getSymbolState, volatilityTracking, calculate_reversion_score]);

  const select_random_active_symbol = useCallback(() => {
    const symbols = [
      "1HZ10V", "1HZ25V", "1HZ50V", "1HZ75V", "1HZ100V",
      "R_10", "R_25", "R_50", "R_75", "R_100",
    ];

    let activeStrategy = config.strategy;
    if (config.strategy === "strategy_n") {
      activeStrategy = sessionStateRef.current.strategyNActiveSub || "strategy_l";
    } else if (config.strategy === "strategy_q") {
      activeStrategy = sessionStateRef.current.strategyQActiveSub || "strategy_a";
    }

    const candidates = symbols
      .map((symbol) => {
        // Skip suspended symbols under Strategy C, D, E and F
        if (activeStrategy === "strategy_c" || activeStrategy === "strategy_d" || activeStrategy === "strategy_e" || activeStrategy === "strategy_f" || activeStrategy === "strategy_j") {
          const tracking = volatilityTracking[symbol];
          if (tracking && tracking.suspendedUntil && Date.now() < tracking.suspendedUntil) {
            return null;
          }
        }

        // Skip symbol if its personal blacklist contains the current arrangement prefix under Strategy F
        if (activeStrategy === "strategy_f") {
          const currentPrefix = (sessionStateRef.current.currentArrangement || []).slice(0, 5).join(",");
          const symbolBlacklist = sessionStateRef.current.blacklistedPrefixes?.[symbol] || [];
          if (symbolBlacklist.includes(currentPrefix)) {
            console.log(`[Strategy F Pool Filter] Skipping symbol ${symbol} because prefix [${currentPrefix}] is blacklisted for it.`);
            return null;
          }
        }

        const symbolState = getSymbolState(symbol);
        
        // Check freshness only - no need for 16 ticks
        if (symbolState?.updatedAt) {
          const tickAgeMs = Date.now() - symbolState.updatedAt;
          if (tickAgeMs > MAX_TICK_AGE_MS) {
            return null;
          }
        } else {
          // If no update timestamp, skip to be safe
          return null;
        }

        return { symbol };
      })
      .filter((c): c is { symbol: string } => c !== null);

    if (candidates.length === 0) {
      return null;
    }

    if (config.strategy === "strategy_g" || config.strategy === "strategy_i" || config.strategy === "strategy_j" || config.strategy === "strategy_l" || config.strategy === "strategy_o" || config.strategy === "strategy_p" || config.strategy === "strategy_r") {
      const currentSymbol = sessionStateRef.current.currentSymbol;
      const filteredCandidates = candidates.filter(c => c.symbol !== currentSymbol);
      const activeCandidates = filteredCandidates.length > 0 ? filteredCandidates : candidates;
      
      console.log(`[Strategy ${config.strategy.toUpperCase()} Volatility Selector] Selecting purely randomly (excluding back-to-back [${currentSymbol}]):`, activeCandidates.map(c => c.symbol).join(", "));
      return activeCandidates[Math.floor(Math.random() * activeCandidates.length)];
    }

    if (config.strategy === "strategy_f") {
      const isForcedSwap = sessionStateRef.current.forceSwapSymbol;
      if (isForcedSwap) {
        const blacklist = sessionStateRef.current.blacklistedPrefixes || {};
        const minCount = Math.min(...candidates.map(c => blacklist[c.symbol]?.length || 0));
        const bestCandidates = candidates.filter(c => (blacklist[c.symbol]?.length || 0) === minCount);
        
        console.log(`[Strategy F Symbol Select - Forced Swap] Candidate blacklist sizes:`, candidates.map(c => `${c.symbol}: ${blacklist[c.symbol]?.length || 0}`).join(", "));
        console.log(`[Strategy F Symbol Select - Forced Swap] Selecting from lowest blacklist count (${minCount}) candidates:`, bestCandidates.map(c => c.symbol).join(", "));
        
        return bestCandidates[Math.floor(Math.random() * bestCandidates.length)];
      } else {
        console.log(`[Strategy F Symbol Select - Normal] Selecting intelligently based on consecutive losses.`);
      }
    }

    // Intelligent brain: prioritize candidates with fewer pure consecutive losses
    const minLosses = Math.min(...candidates.map(c => volatilityTracking[c.symbol]?.pureConsecutiveLosses || 0));
    const bestCandidates = candidates.filter(c => (volatilityTracking[c.symbol]?.pureConsecutiveLosses || 0) === minLosses);

    console.log(`[Volatility Selector - Intelligent] Candidate consecutive losses:`, candidates.map(c => `${c.symbol}: ${volatilityTracking[c.symbol]?.pureConsecutiveLosses || 0}`).join(", "));
    console.log(`[Volatility Selector - Intelligent] Selecting from lowest consecutive loss (${minLosses}) candidates:`, bestCandidates.map(c => c.symbol).join(", "));

    return bestCandidates[Math.floor(Math.random() * bestCandidates.length)];
  }, [getSymbolState, config.strategy, volatilityTracking]);

  const randomCooldownSeconds = useCallback(() => {
    return Math.floor(Math.random() * (COOLDOWN_WAIT_MAX_SECONDS - COOLDOWN_WAIT_MIN_SECONDS + 1)) + COOLDOWN_WAIT_MIN_SECONDS;
  }, []);

  const randomTradeCooldownTicks = useCallback((isWin: boolean) => {
    const minTicks = isWin ? WIN_TRADE_COOLDOWN_MIN_TICKS : LOSS_TRADE_COOLDOWN_MIN_TICKS;
    const maxTicks = isWin ? WIN_TRADE_COOLDOWN_MAX_TICKS : LOSS_TRADE_COOLDOWN_MAX_TICKS;
    return Math.floor(Math.random() * (maxTicks - minTicks + 1)) + minTicks;
  }, []);

  const execute_trade = useCallback(async () => {
    if (!enabledRef.current) {
      console.log("%c[AutoTrader] execute_trade aborted: bot is disabled (Ref Check)", "color: orange; font-weight: bold;");
      return;
    }

    // Check target profit limit
    if (config.targetProfit !== undefined && config.targetProfit > 0 && sessionPLRef.current >= config.targetProfit) {
      console.log(`[AutoTrader] Target Profit reached. Session P/L: $${sessionPLRef.current.toFixed(2)}, Target: $${config.targetProfit.toFixed(2)}. Disabling bot.`);
      toast.success(`Target Profit of $${config.targetProfit.toFixed(2)} reached! Disabling bot.`);
      stableSetConfig(prev => ({ ...prev, enabled: false }));
      return;
    }

    // Check allowable loss limit
    if (config.initialBalance !== undefined && config.initialBalance > 0 && config.allowableLoss !== undefined && config.allowableLoss > 0 && accountInfo?.balance !== undefined) {
      const stopBalance = config.initialBalance - config.allowableLoss;
      if (accountInfo.balance <= stopBalance) {
        console.log(`[AutoTrader] Allowable Loss limit reached. Balance: $${accountInfo.balance.toFixed(2)}, Stop Balance: $${stopBalance.toFixed(2)} (Initial: $${config.initialBalance.toFixed(2)}, Allowable Loss: $${config.allowableLoss.toFixed(2)}). Disabling bot.`);
        toast.error(`Allowable Loss limit reached! Current Balance: $${accountInfo.balance.toFixed(2)} is at/below the limit of $${stopBalance.toFixed(2)}. Disabling bot.`);
        stableSetConfig(prev => ({ ...prev, enabled: false }));
        return;
      }
    }

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
      let updatedArrangement = state.currentArrangement;

      let activeStrategy = config.strategy;
      let nextNActiveSub = state.strategyNActiveSub;
      let nextNNextSwitchTime = state.strategyNNextSwitchTime;

      let nextQActiveSub = state.strategyQActiveSub;
      let nextQRemainingRuns = state.strategyQRemainingRuns;
      let nextQLastSub = state.strategyQLastSub;

      if (config.strategy === "strategy_q") {
        if (!nextQActiveSub || nextQRemainingRuns === undefined || nextQRemainingRuns <= 0) {
          const pool = ["strategy_a", "strategy_b", "strategy_c", "strategy_d"].filter(
            s => s !== nextQLastSub
          );
          nextQActiveSub = pool[Math.floor(Math.random() * pool.length)] as any;
          nextQRemainingRuns = Math.floor(Math.random() * 21) + 20; // 20 to 40 runs
          nextQLastSub = nextQActiveSub;
          console.log(`[Strategy Q Wrapper] Init sub-strategy: ${nextQActiveSub}, runs: ${nextQRemainingRuns}`);
          
          updatedArrangement = [];
          nextStep = 0;
          seqStep = 0;
          state.currentLossSequence = [];
          state.currentArrangement = [];
          state.currentSymbolLosses = 0;
          state.forceSwapSymbol = false;
        }
        activeStrategy = nextQActiveSub;
      }

      if (config.strategy === "strategy_n") {
        if (!nextNActiveSub) {
          nextNActiveSub = Math.random() < 0.5 ? "strategy_l" : "strategy_m";
          nextNNextSwitchTime = Date.now() + 300000 + Math.floor(Math.random() * 180000); // 5 to 8 minutes
          console.log(`[Strategy N Wrapper] Initialized active sub-strategy: ${nextNActiveSub}, next switch at: ${new Date(nextNNextSwitchTime).toLocaleTimeString()}`);
        }
        activeStrategy = nextNActiveSub;
      }

      const baseStakeToUse = activeStrategy === "strategy_l"
        ? (config.strategyLBaseStake ?? config.baseStake)
        : (activeStrategy === "strategy_m"
          ? (config.strategyMBaseStake ?? config.baseStake)
          : (activeStrategy === "strategy_o"
            ? (config.strategyOBaseStake ?? config.baseStake)
            : (activeStrategy === "strategy_p"
              ? (config.strategyPBaseStake ?? config.baseStake)
              : (activeStrategy === "strategy_r"
                ? (config.strategyRBaseStake ?? config.baseStake)
                : config.baseStake))));

      const maxAllowedStake = (baseStakeToUse / 1.40) * STRATEGY_O_STAKES[2];
      const lastTradeExceededMax = activeStrategy === "strategy_o" && 
                                   state.status === "LOSS" && 
                                   state.currentStake >= maxAllowedStake - 0.01;

      let nextOSeqBase = state.strategyOSequenceBaseStake;
      if (activeStrategy === "strategy_o") {
        if (state.status === "LOSS" && !lastTradeExceededMax) {
          if (state.martingaleStep === 0 || nextOSeqBase === undefined) {
            nextOSeqBase = state.currentStake;
          }
        } else {
          nextOSeqBase = undefined;
        }
      }

      let nextPSeqBase = state.strategyPSequenceBaseStake;
      let nextPAccumLoss = state.strategyPAccumulatedLoss;
      if (activeStrategy === "strategy_p") {
        if (state.status === "LOSS") {
          if (state.martingaleStep === 0 || nextPSeqBase === undefined) {
            nextPSeqBase = state.currentStake;
            nextPAccumLoss = state.currentStake;
          } else {
            nextPAccumLoss = (state.strategyPAccumulatedLoss ?? 0) + state.currentStake;
          }
        } else {
          nextPSeqBase = undefined;
          nextPAccumLoss = undefined;
        }
      }

      let nextRSeqBase = state.strategyRSequenceBaseStake;
      let nextRAccumLoss = state.strategyRAccumulatedLoss;
      if (activeStrategy === "strategy_r") {
        if (state.status === "LOSS") {
          if (state.martingaleStep === 0 || nextRSeqBase === undefined) {
            nextRSeqBase = state.currentStake;
            nextRAccumLoss = state.currentStake;
          } else {
            nextRAccumLoss = (state.strategyRAccumulatedLoss ?? 0) + state.currentStake;
          }
        } else {
          nextRSeqBase = undefined;
          nextRAccumLoss = undefined;
        }
      }

      let symbol: string;
      const keepSymbolOnLoss = activeStrategy === "strategy_b" || activeStrategy === "strategy_c" || activeStrategy === "strategy_d" || activeStrategy === "strategy_e" || activeStrategy === "strategy_f" || activeStrategy === "alternating";
      
      const isSuspended = (sym: string) => {
        const tracking = volatilityTracking[sym];
        return !!(tracking?.suspendedUntil && Date.now() < tracking.suspendedUntil);
      };

      const shouldKeep = keepSymbolOnLoss && 
                         state.status === "LOSS" && 
                         state.currentSymbol && 
                         !isSuspended(state.currentSymbol) && 
                         !((activeStrategy === "strategy_d" || activeStrategy === "strategy_e" || activeStrategy === "strategy_f") && state.forceSwapSymbol);

      let nextLMode: "loss_sticky" | "win_sticky" | "none_sticky" | undefined = state.strategyLMode;
      let nextNoneStickyCount: number | undefined = state.strategyLNoneStickyCount;
      let nextRMode: "win_sticky" | "none_sticky" | "loss_sticky" | undefined = state.strategyRMode;
      let nextRModeCount: number | undefined = state.strategyRModeCount;

      if (activeStrategy === "strategy_h") {
        let k = state.fibonacciIndex ?? -1;
        if (k === -1) {
          k = selectUnusedFibonacciIndex(state.usedStartIndices || []);
          state.usedStartIndices = [...(state.usedStartIndices || []), k];
          state.fibonacciIndex = k;
        }
        const symbols = [
          "1HZ10V", "1HZ25V", "1HZ50V", "1HZ75V", "1HZ100V",
          "R_10", "R_25", "R_50", "R_75", "R_100",
        ];
        const fibValue = getFibonacci(k);
        const symbolMod = Number(fibValue % 10n);
        symbol = symbols[symbolMod];
        console.log(`[Strategy H Volatility] Index k: ${k}, F(k): ${fibValue.toString()}, F(k) % 10: ${symbolMod} -> ${symbol}`);
      } else if (activeStrategy === "strategy_l" || activeStrategy === "strategy_m" || activeStrategy === "strategy_o" || activeStrategy === "strategy_p") {
        const isFirstTrade = state.status === "IDLE";
        let shouldSwitchSymbol = false;
        const lModes: Array<"win_sticky" | "none_sticky"> = ["win_sticky", "none_sticky"];
        const getRandomLMode = () => lModes[Math.floor(Math.random() * lModes.length)];

        const stratLabel = activeStrategy === "strategy_m" ? "M" : (activeStrategy === "strategy_o" ? "O" : (activeStrategy === "strategy_p" ? "P" : "L"));

        if (isFirstTrade || !state.currentSymbol || !state.strategyLMode) {
          shouldSwitchSymbol = true;
          nextLMode = getRandomLMode();
          if (nextLMode === "none_sticky") {
            nextNoneStickyCount = Math.floor(Math.random() * 3) + 3;
            console.log(`[Strategy ${stratLabel} Volatility] Initialized None Sticky count: ${nextNoneStickyCount}`);
          } else {
            nextNoneStickyCount = undefined;
          }
        } else {
          const currentMode = state.strategyLMode || "loss_sticky";
          if (currentMode === "none_sticky") {
            const currentCount = state.strategyLNoneStickyCount ?? 1;
            if (currentCount > 1) {
              shouldSwitchSymbol = true;
              nextLMode = "none_sticky";
              nextNoneStickyCount = currentCount - 1;
              console.log(`[Strategy ${stratLabel} Volatility] Continuing None Sticky. Trades remaining: ${nextNoneStickyCount}`);
            } else {
              shouldSwitchSymbol = true;
              nextLMode = getRandomLMode();
              if (nextLMode === "none_sticky") {
                nextNoneStickyCount = Math.floor(Math.random() * 3) + 3;
                console.log(`[Strategy ${stratLabel} Volatility] None Sticky selected again. Count: ${nextNoneStickyCount}`);
              } else {
                nextNoneStickyCount = undefined;
              }
            }
          } else if (currentMode === "loss_sticky") {
            if (state.status === "WIN") {
              shouldSwitchSymbol = true;
              nextLMode = getRandomLMode();
              if (nextLMode === "none_sticky") {
                nextNoneStickyCount = Math.floor(Math.random() * 3) + 3;
                console.log(`[Strategy ${stratLabel} Volatility] Swapped from Loss Sticky to None Sticky. Count: ${nextNoneStickyCount}`);
              } else {
                nextNoneStickyCount = undefined;
              }
            } else {
              shouldSwitchSymbol = false;
              nextLMode = "loss_sticky";
              nextNoneStickyCount = undefined;
            }
          } else {
            // win_sticky
            if (state.status === "LOSS") {
              shouldSwitchSymbol = true;
              nextLMode = getRandomLMode();
              if (nextLMode === "none_sticky") {
                nextNoneStickyCount = Math.floor(Math.random() * 3) + 3;
                console.log(`[Strategy ${stratLabel} Volatility] Swapped from Win Sticky to None Sticky. Count: ${nextNoneStickyCount}`);
              } else {
                nextNoneStickyCount = undefined;
              }
            } else {
              shouldSwitchSymbol = false;
              nextLMode = "win_sticky";
              nextNoneStickyCount = undefined;
            }
          }
        }

        if (shouldSwitchSymbol) {
          const selectedSymbol = select_random_active_symbol();
          if (!selectedSymbol) {
            console.warn("[AutoTrader] Trade skipped: no fresh symbol available");
            setSessionState(prev => ({
              ...prev,
              nextAction: "SKP_STALE",
            }));
            setTicksToWait(3);
            isExecutingRef.current = false;
            return;
          }
          symbol = selectedSymbol.symbol;
          console.log(`[Strategy ${stratLabel} Volatility] Switched symbol to ${symbol}. Chosen mode: ${nextLMode}`);
        } else {
          symbol = state.currentSymbol;
          console.log(`[Strategy ${stratLabel} Volatility] Sticky symbol ${symbol}. Mode: ${nextLMode}`);
        }
      } else if (activeStrategy === "strategy_r" && config.strategyRStickyEnabled) {
        const isFirstTrade = state.status === "IDLE";
        let shouldSwitchSymbol = false;
        const rModes: Array<"win_sticky" | "none_sticky" | "loss_sticky"> = ["win_sticky", "none_sticky", "loss_sticky"];
        const getRandomRMode = (excludeMode?: "win_sticky" | "none_sticky" | "loss_sticky") => {
          const filtered = excludeMode ? rModes.filter(m => m !== excludeMode) : rModes;
          return filtered[Math.floor(Math.random() * filtered.length)];
        };
        const getRandomRCount = (mode?: "win_sticky" | "none_sticky" | "loss_sticky") => {
          if (mode === "win_sticky") {
            return Math.floor(Math.random() * 4) + 5; // 5 - 8 runs
          }
          if (mode === "loss_sticky") {
            return Math.floor(Math.random() * 3) + 2; // 2 - 4 runs
          }
          return Math.floor(Math.random() * 3) + 3; // 3 - 5 runs (none_sticky)
        };

        if (isFirstTrade || !state.currentSymbol || !state.strategyRMode || state.strategyRModeCount === undefined || state.strategyRModeCount <= 0) {
          shouldSwitchSymbol = true;
          nextRMode = getRandomRMode(state.strategyRMode || undefined);
          nextRModeCount = getRandomRCount(nextRMode);
          console.log(`[Strategy R Volatility] Sticky initialized: Mode = ${nextRMode}, Count = ${nextRModeCount}`);
        } else {
          if (
            (state.strategyRMode === "win_sticky" && state.status === "LOSS") ||
            (state.strategyRMode === "loss_sticky" && (state.status === "WIN" || state.status === "IDLE"))
          ) {
            shouldSwitchSymbol = true;
            nextRMode = getRandomRMode(state.strategyRMode || undefined);
            nextRModeCount = getRandomRCount(nextRMode);
            console.log(`[Strategy R Volatility] ${state.strategyRMode === "win_sticky" ? "Win" : "Loss"} Sticky early transition. Re-selecting sticky mode: New Mode = ${nextRMode}, Count = ${nextRModeCount}`);
          } else {
            const currentCount = state.strategyRModeCount;
            if (currentCount > 1) {
              nextRModeCount = currentCount - 1;
              if (nextRMode === "none_sticky") {
                shouldSwitchSymbol = true;
                console.log(`[Strategy R Volatility] Continuing None Sticky. Trades remaining: ${nextRModeCount}`);
              } else if (nextRMode === "win_sticky") {
                shouldSwitchSymbol = false;
                console.log(`[Strategy R Volatility] Win Sticky (Win/Idle detected). Staying on symbol. Trades remaining: ${nextRModeCount}`);
              } else {
                // loss_sticky
                shouldSwitchSymbol = false;
                console.log(`[Strategy R Volatility] Loss Sticky (Loss detected). Staying on symbol. Trades remaining: ${nextRModeCount}`);
              }
            } else {
              shouldSwitchSymbol = true;
              nextRMode = getRandomRMode(state.strategyRMode || undefined);
              nextRModeCount = getRandomRCount(nextRMode);
              console.log(`[Strategy R Volatility] Sticky transition (Count expired): New Mode = ${nextRMode}, Count = ${nextRModeCount}`);
            }
          }
        }

        if (shouldSwitchSymbol) {
          const selectedSymbol = select_random_active_symbol();
          if (!selectedSymbol) {
            console.warn("[AutoTrader] Trade skipped: no fresh symbol available");
            setSessionState(prev => ({
              ...prev,
              nextAction: "SKP_STALE",
            }));
            setTicksToWait(3);
            isExecutingRef.current = false;
            return;
          }
          symbol = selectedSymbol.symbol;
          console.log(`[Strategy R Volatility] Switched symbol to ${symbol}. Chosen mode: ${nextRMode}`);
        } else {
          symbol = state.currentSymbol;
          console.log(`[Strategy R Volatility] Sticky symbol ${symbol}. Mode: ${nextRMode}`);
        }
      } else if (shouldKeep) {
        symbol = state.currentSymbol;
      } else {
        const selectedSymbol = activeStrategy === "strategy_e"
          ? select_smart_volatility_symbol()
          : select_random_active_symbol();
        if (!selectedSymbol) {
          console.warn("[AutoTrader] Trade skipped: no fresh symbol available");

          setSessionState(prev => ({
            ...prev,
            nextAction: "SKP_STALE",
          }));

          setTicksToWait(3);
          isExecutingRef.current = false;
          return;
        }
        symbol = selectedSymbol.symbol;
      }

      let trade: TradeCategory;
      let chosenGroup: "NORMAL" | "SPECIAL";

      const categoryLabels: Record<TradeCategory, string> = {
        under4: "Under 4",
        over4: "Over 4",
        under5: "Under 5",
        over5: "Over 5",
        over0: "Over 0",
        under9: "Under 9",
        even: "Even",
        odd: "Odd",
        rise: "Rise",
        fall: "Fall",
        over2: "Over 2",
        under7: "Under 7",
        over1: "Over 1",
        under8: "Under 8"
      };

      if (activeStrategy === "strategy_a" || activeStrategy === "strategy_b" || activeStrategy === "strategy_c" || activeStrategy === "strategy_d" || activeStrategy === "strategy_e" || activeStrategy === "strategy_f" || activeStrategy === "strategy_g" || activeStrategy === "strategy_h" || activeStrategy === "strategy_i" || activeStrategy === "strategy_j" || activeStrategy === "strategy_k" || activeStrategy === "strategy_l" || activeStrategy === "strategy_m" || activeStrategy === "strategy_o" || activeStrategy === "strategy_p" || activeStrategy === "strategy_r") {
        if (activeStrategy === "strategy_h") {
          let k = state.fibonacciIndex ?? -1;
          let tradeDir: TradeCategory;
          if (k === -1) {
            k = selectUnusedFibonacciIndex(state.usedStartIndices || []);
            state.usedStartIndices = [...(state.usedStartIndices || []), k];
          }
          
          const fibValue = getFibonacci(k);
          const modValue = Number(fibValue % 6n);
          if (modValue === 0) tradeDir = "under4";
          else if (modValue === 1) tradeDir = "over5";
          else if (modValue === 2) tradeDir = "even";
          else if (modValue === 3) tradeDir = "under5";
          else if (modValue === 4) tradeDir = "over4";
          else tradeDir = "odd";

          console.log(`[Strategy H Execution] Index k: ${k}, F(k): ${fibValue.toString()}, F(k) % 6: ${modValue} -> ${tradeDir}`);
          
          trade = tradeDir;
          chosenGroup = getCategoryGroup(trade);
          state.fibonacciIndex = k;

          if (state.status === "WIN" || state.status === "IDLE") {
            nextStep = 0;
          } else if (state.status === "LOSS") {
            nextStep = state.martingaleStep + 1;
            stepIndexRef.current += 1;
          }
        } else if (activeStrategy === "strategy_i") {
          const pool: TradeCategory[] = ["under4", "over4", "under5", "over5", "even", "odd"];
          const tradeDir = pool[Math.floor(Math.random() * pool.length)];
          trade = tradeDir;
          chosenGroup = getCategoryGroup(trade);

          console.log(`[Strategy I Execution] Selected random direction from pool: ${tradeDir}`);

          if (state.status === "WIN" || state.status === "IDLE") {
            nextStep = 0;
          } else if (state.status === "LOSS") {
            nextStep = state.martingaleStep + 1;
            stepIndexRef.current += 1;
          }
        } else if (activeStrategy === "strategy_j") {
          let startA = state.strategyJ_fibStartA ?? -1;
          let startB = state.strategyJ_fibStartB ?? -1;
          let step = state.strategyJ_fibStep ?? -1;

          if (startA === -1 || startB === -1 || step === -1) {
            startA = Math.floor(Math.random() * 1000000000) + 1;
            startB = Math.floor(Math.random() * 1000000000) + 1;
            step = 0;
          }

          if (state.status === "WIN" || state.status === "IDLE") {
            nextStep = 0;
          } else if (state.status === "LOSS") {
            nextStep = state.martingaleStep + 1;
            stepIndexRef.current += 1;
          }

          let fibValue = getGeneralizedFibonacci(startA, startB, step);
          let modValue = Number(fibValue % 8n);
          
          const getDirFromMod = (mod: number): TradeCategory => {
            if (mod === 1) return "under4";
            if (mod === 2) return "over5";
            if (mod === 3) return "even";
            if (mod === 4) return "rise";
            if (mod === 5) return "under5";
            if (mod === 6) return "over4";
            if (mod === 7) return "fall";
            return "odd"; // mod === 0
          };

          let tradeDir = getDirFromMod(modValue);

          console.log(`[Strategy J Execution] Seeds: (${startA}, ${startB}), Step: ${step}, G(step): ${fibValue.toString()}, G(step) % 8: ${modValue} -> ${tradeDir}`);
          
          trade = tradeDir;
          chosenGroup = getCategoryGroup(trade);
          state.strategyJ_fibStartA = startA;
          state.strategyJ_fibStartB = startB;
          state.strategyJ_fibStep = step;
        } else if (activeStrategy === "strategy_l") {
          const pool: TradeCategory[] = ["over2", "under7"];
          const tradeDir = pool[Math.floor(Math.random() * pool.length)];
          trade = tradeDir;
          chosenGroup = getCategoryGroup(trade);

          console.log(`[Strategy L Execution] Selected random direction from pool: ${tradeDir}`);

          if (state.status === "WIN" || state.status === "IDLE") {
            nextStep = 0;
          } else if (state.status === "LOSS") {
            nextStep = state.martingaleStep + 1;
            stepIndexRef.current += 1;
          }
        } else if (activeStrategy === "strategy_o") {
          let pool: TradeCategory[];
          const currentStatus = state.status;
          const currentMartingaleStep = state.martingaleStep;

          if (currentStatus === "WIN" || currentStatus === "IDLE" || lastTradeExceededMax) {
            pool = ["over2", "under7"];
          } else {
            pool = ["over1", "under8"];
          }

          const tradeDir = pool[Math.floor(Math.random() * pool.length)];
          trade = tradeDir;
          chosenGroup = getCategoryGroup(trade);

          console.log(`[Strategy O Execution] Step: ${currentStatus === "LOSS" && !lastTradeExceededMax ? currentMartingaleStep + 1 : 0}, Selected direction: ${tradeDir}`);

          if (currentStatus === "WIN" || currentStatus === "IDLE" || lastTradeExceededMax) {
            nextStep = 0;
          } else if (currentStatus === "LOSS") {
            nextStep = currentMartingaleStep + 1;
            stepIndexRef.current += 1;
          }
        } else if (activeStrategy === "strategy_p") {
          let pool: TradeCategory[];
          const currentStatus = state.status;
          const currentMartingaleStep = state.martingaleStep;

          if (currentStatus === "WIN" || currentStatus === "IDLE") {
            pool = ["over1", "under8"];
          } else {
            pool = ["over5", "under4"];
          }

          const tradeDir = pool[Math.floor(Math.random() * pool.length)];
          trade = tradeDir;
          chosenGroup = getCategoryGroup(trade);

          console.log(`[Strategy P Execution] Step: ${currentStatus === "LOSS" ? currentMartingaleStep + 1 : 0}, Selected direction: ${tradeDir}`);

          if (currentStatus === "WIN" || currentStatus === "IDLE") {
            nextStep = 0;
          } else if (currentStatus === "LOSS") {
            nextStep = currentMartingaleStep + 1;
            stepIndexRef.current += 1;
          }
        } else if (activeStrategy === "strategy_r") {
          let pool: TradeCategory[];
          const currentStatus = state.status;
          const currentMartingaleStep = state.martingaleStep;

          if (currentStatus === "WIN" || currentStatus === "IDLE") {
            pool = ["over1", "under8"];
          } else {
            pool = ["even", "odd", "rise", "fall"];
            if (state.currentCategory) {
              pool = pool.filter(c => c !== state.currentCategory);
            }
          }

          const tradeDir = pool[Math.floor(Math.random() * pool.length)];
          trade = tradeDir;
          chosenGroup = getCategoryGroup(trade);

          console.log(`[Strategy R Execution] Step: ${currentStatus === "LOSS" ? currentMartingaleStep + 1 : 0}, Selected direction: ${tradeDir}`);

          if (currentStatus === "WIN" || currentStatus === "IDLE") {
            nextStep = 0;
          } else if (currentStatus === "LOSS") {
            nextStep = currentMartingaleStep + 1;
            stepIndexRef.current += 1;
          }
        } else {
          let currentArr = state.currentArrangement || [];
          let currentArrIdx = state.currentArrangementIndex || 0;
          let progressIdx = state.arrangementProgressIndex || 0;
          let seed = state.shufflingSeed || 1;

          if (currentArr.length === 0) {
            let elements = ['U4', 'O4', 'U5', 'O5'];
            let counts = [3, 3, 3, 3];
            let totalArrangements = 369600;
            if (activeStrategy === "strategy_c") {
              elements = ['U4', 'O4', 'U5', 'O5', 'EV', 'OD'];
              counts = [2, 2, 2, 2, 2, 2];
              totalArrangements = 7484400;
            } else if (activeStrategy === "strategy_d") {
              elements = ['U4', 'O4', 'U5', 'O5', 'EV', 'OD', 'RISE', 'FALL'];
              counts = [2, 2, 2, 2, 1, 1, 1, 1];
              totalArrangements = 29937600;
            } else if (activeStrategy === "strategy_k" || activeStrategy === "strategy_m") {
              elements = ['U4', 'O4', 'U5', 'O5', 'EV', 'OD', 'RISE', 'FALL'];
              counts = [1, 1, 1, 1, 1, 1, 1, 1];
              totalArrangements = 40320;
            }
            const permIndex = lcgPermute(progressIdx, totalArrangements, seed);
            currentArrIdx = permIndex + 1;
            currentArr = getNthPermutation(elements, counts, currentArrIdx);
          }

          seqStep = state.sequenceStep;
          if (state.status === "WIN" || state.status === "IDLE") {
            nextStep = 0;
          } else if (state.status === "LOSS") {
            nextStep = state.martingaleStep + 1;
            stepIndexRef.current += 1;
          }

          let directionCode = currentArr[state.sequenceStep] || "O5";
          
          // Strategy E Drawdown Reducer: Upgrades U5 -> U4, O4 -> O5 for steps >= 5
          if (activeStrategy === "strategy_e" && nextStep >= 5) {
            if (directionCode === "U5") directionCode = "U4";
            else if (directionCode === "O4") directionCode = "O5";
          }

          if (directionCode === "U4") trade = "under4";
          else if (directionCode === "O4") trade = "over4";
          else if (directionCode === "U5") trade = "under5";
          else if (directionCode === "O5") trade = "over5";
          else if (directionCode === "EV") trade = "even";
          else if (directionCode === "OD") trade = "odd";
          else if (directionCode === "RISE") trade = "rise";
          else if (directionCode === "FALL") trade = "fall";
          else trade = "over5";

          // Strategy E Dynamic Overlay (Real-time Probability Overlay):
          if (activeStrategy === "strategy_e") {
            const symbolState = getSymbolState(symbol);
            if (symbolState && symbolState.digits && symbolState.digits.length >= 30) {
              const digits = symbolState.digits.slice(-25);
              if (trade === "under4" || trade === "over5") {
                const u4Count = digits.filter(d => d <= 3).length;
                const o5Count = digits.filter(d => d >= 6).length;
                if (trade === "under4" && u4Count >= 13 && o5Count <= 7) {
                  trade = "over5";
                  console.log("[Strategy E] Overriding U4 -> O5 (O5 is overdue / regression probable)");
                } else if (trade === "over5" && o5Count >= 13 && u4Count <= 7) {
                  trade = "under4";
                  console.log("[Strategy E] Overriding O5 -> U4 (U4 is overdue / regression probable)");
                }
              } else if (trade === "under5" || trade === "over4") {
                const u5Count = digits.filter(d => d <= 4).length;
                const o4Count = digits.filter(d => d >= 5).length;
                if (trade === "under5" && u5Count >= 16 && o4Count <= 9) {
                  trade = "over4";
                  console.log("[Strategy E] Overriding U5 -> O4 (O4 is overdue / regression probable)");
                } else if (trade === "over4" && o4Count >= 16 && u5Count <= 9) {
                  trade = "under5";
                  console.log("[Strategy E] Overriding O4 -> U5 (U5 is overdue / regression probable)");
                }
              }
            }
          }

          chosenGroup = getCategoryGroup(trade);
        }
      } else {
        const normalGroup: TradeCategory[] = ["under4", "over5"];
        const specialGroup: TradeCategory[] = ["over4", "under5"];
        
        if (state.status === "LOSS" && state.currentCategory) {
          const lastGroup = getCategoryGroup(state.currentCategory);
          const availableCategories = lastGroup === "NORMAL" ? specialGroup : normalGroup;
          trade = availableCategories[Math.floor(Math.random() * availableCategories.length)];
        } else {
          const allCategories: TradeCategory[] = ["under4", "over4", "under5", "over5"];
          trade = allCategories[Math.floor(Math.random() * allCategories.length)];
        }
        chosenGroup = getCategoryGroup(trade as any);

        if (state.status === "WIN" || state.status === "IDLE") {
          nextStep = 0;
          seqStep = 0;
        } else if (state.status === "LOSS") {
          nextStep = state.martingaleStep + 1;
          seqStep = state.sequenceStep + 1;
          stepIndexRef.current += 1;
        }
      }

      // Avoid repeating the same direction of trade during consecutive losses (from 5th loss up to 11th trade)
      const resolution = resolveNextDirection(
        trade,
        nextStep,
        state.currentLossSequence,
        activeStrategy,
        state.currentArrangement,
        state.sequenceStep,
        STRATEGY_DIRECTIONS[activeStrategy] || STRATEGY_DIRECTIONS["alternating"],
        state.blacklistedPrefixes
      );
      if (resolution.trade !== trade) {
        trade = resolution.trade;
        chosenGroup = getCategoryGroup(trade);
        if (resolution.currentArrangement) {
          updatedArrangement = resolution.currentArrangement;
        }
      }

      console.log("[AutoTrader] Volatility and Strategy Selection", {
        strategy: config.strategy,
        activeSubStrategy: activeStrategy,
        symbol,
        lastGroup: state.status === "LOSS" && state.currentCategory ? getCategoryGroup(state.currentCategory) : "None (Random)",
        selectedGroup: chosenGroup,
        selectedTrade: categoryLabels[trade],
      });

      if (activeStrategy === "strategy_o" && nextStep >= 7) {
        toast.error("Strategy O: 7 consecutive losses reached. Stopping automation.");
        setConfig(prev => ({ ...prev, enabled: false }));
        isExecutingRef.current = false;
        return;
      }

      if (nextStep > config.maxMartingaleSteps) {
        toast.error(`Max Martingale Steps (${config.maxMartingaleSteps}) reached. Stopping automation.`);
        setConfig(prev => ({ ...prev, enabled: false }));
        isExecutingRef.current = false;
        return;
      }

      let type: "DIGITOVER" | "DIGITUNDER" | "DIGITEVEN" | "DIGITODD" | "CALLE" | "PUTE";
      let barrier: number | undefined;
      if (trade === "under4") { type = "DIGITUNDER"; barrier = 4; }
      else if (trade === "over4") { type = "DIGITOVER"; barrier = 4; }
      else if (trade === "under5") { type = "DIGITUNDER"; barrier = 5; }
      else if (trade === "over5") { type = "DIGITOVER"; barrier = 5; }
      else if (trade === "even") { type = "DIGITEVEN"; barrier = undefined; }
      else if (trade === "odd") { type = "DIGITODD"; barrier = undefined; }
      else if (trade === "rise") { type = "PUTE"; barrier = undefined; }
      else if (trade === "fall") { type = "CALLE"; barrier = undefined; }
      else if (trade === "over0") { type = "DIGITOVER"; barrier = 0; }
      else if (trade === "over2") { type = "DIGITOVER"; barrier = 2; }
      else if (trade === "under7") { type = "DIGITUNDER"; barrier = 7; }
      else if (trade === "over1") { type = "DIGITOVER"; barrier = 1; }
      else if (trade === "under8") { type = "DIGITUNDER"; barrier = 8; }
      else { type = "DIGITUNDER"; barrier = 9; }

      const isFirstTrade = state.status === "IDLE";
      const isSpecialStakeTrade = trade === "under5" || trade === "over4" || trade === "even" || trade === "odd" || trade === "rise" || trade === "fall";
      const isWin = state.status === "WIN";

      if (activeStrategy === "strategy_l") {
        if (isFirstTrade) {
          nextStake = baseStakeToUse;
        } else if (isWin) {
          if (state.currentStake > baseStakeToUse) {
            nextStake = baseStakeToUse;
          } else {
            const reduced = state.currentStake / 2;
            if (reduced < 0.35) {
              nextStake = baseStakeToUse;
            } else {
              nextStake = Number(reduced.toFixed(2));
            }
          }
        } else if (state.status === "LOSS") {
          nextStake = Number((state.currentStake * 3.5).toFixed(2));
        } else {
          nextStake = baseStakeToUse;
        }
      } else if (activeStrategy === "strategy_o" || activeStrategy === "strategy_p" || activeStrategy === "strategy_r") {
        if (isFirstTrade) {
          nextStake = baseStakeToUse;
        } else if (isWin) {
          if (activeStrategy === "strategy_r") {
            if (state.currentStake > baseStakeToUse + 0.001) {
              // Win stake went above base stake due to recovery -> revert to base stake
              nextStake = baseStakeToUse;
            } else {
              // Win stake is equal to or below base stake
              const floorLimit = Math.max(0.35, Number((baseStakeToUse / 4).toFixed(2)));
              const reduced = Number((state.currentStake / 2).toFixed(2));
              if (reduced >= floorLimit - 0.001) {
                // Halving does not fall below floorLimit (1/4 baseStake or $0.35)
                nextStake = reduced;
              } else {
                // Halving would fall below floorLimit (or max 2 halvings done) -> revert to base stake to repeat process
                nextStake = baseStakeToUse;
              }
            }
          } else {
            if (state.currentStake > baseStakeToUse) {
              nextStake = baseStakeToUse;
            } else {
              const reduced = state.currentStake / 2;
              if (reduced < 0.35) {
                nextStake = baseStakeToUse;
              } else {
                nextStake = Number(reduced.toFixed(2));
              }
            }
          }
        } else if (state.status === "LOSS") {
          if (activeStrategy === "strategy_o") {
            const stepIndex = nextStep;
            if (stepIndex >= 0 && stepIndex < STRATEGY_O_STAKES.length) {
              const seqBase = nextOSeqBase ?? baseStakeToUse;
              let calculatedStake = (seqBase / 1.40) * STRATEGY_O_STAKES[stepIndex];
              if (calculatedStake > maxAllowedStake) {
                calculatedStake = maxAllowedStake;
              }
              nextStake = Number(calculatedStake.toFixed(2));
              if (nextStake < 0.35) nextStake = 0.35;
            } else {
              nextStake = baseStakeToUse;
            }
          } else if (activeStrategy === "strategy_p") {
            // Strategy P Staking Logic
            if (nextStep === 1) {
              nextStake = nextPSeqBase ?? baseStakeToUse;
            } else {
              const seqBase = nextPSeqBase ?? baseStakeToUse;
              const accum = nextPAccumLoss ?? seqBase;
              const calculatedStake = (accum + 0.22 * seqBase) / 1.381;
              nextStake = Number(calculatedStake.toFixed(2));
              if (nextStake < 0.35) nextStake = 0.35;
            }
          } else {
            // Strategy R Staking Logic
            if (nextStep === 1) {
              nextStake = nextRSeqBase ?? baseStakeToUse;
              if (trade === "even" || trade === "odd" || trade === "rise" || trade === "fall") {
                nextStake = Number((nextStake * 1.26).toFixed(2));
                if (nextStake < 0.35) nextStake = 0.35;
                console.log(`[Strategy R Staking] Special category [${trade}] selected. Applying 1.26x markup multiplier: ${nextStake}`);
              }
            } else {
              const seqBase = nextRSeqBase ?? baseStakeToUse;
              const accum = nextRAccumLoss ?? seqBase;
              const isSpecial = trade === "even" || trade === "odd" || trade === "rise" || trade === "fall";
              const divisor = isSpecial ? 0.90 : 1.381;
              const calculatedStake = (accum + 0.22 * seqBase) / divisor;
              nextStake = Number(calculatedStake.toFixed(2));
              if (nextStake < 0.35) nextStake = 0.35;
              if (isSpecial) {
                console.log(`[Strategy R Staking] Special category [${trade}] selected. Calculated stake with 0.90 divisor: ${nextStake}`);
              }
            }
          }
        } else {
          nextStake = baseStakeToUse;
        }
      } else if (isFirstTrade || isWin) {
        nextStake = baseStakeToUse;
      } else if (state.status === "LOSS") {
        if (activeStrategy === "strategy_e" && nextStep >= 5) {
          nextStake = Number((state.currentStake * 1.45).toFixed(2));
          console.log(`[Strategy E] Step ${nextStep} >= 5: Applying reduced Martingale multiplier 1.45x (Stake: ${nextStake})`);
        } else {
          nextStake = isSpecialStakeTrade
            ? Number((state.currentStake * MARTINGALE_MULTIPLIER * 1.26).toFixed(2))
            : Number((state.currentStake * MARTINGALE_MULTIPLIER).toFixed(2));
        }
      } else {
        nextStake = baseStakeToUse;
      }

      // Strategy E Smart Entry Filter
      if (activeStrategy === "strategy_e") {
        const symbolState = getSymbolState(symbol);
        if (symbolState) {
          const sig = generateSignal(symbolState);
          if (sig && sig.confidence >= 0.7) {
            let winZoneContainsDanger = false;
            if (trade === "under4" && sig.dangerDigit <= 3) winZoneContainsDanger = true;
            else if (trade === "over5" && sig.dangerDigit >= 6) winZoneContainsDanger = true;
            else if (trade === "under5" && sig.dangerDigit <= 4) winZoneContainsDanger = true;
            else if (trade === "over4" && sig.dangerDigit >= 5) winZoneContainsDanger = true;

            if (winZoneContainsDanger) {
              console.log(`[Strategy E Filter] Win zone contains danger digit ${sig.dangerDigit} (Confidence: ${sig.confidence}). Delaying entry by 2 seconds.`);
              toast.info(`[Filter] Danger digit ${sig.dangerDigit} detected in win zone. Delaying entry...`, { duration: 3000 });
              
              setSessionState(prev => ({
                ...prev,
                nextAction: "FILT_DGR",
              }));
              
              setTicksToWait(2);
              isExecutingRef.current = false;
              return;
            }
          }
        }
      }

      console.log("[AutoTrader] Trade selection finalized", { symbol, trade: categoryLabels[trade], stake: nextStake });

      const availableBalance = accountInfo?.balance;
      if (availableBalance !== undefined && availableBalance !== null) {
        if (availableBalance < nextStake) {
          toast.error(`Insufficient balance. Available: $${availableBalance.toFixed(2)}, Required stake: $${nextStake.toFixed(2)}. AI-automation stopped.`);
          setConfig(prev => ({ ...prev, enabled: false }));
          isExecutingRef.current = false;
          return;
        }
      }

      setSessionState(prev => ({
        ...prev,
        currentStake: nextStake,
        martingaleStep: nextStep,
        sequenceStep: seqStep,
        initialChoice: type,
        currentSymbol: symbol,
        currentContract: type,
        currentBarrier: barrier,
        currentCategory: trade,
        status: "PENDING",
        nextAction: "TRD_LIV",
        forceSwapSymbol: false,
        fibonacciIndex: state.fibonacciIndex,
        usedStartIndices: state.usedStartIndices,
        strategyJ_fibStartA: state.strategyJ_fibStartA,
        strategyJ_fibStartB: state.strategyJ_fibStartB,
        strategyJ_fibStep: state.strategyJ_fibStep,
        currentArrangement: updatedArrangement,
        strategyLMode: nextLMode,
        strategyLNoneStickyCount: nextNoneStickyCount,
        strategyNActiveSub: nextNActiveSub,
        strategyNNextSwitchTime: nextNNextSwitchTime,
        strategyOSequenceBaseStake: nextOSeqBase,
        strategyPSequenceBaseStake: nextPSeqBase,
        strategyPAccumulatedLoss: nextPAccumLoss,
        strategyRSequenceBaseStake: nextRSeqBase,
        strategyRAccumulatedLoss: nextRAccumLoss,
        strategyRMode: nextRMode,
        strategyRModeCount: nextRModeCount,
        strategyQActiveSub: nextQActiveSub,
        strategyQRemainingRuns: nextQRemainingRuns,
        strategyQLastSub: nextQLastSub,
      }));

      const reqId = Date.now() + Math.floor(Math.random() * 10000);

      // Add pending trade to log for real-time visibility
      const pendingRecord: TradeRecord = {
        id: `pending-${reqId}`,
        symbol,
        sequence_name: activeSequenceNameRef.current,
        contract: type,
        barrier,
        stake: nextStake,
        profit: 0,
        martingale_step: nextStep,
        status: "PENDING",
        next_action: "WAITING_FOR_RESULT",
        timestamp: new Date(),
      };
      setTradeLog(prev => [pendingRecord, ...prev].slice(0, 2000));

      const isV4 = ws.url.includes("api.derivws.com");
      
      const proposalReq: any = {
        proposal: 1,
        amount: nextStake,
        basis: "stake",
        contract_type: type,
        currency: "USD",
        duration: 1,
        duration_unit: "t",
        req_id: reqId,
      };


      if (barrier !== undefined) {
        proposalReq.barrier = String(barrier);
      }

      if (isV4) {
        proposalReq.underlying_symbol = symbol;
      } else {
        proposalReq.symbol = symbol;
      }

      // Register the pending proposal before sending (supabaseId filled in background)
      pendingProposals.current.set(String(reqId), {
        symbol,
        dangerDigit: barrier ?? 0,
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
          setSessionState(prev => ({ ...prev, status: "LOSS", nextAction: "PRP_TMO" }));
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
  }, [config, wsRef, accountInfo, select_random_active_symbol]);

  const handle_result = useCallback((isWin: boolean, symbol: string, profit: number, supabaseId?: string) => {
    const state = sessionStateRef.current;
    
    let activeStrategy = config.strategy;
    if (config.strategy === "strategy_n") {
      activeStrategy = state.strategyNActiveSub || "strategy_l";
    } else if (config.strategy === "strategy_q") {
      activeStrategy = state.strategyQActiveSub || "strategy_a";
    }

    const baseStakeToUse = activeStrategy === "strategy_l"
      ? (config.strategyLBaseStake ?? config.baseStake)
      : (activeStrategy === "strategy_m"
        ? (config.strategyMBaseStake ?? config.baseStake)
        : (activeStrategy === "strategy_o"
          ? (config.strategyOBaseStake ?? config.baseStake)
          : (activeStrategy === "strategy_p"
            ? (config.strategyPBaseStake ?? config.baseStake)
            : config.baseStake)));

    const maxAllowedStake = (baseStakeToUse / 1.40) * STRATEGY_O_STAKES[2];
    const lastTradeExceededMax = activeStrategy === "strategy_o" && 
                                 !isWin && 
                                 state.currentStake >= maxAllowedStake - 0.01;

    const failedDirection = state.currentCategory
      ? categoryToCode(state.currentCategory)
      : (state.currentArrangement && state.currentArrangement.length > 0 && state.currentArrangement[state.sequenceStep]
          ? state.currentArrangement[state.sequenceStep]
          : "O5");
    const nextLossSeq = isWin || (activeStrategy === "strategy_o" && lastTradeExceededMax)
      ? []
      : [...(state.currentLossSequence || []), failedDirection];
    
    // Update per-symbol tracker
    symbolTrackerRef.current.set(symbol, {
      lastGroup: state.currentCategory && (state.currentCategory !== "over0" && state.currentCategory !== "under9") 
        ? getCategoryGroup(state.currentCategory as any) 
        : null,
    });

    setVolatilityTracking(prev => {
      const current = prev[symbol] || { consecutiveLosses: 0, pendingSuspension: false, suspendedUntil: null, pureConsecutiveLosses: 0 };
      let nextLosses = current.consecutiveLosses;
      let nextPending = current.pendingSuspension;
      let nextSuspendedUntil = current.suspendedUntil;
      let nextPureLosses = current.pureConsecutiveLosses ?? 0;

      // Pure consecutive losses tracker for selection brain: increment on loss, reset to 0 on win
      if (isWin) {
        nextPureLosses = 0;
      } else {
        nextPureLosses += 1;
      }

      if (activeStrategy === "strategy_c" || activeStrategy === "strategy_d" || activeStrategy === "strategy_e") {
        if (activeStrategy === "strategy_e") {
          const stdDev = calculate_reversion_score(symbol);
          const isChaotic = stdDev > 2.0;

          if (isWin) {
            if (current.pendingSuspension) {
              const mins = 5 + Math.random() * 5;
              const suspensionMs = mins * 60 * 1000;
              nextSuspendedUntil = Date.now() + suspensionMs;
              nextPending = false;
              nextLosses = 0;
              toast.success(`${symbol} recovered! Enacting deferred suspension for ${Math.round(mins)} minutes to cool down.`, {
                duration: 8000
              });
            } else {
              nextLosses = 0;
            }
          } else {
            if (state.martingaleStep < 5) {
              nextLosses += 1;
              if (nextLosses >= 5) {
                if (isChaotic) {
                  const mins = 5 + Math.random() * 5;
                  const suspensionMs = mins * 60 * 1000;
                  nextSuspendedUntil = Date.now() + suspensionMs;
                  nextLosses = 0;
                  toast.warning(`${symbol} hit 5 losses and classified as Chaotic (SD: ${stdDev.toFixed(2)}). Suspended immediately for ${Math.round(mins)} minutes. Swapping index.`, {
                    duration: 8000
                  });
                } else {
                  nextPending = true;
                  toast.info(`${symbol} hit 5 losses and classified as Stable (SD: ${stdDev.toFixed(2)}). Sticky recovery active. Suspension queued until win.`, {
                    duration: 8000
                  });
                }
              }
            } else {
              nextLosses = 0;
            }
          }
        } else if (activeStrategy === "strategy_d") {
          if (isWin) {
            nextLosses = 0;
          } else {
            // Only increment/suspend if we are on the first volatility run (martingaleStep < 5)
            if (state.martingaleStep < 5) {
              nextLosses += 1;
              if (nextLosses >= 5) {
                const mins = 5 + Math.random() * 5;
                const suspensionMs = mins * 60 * 1000;
                nextSuspendedUntil = Date.now() + suspensionMs;
                nextLosses = 0;
                toast.warning(`${symbol} suspended immediately for ${Math.round(mins)} minutes due to 5 consecutive losses. Swapping volatility index.`, {
                  duration: 8000
                });
              }
            } else {
              // Probe phase: do not increment towards suspension
              nextLosses = 0;
            }
          }
        } else {
          // Strategy C: Deferred Suspension
          if (isWin) {
            if (current.pendingSuspension) {
              // Recovered from a 5+ loss run! Enact suspension now.
              const mins = 5 + Math.random() * 5;
              const suspensionMs = mins * 60 * 1000;
              nextSuspendedUntil = Date.now() + suspensionMs;
              nextPending = false;
              nextLosses = 0;
              toast.success(`${symbol} recovered! Enacting suspension for ${Math.round(mins)} minutes to cool down.`, {
                duration: 8000
              });
            } else {
              // Normal win, reset losses
              nextLosses = 0;
            }
          } else {
            // Loss: increment losses
            nextLosses += 1;
            if (nextLosses >= 5 && !nextPending) {
              nextPending = true;
              toast.warning(`${symbol} hit 5 consecutive losses. Suspension queued until current run closes in a win.`, {
                duration: 8000
              });
            }
          }
        }
      } else {
        // Track basic consecutive losses for other strategies (alternating, strategy_a, strategy_b, strategy_f)
        if (isWin) {
          nextLosses = 0;
        } else {
          nextLosses += 1;
        }
      }

      return {
        ...prev,
        [symbol]: {
          consecutiveLosses: nextLosses,
          pendingSuspension: nextPending,
          suspendedUntil: nextSuspendedUntil,
          pureConsecutiveLosses: nextPureLosses
        }
      };
    });

    const newStatus = isWin ? "WIN" : "LOSS";
    let ticksToWaitNext = (activeStrategy === "strategy_l" || activeStrategy === "strategy_o" || activeStrategy === "strategy_p" || activeStrategy === "strategy_r")
      ? Math.floor(Math.random() * 4) + 5
      : randomTradeCooldownTicks(isWin);
    let nextAction = isWin
      ? `P_CD_${ticksToWaitNext}T`
      : `L_CD_${ticksToWaitNext}T`;

    const newRecord: TradeRecord = {
      id: Math.random().toString(36).substring(2, 11),
      symbol,
      sequence_name: activeSequenceNameRef.current,
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
      return [newRecord, ...filtered].slice(0, 2000);
    });

    // Update Daily Stats locally
    setDailyStats(prev => ({
      total_trades: prev.total_trades + 1,
      wins: prev.wins + (isWin ? 1 : 0)
    }));

    // Update Daily P/L locally regardless of Supabase success
    setDailyPL(prev => {
      return prev + profit;
    });

    setSessionPL(prev => {
      return prev + profit;
    });

    const now = Date.now();
    const effectiveStartAt = continuousTradeStartAtRef.current ?? now;
    const cooldownDurationMs = config.cooldownIntervalMinutes * 60 * 1000;
    if (now - effectiveStartAt >= cooldownDurationMs) {
      const intervalPauseSeconds = randomCooldownSeconds();
      ticksToWaitNext = Math.max(ticksToWaitNext, intervalPauseSeconds);
      nextAction = `${nextAction}_B_CD_${config.cooldownIntervalMinutes}M`;
      setContinuousTradeStartAt(now);
      setMartingaleCycles(0);
    }

    if (supabaseId) {
      supabase.from("trades").update({ result: isWin ? "won" : "lost", profit_loss: profit }).eq("id", supabaseId).then(({ error }) => {
        if (error) console.error("Error updating trade result in Supabase:", error);
      });
    }

    if (windDownMode && isWin) {
      nextAction = "WD_CMP";
      ticksToWaitNext = 0;
      setConfig(prev => ({ ...prev, enabled: false }));
      setWindDownMode(false);
      toast.success("Wind down complete: last confirmed trade closed in profit. Auto-automation stopped.");
    }

    let nextSeqStep = state.sequenceStep;
    let nextArrIndex = state.currentArrangementIndex;
    let nextArr = state.currentArrangement;
    let nextProgressIndex = state.arrangementProgressIndex;
    let nextSeed = state.shufflingSeed;

    if (activeStrategy === "strategy_a" || activeStrategy === "strategy_b" || activeStrategy === "strategy_c" || activeStrategy === "strategy_d" || activeStrategy === "strategy_e" || activeStrategy === "strategy_f" || activeStrategy === "strategy_g" || activeStrategy === "strategy_k" || activeStrategy === "strategy_m") {
      if (isWin) {
        // Each win allows a new sequence to be selected
        nextSeqStep = 0;
        nextProgressIndex = state.arrangementProgressIndex + 1;
        
        let totalArrangements = 369600;
        let elements = ['U4', 'O4', 'U5', 'O5'];
        let counts = [3, 3, 3, 3];
        
        if (activeStrategy === "strategy_c") {
          elements = ['U4', 'O4', 'U5', 'O5', 'EV', 'OD'];
          counts = [2, 2, 2, 2, 2, 2];
          totalArrangements = 7484400;
        } else if (activeStrategy === "strategy_d") {
          elements = ['U4', 'O4', 'U5', 'O5', 'EV', 'OD', 'RISE', 'FALL'];
          counts = [2, 2, 2, 2, 1, 1, 1, 1];
          totalArrangements = 29937600;
        } else if (activeStrategy === "strategy_k" || activeStrategy === "strategy_m") {
          elements = ['U4', 'O4', 'U5', 'O5', 'EV', 'OD', 'RISE', 'FALL'];
          counts = [1, 1, 1, 1, 1, 1, 1, 1];
          totalArrangements = 40320;
        }

        if (nextProgressIndex >= totalArrangements) {
          nextProgressIndex = 0;
          nextSeed = Math.floor(Math.random() * 100000) + 1;
        }

        if (activeStrategy === "strategy_f" || activeStrategy === "strategy_g" || activeStrategy === "strategy_k" || activeStrategy === "strategy_m") {
          // Find the next valid non-blacklisted arrangement
          let tempProgress = nextProgressIndex;
          const symbols = [
            "1HZ10V", "1HZ25V", "1HZ50V", "1HZ75V", "1HZ100V",
            "R_10", "R_25", "R_50", "R_75", "R_100",
          ];
          while (true) {
            const permIndex = lcgPermute(tempProgress, totalArrangements, nextSeed);
            const tempArrIndex = permIndex + 1;
            const tempArr = getNthPermutation(elements, counts, tempArrIndex);
            
            const isBlacklistedGlobally = isPrefixBlacklisted(tempArr, state.blacklistedPrefixes?.["global"] || []);
            
            const hasValidSymbol = isBlacklistedGlobally ? false : (
              (activeStrategy === "strategy_g" || activeStrategy === "strategy_k" || activeStrategy === "strategy_m") ? true : symbols.some(s => {
                const symbolBlacklist = state.blacklistedPrefixes?.[s] || [];
                return !isPrefixBlacklisted(tempArr, symbolBlacklist);
              })
            );

            if (hasValidSymbol) {
              nextArrIndex = tempArrIndex;
              nextArr = tempArr;
              nextProgressIndex = tempProgress;
              break;
            }
            console.log(`[Strategy ${activeStrategy.toUpperCase()} Pool Filter] Skipping arrangement #${tempArrIndex} because it matches a blacklisted prefix`);
            tempProgress = (tempProgress + 1) % totalArrangements;
          }
          toast.success(`Win! Selecting new valid arrangement #${nextArrIndex}`);
        } else {
          const permIndex = lcgPermute(nextProgressIndex, totalArrangements, nextSeed);
          nextArrIndex = permIndex + 1;
          nextArr = getNthPermutation(elements, counts, nextArrIndex);
          toast.success(`Win! Selecting new arrangement #${nextArrIndex}`);
        }
      } else {
        if ((activeStrategy === "strategy_f" && (state.currentSymbolLosses || 0) >= 4) || 
            (activeStrategy === "strategy_g" && state.martingaleStep >= 4) ||
            (activeStrategy === "strategy_k" && state.martingaleStep >= 4) ||
            (activeStrategy === "strategy_m" && state.martingaleStep >= 4)) {
          // 5th+ consecutive loss: Discard old arrangement, shuffle a brand new one!
          nextSeqStep = 0;
          nextProgressIndex = state.arrangementProgressIndex + 1;
          
          let elements = ['U4', 'O4', 'U5', 'O5'];
          let counts = [3, 3, 3, 3];
          let totalArrangements = 369600;
          if (activeStrategy === "strategy_k" || activeStrategy === "strategy_m") {
            elements = ['U4', 'O4', 'U5', 'O5', 'EV', 'OD', 'RISE', 'FALL'];
            counts = [1, 1, 1, 1, 1, 1, 1, 1];
            totalArrangements = 40320;
          }

          if (nextProgressIndex >= totalArrangements) {
            nextProgressIndex = 0;
            nextSeed = Math.floor(Math.random() * 100000) + 1;
          }

          const symbols = [
            "1HZ10V", "1HZ25V", "1HZ50V", "1HZ75V", "1HZ100V",
            "R_10", "R_25", "R_50", "R_75", "R_100",
          ];
          const remainingSymbols = symbols.filter(s => s !== symbol);

          // Get the nextBlacklist (calculate it here by adding the prefix that just failed to tempBlacklist)
          const tempBlacklist = { ...(state.blacklistedPrefixes || {}) };
          if (!tempBlacklist["global"]) tempBlacklist["global"] = [];
          
          const prefixToBlacklist = nextLossSeq.join(",");
          if (prefixToBlacklist && activeStrategy !== "strategy_k" && activeStrategy !== "strategy_m") {
            if (activeStrategy === "strategy_g") {
              const globalBlacklist = [...(tempBlacklist["global"] || [])];
              if (!globalBlacklist.includes(prefixToBlacklist)) {
                globalBlacklist.push(prefixToBlacklist);
                tempBlacklist["global"] = globalBlacklist;
                toast.warning(`Prefix [${prefixToBlacklist.split(",").join(" -> ")}] blacklisted GLOBALLY for the session due to ${nextLossSeq.length} consecutive losses. Shuffling new arrangement.`, {
                  duration: 8000
                });
                console.log(`[Strategy ${activeStrategy.toUpperCase()}] ${nextLossSeq.length} consecutive losses. Blacklisted prefix globally: ${prefixToBlacklist}`);
              }
            } else {
              const symbolBlacklist = [...(tempBlacklist[symbol] || [])];
              if (!symbolBlacklist.includes(prefixToBlacklist)) {
                symbolBlacklist.push(prefixToBlacklist);
                if (symbolBlacklist.length > MAX_BLACKLIST_SIZE) {
                  symbolBlacklist.shift();
                }
                tempBlacklist[symbol] = symbolBlacklist;
              }
            }
          }

          let tempProgressVal = nextProgressIndex;
          while (true) {
            const permIndex = lcgPermute(tempProgressVal, totalArrangements, nextSeed);
            const tempArrIndex = permIndex + 1;
            const tempArr = getNthPermutation(elements, counts, tempArrIndex);
            
            const isBlacklistedGlobally = isPrefixBlacklisted(tempArr, tempBlacklist["global"] || []);
            
            const hasValidSymbol = isBlacklistedGlobally ? false : (
              (activeStrategy === "strategy_g" || activeStrategy === "strategy_k" || activeStrategy === "strategy_m") ? true : remainingSymbols.some(s => {
                const symbolBlacklist = tempBlacklist[s] || [];
                return !isPrefixBlacklisted(tempArr, symbolBlacklist);
              })
            );

            if (hasValidSymbol) {
              nextArrIndex = tempArrIndex;
              nextArr = tempArr;
              nextProgressIndex = tempProgressVal;
              break;
            }
            tempProgressVal = (tempProgressVal + 1) % totalArrangements;
          }
          console.log(`[Strategy ${activeStrategy.toUpperCase()} ${nextLossSeq.length}th Loss] Shuffling brand new arrangement #${nextArrIndex} because current prefix was blacklisted.`);
        } else {
          // On Loss: pool all arrangements starting with the consecutive loss directions
          const lossPrefix = (state.currentArrangement || []).slice(0, state.sequenceStep + 1);
          
          // If loss prefix is valid (e.g. within 12 elements), pool and draw
          if (lossPrefix.length < (activeStrategy === "strategy_k" || activeStrategy === "strategy_m" ? 8 : 12)) {
            let elements = ['U4', 'O4', 'U5', 'O5'];
            let counts = [3, 3, 3, 3];
            if (activeStrategy === "strategy_c") {
              elements = ['U4', 'O4', 'U5', 'O5', 'EV', 'OD'];
              counts = [2, 2, 2, 2, 2, 2];
            } else if (activeStrategy === "strategy_d") {
              elements = ['U4', 'O4', 'U5', 'O5', 'EV', 'OD', 'RISE', 'FALL'];
              counts = [2, 2, 2, 2, 1, 1, 1, 1];
            } else if (activeStrategy === "strategy_k" || activeStrategy === "strategy_m") {
              elements = ['U4', 'O4', 'U5', 'O5', 'EV', 'OD', 'RISE', 'FALL'];
              counts = [1, 1, 1, 1, 1, 1, 1, 1];
            }
            
            if (activeStrategy === "strategy_k" || activeStrategy === "strategy_m") {
              let attempts = 0;
              do {
                nextArr = getRandomSequenceWithPrefix(lossPrefix, elements, counts);
                attempts++;
              } while (
                attempts < 100 &&
                isPrefixBlacklisted(nextArr, state.blacklistedPrefixes?.["global"] || [])
              );
            } else {
              nextArr = getRandomSequenceWithPrefix(lossPrefix, elements, counts);
            }
            nextArrIndex = getPermutationIndex(elements, counts, nextArr);
            nextSeqStep = state.sequenceStep + 1;
            
            toast.info(`Loss! Pooled prefix [${lossPrefix.join(", ")}]. Selected arrangement #${nextArrIndex}`);
            console.log(`[AutoTrader] Loss! Prefix: ${lossPrefix.join(", ")}. Pooled and selected arrangement #${nextArrIndex}`);
          } else {
            // If we reached the end of the sequence, start all over
            nextSeqStep = 0;
            nextProgressIndex = state.arrangementProgressIndex + 1;
            
            let totalArrangements = 369600;
            let elements = ['U4', 'O4', 'U5', 'O5'];
            let counts = [3, 3, 3, 3];
            if (activeStrategy === "strategy_c") {
              elements = ['U4', 'O4', 'U5', 'O5', 'EV', 'OD'];
              counts = [2, 2, 2, 2, 2, 2];
              totalArrangements = 7484400;
            } else if (activeStrategy === "strategy_d") {
              elements = ['U4', 'O4', 'U5', 'O5', 'EV', 'OD', 'RISE', 'FALL'];
              counts = [2, 2, 2, 2, 1, 1, 1, 1];
              totalArrangements = 29937600;
            } else if (activeStrategy === "strategy_k" || activeStrategy === "strategy_m") {
              elements = ['U4', 'O4', 'U5', 'O5', 'EV', 'OD', 'RISE', 'FALL'];
              counts = [1, 1, 1, 1, 1, 1, 1, 1];
              totalArrangements = 40320;
            }

            if (nextProgressIndex >= totalArrangements) {
              nextProgressIndex = 0;
              nextSeed = Math.floor(Math.random() * 100000) + 1;
            }
            if (activeStrategy === "strategy_k" || activeStrategy === "strategy_m") {
              let tempProgressVal = nextProgressIndex;
              while (true) {
                const permIndex = lcgPermute(tempProgressVal, totalArrangements, nextSeed);
                const tempArrIndex = permIndex + 1;
                const tempArr = getNthPermutation(elements, counts, tempArrIndex);
                if (!isPrefixBlacklisted(tempArr, state.blacklistedPrefixes?.["global"] || [])) {
                  nextArrIndex = tempArrIndex;
                  nextArr = tempArr;
                  nextProgressIndex = tempProgressVal;
                  break;
                }
                tempProgressVal = (tempProgressVal + 1) % totalArrangements;
              }
            } else {
              const permIndex = lcgPermute(nextProgressIndex, totalArrangements, nextSeed);
              nextArrIndex = permIndex + 1;
              nextArr = getNthPermutation(elements, counts, nextArrIndex);
            }
            toast.warning(`Cycle limit reached! Rotating to new arrangement #${nextArrIndex}`);
          }
        }
      }
    } else {
      nextSeqStep = isWin ? 0 : state.sequenceStep;
    }

    let nextSymbolLosses = state.currentSymbolLosses || 0;
    let nextForceSwapSymbol = state.forceSwapSymbol || false;
    let nextBlacklist = { ...(state.blacklistedPrefixes || {}) };

    if (isWin && (activeStrategy === "strategy_k" || activeStrategy === "strategy_m")) {
      if (state.currentLossSequence && state.currentLossSequence.length >= 5) {
        const prefixToBlacklist = state.currentLossSequence.join(",");
        if (!nextBlacklist["global"]) nextBlacklist["global"] = [];
        const globalBlacklist = [...(nextBlacklist["global"] || [])];
        if (!globalBlacklist.includes(prefixToBlacklist)) {
          globalBlacklist.push(prefixToBlacklist);
          nextBlacklist["global"] = globalBlacklist;
          toast.warning(`Prefix [${prefixToBlacklist.split(",").join(" -> ")}] blacklisted GLOBALLY for the session after recovery from ${state.currentLossSequence.length} consecutive losses.`, {
            duration: 8000
          });
          console.log(`[Strategy K] Recovery win. Blacklisted prefix globally: ${prefixToBlacklist}`);
        }
      }
    }

    if (activeStrategy === "strategy_d" || activeStrategy === "strategy_e" || activeStrategy === "strategy_f" || activeStrategy === "strategy_g" || activeStrategy === "strategy_k" || activeStrategy === "strategy_m") {
      if (isWin) {
        nextSymbolLosses = 0;
        nextForceSwapSymbol = false;
      } else {
        nextSymbolLosses += 1;
        
        if (activeStrategy === "strategy_f") {
          if (nextSymbolLosses >= 5) {
            const prefix = nextLossSeq.join(",");
            if (prefix) {
              const symbolBlacklist = [...(nextBlacklist[symbol] || [])];
              if (!symbolBlacklist.includes(prefix)) {
                symbolBlacklist.push(prefix);
                if (symbolBlacklist.length > MAX_BLACKLIST_SIZE) {
                  symbolBlacklist.shift();
                }
                nextBlacklist[symbol] = symbolBlacklist;
                toast.warning(`Prefix [${prefix.split(",").join(" -> ")}] blacklisted specifically for ${symbol} due to ${nextLossSeq.length} consecutive losses. Swapping index.`, {
                  duration: 8000
                });
                console.log(`[Strategy F] ${nextSymbolLosses} consecutive losses on ${symbol}. Blacklisted prefix: ${prefix}. Swapping symbol.`);
              }
            }
            nextSymbolLosses = 0;
            nextForceSwapSymbol = true;
          }
        } else if (activeStrategy === "strategy_g") {
          if (state.martingaleStep >= 4) {
            const prefix = nextLossSeq.join(",");
            if (prefix) {
              if (!nextBlacklist["global"]) nextBlacklist["global"] = [];
              const globalBlacklist = [...(nextBlacklist["global"] || [])];
              if (!globalBlacklist.includes(prefix)) {
                globalBlacklist.push(prefix);
                nextBlacklist["global"] = globalBlacklist;
                toast.warning(`Prefix [${prefix.split(",").join(" -> ")}] blacklisted GLOBALLY for the session due to ${nextLossSeq.length} consecutive losses. Shuffling new arrangement.`, {
                  duration: 8000
                });
                console.log(`[Strategy ${activeStrategy.toUpperCase()}] ${nextLossSeq.length} consecutive losses. Blacklisted prefix globally: ${prefix}`);
              }
            }
          }
        } else if (activeStrategy === "strategy_e") {
          const stdDev = calculate_reversion_score(symbol);
          const isChaotic = stdDev > 2.0;

          if (state.martingaleStep < 5) {
            if (nextSymbolLosses === 5) {
              if (isChaotic) {
                nextSymbolLosses = 0;
                nextForceSwapSymbol = true;
              } else {
                // For Stable index, we stay sticky!
              }
            }
          } else {
            if (nextSymbolLosses === 2) {
              nextSymbolLosses = 0;
              nextForceSwapSymbol = true;
            }
          }
        } else {
          // Strategy D
          if (state.martingaleStep < 5) {
            if (nextSymbolLosses === 5) {
              nextSymbolLosses = 0;
              nextForceSwapSymbol = true;
            }
          } else {
            if (nextSymbolLosses === 2) {
              nextSymbolLosses = 0;
              nextForceSwapSymbol = true;
            }
          }
        }
      }
    } else {
      nextSymbolLosses = 0;
      nextForceSwapSymbol = false;
    }

    let nextFibonacciIndex = state.fibonacciIndex;
    let nextUsedStartIndices = state.usedStartIndices || [];
    if (activeStrategy === "strategy_h") {
      if (isWin) {
        nextFibonacciIndex = selectUnusedFibonacciIndex(state.usedStartIndices || []);
        nextUsedStartIndices = [...nextUsedStartIndices, nextFibonacciIndex];
        console.log(`[Strategy H Result] Trade Won! Selecting new random fibonacciIndex k = ${nextFibonacciIndex} for next trade. Blacklisted indices count: ${nextUsedStartIndices.length}`);
      } else {
        nextFibonacciIndex = (state.fibonacciIndex ?? 0) + 1;
        console.log(`[Strategy H Result] Trade Lost! Incrementing fibonacciIndex to sequential recovery step k = ${nextFibonacciIndex} for next trade.`);
      }
    }

    let nextJStartA = state.strategyJ_fibStartA ?? -1;
    let nextJStartB = state.strategyJ_fibStartB ?? -1;
    let nextJStep = state.strategyJ_fibStep ?? -1;
    if (activeStrategy === "strategy_j") {
      if (isWin) {
        nextJStartA = Math.floor(Math.random() * 1000000000) + 1;
        nextJStartB = Math.floor(Math.random() * 1000000000) + 1;
        nextJStep = 0;
        console.log(`[Strategy J Result] Trade Won! Re-seeding generalized Fibonacci seeds: A = ${nextJStartA}, B = ${nextJStartB}, step = ${nextJStep}`);
      } else {
        nextJStep = (state.strategyJ_fibStep ?? 0) + 1;
        console.log(`[Strategy J Result] Trade Lost! Advancing step to next Fibonacci sequence number: step = ${nextJStep}`);
      }
    }

    let nextNActiveSub = state.strategyNActiveSub;
    let nextNNextSwitchTime = state.strategyNNextSwitchTime;
    let isStrategyNSwitching = false;

    if (config.strategy === "strategy_n" && isWin && state.strategyNNextSwitchTime && Date.now() >= state.strategyNNextSwitchTime) {
      const currentSub = state.strategyNActiveSub || "strategy_l";
      nextNActiveSub = currentSub === "strategy_l" ? "strategy_m" : "strategy_l";
      nextNNextSwitchTime = Date.now() + 300000 + Math.floor(Math.random() * 180000); // 5 to 8 minutes
      isStrategyNSwitching = true;
      
      console.log(`[Strategy N Wrapper] Switching sub-strategy from ${currentSub} to ${nextNActiveSub}. Next switch time: ${new Date(nextNNextSwitchTime).toLocaleTimeString()}`);
      toast.success(`Strategy N: Switching to ${nextNActiveSub.toUpperCase()}! Next switch in ~${Math.round((nextNNextSwitchTime - Date.now()) / 60000)}m`, {
        duration: 8000
      });
    }

    let nextQActiveSub = state.strategyQActiveSub;
    let nextQRemainingRuns = state.strategyQRemainingRuns !== undefined ? state.strategyQRemainingRuns - 1 : undefined;
    let nextQLastSub = state.strategyQLastSub;
    let isStrategyQSwitching = false;

    if (config.strategy === "strategy_q") {
      if (nextQRemainingRuns !== undefined) {
        console.log(`[Strategy Q Result] Sub-strategy ${nextQActiveSub} runs remaining: ${nextQRemainingRuns}`);
        if (nextQRemainingRuns <= 0) {
          isStrategyQSwitching = true;
          const pool = ["strategy_a", "strategy_b", "strategy_c", "strategy_d"].filter(
            s => s !== nextQLastSub
          );
          nextQActiveSub = pool[Math.floor(Math.random() * pool.length)] as any;
          nextQRemainingRuns = Math.floor(Math.random() * 21) + 20; // 20 to 40 runs
          nextQLastSub = nextQActiveSub;
          
          console.log(`[Strategy Q Result] Switching sub-strategy to ${nextQActiveSub}. Allocated runs: ${nextQRemainingRuns}`);
          toast.success(`Strategy Q: Switching to ${nextQActiveSub.replace("strategy_", "").toUpperCase()} for ${nextQRemainingRuns} runs!`, {
            duration: 8000
          });
        }
      }
    }

    let nextSessionState = {
      ...state,
      status: newStatus,
      nextAction,
      currentStake: (activeStrategy === "strategy_l" || activeStrategy === "strategy_o" || activeStrategy === "strategy_p" || activeStrategy === "strategy_r")
        ? state.currentStake 
        : (isWin ? baseStakeToUse : state.currentStake),
      martingaleStep: isWin ? 0 : state.martingaleStep,
      sequenceStep: nextSeqStep,
      currentArrangementIndex: nextArrIndex,
      currentArrangement: nextArr,
      arrangementProgressIndex: nextProgressIndex,
      shufflingSeed: nextSeed,
      currentSymbolLosses: nextSymbolLosses,
      forceSwapSymbol: nextForceSwapSymbol,
      blacklistedPrefixes: nextBlacklist,
      fibonacciIndex: nextFibonacciIndex,
      usedStartIndices: nextUsedStartIndices,
      strategyJ_fibStartA: nextJStartA,
      strategyJ_fibStartB: nextJStartB,
      strategyJ_fibStep: nextJStep,
      currentLossSequence: nextLossSeq,
      strategyNActiveSub: nextNActiveSub,
      strategyNNextSwitchTime: nextNNextSwitchTime,
      strategyOSequenceBaseStake: isWin || (activeStrategy === "strategy_o" && lastTradeExceededMax) ? undefined : state.strategyOSequenceBaseStake,
      strategyPSequenceBaseStake: isWin ? undefined : state.strategyPSequenceBaseStake,
      strategyPAccumulatedLoss: isWin ? undefined : state.strategyPAccumulatedLoss,
      strategyRSequenceBaseStake: isWin ? undefined : state.strategyRSequenceBaseStake,
      strategyRAccumulatedLoss: isWin ? undefined : state.strategyRAccumulatedLoss,
      strategyQActiveSub: nextQActiveSub,
      strategyQRemainingRuns: nextQRemainingRuns,
      strategyQLastSub: nextQLastSub,
    };

    if (isStrategyNSwitching || isStrategyQSwitching) {
      const nextBaseStake = isStrategyQSwitching
        ? config.baseStake
        : (nextNActiveSub === "strategy_l"
          ? (config.strategyLBaseStake ?? config.baseStake)
          : (config.strategyMBaseStake ?? config.baseStake));

      nextSessionState = {
        ...nextSessionState,
        currentStake: nextBaseStake,
        martingaleStep: 0,
        sequenceStep: 0,
        currentArrangementIndex: 0,
        currentArrangement: [],
        currentSymbolLosses: 0,
        forceSwapSymbol: false,
        currentLossSequence: [],
        strategyLMode: undefined,
        strategyLNoneStickyCount: undefined,
      };
    }

    sessionStateRef.current = nextSessionState;
    setSessionState(nextSessionState);
    setTicksToWait(ticksToWaitNext);
    
    // Crucial: Reset the execution lock only AFTER the result is processed
    isExecutingRef.current = false;
    console.log(JSON.stringify({
      event: "trade_settled",
      sequence: activeSequenceNameRef.current,
      step: stepIndexRef.current,
      trade: state.currentContract,
      result: newStatus,
      symbol,
      status: newStatus,
      profit: Number(profit.toFixed(2)),
      next_action: nextAction,
      ticks_to_wait: ticksToWaitNext,
      timestamp: new Date().toISOString()
    }, null, 2));
    
    if (ticksToWaitNext === 0 && !(windDownMode && isWin)) {
      if (enabledRef.current) {
        console.log("[AutoTrader] Scheduling next trade immediately...");
        setTimeout(() => execute_trade(), 0);
      } else {
        console.log("%c[AutoTrader] Bot disabled, stopping loop after trade settlement.", "color: red; font-weight: bold;");
      }
    }
  }, [execute_trade, config, windDownMode, randomCooldownSeconds, randomTradeCooldownTicks]);

  const handleTradeMessage = useCallback((data: any) => {
    if (data.msg_type !== "tick") {
      console.log(`[AutoTrader] Received message type: ${data.msg_type}`, data);
    }

    if (data.msg_type === "profit_table" && data.profit_table) {
      const transactions = data.profit_table.transactions || [];
      const isFirstPage = (data.echo_req.offset || 0) === 0;
      
      // Use a temporary calculation to avoid intermediate state flickers
      let pageProfit = 0;
      let pageWins = 0;
      
      transactions.forEach((t: any) => {
        const profit = (Number(t.sell_price) || 0) - (Number(t.buy_price) || 0);
        pageProfit += profit;
        if (profit > 0) pageWins++;
      });

      // Update our accumulation refs (using functional updates or refs to keep track across pages)
      // For simplicity, we'll use the echo_req to know if we should reset
      if (isFirstPage) {
        (window as any)._dailyPLBuffer = { profit: pageProfit, trades: transactions.length, wins: pageWins };
      } else {
        const buffer = (window as any)._dailyPLBuffer || { profit: 0, trades: 0, wins: 0 };
        buffer.profit += pageProfit;
        buffer.trades += transactions.length;
        buffer.wins += pageWins;
      }

      const buffer = (window as any)._dailyPLBuffer;

      // If we got a full page and haven't hit a safety limit (e.g. 1,000,000 trades), fetch next
      if (transactions.length === 500 && buffer.trades < 1000000) {
        console.log(`[AutoTrader] Received 500 trades (Total: ${buffer.trades}), fetching next page...`);
        fetchDailyPL(buffer.trades);
      } else {
        console.log(`[AutoTrader] Daily P/L Reconciled: $${buffer.profit.toFixed(2)} (Wins: ${buffer.wins}, Total: ${buffer.trades})`);
        setDailyPL(buffer.profit);
        setDailyStats({
          total_trades: buffer.trades,
          wins: buffer.wins
        });
      }
      return;
    }

    if (!config.enabled && !["proposal_open_contract", "buy"].includes(data.msg_type) && !data.error) return;

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
      const status = poc.status;
      const isFinished = poc.is_sold || poc.is_expired || ["won", "lost", "sold", "expired"].includes(status);

      console.log(`[AutoTrader] Contract ${contractId} update: status=${status}, is_sold=${poc.is_sold}, profit=${poc.profit}`);

      if (isFinished) {
        if (!settledContracts.current.has(contractId)) {
          console.log(`[AutoTrader] Settling contract ${contractId} (${status})`);
          settledContracts.current.add(contractId);
          const isWin = (poc.profit ?? 0) > 0 || status === "won";
          const profit = Number(poc.profit) || 0;
          const openC = openContracts.current.get(contractId);
          handle_result(isWin, openC?.symbol || poc.underlying || poc.symbol || "", profit, openC?.supabaseId);
        }
        
        // Always remove from openContracts if finished to stop watchdog polling
        if (openContracts.current.has(contractId)) {
          console.log(`[AutoTrader] Removing ${contractId} from active monitoring`);
          openContracts.current.delete(contractId);
        }
      }
    }

    if (data.msg_type === "profit_table" && data.profit_table) {
      // Handled above the enabled check
      return;
    }

    if (data.error) {
      const reqId = String(data.req_id);
      console.error(`[AutoTrader] API Error (req_id: ${reqId}):`, data.error);

      // Reset execution lock if this error belongs to a pending trade attempt
      if (pendingProposals.current.has(reqId) || Array.from(pendingBuys.current.keys()).includes(reqId)) {
        toast.error(`Trade error: ${data.error.message}`);
        setSessionState(prev => ({ ...prev, status: "LOSS", nextAction: "ERR_RTY" }));
        setTicksToWait(30);
        isExecutingRef.current = false;
        
        pendingProposals.current.delete(reqId);
        // Clear buy if match
        const buyReq = Array.from(pendingBuys.current.keys()).find(k => k === reqId);
        if (buyReq) pendingBuys.current.delete(buyReq);
      }

      // If it's a contract status error and we have it in openContracts, clear it
      if (data.msg_type === "proposal_open_contract" && data.error.code === "ContractNotFound") {
        // We don't have the contract ID directly in the error top-level usually, 
        // but we can check our open contracts if the watchdog just polled.
        console.warn("[AutoTrader] Contract not found on Deriv. Clearing stale references.");
        openContracts.current.clear(); // Nuclear option if we hit this, or we could be more specific
        isExecutingRef.current = false;
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


  const fetchDailyPL = useCallback(async (offset = 0) => {
    try {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        console.warn("[AutoTrader] fetchDailyPL: WebSocket not ready");
        return;
      }

      const now = new Date();
      // Get start of today in UTC (00:00:00 UTC)
      const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
      const epoch = Math.floor(startOfToday.getTime() / 1000);

      if (offset === 0) {
        console.log(`[AutoTrader] Requesting profit_table from Deriv since ${startOfToday.toISOString()} (UTC)`);
      }

      ws.send(JSON.stringify({
        profit_table: 1,
        date_from: epoch,
        limit: 500,
        offset: offset,
        sort: "ASC"
      }));
    } catch (err) {
      console.error("Unexpected error in fetchDailyPL:", err);
    }
  }, [wsRef]);

  useEffect(() => {
    if (!user?.id || !connected || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    const recoverPendingTrades = async () => {
      try {
        console.log("[AutoTrader] Recovery: Checking for pending trades in database...");
        const { data: pendingTrades, error } = await supabase
          .from("trades")
          .select("*")
          .eq("user_id", user.id)
          .eq("result", "pending")
          .not("contract_id", "is", null);

        if (error) throw error;
        if (!pendingTrades || pendingTrades.length === 0) return;

        console.log(`[AutoTrader] Recovery: Found ${pendingTrades.length} pending trades. Resolving...`);
        
        pendingTrades.forEach(trade => {
          if (trade.contract_id) {
            // Populate openContracts so handle_result can find it
            openContracts.current.set(trade.contract_id, {
              symbol: trade.symbol || "",
              stake: Number(trade.stake) || 0,
              timestamp: new Date(trade.timestamp).getTime(),
              supabaseId: trade.id
            });
            requestContractStatus(trade.contract_id);
          }
        });
      } catch (err) {
        console.error("[AutoTrader] Recovery failed:", err);
      }
    };

    // Delay recovery slightly to ensure socket is ready for multiple requests
    const timer = setTimeout(recoverPendingTrades, 2000);
    return () => clearTimeout(timer);
  }, [user?.id, connected, requestContractStatus, wsRef]);

  useEffect(() => {
    if (connected && accountInfo?.loginid) {
      fetchDailyPL();
    }
    const interval = setInterval(() => {
      if (connected && accountInfo?.loginid) {
        fetchDailyPL();
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchDailyPL, user?.id, connected, accountInfo?.loginid]);

  useEffect(() => {
    localStorage.setItem('autoTraderConfig', JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    localStorage.setItem('tradeLog', JSON.stringify(tradeLog.slice(0, 50)));
  }, [tradeLog]);

  useEffect(() => {
    localStorage.setItem('arrangementProgressIndex', String(sessionState.arrangementProgressIndex));
    localStorage.setItem('shufflingSeed', String(sessionState.shufflingSeed));
    localStorage.setItem('currentArrangementIndex', String(sessionState.currentArrangementIndex));
    localStorage.setItem('currentArrangement', JSON.stringify(sessionState.currentArrangement));
    localStorage.setItem('sequenceStep', String(sessionState.sequenceStep));
    localStorage.setItem('martingaleStep', String(sessionState.martingaleStep));
    localStorage.setItem('currentStake', String(sessionState.currentStake));
    localStorage.setItem('sessionStatus', sessionState.status);
    localStorage.setItem('currentSymbol', sessionState.currentSymbol);
    if (sessionState.currentCategory) {
      localStorage.setItem('currentCategory', sessionState.currentCategory);
    } else {
      localStorage.removeItem('currentCategory');
    }
    localStorage.setItem('currentSymbolLosses', String(sessionState.currentSymbolLosses));
    localStorage.setItem('forceSwapSymbol', String(sessionState.forceSwapSymbol));
    localStorage.setItem('blacklistedPrefixes', JSON.stringify(sessionState.blacklistedPrefixes || []));
    localStorage.setItem('fibonacciIndex', String(sessionState.fibonacciIndex ?? -1));
    localStorage.setItem('usedStartIndices', JSON.stringify(sessionState.usedStartIndices || []));
    localStorage.setItem('strategyJ_fibStartA', String(sessionState.strategyJ_fibStartA ?? -1));
    localStorage.setItem('strategyJ_fibStartB', String(sessionState.strategyJ_fibStartB ?? -1));
    localStorage.setItem('strategyJ_fibStep', String(sessionState.strategyJ_fibStep ?? -1));
    localStorage.setItem('currentLossSequence', JSON.stringify(sessionState.currentLossSequence || []));
    if (sessionState.strategyLMode) {
      localStorage.setItem('strategyLMode', sessionState.strategyLMode);
    } else {
      localStorage.removeItem('strategyLMode');
    }
    if (sessionState.strategyLNoneStickyCount !== undefined) {
      localStorage.setItem('strategyLNoneStickyCount', String(sessionState.strategyLNoneStickyCount));
    } else {
      localStorage.removeItem('strategyLNoneStickyCount');
    }
    if (sessionState.strategyNActiveSub) {
      localStorage.setItem('strategyNActiveSub', sessionState.strategyNActiveSub);
    } else {
      localStorage.removeItem('strategyNActiveSub');
    }
    if (sessionState.strategyNNextSwitchTime) {
      localStorage.setItem('strategyNNextSwitchTime', String(sessionState.strategyNNextSwitchTime));
    } else {
      localStorage.removeItem('strategyNNextSwitchTime');
    }
    if (sessionState.strategyOSequenceBaseStake !== undefined) {
      localStorage.setItem('strategyOSequenceBaseStake', String(sessionState.strategyOSequenceBaseStake));
    } else {
      localStorage.removeItem('strategyOSequenceBaseStake');
    }
    if (sessionState.strategyPSequenceBaseStake !== undefined) {
      localStorage.setItem('strategyPSequenceBaseStake', String(sessionState.strategyPSequenceBaseStake));
    } else {
      localStorage.removeItem('strategyPSequenceBaseStake');
    }
    if (sessionState.strategyPAccumulatedLoss !== undefined) {
      localStorage.setItem('strategyPAccumulatedLoss', String(sessionState.strategyPAccumulatedLoss));
    } else {
      localStorage.removeItem('strategyPAccumulatedLoss');
    }
    if (sessionState.strategyRSequenceBaseStake !== undefined) {
      localStorage.setItem('strategyRSequenceBaseStake', String(sessionState.strategyRSequenceBaseStake));
    } else {
      localStorage.removeItem('strategyRSequenceBaseStake');
    }
    if (sessionState.strategyRAccumulatedLoss !== undefined) {
      localStorage.setItem('strategyRAccumulatedLoss', String(sessionState.strategyRAccumulatedLoss));
    } else {
      localStorage.removeItem('strategyRAccumulatedLoss');
    }
    if (sessionState.strategyRMode) {
      localStorage.setItem('strategyRMode', sessionState.strategyRMode);
    } else {
      localStorage.removeItem('strategyRMode');
    }
    if (sessionState.strategyRModeCount !== undefined) {
      localStorage.setItem('strategyRModeCount', String(sessionState.strategyRModeCount));
    } else {
      localStorage.removeItem('strategyRModeCount');
    }
    if (sessionState.strategyQActiveSub) {
      localStorage.setItem('strategyQActiveSub', sessionState.strategyQActiveSub);
    } else {
      localStorage.removeItem('strategyQActiveSub');
    }
    if (sessionState.strategyQRemainingRuns !== undefined) {
      localStorage.setItem('strategyQRemainingRuns', String(sessionState.strategyQRemainingRuns));
    } else {
      localStorage.removeItem('strategyQRemainingRuns');
    }
    if (sessionState.strategyQLastSub) {
      localStorage.setItem('strategyQLastSub', sessionState.strategyQLastSub);
    } else {
      localStorage.removeItem('strategyQLastSub');
    }
  }, [sessionState]);

  useEffect(() => {
    if (!user?.id) return;
    const syncConfig = async () => {
      // Don't sync from cloud if the user recently performed a manual action (prevent overwriting new state with old DB state)
      if (Date.now() - lastManualActionRef.current < 10000) {
        console.log("[AutoTrader] Sync from cloud blocked: recent manual activity detected.");
        return;
      }

      const { data } = await supabase.from('user_configs').select('config').eq('user_id', user.id).maybeSingle();
      if (data?.config) {
        const merged = { ...config, ...data.config };
        const sanitized = sanitizeConfig(merged);
        
        // If we sanitized it (changed something), save it back to ensure DB is clean
        if (sanitized.baseStake !== merged.baseStake || sanitized.maxMartingaleSteps !== merged.maxMartingaleSteps) {
          console.log("[AutoTrader] Sanitized legacy config:", sanitized);
          // Don't wait for this
          supabase.from('user_configs').upsert({ user_id: user.id, config: sanitized });
        }

        // Only merge if meaningful changes exist and avoid flipping 'enabled' back to true if it was locally disabled
        const isDifferent = JSON.stringify(sanitized) !== JSON.stringify(config);
        
        if (isDifferent) {
          console.group("[AutoTrader] Syncing config from Supabase");
          console.log("Local Config:", config);
          console.log("Cloud Config:", sanitized);
          
          setConfig(prev => {
            const finalEnabled = prev.enabled === false ? false : sanitized.enabled;
            if (finalEnabled !== sanitized.enabled && sanitized.enabled === true) {
              console.warn("[AutoTrader] Cloud tried to enable bot, but local is disabled. Overriding cloud.");
            }
            return { ...prev, ...sanitized, enabled: finalEnabled };
          });
          console.groupEnd();
        }
      }
    };
    syncConfig();
  }, [user?.id]);

  // Cross-tab sync for localStorage
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'autoTraderConfig' && e.newValue) {
        try {
          const newConfig = sanitizeConfig(JSON.parse(e.newValue));
          if (JSON.stringify(newConfig) !== JSON.stringify(config)) {
            console.log("[AutoTrader] Syncing config from other tab...");
            setConfig(newConfig);
          }
        } catch (err) {
          console.error("[AutoTrader] Cross-tab sync failed:", err);
        }
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [config]);

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

  // Monitor balance changes and disable bot if balance is lower than stake
  useEffect(() => {
    if (!config.enabled) return;
    const balance = accountInfo?.balance;
    if (balance !== undefined && balance !== null) {
      if (sessionState.status === "PENDING") return;

      const requiredStake = (sessionState.status === "WIN" || sessionState.status === "IDLE")
        ? config.baseStake
        : (sessionState.currentStake || config.baseStake);

      if (balance < requiredStake) {
        console.warn(`[AutoTrader] Insufficient balance: Available: $${balance.toFixed(2)}, Required: $${requiredStake.toFixed(2)}. Disabling bot.`);
        toast.error(`Insufficient balance. Available: $${balance.toFixed(2)}, Required stake: $${requiredStake.toFixed(2)}. AI-automation stopped.`);
        setConfig(prev => ({ ...prev, enabled: false }));
      }
    }
  }, [accountInfo?.balance, config.baseStake, config.enabled, sessionState.currentStake, sessionState.status]);

  useEffect(() => {
    if (!config.enabled && windDownMode) {
      setWindDownMode(false);
    }
  }, [config.enabled, windDownMode]);

  useEffect(() => {
    if (!config.enabled) {
      symbolTrackerRef.current.clear();
      console.log("[AutoTrader] Symbol state trackers reset (auto-trading disabled)");
    }
  }, [config.enabled]);

  useEffect(() => {
    if (!config.enabled) {
      setContinuousTradeStartAt(null);
    } else if (!continuousTradeStartAt) {
      setContinuousTradeStartAt(Date.now());
    }
  }, [config.enabled, continuousTradeStartAt]);

  // Reset session blacklist on new day session start
  useEffect(() => {
    if (config.enabled) {
      const currentDay = getLocalDayString();
      const lastSessionDay = localStorage.getItem('lastSessionDate');

      if (lastSessionDay && lastSessionDay !== currentDay) {
        const emptyBlacklist: Record<string, string[]> = {};
        const symbols = [
          "1HZ10V", "1HZ25V", "1HZ50V", "1HZ75V", "1HZ100V",
          "R_10", "R_25", "R_50", "R_75", "R_100",
        ];
        symbols.forEach(s => emptyBlacklist[s] = []);
        emptyBlacklist["global"] = [];
        
        setSessionState(prev => ({
          ...prev,
          blacklistedPrefixes: emptyBlacklist
        }));
        localStorage.setItem('blacklistedPrefixes', JSON.stringify(emptyBlacklist));
        toast.info("New day detected. Resetting session blacklist.");
        console.log(`[AutoTrader] New day detected (${currentDay} vs ${lastSessionDay}). Resetting blacklist.`);
      }
      
      localStorage.setItem('lastSessionDate', currentDay);
    }
  }, [config.enabled]);

  const activateWindDown = useCallback(() => {
    if (!config.enabled) {
      toast.error("Enable auto-automation before activating wind down.");
      return;
    }
    setWindDownMode(true);
    toast.info("Wind down armed: bot will stop only after the next profitable settled trade.");
  }, [config.enabled]);

  const resetTradeLog = useCallback(() => {
    setTradeLog([]);
    
    const initial: Record<string, VolatilityTracking> = {};
    const symbols = [
      "1HZ10V", "1HZ25V", "1HZ50V", "1HZ75V", "1HZ100V",
      "R_10", "R_25", "R_50", "R_75", "R_100",
    ];
    symbols.forEach(s => {
      initial[s] = { consecutiveLosses: 0, pendingSuspension: false, suspendedUntil: null };
    });
    setVolatilityTracking(initial);
    
    const newSeed = Math.floor(Math.random() * 100000) + 1;
    const newProgress = 0;
    
    let totalArrangements = 369600;
    let elements = ['U4', 'O4', 'U5', 'O5'];
    let counts = [3, 3, 3, 3];
    if (config.strategy === "strategy_c") {
      elements = ['U4', 'O4', 'U5', 'O5', 'EV', 'OD'];
      counts = [2, 2, 2, 2, 2, 2];
      totalArrangements = 7484400;
    } else if (config.strategy === "strategy_d") {
      elements = ['U4', 'O4', 'U5', 'O5', 'EV', 'OD', 'RISE', 'FALL'];
      counts = [2, 2, 2, 2, 1, 1, 1, 1];
      totalArrangements = 29937600;
    } else if (config.strategy === "strategy_k" || config.strategy === "strategy_m") {
      elements = ['U4', 'O4', 'U5', 'O5', 'EV', 'OD', 'RISE', 'FALL'];
      counts = [1, 1, 1, 1, 1, 1, 1, 1];
      totalArrangements = 40320;
    }

    const permIndex = lcgPermute(newProgress, totalArrangements, newSeed);
    const newArrIndex = permIndex + 1;
    const newArr = getNthPermutation(elements, counts, newArrIndex);

    const currentDay = getLocalDayString();
    const lastSessionDay = localStorage.getItem('lastSessionDate');

    let blacklistToUse: Record<string, string[]> = {};
    if (lastSessionDay === currentDay) {
      const saved = localStorage.getItem('blacklistedPrefixes');
      if (saved) {
        try {
          blacklistToUse = JSON.parse(saved);
        } catch (e) {}
      }
    }

    if (!blacklistToUse || Object.keys(blacklistToUse).length === 0) {
      symbols.forEach(s => blacklistToUse[s] = []);
      blacklistToUse["global"] = [];
    }

    setSessionState({
      currentStake: config.baseStake,
      martingaleStep: 0,
      sequenceStep: 0,
      initialChoice: "DIGITOVER",
      currentSymbol: "",
      currentContract: "DIGITOVER",
      currentBarrier: 5,
      status: "IDLE",
      nextAction: "W8_TCK",
      currentCategory: null,
      
      currentArrangementIndex: newArrIndex,
      currentArrangement: newArr,
      arrangementProgressIndex: newProgress,
      shufflingSeed: newSeed,
      currentSymbolLosses: 0,
      forceSwapSymbol: false,
      blacklistedPrefixes: blacklistToUse,
      fibonacciIndex: -1,
      usedStartIndices: [],
      strategyLMode: undefined,
      strategyLNoneStickyCount: undefined,
      strategyNActiveSub: undefined,
      strategyNNextSwitchTime: undefined,
      strategyQActiveSub: undefined,
      strategyQRemainingRuns: undefined,
      strategyQLastSub: undefined,
      strategyRSequenceBaseStake: undefined,
      strategyRAccumulatedLoss: undefined,
      strategyRMode: undefined,
      strategyRModeCount: undefined,
    });
    setTicksToWait(0);
    setMartingaleCycles(0);
    setContinuousTradeStartAt(config.enabled ? Date.now() : null);
  }, [config.baseStake, config.enabled]);

  const prevConnectedRef = useRef(connected);
  const prevLoginidRef = useRef(accountInfo?.loginid);

  useEffect(() => {
    const connTransitioned = !prevConnectedRef.current && connected;
    const accountChanged = prevLoginidRef.current !== accountInfo?.loginid;

    if ((connTransitioned || accountChanged) && connected && accountInfo?.loginid) {
      console.log("[AutoTrader] New connection/account detected. Resetting session state and trade history.");
      resetTradeLog();
    }

    prevConnectedRef.current = connected;
    prevLoginidRef.current = accountInfo?.loginid;
  }, [connected, accountInfo?.loginid, resetTradeLog]);

  const sanitizeConfigWithToasts = useCallback((cfg: AutoTraderConfig): AutoTraderConfig => {
    let corrected = { ...cfg };
    
    if (cfg.baseStake < 0.35) {
      corrected.baseStake = 0.35;
      toast.warning("Minimum Base Stake is $0.35", { id: 'min-stake-toast' });
    }
    
    if (cfg.maxMartingaleSteps < 1) {
      corrected.maxMartingaleSteps = 1;
      toast.warning("Minimum Max Step is 1", { id: 'min-step-toast' });
    }

    if (cfg.strategyLBaseStake !== undefined && cfg.strategyLBaseStake < 0.35) {
      corrected.strategyLBaseStake = 0.35;
      toast.warning("Minimum Base Stake L is $0.35", { id: 'min-stake-l-toast' });
    }

    if (cfg.strategyMBaseStake !== undefined && cfg.strategyMBaseStake < 0.35) {
      corrected.strategyMBaseStake = 0.35;
      toast.warning("Minimum Base Stake M is $0.35", { id: 'min-stake-m-toast' });
    }

    if (cfg.strategyOBaseStake !== undefined && cfg.strategyOBaseStake < 0.35) {
      corrected.strategyOBaseStake = 0.35;
      toast.warning("Minimum Base Stake O is $0.35", { id: 'min-stake-o-toast' });
    }

    if (cfg.strategyPBaseStake !== undefined && cfg.strategyPBaseStake < 0.35) {
      corrected.strategyPBaseStake = 0.35;
      toast.warning("Minimum Base Stake P is $0.35", { id: 'min-stake-p-toast' });
    }
    if (cfg.strategyRBaseStake !== undefined && cfg.strategyRBaseStake < 0.35) {
      corrected.strategyRBaseStake = 0.35;
      toast.warning("Minimum Base Stake R is $0.35", { id: 'min-stake-r-toast' });
    }
    
    return corrected;
  }, []);

  const stableSetConfig = useCallback(async (val: AutoTraderConfig | ((prev: AutoTraderConfig) => AutoTraderConfig)) => {
    let nextConfig: AutoTraderConfig;
    
    if (typeof val === 'function') {
      setConfig(prev => {
        nextConfig = sanitizeConfigWithToasts(val(prev));
        
        // Track manual toggle activity
        if (nextConfig.enabled !== prev.enabled) {
          console.log(`%c[AutoTrader] Manual Toggle Detected: enabled=${prev.enabled} -> ${nextConfig.enabled}`, "color: blue; font-weight: bold;");
          lastManualActionRef.current = Date.now();
          enabledRef.current = nextConfig.enabled;
          
          // Immediate persistence for enabled state change
          if (user?.id) {
            supabase.from('user_configs').upsert({ 
              user_id: user.id, 
              config: nextConfig, 
              updated_at: new Date().toISOString() 
            }).then(({ error }) => {
              if (error) console.error("[AutoTrader] Immediate save failed:", error);
              else console.log("[AutoTrader] Immediate save successful.");
            });
          }
        }
        
        return nextConfig;
      });
    } else {
      nextConfig = sanitizeConfigWithToasts(val);
      const prevEnabled = enabledRef.current;
      
      if (nextConfig.enabled !== prevEnabled) {
        console.log(`%c[AutoTrader] Manual Toggle Detected: enabled=${prevEnabled} -> ${nextConfig.enabled}`, "color: blue; font-weight: bold;");
        lastManualActionRef.current = Date.now();
        enabledRef.current = nextConfig.enabled;

        // Immediate persistence for enabled state change
        if (user?.id) {
          supabase.from('user_configs').upsert({ 
            user_id: user.id, 
            config: nextConfig, 
            updated_at: new Date().toISOString() 
          }).then(({ error }) => {
            if (error) console.error("[AutoTrader] Immediate save failed:", error);
            else console.log("[AutoTrader] Immediate save successful.");
          });
        }
      }

      setConfig(nextConfig);
    }
  }, [user?.id, windDownMode, sanitizeConfigWithToasts]);

  const clearBlacklist = useCallback(() => {
    const symbols = [
      "1HZ10V", "1HZ25V", "1HZ50V", "1HZ75V", "1HZ100V",
      "R_10", "R_25", "R_50", "R_75", "R_100",
    ];
    const emptyBlacklist: Record<string, string[]> = {};
    symbols.forEach(s => emptyBlacklist[s] = []);
    emptyBlacklist["global"] = [];

    setSessionState(prev => ({
      ...prev,
      blacklistedPrefixes: emptyBlacklist
    }));
    localStorage.setItem('blacklistedPrefixes', JSON.stringify(emptyBlacklist));
    toast.success("Session blacklist successfully cleared.");
  }, []);

  useEffect(() => {
    if (!config.enabled) return;
    if (sessionState.status === "PENDING") return;

    // Check target profit limit
    if (config.targetProfit !== undefined && config.targetProfit > 0 && sessionPL >= config.targetProfit) {
      console.log(`[AutoTrader] Target Profit reached. Session P/L: $${sessionPL.toFixed(2)}, Target: $${config.targetProfit.toFixed(2)}. Disabling bot.`);
      toast.success(`Target Profit of $${config.targetProfit.toFixed(2)} reached! Disabling bot.`);
      stableSetConfig(prev => ({ ...prev, enabled: false }));
    }

    // Check allowable loss limit
    if (sessionState.status !== "WIN") {
      if (config.initialBalance !== undefined && config.initialBalance > 0 && config.allowableLoss !== undefined && config.allowableLoss > 0 && accountInfo?.balance !== undefined) {
        const stopBalance = config.initialBalance - config.allowableLoss;
        if (accountInfo.balance <= stopBalance) {
          console.log(`[AutoTrader] Allowable Loss limit reached. Balance: $${accountInfo.balance.toFixed(2)}, Stop Balance: $${stopBalance.toFixed(2)} (Initial: $${config.initialBalance.toFixed(2)}, Allowable Loss: $${config.allowableLoss.toFixed(2)}). Disabling bot.`);
          toast.error(`Allowable Loss limit reached! Current Balance: $${accountInfo.balance.toFixed(2)} is at/below the limit of $${stopBalance.toFixed(2)}. Disabling bot.`);
          stableSetConfig(prev => ({ ...prev, enabled: false }));
        }
      }
    }
  }, [config.enabled, config.targetProfit, config.initialBalance, config.allowableLoss, sessionPL, accountInfo?.balance, sessionState.status, stableSetConfig]);

  return {
    config,
    setConfig: stableSetConfig,
    tradeLog,
    setTradeLog,
    dailyPL,
    sessionPL,
    resetSessionPL,
    dailyStats,
    resetTradeLog,
    sessionState,
    ticksToWait,
    handleTradeMessage,
    execute_trade,
    handle_result,
    windDownMode,
    activateWindDown,
    volatilityTracking,
    clearBlacklist,
  };
}

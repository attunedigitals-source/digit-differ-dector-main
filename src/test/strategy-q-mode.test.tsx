// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import * as React from "react";
import { useAutoTrader } from "@/hooks/useAutoTrader";

// Mock Supabase
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: null }),
        }),
      }),
      upsert: () => Promise.resolve({ error: null }),
      insert: () => ({
        select: () => ({
          single: () => Promise.resolve({ data: { id: "test-id" } }),
        }),
      }),
      update: () => ({
        eq: () => Promise.resolve({ error: null }),
      }),
    }),
    auth: {
      getUser: () => Promise.resolve({ data: { user: { id: "test-user-id" } } }),
    },
  },
}));

// Mock Auth hook
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "test-user-id" },
  }),
}));

// Mock toast notifications
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe("useAutoTrader Strategy Q Wrapper Logic", () => {
  const wsRef = { current: { readyState: 1, send: vi.fn(), url: "wss://api.derivws.com" } };
  
  const getSymbolState = (symbol: string) => ({
    symbol,
    digits: Array(50).fill(5),
    tickCount: 50,
    updatedAt: Date.now(),
  });

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("should initialize with a random sub-strategy (A-D) and 20-40 runs on first trade", async () => {
    localStorage.setItem("autoTraderConfig", JSON.stringify({
      enabled: true,
      baseStake: 0.35,
      maxMartingaleSteps: 12,
      cooldownIntervalMinutes: 30,
      strategy: "strategy_q"
    }));

    const accountInfo = { loginid: "CR12345", currency: "USD", token: "test-token", balance: 10.0 };

    const { result } = renderHook(() => 
      useAutoTrader(wsRef as any, accountInfo as any, true, getSymbolState as any)
    );

    await act(async () => {
      await result.current.execute_trade();
    });

    const activeSub = localStorage.getItem("strategyQActiveSub");
    const remainingRuns = localStorage.getItem("strategyQRemainingRuns");
    const lastSub = localStorage.getItem("strategyQLastSub");

    expect(["strategy_a", "strategy_b", "strategy_c", "strategy_d"]).toContain(activeSub);
    expect(activeSub).toBe(lastSub);
    expect(remainingRuns).not.toBeNull();
    const runsNum = parseInt(remainingRuns!, 10);
    expect(runsNum).toBeGreaterThanOrEqual(20);
    expect(runsNum).toBeLessThanOrEqual(40);
  });

  it("should decrement runs count on settled trade", async () => {
    localStorage.setItem("autoTraderConfig", JSON.stringify({
      enabled: true,
      baseStake: 0.35,
      maxMartingaleSteps: 12,
      cooldownIntervalMinutes: 30,
      strategy: "strategy_q"
    }));
    // Pre-populate Strategy Q state
    localStorage.setItem("strategyQActiveSub", "strategy_a");
    localStorage.setItem("strategyQRemainingRuns", "30");
    localStorage.setItem("strategyQLastSub", "strategy_a");
    localStorage.setItem("currentSymbol", "R_10");

    const accountInfo = { loginid: "CR12345", currency: "USD", token: "test-token", balance: 10.0 };

    const { result } = renderHook(() => 
      useAutoTrader(wsRef as any, accountInfo as any, true, getSymbolState as any)
    );

    // Run handle_result directly to simulate a settled trade
    await act(async () => {
      result.current.handle_result(true, "R_10", 0.31, "test-supabase-id");
    });

    const remainingRuns = localStorage.getItem("strategyQRemainingRuns");
    expect(remainingRuns).toBe("29");
  });

  it("should switch to a different sub-strategy and reset counts when remaining runs reach 0", async () => {
    localStorage.setItem("autoTraderConfig", JSON.stringify({
      enabled: true,
      baseStake: 0.35,
      maxMartingaleSteps: 12,
      cooldownIntervalMinutes: 30,
      strategy: "strategy_q"
    }));
    // Pre-populate Strategy Q state with 1 run remaining for strategy_a
    localStorage.setItem("strategyQActiveSub", "strategy_a");
    localStorage.setItem("strategyQRemainingRuns", "1");
    localStorage.setItem("strategyQLastSub", "strategy_a");
    localStorage.setItem("currentSymbol", "R_10");
    localStorage.setItem("martingaleStep", "2");
    localStorage.setItem("sequenceStep", "4");

    const accountInfo = { loginid: "CR12345", currency: "USD", token: "test-token", balance: 10.0 };

    const { result } = renderHook(() => 
      useAutoTrader(wsRef as any, accountInfo as any, true, getSymbolState as any)
    );

    // Settle the trade (decrements remaining runs from 1 to 0, which triggers switch)
    await act(async () => {
      result.current.handle_result(true, "R_10", 0.31, "test-supabase-id");
    });

    const activeSub = localStorage.getItem("strategyQActiveSub");
    const remainingRuns = localStorage.getItem("strategyQRemainingRuns");
    const lastSub = localStorage.getItem("strategyQLastSub");
    const martingaleStep = localStorage.getItem("martingaleStep");
    const sequenceStep = localStorage.getItem("sequenceStep");

    // Must have switched away from strategy_a
    expect(["strategy_b", "strategy_c", "strategy_d"]).toContain(activeSub);
    expect(activeSub).toBe(lastSub);
    expect(activeSub).not.toBe("strategy_a");

    // Remaining runs resets to [20, 40]
    const runsNum = parseInt(remainingRuns!, 10);
    expect(runsNum).toBeGreaterThanOrEqual(20);
    expect(runsNum).toBeLessThanOrEqual(40);

    // Martingale steps and arrangements progress must have reset to 0
    expect(martingaleStep).toBe("0");
    expect(sequenceStep).toBe("0");
  });
});

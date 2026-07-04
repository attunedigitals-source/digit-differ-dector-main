// @vitest-environment jsdom
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useAutoTrader } from "../hooks/useAutoTrader";

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

const mockToast = vi.hoisted(() => ({
  success: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: mockToast,
}));

describe("useAutoTrader Strategy P Mode Logic", () => {
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

  it("should initialize at base stake and trade Over 1 or Under 8 on first trade", async () => {
    localStorage.setItem("autoTraderConfig", JSON.stringify({
      enabled: true,
      baseStake: 1.40,
      maxMartingaleSteps: 12,
      cooldownIntervalMinutes: 30,
      strategy: "strategy_p"
    }));

    const accountInfo = { loginid: "CR12345", currency: "USD", token: "test-token", balance: 100.0 };

    const { result } = renderHook(() => 
      useAutoTrader(wsRef as any, accountInfo as any, true, getSymbolState as any)
    );

    await act(async () => {
      await result.current.execute_trade();
    });

    const contract = result.current.sessionState.currentContract;
    expect(["DIGITOVER", "DIGITUNDER"]).toContain(contract);
    expect([1, 8]).toContain(result.current.sessionState.currentBarrier);
    expect(result.current.sessionState.currentStake).toBe(1.40);
  });

  it("should trade Over 5 or Under 4 on Loss Step 1 with same stake", async () => {
    const accountInfo = { loginid: "CR12345", currency: "USD", token: "test-token", balance: 200.0 };

    localStorage.setItem("autoTraderConfig", JSON.stringify({
      enabled: true,
      baseStake: 1.40,
      maxMartingaleSteps: 12,
      cooldownIntervalMinutes: 30,
      strategy: "strategy_p"
    }));
    localStorage.setItem("currentSymbol", "R_10");
    localStorage.setItem("sessionStatus", "LOSS");
    localStorage.setItem("martingaleStep", "0");
    localStorage.setItem("currentStake", "1.40");

    const { result } = renderHook(() => 
      useAutoTrader(wsRef as any, accountInfo as any, true, getSymbolState as any)
    );

    await act(async () => {
      await result.current.execute_trade();
    });

    expect(["DIGITOVER", "DIGITUNDER"]).toContain(result.current.sessionState.currentContract);
    expect([5, 4]).toContain(result.current.sessionState.currentBarrier);
    expect(result.current.sessionState.currentStake).toBe(1.40);
    expect(result.current.sessionState.martingaleStep).toBe(1);
  });

  it("should calculate recovery stake on Step 2 (to cover accumulated loss + 22% of base stake)", async () => {
    const accountInfo = { loginid: "CR12345", currency: "USD", token: "test-token", balance: 200.0 };

    localStorage.setItem("autoTraderConfig", JSON.stringify({
      enabled: true,
      baseStake: 1.40,
      maxMartingaleSteps: 12,
      cooldownIntervalMinutes: 30,
      strategy: "strategy_p"
    }));
    localStorage.setItem("currentSymbol", "R_10");
    localStorage.setItem("sessionStatus", "LOSS");
    localStorage.setItem("martingaleStep", "1");
    localStorage.setItem("currentStake", "1.40");
    localStorage.setItem("strategyPSequenceBaseStake", "1.40");
    localStorage.setItem("strategyPAccumulatedLoss", "1.40");

    const { result } = renderHook(() => 
      useAutoTrader(wsRef as any, accountInfo as any, true, getSymbolState as any)
    );

    await act(async () => {
      await result.current.execute_trade();
    });

    expect(["DIGITOVER", "DIGITUNDER"]).toContain(result.current.sessionState.currentContract);
    expect([5, 4]).toContain(result.current.sessionState.currentBarrier);
    
    // Step 2 stake = (2.80 + 0.22 * 1.40) / 1.381 = 3.108 / 1.381 = 2.25
    expect(result.current.sessionState.currentStake).toBe(2.25);
    expect(result.current.sessionState.martingaleStep).toBe(2);
  });

  it("should calculate recovery stake on Step 3 (to cover accumulated loss + 22% of base stake)", async () => {
    const accountInfo = { loginid: "CR12345", currency: "USD", token: "test-token", balance: 200.0 };

    localStorage.setItem("autoTraderConfig", JSON.stringify({
      enabled: true,
      baseStake: 1.40,
      maxMartingaleSteps: 12,
      cooldownIntervalMinutes: 30,
      strategy: "strategy_p"
    }));
    localStorage.setItem("currentSymbol", "R_10");
    localStorage.setItem("sessionStatus", "LOSS");
    localStorage.setItem("martingaleStep", "2");
    localStorage.setItem("currentStake", "2.25");
    localStorage.setItem("strategyPSequenceBaseStake", "1.40");
    localStorage.setItem("strategyPAccumulatedLoss", "2.80"); // 1.40 + 1.40 from previous loss steps

    const { result } = renderHook(() => 
      useAutoTrader(wsRef as any, accountInfo as any, true, getSymbolState as any)
    );

    await act(async () => {
      await result.current.execute_trade();
    });

    // Step 3 stake = (2.80 + 2.25 + 0.22 * 1.40) / 1.381 = 5.358 / 1.381 = 3.88
    expect(result.current.sessionState.currentStake).toBe(3.88);
    expect(result.current.sessionState.martingaleStep).toBe(3);
  });

  it("should halve the stake and stay on Over 1 / Under 8 when winning at base stake", async () => {
    localStorage.setItem("autoTraderConfig", JSON.stringify({
      enabled: true,
      baseStake: 1.40,
      maxMartingaleSteps: 12,
      cooldownIntervalMinutes: 30,
      strategy: "strategy_p"
    }));
    localStorage.setItem("currentSymbol", "R_10");
    localStorage.setItem("sessionStatus", "WIN");
    localStorage.setItem("martingaleStep", "0");
    localStorage.setItem("currentStake", "1.40");

    const accountInfo = { loginid: "CR12345", currency: "USD", token: "test-token", balance: 200.0 };

    const { result } = renderHook(() => 
      useAutoTrader(wsRef as any, accountInfo as any, true, getSymbolState as any)
    );

    await act(async () => {
      await result.current.execute_trade();
    });

    expect(["DIGITOVER", "DIGITUNDER"]).toContain(result.current.sessionState.currentContract);
    expect([1, 8]).toContain(result.current.sessionState.currentBarrier);
    expect(result.current.sessionState.currentStake).toBe(0.70);
  });
});

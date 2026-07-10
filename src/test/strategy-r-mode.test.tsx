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

// Mock toast notifications
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe("useAutoTrader Strategy R Mode Logic", () => {
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
      strategy: "strategy_r"
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

  it("should choose from pool of 4 directions on Loss Step 1 with same stake, excluding the previous category", async () => {
    const accountInfo = { loginid: "CR12345", currency: "USD", token: "test-token", balance: 200.0 };

    localStorage.setItem("autoTraderConfig", JSON.stringify({
      enabled: true,
      baseStake: 1.40,
      maxMartingaleSteps: 12,
      cooldownIntervalMinutes: 30,
      strategy: "strategy_r"
    }));
    // Simulate previous trade was a loss under U8 (Under 8)
    localStorage.setItem("currentSymbol", "R_10");
    localStorage.setItem("sessionStatus", "LOSS");
    localStorage.setItem("martingaleStep", "0");
    localStorage.setItem("currentStake", "1.40");
    localStorage.setItem("currentCategory", "under8");

    const { result } = renderHook(() => 
      useAutoTrader(wsRef as any, accountInfo as any, true, getSymbolState as any)
    );

    await act(async () => {
      await result.current.execute_trade();
    });

    // The chosen direction must be in the loss step pool ["over5", "under4", "under5", "over4", "even", "odd"]
    const chosenTrade = result.current.sessionState.currentCategory;
    expect(["over5", "under4", "under5", "over4", "even", "odd"]).toContain(chosenTrade);
    expect(chosenTrade).not.toBe("under8");
    
    // Check markup stake scaling if a special trade was chosen
    if (chosenTrade === "under5" || chosenTrade === "over4" || chosenTrade === "even" || chosenTrade === "odd") {
      expect(result.current.sessionState.currentStake).toBe(Number((1.40 * 1.26).toFixed(2))); // 1.76
    } else {
      expect(result.current.sessionState.currentStake).toBe(1.40);
    }
    
    expect(result.current.sessionState.martingaleStep).toBe(1);
  });

  it("should calculate recovery stake on Step 2 and apply 1.26x markup only if special trade is chosen", async () => {
    const accountInfo = { loginid: "CR12345", currency: "USD", token: "test-token", balance: 200.0 };

    localStorage.setItem("autoTraderConfig", JSON.stringify({
      enabled: true,
      baseStake: 1.40,
      maxMartingaleSteps: 12,
      cooldownIntervalMinutes: 30,
      strategy: "strategy_r"
    }));
    localStorage.setItem("currentSymbol", "R_10");
    localStorage.setItem("sessionStatus", "LOSS");
    localStorage.setItem("martingaleStep", "1");
    localStorage.setItem("currentStake", "1.40");
    localStorage.setItem("strategyRSequenceBaseStake", "1.40");
    localStorage.setItem("strategyRAccumulatedLoss", "1.40");
    localStorage.setItem("currentCategory", "under4");

    const { result } = renderHook(() => 
      useAutoTrader(wsRef as any, accountInfo as any, true, getSymbolState as any)
    );

    await act(async () => {
      await result.current.execute_trade();
    });

    // Dynamic recovery stake:
    // If special contract: (1.40 + 1.40 + 0.22 * 1.40) / 0.90 = 3.108 / 0.90 = 3.45
    // If normal contract: (1.40 + 1.40 + 0.22 * 1.40) / 1.381 = 3.108 / 1.381 = 2.25
    const chosenTrade = result.current.sessionState.currentCategory;
    expect(chosenTrade).not.toBe("under4"); // guarantee no back-to-back repetition of under4
    
    if (chosenTrade === "under5" || chosenTrade === "over4" || chosenTrade === "even" || chosenTrade === "odd") {
      expect(result.current.sessionState.currentStake).toBe(3.45);
    } else {
      expect(result.current.sessionState.currentStake).toBe(2.25);
    }
  });

  it("should reset state and halve the stake on Win", async () => {
    localStorage.setItem("autoTraderConfig", JSON.stringify({
      enabled: true,
      baseStake: 1.40,
      maxMartingaleSteps: 12,
      cooldownIntervalMinutes: 30,
      strategy: "strategy_r"
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

    // Halve base stake: 1.40 / 2 = 0.70
    expect(result.current.sessionState.currentStake).toBe(0.70);
    expect(result.current.sessionState.martingaleStep).toBe(0);
    expect(result.current.sessionState.strategyRSequenceBaseStake).toBeUndefined();
    expect(result.current.sessionState.strategyRAccumulatedLoss).toBeUndefined();
  });
});

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

describe("useAutoTrader Strategy O Mode Logic", () => {
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

  it("should initialize at base stake and trade Over 2 or Under 7 on first trade", async () => {
    localStorage.setItem("autoTraderConfig", JSON.stringify({
      enabled: true,
      baseStake: 1.40,
      maxMartingaleSteps: 12,
      cooldownIntervalMinutes: 30,
      strategy: "strategy_o"
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
    expect([2, 7]).toContain(result.current.sessionState.currentBarrier);
    expect(result.current.sessionState.currentStake).toBe(1.40);
  });

  it("should progression and staking correctly on successive losses", async () => {
    const accountInfo = { loginid: "CR12345", currency: "USD", token: "test-token", balance: 200.0 };

    // 1st Loss: next step is 1, contract should be Over 1 / Under 8, stake should be 6.65 (for base stake 1.40)
    localStorage.setItem("autoTraderConfig", JSON.stringify({
      enabled: true,
      baseStake: 1.40,
      maxMartingaleSteps: 12,
      cooldownIntervalMinutes: 30,
      strategy: "strategy_o"
    }));
    localStorage.setItem("currentSymbol", "R_10");
    localStorage.setItem("sessionStatus", "LOSS");
    localStorage.setItem("martingaleStep", "0");
    localStorage.setItem("currentStake", "1.40");

    let renderResult = renderHook(() => 
      useAutoTrader(wsRef as any, accountInfo as any, true, getSymbolState as any)
    );

    await act(async () => {
      await renderResult.result.current.execute_trade();
    });

    expect(["DIGITOVER", "DIGITUNDER"]).toContain(renderResult.result.current.sessionState.currentContract);
    expect([1, 8]).toContain(renderResult.result.current.sessionState.currentBarrier);
    expect(renderResult.result.current.sessionState.currentStake).toBe(6.65);
    expect(renderResult.result.current.sessionState.martingaleStep).toBe(1);

    // 2nd Loss: next step is 2, contract should be Over 1 / Under 8, stake should be 37.15
    localStorage.setItem("sessionStatus", "LOSS");
    localStorage.setItem("martingaleStep", "1");
    localStorage.setItem("currentStake", "6.65");

    renderResult = renderHook(() => 
      useAutoTrader(wsRef as any, accountInfo as any, true, getSymbolState as any)
    );

    await act(async () => {
      await renderResult.result.current.execute_trade();
    });

    expect(["DIGITOVER", "DIGITUNDER"]).toContain(renderResult.result.current.sessionState.currentContract);
    const barrier = renderResult.result.current.sessionState.currentBarrier;
    expect([1, 8]).toContain(barrier);
    expect(renderResult.result.current.sessionState.currentStake).toBe(37.15);
    expect(renderResult.result.current.sessionState.martingaleStep).toBe(2);
  });

  it("should scale stakes proportionally for different base stakes", async () => {
    const accountInfo = { loginid: "CR12345", currency: "USD", token: "test-token", balance: 200.0 };

    localStorage.setItem("autoTraderConfig", JSON.stringify({
      enabled: true,
      baseStake: 0.35,
      maxMartingaleSteps: 12,
      cooldownIntervalMinutes: 30,
      strategy: "strategy_o"
    }));
    localStorage.setItem("currentSymbol", "R_10");
    localStorage.setItem("sessionStatus", "LOSS");
    localStorage.setItem("martingaleStep", "0");
    localStorage.setItem("currentStake", "0.35");

    const { result } = renderHook(() => 
      useAutoTrader(wsRef as any, accountInfo as any, true, getSymbolState as any)
    );

    await act(async () => {
      await result.current.execute_trade();
    });

    // (0.35 / 1.40) * 6.65 = 1.6625 -> 1.66
    expect(result.current.sessionState.currentStake).toBe(1.66);
  });

  it("should halve the stake and stay on Over 2 / Under 7 when winning at base stake", async () => {
    localStorage.setItem("autoTraderConfig", JSON.stringify({
      enabled: true,
      baseStake: 1.40,
      maxMartingaleSteps: 12,
      cooldownIntervalMinutes: 30,
      strategy: "strategy_o"
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
    expect([2, 7]).toContain(result.current.sessionState.currentBarrier);
    expect(result.current.sessionState.currentStake).toBe(0.7);
  });

  it("should reset to Step 0 and base stake when Step 2 trade is lost", async () => {
    localStorage.setItem("autoTraderConfig", JSON.stringify({
      enabled: true,
      baseStake: 1.40,
      maxMartingaleSteps: 12,
      cooldownIntervalMinutes: 30,
      strategy: "strategy_o"
    }));
    localStorage.setItem("currentSymbol", "R_10");
    localStorage.setItem("sessionStatus", "LOSS");
    localStorage.setItem("martingaleStep", "2"); // We are on Step 2
    localStorage.setItem("currentStake", "37.15");

    const accountInfo = { loginid: "CR12345", currency: "USD", token: "test-token", balance: 200.0 };

    const { result } = renderHook(() => 
      useAutoTrader(wsRef as any, accountInfo as any, true, getSymbolState as any)
    );

    await act(async () => {
      await result.current.execute_trade();
    });

    expect(["DIGITOVER", "DIGITUNDER"]).toContain(result.current.sessionState.currentContract);
    expect(result.current.sessionState.currentStake).toBe(1.40);
    expect(result.current.sessionState.martingaleStep).toBe(0);
  });

  it("should calculate recovery stake from actual first loss stake if it was halved", async () => {
    localStorage.setItem("autoTraderConfig", JSON.stringify({
      enabled: true,
      baseStake: 1.40,
      maxMartingaleSteps: 12,
      cooldownIntervalMinutes: 30,
      strategy: "strategy_o"
    }));
    localStorage.setItem("currentSymbol", "R_10");
    localStorage.setItem("sessionStatus", "LOSS");
    localStorage.setItem("martingaleStep", "0"); 
    localStorage.setItem("currentStake", "0.70"); // Stake was halved to 0.70 on win, then lost!

    const accountInfo = { loginid: "CR12345", currency: "USD", token: "test-token", balance: 200.0 };

    const { result } = renderHook(() => 
      useAutoTrader(wsRef as any, accountInfo as any, true, getSymbolState as any)
    );

    await act(async () => {
      await result.current.execute_trade();
    });

    // Step 1: (0.70 / 1.40) * 6.65 = 3.325 -> 3.33
    expect(result.current.sessionState.currentStake).toBe(3.33);
    expect(result.current.sessionState.martingaleStep).toBe(1);
  });

  it("should continue recovery and clamp stake to 37.15 if step 2 trade lost at 18.58", async () => {
    localStorage.setItem("autoTraderConfig", JSON.stringify({
      enabled: true,
      baseStake: 1.40,
      maxMartingaleSteps: 12,
      cooldownIntervalMinutes: 30,
      strategy: "strategy_o"
    }));
    localStorage.setItem("currentSymbol", "R_10");
    localStorage.setItem("sessionStatus", "LOSS");
    localStorage.setItem("martingaleStep", "2"); 
    localStorage.setItem("currentStake", "18.58"); 
    localStorage.setItem("strategyOSequenceBaseStake", "0.70"); 

    const accountInfo = { loginid: "CR12345", currency: "USD", token: "test-token", balance: 200.0 };

    const { result } = renderHook(() => 
      useAutoTrader(wsRef as any, accountInfo as any, true, getSymbolState as any)
    );

    await act(async () => {
      await result.current.execute_trade();
    });

    // Step 3: Next calculated stake is (0.70 / 1.40) * 207.57 = 103.79.
    // Capped to maxAllowedStake = 37.15.
    expect(["DIGITOVER", "DIGITUNDER"]).toContain(result.current.sessionState.currentContract);
    expect(result.current.sessionState.currentStake).toBe(37.15);
    expect(result.current.sessionState.martingaleStep).toBe(3);
  });
});

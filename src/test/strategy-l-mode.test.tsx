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

describe("useAutoTrader Strategy L Mode Transitions", () => {
  const wsRef = { current: { readyState: 1, send: vi.fn(), url: "wss://api.derivws.com" } };
  
  // We return a fresh timestamp so the symbol check passes freshness filters
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

  it("should initialize None Sticky count to between 3 and 5 when first trade selects none_sticky", async () => {
    // Mock random returns:
    // 1st: 0.7 for getRandomLMode() -> Math.floor(0.7 * 3) = 2 ("none_sticky")
    // 2nd: 0.5 for count -> Math.floor(0.5 * 3) + 3 = 4
    // 3rd: 0.2 for select_random_active_symbol
    const mockRandom = vi.spyOn(Math, "random")
      .mockReturnValueOnce(0.7)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.2);

    localStorage.setItem("autoTraderConfig", JSON.stringify({
      enabled: true,
      baseStake: 0.35,
      maxMartingaleSteps: 12,
      cooldownIntervalMinutes: 30,
      strategy: "strategy_l"
    }));

    const accountInfo = { loginid: "CR12345", currency: "USD", token: "test-token", balance: 10.0 };

    const { result } = renderHook(() => 
      useAutoTrader(wsRef as any, accountInfo as any, true, getSymbolState as any)
    );

    await act(async () => {
      await result.current.execute_trade();
    });

    // Check localStorage values to verify state update
    expect(localStorage.getItem("strategyLMode")).toBe("none_sticky");
    expect(localStorage.getItem("strategyLNoneStickyCount")).toBe("4");
  });

  it("should decrement count and keep none_sticky when count > 1", async () => {
    // Configure the state to already be in none_sticky mode with count 3
    localStorage.setItem("autoTraderConfig", JSON.stringify({
      enabled: true,
      baseStake: 0.35,
      maxMartingaleSteps: 12,
      cooldownIntervalMinutes: 30,
      strategy: "strategy_l"
    }));
    localStorage.setItem("currentSymbol", "R_10");
    localStorage.setItem("sessionStatus", "WIN");
    localStorage.setItem("strategyLMode", "none_sticky");
    localStorage.setItem("strategyLNoneStickyCount", "3");

    // Mock random return for select_random_active_symbol
    vi.spyOn(Math, "random").mockReturnValue(0.1);

    const accountInfo = { loginid: "CR12345", currency: "USD", token: "test-token", balance: 10.0 };

    const { result } = renderHook(() => 
      useAutoTrader(wsRef as any, accountInfo as any, true, getSymbolState as any)
    );

    await act(async () => {
      await result.current.execute_trade();
    });

    // The mode should still be none_sticky, and count should be decremented to 2
    expect(localStorage.getItem("strategyLMode")).toBe("none_sticky");
    expect(localStorage.getItem("strategyLNoneStickyCount")).toBe("2");
  });

  it("should select new random mode and clear count when currentCount is 1", async () => {
    // Configure state to be in none_sticky mode with count 1
    localStorage.setItem("autoTraderConfig", JSON.stringify({
      enabled: true,
      baseStake: 0.35,
      maxMartingaleSteps: 12,
      cooldownIntervalMinutes: 30,
      strategy: "strategy_l"
    }));
    localStorage.setItem("currentSymbol", "R_10");
    localStorage.setItem("sessionStatus", "WIN");
    localStorage.setItem("strategyLMode", "none_sticky");
    localStorage.setItem("strategyLNoneStickyCount", "1");

    // Mock random returns:
    // 1st: 0.4 for getRandomLMode() -> Math.floor(0.4 * 3) = 1 ("win_sticky")
    // 2nd: 0.1 for select_random_active_symbol
    vi.spyOn(Math, "random")
      .mockReturnValueOnce(0.4)
      .mockReturnValueOnce(0.1);

    const accountInfo = { loginid: "CR12345", currency: "USD", token: "test-token", balance: 10.0 };

    const { result } = renderHook(() => 
      useAutoTrader(wsRef as any, accountInfo as any, true, getSymbolState as any)
    );

    await act(async () => {
      await result.current.execute_trade();
    });

    // The mode should transition to win_sticky, and count should be removed
    expect(localStorage.getItem("strategyLMode")).toBe("win_sticky");
    expect(localStorage.getItem("strategyLNoneStickyCount")).toBeNull();
  });
});

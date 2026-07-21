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

    // The chosen direction must be in the loss step pool ["over5", "under4", "under5", "over4", "even", "odd", "rise", "fall"]
    const chosenTrade = result.current.sessionState.currentCategory;
    expect(["over5", "under4", "under5", "over4", "even", "odd", "rise", "fall"]).toContain(chosenTrade);
    expect(chosenTrade).not.toBe("under8");
    
    // Check markup stake scaling if a special trade was chosen
    if (chosenTrade === "under5" || chosenTrade === "over4" || chosenTrade === "even" || chosenTrade === "odd" || chosenTrade === "rise" || chosenTrade === "fall") {
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
    
    if (chosenTrade === "under5" || chosenTrade === "over4" || chosenTrade === "even" || chosenTrade === "odd" || chosenTrade === "rise" || chosenTrade === "fall") {
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

    // 1st halving from base stake 1.40 -> 0.70
    expect(result.current.sessionState.currentStake).toBe(0.70);
    expect(result.current.sessionState.martingaleStep).toBe(0);
    expect(result.current.sessionState.strategyRSequenceBaseStake).toBeUndefined();
    expect(result.current.sessionState.strategyRAccumulatedLoss).toBeUndefined();
  });

  it("should halve stake twice on consecutive wins then reset to base stake on next win to repeat cycle", async () => {
    localStorage.setItem("autoTraderConfig", JSON.stringify({
      enabled: true,
      baseStake: 1.40,
      maxMartingaleSteps: 12,
      cooldownIntervalMinutes: 30,
      strategy: "strategy_r"
    }));
    // Simulate 2nd consecutive win when currentStake is already halved to 0.70
    localStorage.setItem("currentSymbol", "R_10");
    localStorage.setItem("sessionStatus", "WIN");
    localStorage.setItem("martingaleStep", "0");
    localStorage.setItem("currentStake", "0.70");

    const accountInfo = { loginid: "CR12345", currency: "USD", token: "test-token", balance: 200.0 };

    const { result, unmount } = renderHook(() => 
      useAutoTrader(wsRef as any, accountInfo as any, true, getSymbolState as any)
    );

    await act(async () => {
      await result.current.execute_trade();
    });

    // 2nd halving: 0.70 / 2 = 0.35 (max halving reached)
    expect(result.current.sessionState.currentStake).toBe(0.35);
    unmount();

    // Now simulate 3rd consecutive win when currentStake was 0.35 (max halving reached)
    localStorage.setItem("currentSymbol", "R_10");
    localStorage.setItem("sessionStatus", "WIN");
    localStorage.setItem("martingaleStep", "0");
    localStorage.setItem("currentStake", "0.35");

    const { result: res3 } = renderHook(() => 
      useAutoTrader(wsRef as any, accountInfo as any, true, getSymbolState as any)
    );

    await act(async () => {
      await res3.current.execute_trade();
    });

    // After max halving is reached on a win, next stake resets to baseStake 1.40 to repeat the halving process!
    expect(res3.current.sessionState.currentStake).toBe(1.40);
  });

  it("should enforce baseStake / 4 floor for larger base stakes (e.g. 10.00 -> 5.00 -> 2.50 -> 10.00)", async () => {
    localStorage.setItem("autoTraderConfig", JSON.stringify({
      enabled: true,
      baseStake: 10.00,
      maxMartingaleSteps: 12,
      cooldownIntervalMinutes: 30,
      strategy: "strategy_r"
    }));

    // 1st win at 10.00 -> 5.00
    localStorage.setItem("currentSymbol", "R_10");
    localStorage.setItem("sessionStatus", "WIN");
    localStorage.setItem("martingaleStep", "0");
    localStorage.setItem("currentStake", "10.00");

    const accountInfo = { loginid: "CR12345", currency: "USD", token: "test-token", balance: 200.0 };
    const { result, unmount } = renderHook(() => 
      useAutoTrader(wsRef as any, accountInfo as any, true, getSymbolState as any)
    );

    await act(async () => {
      await result.current.execute_trade();
    });

    expect(result.current.sessionState.currentStake).toBe(5.00);
    unmount();

    // 2nd win at 5.00 -> 2.50 (baseStake / 4)
    localStorage.setItem("currentSymbol", "R_10");
    localStorage.setItem("sessionStatus", "WIN");
    localStorage.setItem("martingaleStep", "0");
    localStorage.setItem("currentStake", "5.00");

    const { result: res2, unmount: unmount2 } = renderHook(() => 
      useAutoTrader(wsRef as any, accountInfo as any, true, getSymbolState as any)
    );

    await act(async () => {
      await res2.current.execute_trade();
    });

    expect(res2.current.sessionState.currentStake).toBe(2.50);
    unmount2();

    // 3rd win at 2.50 (1/4 baseStake floor reached) -> resets to 10.00
    localStorage.setItem("currentSymbol", "R_10");
    localStorage.setItem("sessionStatus", "WIN");
    localStorage.setItem("martingaleStep", "0");
    localStorage.setItem("currentStake", "2.50");

    const { result: res3 } = renderHook(() => 
      useAutoTrader(wsRef as any, accountInfo as any, true, getSymbolState as any)
    );

    await act(async () => {
      await res3.current.execute_trade();
    });

    expect(res3.current.sessionState.currentStake).toBe(10.00);
  });

  it("should initialize sticky mode and count when strategyRStickyEnabled is true", async () => {
    localStorage.setItem("autoTraderConfig", JSON.stringify({
      enabled: true,
      baseStake: 1.40,
      maxMartingaleSteps: 12,
      cooldownIntervalMinutes: 30,
      strategy: "strategy_r",
      strategyRStickyEnabled: true
    }));
    localStorage.setItem("shufflingSeed", "12345");

    const accountInfo = { loginid: "CR12345", currency: "USD", token: "test-token", balance: 100.0 };

    // Mock Math.random to return:
    // 1st: 0.1 for getRandomRMode() -> Math.floor(0.1 * 2) = 0 ("win_sticky")
    // 2nd: 0.5 for getRandomRCount("win_sticky") -> Math.floor(0.5 * 4) + 5 = 7
    // 3rd: 0.2 for select_random_active_symbol()
    let randCallCount = 0;
    vi.spyOn(Math, 'random').mockImplementation(() => {
      randCallCount++;
      if (randCallCount === 1) return 0.1; // win_sticky
      if (randCallCount === 2) return 0.5; // count = 7
      return 0.2; // symbol select
    });

    const { result } = renderHook(() => 
      useAutoTrader(wsRef as any, accountInfo as any, true, getSymbolState as any)
    );

    await act(async () => {
      await result.current.execute_trade();
    });

    expect(result.current.sessionState.strategyRMode).toBe("win_sticky");
    expect(result.current.sessionState.strategyRModeCount).toBe(7);
    expect(result.current.sessionState.currentSymbol).toBeDefined();
  });

  it("should decrement count and stay on symbol on win under win_sticky", async () => {
    localStorage.setItem("autoTraderConfig", JSON.stringify({
      enabled: true,
      baseStake: 1.40,
      maxMartingaleSteps: 12,
      cooldownIntervalMinutes: 30,
      strategy: "strategy_r",
      strategyRStickyEnabled: true
    }));
    localStorage.setItem("currentSymbol", "R_10");
    localStorage.setItem("sessionStatus", "WIN");
    localStorage.setItem("strategyRMode", "win_sticky");
    localStorage.setItem("strategyRModeCount", "4");

    const accountInfo = { loginid: "CR12345", currency: "USD", token: "test-token", balance: 100.0 };

    const { result } = renderHook(() => 
      useAutoTrader(wsRef as any, accountInfo as any, true, getSymbolState as any)
    );

    await act(async () => {
      await result.current.execute_trade();
    });

    // It should stay on R_10 and decrement count to 3
    expect(result.current.sessionState.currentSymbol).toBe("R_10");
    expect(result.current.sessionState.strategyRMode).toBe("win_sticky");
    expect(result.current.sessionState.strategyRModeCount).toBe(3);
  });

  it("should immediately re-select mode and count and swap symbol on loss under win_sticky", async () => {
    localStorage.setItem("autoTraderConfig", JSON.stringify({
      enabled: true,
      baseStake: 1.40,
      maxMartingaleSteps: 12,
      cooldownIntervalMinutes: 30,
      strategy: "strategy_r",
      strategyRStickyEnabled: true
    }));
    localStorage.setItem("currentSymbol", "R_10");
    localStorage.setItem("sessionStatus", "LOSS");
    localStorage.setItem("strategyRMode", "win_sticky");
    localStorage.setItem("strategyRModeCount", "4");
    localStorage.setItem("shufflingSeed", "12345");

    const accountInfo = { loginid: "CR12345", currency: "USD", token: "test-token", balance: 100.0 };

    // Mock Math.random for re-selection:
    // 1st: 0.1 -> since win_sticky is excluded, filtered is ["none_sticky", "loss_sticky"]. Index 0 is none_sticky.
    // 2nd: 0.9 -> count = 5 (Math.floor(0.9 * 3) + 3 = 5)
    // 3rd: 0.1 -> symbol selection
    let randCallCount = 0;
    vi.spyOn(Math, 'random').mockImplementation(() => {
      randCallCount++;
      return randCallCount === 1 ? 0.1 : (randCallCount === 2 ? 0.9 : 0.1);
    });

    const { result } = renderHook(() => 
      useAutoTrader(wsRef as any, accountInfo as any, true, getSymbolState as any)
    );

    await act(async () => {
      await result.current.execute_trade();
    });

    expect(result.current.sessionState.currentSymbol).not.toBe("R_10");
    expect(result.current.sessionState.strategyRMode).toBe("none_sticky");
    expect(result.current.sessionState.strategyRModeCount).toBe(5);
  });

  it("should decrement count and stay on symbol on loss under loss_sticky", async () => {
    localStorage.setItem("autoTraderConfig", JSON.stringify({
      enabled: true,
      baseStake: 1.40,
      maxMartingaleSteps: 12,
      cooldownIntervalMinutes: 30,
      strategy: "strategy_r",
      strategyRStickyEnabled: true
    }));
    localStorage.setItem("currentSymbol", "R_10");
    localStorage.setItem("sessionStatus", "LOSS");
    localStorage.setItem("strategyRMode", "loss_sticky");
    localStorage.setItem("strategyRModeCount", "4");

    const accountInfo = { loginid: "CR12345", currency: "USD", token: "test-token", balance: 100.0 };

    const { result } = renderHook(() => 
      useAutoTrader(wsRef as any, accountInfo as any, true, getSymbolState as any)
    );

    await act(async () => {
      await result.current.execute_trade();
    });

    // It should stay on R_10 and decrement count to 3
    expect(result.current.sessionState.currentSymbol).toBe("R_10");
    expect(result.current.sessionState.strategyRMode).toBe("loss_sticky");
    expect(result.current.sessionState.strategyRModeCount).toBe(3);
  });

  it("should immediately re-select mode and count and swap symbol on win under loss_sticky", async () => {
    localStorage.setItem("autoTraderConfig", JSON.stringify({
      enabled: true,
      baseStake: 1.40,
      maxMartingaleSteps: 12,
      cooldownIntervalMinutes: 30,
      strategy: "strategy_r",
      strategyRStickyEnabled: true
    }));
    localStorage.setItem("currentSymbol", "R_10");
    localStorage.setItem("sessionStatus", "WIN");
    localStorage.setItem("strategyRMode", "loss_sticky");
    localStorage.setItem("strategyRModeCount", "4");
    localStorage.setItem("shufflingSeed", "12345");

    const accountInfo = { loginid: "CR12345", currency: "USD", token: "test-token", balance: 100.0 };

    // Mock Math.random for re-selection:
    // 1st: 0.5 -> since loss_sticky is excluded, filtered is ["win_sticky", "none_sticky"]. Math.floor(0.5 * 2) = 1 (none_sticky)
    // 2nd: 0.9 -> count = 5 (Math.floor(0.9 * 3) + 3 = 5)
    // 3rd: 0.1 -> symbol selection
    let randCallCount = 0;
    vi.spyOn(Math, 'random').mockImplementation(() => {
      randCallCount++;
      return randCallCount === 1 ? 0.5 : (randCallCount === 2 ? 0.9 : 0.1);
    });

    const { result } = renderHook(() => 
      useAutoTrader(wsRef as any, accountInfo as any, true, getSymbolState as any)
    );

    await act(async () => {
      await result.current.execute_trade();
    });

    expect(result.current.sessionState.currentSymbol).not.toBe("R_10");
    expect(result.current.sessionState.strategyRMode).toBe("none_sticky");
    expect(result.current.sessionState.strategyRModeCount).toBe(5);
  });

  it("should never select the same sticky mode back-to-back", async () => {
    localStorage.setItem("autoTraderConfig", JSON.stringify({
      enabled: true,
      baseStake: 1.40,
      maxMartingaleSteps: 12,
      cooldownIntervalMinutes: 30,
      strategy: "strategy_r",
      strategyRStickyEnabled: true
    }));
    localStorage.setItem("currentSymbol", "R_10");
    localStorage.setItem("sessionStatus", "LOSS");
    localStorage.setItem("strategyRMode", "win_sticky");
    localStorage.setItem("strategyRModeCount", "4");
    localStorage.setItem("shufflingSeed", "12345");

    const accountInfo = { loginid: "CR12345", currency: "USD", token: "test-token", balance: 100.0 };

    // Mock Math.random for re-selection:
    // We start in win_sticky and transition. The pool is filtered to exclude win_sticky, leaving ["none_sticky", "loss_sticky"].
    // 1st: 0.9 -> Math.floor(0.9 * 2) = 1 ("loss_sticky")
    // 2nd: 0.9 -> count = 5
    // 3rd: 0.1 -> symbol selection
    let randCallCount = 0;
    vi.spyOn(Math, 'random').mockImplementation(() => {
      randCallCount++;
      return randCallCount === 1 ? 0.9 : (randCallCount === 2 ? 0.9 : 0.1);
    });

    const { result } = renderHook(() => 
      useAutoTrader(wsRef as any, accountInfo as any, true, getSymbolState as any)
    );

    await act(async () => {
      await result.current.execute_trade();
    });

    expect(result.current.sessionState.strategyRMode).not.toBe("win_sticky");
    expect(result.current.sessionState.strategyRMode).toBe("loss_sticky");
  });

  it("should set win_sticky count within range (5-8)", async () => {
    localStorage.setItem("autoTraderConfig", JSON.stringify({
      enabled: true,
      baseStake: 1.40,
      maxMartingaleSteps: 12,
      cooldownIntervalMinutes: 30,
      strategy: "strategy_r",
      strategyRStickyEnabled: true
    }));

    let randCount = 0;
    vi.spyOn(Math, 'random').mockImplementation(() => {
      randCount++;
      if (randCount === 1) return 0.1; // win_sticky
      if (randCount === 2) return 0.0; // min bound -> Math.floor(0 * 4) + 5 = 5
      return 0.1;
    });

    const accountInfo = { loginid: "CR12345", currency: "USD", token: "test-token", balance: 100.0 };
    const { result } = renderHook(() => 
      useAutoTrader(wsRef as any, accountInfo as any, true, getSymbolState as any)
    );

    await act(async () => {
      await result.current.execute_trade();
    });

    expect(result.current.sessionState.strategyRMode).toBe("win_sticky");
    expect(result.current.sessionState.strategyRModeCount).toBe(5);
  });

  it("should set loss_sticky count within range (2-4)", async () => {
    localStorage.setItem("autoTraderConfig", JSON.stringify({
      enabled: true,
      baseStake: 1.40,
      maxMartingaleSteps: 12,
      cooldownIntervalMinutes: 30,
      strategy: "strategy_r",
      strategyRStickyEnabled: true
    }));

    // Math.random() = 0.999 -> Math.floor(0.999 * 3) = 2 ("loss_sticky")
    // Math.random() = 0.999 -> Math.floor(0.999 * 3) + 2 = 4 (count = 4)
    vi.spyOn(Math, 'random').mockReturnValue(0.999);

    const accountInfo = { loginid: "CR12345", currency: "USD", token: "test-token", balance: 100.0 };
    const { result } = renderHook(() => 
      useAutoTrader(wsRef as any, accountInfo as any, true, getSymbolState as any)
    );

    await act(async () => {
      await result.current.execute_trade();
    });

    expect(result.current.sessionState.strategyRMode).toBe("loss_sticky");
    expect(result.current.sessionState.strategyRModeCount).toBe(4);
  });

  it("should set none_sticky count within range (3-5)", async () => {
    localStorage.clear();
    localStorage.setItem("autoTraderConfig", JSON.stringify({
      enabled: true,
      baseStake: 1.40,
      maxMartingaleSteps: 12,
      cooldownIntervalMinutes: 30,
      strategy: "strategy_r",
      strategyRStickyEnabled: true
    }));
    // Explicitly set previous mode as win_sticky so filtered pool is ["none_sticky", "loss_sticky"]
    localStorage.setItem("strategyRMode", "win_sticky");

    let randCount = 0;
    vi.spyOn(Math, 'random').mockImplementation(() => {
      randCount++;
      if (randCount === 1) return 0.1; // index 0 in ["none_sticky", "loss_sticky"] -> none_sticky
      return 0.0; // min bound -> Math.floor(0 * 3) + 3 = 3
    });

    const accountInfo = { loginid: "CR12345", currency: "USD", token: "test-token", balance: 100.0 };
    const { result } = renderHook(() => 
      useAutoTrader(wsRef as any, accountInfo as any, true, getSymbolState as any)
    );

    await act(async () => {
      await result.current.execute_trade();
    });

    expect(result.current.sessionState.strategyRMode).toBe("none_sticky");
    expect(result.current.sessionState.strategyRModeCount).toBe(3);
  });
});

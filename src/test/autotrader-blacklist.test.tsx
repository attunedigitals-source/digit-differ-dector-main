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

// Mock toast notifications to avoid DOM issues
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe("useAutoTrader Strategy K Blacklist win-recovery integration", () => {
  const wsRef = { current: null };
  const accountInfo = { loginid: "CR12345", currency: "USD", token: "test-token" };
  const getSymbolState = () => undefined;

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("does not add to blacklist on loss under Strategy K", () => {
    localStorage.setItem("autoTraderConfig", JSON.stringify({
      enabled: true,
      baseStake: 0.35,
      maxMartingaleSteps: 12,
      cooldownIntervalMinutes: 30,
      strategy: "strategy_k"
    }));
    
    // Simulate a run that is currently at 4 losses, and we are handling the 5th loss
    localStorage.setItem("currentLossSequence", JSON.stringify(["U5", "U4", "EV", "RISE"]));
    localStorage.setItem("martingaleStep", "4");
    localStorage.setItem("sequenceStep", "4");
    localStorage.setItem("currentArrangement", JSON.stringify(["U5", "U4", "EV", "RISE", "U4", "FALL", "O4", "OD"]));
    localStorage.setItem("currentArrangementIndex", "1");
    localStorage.setItem("shufflingSeed", "12345");

    const { result } = renderHook(() => 
      useAutoTrader(wsRef as any, accountInfo as any, true, getSymbolState)
    );

    // Verify initial state
    expect(result.current.sessionState.currentLossSequence).toEqual(["U5", "U4", "EV", "RISE"]);
    expect(result.current.sessionState.blacklistedPrefixes?.["global"]).toEqual([]);

    // Simulate a lost contract proposal update
    act(() => {
      result.current.handleTradeMessage({
        msg_type: "proposal_open_contract",
        proposal_open_contract: {
          contract_id: 10001,
          status: "lost",
          profit: -0.35,
          is_sold: 1,
          underlying: "1HZ10V",
        }
      });
    });

    // Check that loss sequence is updated, but it is NOT added to the global blacklist on loss
    expect(result.current.sessionState.currentLossSequence).toEqual(["U5", "U4", "EV", "RISE", "U4"]);
    expect(result.current.sessionState.blacklistedPrefixes?.["global"]).toEqual([]);
  });

  it("adds to global blacklist only after a win following 5+ consecutive losses", () => {
    localStorage.setItem("autoTraderConfig", JSON.stringify({
      enabled: true,
      baseStake: 0.35,
      maxMartingaleSteps: 12,
      cooldownIntervalMinutes: 30,
      strategy: "strategy_k"
    }));
    
    // Simulate 5 consecutive losses
    localStorage.setItem("currentLossSequence", JSON.stringify(["U5", "U4", "EV", "RISE", "FALL"]));
    localStorage.setItem("martingaleStep", "5");
    localStorage.setItem("sequenceStep", "5");

    const { result } = renderHook(() => 
      useAutoTrader(wsRef as any, accountInfo as any, true, getSymbolState)
    );

    expect(result.current.sessionState.currentLossSequence).toEqual(["U5", "U4", "EV", "RISE", "FALL"]);

    // Simulate a won contract proposal update (recovery win)
    act(() => {
      result.current.handleTradeMessage({
        msg_type: "proposal_open_contract",
        proposal_open_contract: {
          contract_id: 10002,
          status: "won",
          profit: 0.5,
          is_sold: 1,
          underlying: "1HZ10V",
        }
      });
    });

    // Check that loss sequence is reset
    expect(result.current.sessionState.currentLossSequence).toEqual([]);
    // Check that the prefix was successfully added to the global blacklist
    expect(result.current.sessionState.blacklistedPrefixes?.["global"]).toContain("U5,U4,EV,RISE,FALL");
  });

  it("does not add to blacklist if won after fewer than 5 consecutive losses", () => {
    localStorage.setItem("autoTraderConfig", JSON.stringify({
      enabled: true,
      baseStake: 0.35,
      maxMartingaleSteps: 12,
      cooldownIntervalMinutes: 30,
      strategy: "strategy_k"
    }));
    
    // Simulate only 3 consecutive losses
    localStorage.setItem("currentLossSequence", JSON.stringify(["U5", "U4", "EV"]));
    localStorage.setItem("martingaleStep", "3");
    localStorage.setItem("sequenceStep", "3");

    const { result } = renderHook(() => 
      useAutoTrader(wsRef as any, accountInfo as any, true, getSymbolState)
    );

    expect(result.current.sessionState.currentLossSequence).toEqual(["U5", "U4", "EV"]);

    act(() => {
      result.current.handleTradeMessage({
        msg_type: "proposal_open_contract",
        proposal_open_contract: {
          contract_id: 10003,
          status: "won",
          profit: 0.5,
          is_sold: 1,
          underlying: "1HZ10V",
        }
      });
    });

    expect(result.current.sessionState.currentLossSequence).toEqual([]);
    expect(result.current.sessionState.blacklistedPrefixes?.["global"]).toEqual([]);
  });
});

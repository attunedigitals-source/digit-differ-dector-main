// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import * as React from "react";
import { useAutoTrader } from "@/hooks/useAutoTrader";
import { toast } from "sonner";

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

describe("useAutoTrader Balance Check", () => {
  const wsRef = { current: { readyState: 1, send: vi.fn(), url: "wss://api.derivws.com" } };
  const getSymbolState = () => ({
    symbol: "R_10",
    digits: Array(50).fill(5),
    tickCount: 50,
    updatedAt: Date.now(),
  });

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("should stop execution and disable automation when balance is lower than stake", async () => {
    localStorage.setItem("autoTraderConfig", JSON.stringify({
      enabled: true,
      baseStake: 5.0,
      maxMartingaleSteps: 12,
      cooldownIntervalMinutes: 30,
      strategy: "alternating"
    }));

    // Account with 2.5 USD balance, which is lower than the baseStake of 5.0
    const accountInfo = { loginid: "CR12345", currency: "USD", token: "test-token", balance: 2.5 };

    const { result } = renderHook(() => 
      useAutoTrader(wsRef as any, accountInfo as any, true, getSymbolState as any)
    );

    // With our proactive balance check useEffect, the bot will be disabled immediately on mount
    expect(result.current.config.enabled).toBe(false);

    // Check that toast.error was called with insufficient balance message
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining("Insufficient balance. Available: $2.50, Required stake: $5.00. AI-automation stopped.")
    );

    // Check that no message was sent on wsRef (mock wsRef.current.send should not be called for proposal since we returned early)
    expect(wsRef.current.send).not.toHaveBeenCalled();
  });

  it("should allow execution when balance is sufficient", async () => {
    localStorage.setItem("autoTraderConfig", JSON.stringify({
      enabled: true,
      baseStake: 1.0,
      maxMartingaleSteps: 12,
      cooldownIntervalMinutes: 30,
      strategy: "alternating"
    }));

    // Account with 10.0 USD balance, which is higher than the baseStake of 1.0
    const accountInfo = { loginid: "CR12345", currency: "USD", token: "test-token", balance: 10.0 };

    const { result } = renderHook(() => 
      useAutoTrader(wsRef as any, accountInfo as any, true, getSymbolState as any)
    );

    expect(result.current.config.enabled).toBe(true);

    await act(async () => {
      await result.current.execute_trade();
    });

    // Config should still be enabled
    expect(result.current.config.enabled).toBe(true);

    // toast.error should not have been called
    expect(toast.error).not.toHaveBeenCalled();

    // Check that proposal request was sent on WebSocket
    expect(wsRef.current.send).toHaveBeenCalled();
  });
});

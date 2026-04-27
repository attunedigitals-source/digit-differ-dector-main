// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/pkce", () => ({
  generateCodeVerifier: vi.fn(() => "mock-verifier"),
  generateCodeChallenge: vi.fn(async () => "mock-challenge"),
  generateState: vi.fn(() => "mock-state"),
}));

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: invokeMock,
    },
  },
}));

import {
  buildDerivAuthorizeUrl,
  DERIV_SESSION_KEYS,
  exchangeDerivAuthorizationCode,
  validateOAuthState,
  getCodeVerifier,
  clearDerivOAuthSession,
  derivApiFetch,
} from "@/lib/deriv-oauth";

describe("deriv-oauth", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv("VITE_DERIV_APP_ID", "12345");
    invokeMock.mockReset();
  });

  it("builds Deriv authorize URL with PKCE and stores verifier/state", async () => {
    const url = new URL(await buildDerivAuthorizeUrl());

    expect(url.origin + url.pathname).toBe("https://auth.deriv.com/oauth2/auth");
    expect(url.searchParams.get("app_id")).toBe("12345");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:3000/api/auth/deriv/callback");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBe("mock-challenge");
    expect(url.searchParams.get("state")).toBe("mock-state");
    expect(url.searchParams.get("l")).toBeNull();
    expect(url.searchParams.get("scope")).toBeNull();

    expect(sessionStorage.getItem(DERIV_SESSION_KEYS.verifier)).toBe("mock-verifier");
    expect(sessionStorage.getItem(DERIV_SESSION_KEYS.state)).toBe("mock-state");
  });

  it("validates state and exposes verifier", () => {
    sessionStorage.setItem(DERIV_SESSION_KEYS.state, "abc");
    sessionStorage.setItem(DERIV_SESSION_KEYS.verifier, "verifier-1");

    expect(() => validateOAuthState("abc")).not.toThrow();
    expect(getCodeVerifier()).toBe("verifier-1");
    expect(() => validateOAuthState("wrong")).toThrow("OAuth state validation failed.");
  });

  it("exchanges auth code through backend function and returns access token", async () => {
    invokeMock.mockResolvedValue({
      data: { access_token: "token-1" },
      error: null,
    });

    const token = await exchangeDerivAuthorizationCode("code-1", "verifier-1");

    expect(token).toBe("token-1");
    expect(invokeMock).toHaveBeenCalledWith("deriv-oauth-token", {
      body: {
        code: "code-1",
        codeVerifier: "verifier-1",
        redirectUri: "http://localhost:3000/api/auth/deriv/callback",
      },
    });
  });

  it("adds bearer token for API calls", async () => {
    const mockFetch = vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true } as Response);

    await derivApiFetch("https://api.example.com/me", "abc123", { method: "GET" });

    const [, options] = mockFetch.mock.calls[0];
    const headers = new Headers(options?.headers);
    expect(headers.get("Authorization")).toBe("Bearer abc123");
  });

  it("clears oauth session values", () => {
    sessionStorage.setItem(DERIV_SESSION_KEYS.state, "abc");
    sessionStorage.setItem(DERIV_SESSION_KEYS.verifier, "v");

    clearDerivOAuthSession();

    expect(sessionStorage.getItem(DERIV_SESSION_KEYS.state)).toBeNull();
    expect(sessionStorage.getItem(DERIV_SESSION_KEYS.verifier)).toBeNull();
  });
});

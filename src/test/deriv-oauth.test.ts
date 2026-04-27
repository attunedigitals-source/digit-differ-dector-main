// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/pkce", () => ({
  generateCodeVerifier: vi.fn(() => "mock-verifier"),
  generateCodeChallenge: vi.fn(async () => "mock-challenge"),
  generateState: vi.fn(() => "mock-state"),
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
  });

  it("builds Deriv authorize URL with PKCE and stores verifier/state", async () => {
    const url = new URL(await buildDerivAuthorizeUrl());

    expect(url.origin + url.pathname).toBe("https://oauth.deriv.com/oauth2/authorize");
    expect(url.searchParams.get("app_id")).toBe("12345");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBe("mock-challenge");
    expect(url.searchParams.get("state")).toBe("mock-state");

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

  it("exchanges auth code and returns access token", async () => {
    const mockFetch = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "token-1" }),
    } as Response);

    const token = await exchangeDerivAuthorizationCode("code-1", "verifier-1");

    expect(token).toBe("token-1");
    expect(mockFetch).toHaveBeenCalledOnce();
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

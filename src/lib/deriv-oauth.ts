// Deriv OAuth helpers — V2 PKCE flow

import { generatePKCE, storePKCEData } from "./pkce";

export const DERIV_APP_ID = "33cLEpErKviQMzxGeRncH";

// ---- Types ----

export type DerivAccount = {
  loginid: string;
  currency: string;
  is_virtual: boolean;
  balance?: number;
  /** Legacy token (V1 OAuth) — undefined in the new PKCE flow */
  token?: string;
};

export type DerivSession = {
  access_token: string;
  expires_at: number; // epoch ms
  accounts: DerivAccount[];
  active_loginid: string;
};

// ---- Storage Keys ----

const SESSION_KEY = "deriv.session";
const LEGACY_ACCOUNTS_KEY = "deriv.accounts";
const LEGACY_ACTIVE_KEY = "deriv.activeLoginid";

// ---- OAuth URL Builder ----

/**
 * Initiates the Deriv OAuth flow using PKCE.
 * Returns the authorization URL to redirect the user to.
 */
export async function getOAuthUrl(action: "login" | "signup" = "login"): Promise<string> {
  const redirectUri =
    typeof window !== "undefined"
      ? `${window.location.origin}/auth/callback`
      : "https://digitbotpro.com/auth/callback";

  const { codeVerifier, codeChallenge, state } = await generatePKCE();
  storePKCEData(codeVerifier, state);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: DERIV_APP_ID,
    redirect_uri: redirectUri,
    scope: "trade account_manage",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    app_id: "117322",
  });

  if (action === "signup") {
    params.append("prompt", "registration");
  }

  return `https://auth.deriv.com/oauth2/auth?${params.toString()}`;
}

// ---- Session Storage (V2 PKCE Flow) ----

export function saveSession(session: DerivSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function getSession(): DerivSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as DerivSession) : null;
  } catch {
    return null;
  }
}

export function getAccessToken(): string | null {
  const activeAccount = getActiveAccount();
  if (activeAccount?.token) return activeAccount.token;
  return getSession()?.access_token ?? null;
}

export function getAccounts(): DerivAccount[] {
  const session = getSession();
  if (session) return session.accounts;

  // Legacy fallback
  try {
    const raw = localStorage.getItem(LEGACY_ACCOUNTS_KEY);
    return raw ? (JSON.parse(raw) as DerivAccount[]) : [];
  } catch {
    return [];
  }
}

export function getActiveAccount(): DerivAccount | null {
  const session = getSession();
  if (session) {
    const foundActive = session.accounts.find((a) => a.loginid === session.active_loginid);
    if (foundActive) return foundActive;

    const demo = session.accounts.find((a) => a.is_virtual);
    if (demo) return demo;

    return session.accounts[0] ?? null;
  }

  // Legacy fallback
  const accs = getAccounts();
  const active = localStorage.getItem(LEGACY_ACTIVE_KEY);
  const foundActive = accs.find((a) => a.loginid === active);
  if (foundActive) return foundActive;

  const demo = accs.find((a) => a.is_virtual);
  if (demo) return demo;

  return accs[0] ?? null;
}

export function setActiveAccount(loginid: string): void {
  const session = getSession();
  if (session) {
    session.active_loginid = loginid;
    saveSession(session);
  } else {
    localStorage.setItem(LEGACY_ACTIVE_KEY, loginid);
  }
}

export function clearDerivAuth(): void {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(LEGACY_ACCOUNTS_KEY);
  localStorage.removeItem(LEGACY_ACTIVE_KEY);
}

// ---- Legacy helpers (kept for backward compat) ----

/** @deprecated — only used by legacy V1 callback parsing */
export function parseOAuthCallback(search: string): DerivAccount[] {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const accounts: DerivAccount[] = [];
  let i = 1;
  while (params.get(`token${i}`)) {
    accounts.push({
      loginid: params.get(`acct${i}`) || `acc${i}`,
      currency: params.get(`cur${i}`) || "USD",
      is_virtual: false,
      token: params.get(`token${i}`) ?? undefined,
    });
    i++;
  }
  return accounts;
}

/** @deprecated */
export function saveAccounts(accounts: DerivAccount[]): void {
  localStorage.setItem(LEGACY_ACCOUNTS_KEY, JSON.stringify(accounts));
  if (accounts[0]) {
    localStorage.setItem(LEGACY_ACTIVE_KEY, accounts[0].loginid);
  }
}

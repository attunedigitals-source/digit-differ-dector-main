import { generateCodeChallenge, generateCodeVerifier, generateState } from "@/lib/pkce";

const DERIV_OAUTH_BASE_URL = "https://oauth.deriv.com/oauth2";
const OAUTH_AUTHORIZE_URL = `${DERIV_OAUTH_BASE_URL}/authorize`;
const OAUTH_TOKEN_URL = `${DERIV_OAUTH_BASE_URL}/token`;

export const DERIV_SESSION_KEYS = {
  verifier: "deriv_code_verifier",
  state: "deriv_oauth_state",
} as const;

export interface DerivTokenResponse {
  access_token?: string;
  token1?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  [key: string]: unknown;
}

export const getDerivRedirectUri = () =>
  import.meta.env.VITE_DERIV_REDIRECT_URL || `${window.location.origin}/api/auth/deriv/callback`;

export const buildDerivAuthorizeUrl = async (): Promise<string> => {
  const appId = import.meta.env.VITE_DERIV_APP_ID;

  if (!appId) {
    throw new Error("Deriv App ID not configured.");
  }

  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  const state = generateState();

  sessionStorage.setItem(DERIV_SESSION_KEYS.verifier, verifier);
  sessionStorage.setItem(DERIV_SESSION_KEYS.state, state);

  const authUrl = new URL(OAUTH_AUTHORIZE_URL);
  authUrl.searchParams.set("app_id", appId);
  authUrl.searchParams.set("l", "EN");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", getDerivRedirectUri());
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("state", state);

  const scopes = import.meta.env.VITE_DERIV_OAUTH_SCOPES;
  if (scopes) {
    authUrl.searchParams.set("scope", scopes);
  }

  return authUrl.toString();
};

export const startDerivOAuth = async () => {
  window.location.href = await buildDerivAuthorizeUrl();
};

export const validateOAuthState = (returnedState: string | null): void => {
  const storedState = sessionStorage.getItem(DERIV_SESSION_KEYS.state);

  if (!returnedState || returnedState !== storedState) {
    throw new Error("OAuth state validation failed.");
  }
};

export const getCodeVerifier = (): string => {
  const verifier = sessionStorage.getItem(DERIV_SESSION_KEYS.verifier);

  if (!verifier) {
    throw new Error("Missing PKCE code verifier.");
  }

  return verifier;
};

export const clearDerivOAuthSession = (): void => {
  sessionStorage.removeItem(DERIV_SESSION_KEYS.verifier);
  sessionStorage.removeItem(DERIV_SESSION_KEYS.state);
};

export const exchangeDerivAuthorizationCode = async (code: string, codeVerifier: string): Promise<string> => {
  const appId = import.meta.env.VITE_DERIV_APP_ID;
  if (!appId) {
    throw new Error("Deriv App ID not configured.");
  }

  const response = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: appId,
      redirect_uri: getDerivRedirectUri(),
      code,
      code_verifier: codeVerifier,
    }),
  });

  const data = (await response.json()) as DerivTokenResponse & {
    error?: string;
    error_description?: string;
  };

  if (!response.ok) {
    throw new Error(data.error_description || data.error || "Failed to exchange Deriv OAuth code.");
  }

  const token = data.access_token || data.token1;
  if (!token) {
    throw new Error("Deriv access token is missing from token exchange response.");
  }

  return token;
};

export const derivApiFetch = async (
  endpoint: string,
  accessToken: string,
  init: RequestInit = {}
): Promise<Response> => {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);

  return fetch(endpoint, {
    ...init,
    headers,
  });
};

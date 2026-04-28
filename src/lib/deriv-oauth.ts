import { generateCodeChallenge, generateCodeVerifier, generateState } from "@/lib/pkce";
import { supabase } from "@/integrations/supabase/client";
import { CLIENT_ID, REDIRECT_URI } from "@/config/deriv";

const OAUTH_AUTHORIZE_URL = "https://oauth.deriv.com/oauth2/authorize";
const OAUTH_TOKEN_URL = "https://oauth.deriv.com/oauth2/token";

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
  account_id?: string;
  loginid?: string;
  [key: string]: unknown;
}

export const getDerivRedirectUri = () => REDIRECT_URI;

export const buildDerivAuthorizeUrl = async (): Promise<string> => {
  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  const state = generateState();

  sessionStorage.setItem(DERIV_SESSION_KEYS.verifier, verifier);
  sessionStorage.setItem(DERIV_SESSION_KEYS.state, state);

  const authUrl = new URL(OAUTH_AUTHORIZE_URL);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("app_id", CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.set("scope", "trade account_manage");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");

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

export const exchangeDerivAuthorizationCode = async (code: string, codeVerifier: string): Promise<DerivTokenResponse> => {
  // Use public token endpoint directly since PKCE doesn't require client_secret
  const response = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Deriv-App-ID": CLIENT_ID,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",

      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      code: code,
      code_verifier: codeVerifier,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error_description || errorData.error || "Failed to exchange Deriv OAuth code.");
  }

  return response.json();
};

export const derivApiFetch = async (
  endpoint: string,
  accessToken: string,
  init: RequestInit = {}
): Promise<Response> => {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);
  headers.set("Deriv-App-ID", CLIENT_ID);
  headers.set("Content-Type", "application/json");

  return fetch(endpoint, {
    ...init,
    headers,
  });
};



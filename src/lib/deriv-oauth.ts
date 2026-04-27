import { generateCodeChallenge, generateCodeVerifier, generateState } from "@/lib/pkce";

const OAUTH_AUTHORIZE_URL = "https://oauth.deriv.com/oauth2/authorize";

export const getDerivRedirectUri = () =>
  import.meta.env.VITE_DERIV_REDIRECT_URL || `${window.location.origin}/api/auth/deriv/callback`;

export const startDerivOAuth = async () => {
  const appId = import.meta.env.VITE_DERIV_APP_ID;

  if (!appId) {
    throw new Error("Deriv App ID not configured.");
  }

  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  const state = generateState();

  sessionStorage.setItem("deriv_code_verifier", verifier);
  sessionStorage.setItem("deriv_oauth_state", state);

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

  window.location.href = authUrl.toString();
};
